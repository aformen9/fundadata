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


-- 6. Seed data for devices (Only insert if the table is empty)
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
