-- FundaData Database Schema Setup Script
-- Paste and run this script in your Supabase SQL Editor.

-- 1. Create user_roles table if not exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('operador', 'fundacion')),
    dispositivo_id INT REFERENCES public.dispositivo(id) ON DELETE SET NULL,
    email TEXT,
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id)
);

-- 2. Create historial_seguimiento table if not exists
CREATE TABLE IF NOT EXISTS public.historial_seguimiento (
    id SERIAL PRIMARY KEY,
    vinculo_id INT NOT NULL REFERENCES public.vinculo(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    campo_modificado TEXT NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. RLS Security Definer helper functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_my_device_id()
RETURNS INT SECURITY DEFINER AS $$
  SELECT dispositivo_id FROM public.user_roles WHERE user_id = auth.uid() AND activo = TRUE;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT SECURITY DEFINER AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() AND activo = TRUE;
$$ LANGUAGE sql;

-- 4. Enable Row Level Security
ALTER TABLE public.vinculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_ninez ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_seguimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona ENABLE ROW LEVEL SECURITY;

-- 5. Establish RLS Policies

-- 5.1 Persona Policies:
-- Allow authenticated users to select personas to verify DNI existence before registration
CREATE POLICY persona_select_all ON public.persona
    FOR SELECT TO authenticated
    USING (true);

-- Allow authenticated users to create new personas
CREATE POLICY persona_insert_all ON public.persona
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow operators and admins to update personas
CREATE POLICY persona_update_policy ON public.persona
    FOR UPDATE TO authenticated
    USING (
        public.get_my_role() = 'fundacion' OR 
        (public.get_my_role() = 'operador' AND EXISTS (
            SELECT 1 FROM public.vinculo v
            WHERE v.dni = persona.dni AND v.dispositivo_id = public.get_my_device_id()
        ))
    );

-- 5.2 User Roles Policies:
-- Users can see their own role, admins can see and update everything
CREATE POLICY user_roles_select ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.get_my_role() = 'fundacion');

CREATE POLICY user_roles_all_admin ON public.user_roles
    FOR ALL TO authenticated
    USING (public.get_my_role() = 'fundacion');

-- 5.3 Vinculo Policies:
-- Admin can do everything. Operators can only read/insert/update within their own device.
CREATE POLICY vinculo_policy ON public.vinculo
    FOR ALL TO authenticated
    USING (
        public.get_my_role() = 'fundacion' OR 
        (public.get_my_role() = 'operador' AND dispositivo_id = public.get_my_device_id())
    );

-- 5.4 Ficha Ninez Policies:
-- Admin can do everything. Operators can only operate on records linked to their device.
CREATE POLICY ficha_ninez_policy ON public.ficha_ninez
    FOR ALL TO authenticated
    USING (
        public.get_my_role() = 'fundacion' OR
        (public.get_my_role() = 'operador' AND EXISTS (
            SELECT 1 FROM public.vinculo v
            WHERE v.id = ficha_ninez.vinculo_id AND v.dispositivo_id = public.get_my_device_id()
        ))
    );

-- 5.5 Ficha Dia Policies:
-- Admin can do everything. Operators can only operate on records linked to their device.
CREATE POLICY ficha_dia_policy ON public.ficha_dia
    FOR ALL TO authenticated
    USING (
        public.get_my_role() = 'fundacion' OR
        (public.get_my_role() = 'operador' AND EXISTS (
            SELECT 1 FROM public.vinculo v
            WHERE v.id = ficha_dia.vinculo_id AND v.dispositivo_id = public.get_my_device_id()
        ))
    );

-- 5.6 Historial Seguimiento Policies:
-- Admin can do everything. Operators can only operate on records linked to their device.
CREATE POLICY historial_seguimiento_policy ON public.historial_seguimiento
    FOR ALL TO authenticated
    USING (
        public.get_my_role() = 'fundacion' OR
        (public.get_my_role() = 'operador' AND EXISTS (
            SELECT 1 FROM public.vinculo v
            WHERE v.id = historial_seguimiento.vinculo_id AND v.dispositivo_id = public.get_my_device_id()
        ))
    );


-- 6. New tables for attendance and notifications

-- 6.1 Tutors/guardians (not system users, just contacts)
CREATE TABLE IF NOT EXISTS public.tutor (
  id           BIGSERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL,
  telefono     TEXT NOT NULL,
  dni_nino     TEXT NOT NULL REFERENCES public.persona(dni) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tutor ENABLE ROW LEVEL SECURITY;
CREATE POLICY tutor_policy ON public.tutor
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'fundacion' OR
    (public.get_my_role() = 'operador' AND EXISTS (
      SELECT 1 FROM public.vinculo v
      WHERE v.dni = tutor.dni_nino AND v.dispositivo_id = public.get_my_device_id()
    ))
  );

-- 6.2 Daily attendance records
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
CREATE POLICY registro_asistencia_policy ON public.registro_asistencia
  FOR ALL TO authenticated
  USING (
    public.get_my_role() = 'fundacion' OR
    (public.get_my_role() = 'operador' AND dispositivo_id = public.get_my_device_id())
  );

-- 6.3 Notification log (prevents duplicate sends)
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

-- 6.4 Helper function to detect consecutive absences for notifications
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

-- 7. Seed data for devices (Only insert if the table is empty)
-- Managed by 10 centers (5 child care centers - 'ninez', and 5 day-care centers - 'dia')
INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Niñez "Rayito de Luz"', 'ninez' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo);

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Niñez "Pequeños Pasos"', 'ninez' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Niñez "Pequeños Pasos"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Niñez "Futuro Feliz"', 'ninez' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Niñez "Futuro Feliz"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Niñez "Travesuras"', 'ninez' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Niñez "Travesuras"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Niñez "Manitos Mágicas"', 'ninez' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Niñez "Manitos Mágicas"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Día "Renacer"', 'dia' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Día "Renacer"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Día "Sabiduría"', 'dia' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Día "Sabiduría"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Día "Edad de Oro"', 'dia' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Día "Edad de Oro"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Día "Vida Activa"', 'dia' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Día "Vida Activa"');

INSERT INTO public.dispositivo (nombre, tipo)
SELECT 'Centro de Día "Nuevo Horizonte"', 'dia' WHERE NOT EXISTS (SELECT 1 FROM public.dispositivo WHERE nombre = 'Centro de Día "Nuevo Horizonte"');
