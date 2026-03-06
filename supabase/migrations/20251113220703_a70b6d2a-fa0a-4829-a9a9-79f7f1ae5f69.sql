-- Check if user exists and create/update accordingly
DO $$
DECLARE
  admin_user_id UUID := 'e033ec4d-0155-44c9-8aaf-b4a79adbc572';
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = admin_user_id) INTO user_exists;

  IF NOT user_exists THEN
    -- Create user record
    INSERT INTO users (id, email, first_name, last_name, employee_number, status, created_at, updated_at)
    VALUES (
      admin_user_id,
      'alena.draganova@gmail.com',
      'Алена',
      'Драганова',
      'ADMIN_' || substring(admin_user_id::text, 1, 8),
      true,
      NOW(),
      NOW()
    );
  END IF;

  -- Assign admin role (idempotent)
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Refresh effective permissions
  PERFORM refresh_user_effective_permissions(admin_user_id);
END $$;