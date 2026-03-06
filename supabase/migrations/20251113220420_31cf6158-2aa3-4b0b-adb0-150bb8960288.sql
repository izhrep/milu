-- Fix trigger to bypass RLS when creating user record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert bypasses RLS because function is SECURITY DEFINER
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'active',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the auth user creation
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Add policy to allow service role to insert into users
DROP POLICY IF EXISTS users_insert_service_role_policy ON users;
CREATE POLICY users_insert_service_role_policy ON users
  FOR INSERT
  TO service_role
  WITH CHECK (true);