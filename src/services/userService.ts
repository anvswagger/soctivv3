import { supabase } from "@/integrations/supabase/client";
import { AppRole, Client, Profile } from "@/types/database";

export const userService = {
    async getUserData(userId: string) {
        // Parallel execution with resilience (Promise.allSettled)
        const [profileResult, rolesResult, clientResult] = await Promise.allSettled([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('user_roles').select('role').eq('user_id', userId),
            supabase.from('clients').select('*').eq('user_id', userId).single()
        ]);

        // Process Profile
        let profile: Profile | null = null;
        if (profileResult.status === 'fulfilled') {
            if (profileResult.value.data) {
                profile = profileResult.value.data;
            } else if (profileResult.value.error) {
                console.error('Profile fetch error:', profileResult.value.error);
            }
        } else {
            console.error('Profile fetch crashed:', profileResult.reason);
        }

        // Process Roles
        let roles: AppRole[] = [];
        if (rolesResult.status === 'fulfilled') {
            if (rolesResult.value.data) {
                roles = rolesResult.value.data.map((r: { role: AppRole }) => r.role);
            }
        }

        // Process Client
        let client: Client | null = null;
        if (clientResult.status === 'fulfilled') {
            if (clientResult.value.data) {
                client = clientResult.value.data;
            }
        }

        return {
            profile,
            roles,
            client
        };
    }
};
