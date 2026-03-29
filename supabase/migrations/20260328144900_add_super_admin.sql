-- Create Super Admin User: hnyshans85@gmail.com
-- Ensure pgcrypto is available (Supabase usually puts it in 'extensions' schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Set search path to include extensions so we can find crypt and gen_salt
  SET search_path = public, extensions, auth;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'hnyshans85@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'hnyshans85@gmail.com',
      crypt('admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO new_user_id;

    -- Assign super_admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'super_admin');

    RAISE NOTICE 'User created and assigned super_admin role.';
  ELSE
    -- If user already exists, just ensure they have the super_admin role
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'hnyshans85@gmail.com';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User already exists, ensured super_admin role assignment.';
  END IF;
END $$;
