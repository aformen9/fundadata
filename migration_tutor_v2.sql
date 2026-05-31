-- Migración: Tabla tutores múltiples (tutor_v2)
-- Ejecutar en Supabase SQL Editor

-- Tabla tutores múltiples
CREATE TABLE IF NOT EXISTS tutor_v2 (
  id            SERIAL PRIMARY KEY,
  vinculo_id    INTEGER NOT NULL REFERENCES vinculo(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  telefono      TEXT NOT NULL,
  relacion      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_v2_vinculo ON tutor_v2(vinculo_id);

ALTER TABLE tutor_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operador ve tutores de su centro" ON tutor_v2
  FOR ALL USING (
    vinculo_id IN (
      SELECT v.id FROM vinculo v
      JOIN user_roles ur ON ur.dispositivo_id = v.dispositivo_id
      WHERE ur.user_id = auth.uid()
    )
  );

-- Migrar datos existentes de tutor vieja (si hay datos)
INSERT INTO tutor_v2 (vinculo_id, nombre, telefono)
SELECT v.id, t.nombre, t.telefono
FROM tutor t
JOIN vinculo v ON v.dni = t.dni_nino AND v.estado = 'activo'
ON CONFLICT DO NOTHING;
