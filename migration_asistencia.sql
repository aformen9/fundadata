-- ============================================================
-- MIGRATION: Asistencia + Tutores + Notificaciones
-- Ejecutar este archivo en Supabase SQL Editor
-- ============================================================

-- Tabla de tutores/referentes del niño
CREATE TABLE IF NOT EXISTS public.tutor (
  id           BIGSERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL,
  telefono     TEXT NOT NULL,
  dni_nino     TEXT NOT NULL REFERENCES public.persona(dni) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tutor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_policy ON public.tutor;
CREATE POLICY tutor_policy ON public.tutor
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'fundacion' OR
    (public.get_my_role() = 'operador' AND EXISTS (
      SELECT 1 FROM public.vinculo v
      WHERE v.dni = tutor.dni_nino AND v.dispositivo_id = public.get_my_device_id()
    ))
  );

-- Tabla de asistencia diaria
CREATE TABLE IF NOT EXISTS public.registro_asistencia (
  id             BIGSERIAL PRIMARY KEY,
  dni            TEXT NOT NULL REFERENCES public.persona(dni) ON DELETE CASCADE,
  dispositivo_id INT NOT NULL REFERENCES public.dispositivo(id),
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  presente       BOOLEAN NOT NULL,
  registrado_por UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dni, dispositivo_id, fecha)
);

ALTER TABLE public.registro_asistencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registro_asistencia_policy ON public.registro_asistencia;
CREATE POLICY registro_asistencia_policy ON public.registro_asistencia
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'fundacion' OR
    (public.get_my_role() = 'operador' AND dispositivo_id = public.get_my_device_id())
  );

-- Tabla de log de notificaciones enviadas
CREATE TABLE IF NOT EXISTS public.notificacion_log (
  id             BIGSERIAL PRIMARY KEY,
  dni            TEXT NOT NULL,
  dispositivo_id INT NOT NULL,
  fecha_envio    DATE NOT NULL DEFAULT CURRENT_DATE,
  mensaje        TEXT,
  enviado        BOOLEAN DEFAULT false,
  error_msg      TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Función que detecta niños con 2 días consecutivos de falta (para la Edge Function)
CREATE OR REPLACE FUNCTION public.get_consecutive_absences(p_today DATE, p_yesterday DATE)
RETURNS TABLE(
  dni TEXT,
  nombre TEXT,
  apellido TEXT,
  dispositivo_id INT,
  tutor_nombre TEXT,
  telefono TEXT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT
    ra.dni,
    p.nombre,
    p.apellido,
    ra.dispositivo_id,
    t.nombre AS tutor_nombre,
    t.telefono
  FROM registro_asistencia ra
  JOIN persona p ON p.dni = ra.dni
  JOIN tutor t ON t.dni_nino = ra.dni
  WHERE ra.presente = false
    AND ra.fecha = p_today
    AND EXISTS (
      SELECT 1 FROM registro_asistencia ra2
      WHERE ra2.dni = ra.dni
        AND ra2.dispositivo_id = ra.dispositivo_id
        AND ra2.fecha = p_yesterday
        AND ra2.presente = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM notificacion_log nl
      WHERE nl.dni = ra.dni
        AND nl.dispositivo_id = ra.dispositivo_id
        AND nl.fecha_envio = p_today
        AND nl.enviado = true
    );
$$;
