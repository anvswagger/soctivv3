-- Migration to add direct relationship between user_roles and profiles
-- This helps PostgREST identify the join for queries like .select('*, profiles(*)')
-- even though both already reference auth.users.

-- First, check if the relationship exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_fkey_profiles'
    ) THEN
        ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_user_id_fkey_profiles
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;
