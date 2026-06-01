-- Allow 'pendiente' as a valid role value
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('operador', 'fundacion', 'pendiente'));

-- Allow authenticated users to self-register as pending (only their own row, only pendiente role)
DROP POLICY IF EXISTS "users_self_register_pending" ON public.user_roles;
CREATE POLICY "users_self_register_pending"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'pendiente' AND activo = FALSE);
