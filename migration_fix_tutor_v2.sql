-- Fix get_consecutive_absences: use tutor_v2 + vinculo instead of old tutor table
CREATE OR REPLACE FUNCTION public.get_consecutive_absences(p_today DATE, p_yesterday DATE)
RETURNS TABLE(
  dni TEXT,
  nombre TEXT,
  apellido TEXT,
  dispositivo_id INT,
  tutor_nombre TEXT,
  telefono TEXT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT ON (ra.dni, ra.dispositivo_id)
    ra.dni,
    p.nombre,
    p.apellido,
    ra.dispositivo_id,
    t.nombre AS tutor_nombre,
    t.telefono
  FROM registro_asistencia ra
  JOIN persona p ON p.dni = ra.dni
  JOIN vinculo vi ON vi.dni = ra.dni
    AND vi.dispositivo_id = ra.dispositivo_id
    AND (vi.fecha_baja IS NULL OR vi.fecha_baja >= p_today)
  JOIN tutor_v2 t ON t.vinculo_id = vi.id
  WHERE ra.presente = false
    AND ra.fecha = p_today
    AND EXISTS (
      SELECT 1 FROM registro_asistencia ra2
      WHERE ra2.dni = ra.dni
        AND ra2.dispositivo_id = ra.dispositivo_id
        AND ra2.presente = false
        AND ra2.fecha = (
          SELECT MAX(ra3.fecha)
          FROM registro_asistencia ra3
          WHERE ra3.dni = ra.dni
            AND ra3.dispositivo_id = ra.dispositivo_id
            AND ra3.fecha < p_today
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM notificacion_log nl
      WHERE nl.dni = ra.dni
        AND nl.dispositivo_id = ra.dispositivo_id
        AND nl.fecha_envio = p_today
        AND nl.enviado = true
    )
  ORDER BY ra.dni, ra.dispositivo_id, t.id;
$$;
