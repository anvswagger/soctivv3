-- Force update for super admin user
DO $$
DECLARE
    target_user_id UUID;
    target_email TEXT := 'hnyshans85@gmail.com';
BEGIN
    -- Find the user ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

    IF target_user_id IS NOT NULL THEN
        -- 1. Ensure profile is approved
        INSERT INTO public.profiles (id, full_name, approval_status)
        VALUES (target_user_id, 'Super Admin', 'approved')
        ON CONFLICT (id) DO UPDATE
        SET approval_status = 'approved', full_name = 'Super Admin';

        -- 2. Ensure super_admin role is assigned
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'super_admin')
        ON CONFLICT (user_id, role) DO NOTHING;

        -- 3. Ensure client record exists and marked as onboarded (just in case)
        INSERT INTO public.clients (user_id, company_name, onboarding_completed, webhook_code)
        VALUES (target_user_id, 'Soctiv Admin', true, 'admin-webhook-force-code')
        ON CONFLICT (user_id) DO UPDATE
        SET onboarding_completed = true;

        -- 4. Give admin permissions if needed
        INSERT INTO public.admin_access_permissions (user_id, can_appointments, can_clients, can_leads, can_library, can_notifications, can_settings, can_sms)
        VALUES (target_user_id, true, true, true, true, true, true, true)
        ON CONFLICT (user_id) DO UPDATE
        SET can_appointments = true, can_clients = true, can_leads = true, can_library = true, can_notifications = true, can_settings = true, can_sms = true;

    END IF;
END $$;
