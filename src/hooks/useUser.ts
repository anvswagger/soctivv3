import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { AppRole, Profile, Client } from '@/types/database';
import { userService } from '@/services/userService';



/**
 * Manages the Supabase Auth Session.
 * Syncs with Supabase's onAuthStateChange.
 */
export function useUserSession() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // Invalidate session query to trigger re-render
            queryClient.setQueryData(['session'], session);

            // If signed out, clear all user data immediately
            if (event === 'SIGNED_OUT') {
                queryClient.removeQueries();
            }
        });

        return () => subscription.unsubscribe();
    }, [queryClient]);

    return useQuery({
        queryKey: ['session'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            return session;
        },
        // Session is managed by the listener, so we don't need frequent refetching
        staleTime: Infinity,
        gcTime: Infinity,
    });
}

/**
 * Fetches all user data (Profile, Roles, Client) in parallel.
 * Dependent on the User ID.
 */
export function useUserData(userId: string | undefined) {
    return useQuery({
        queryKey: ['userData', userId],
        queryFn: async () => {
            if (!userId) return null;

            return await userService.getUserData(userId);
        },
        enabled: !!userId,
        // data is considered fresh for 5 minutes, unless manually invalidated (e.g. after onboarding)
        staleTime: 1000 * 60 * 5,
        retry: 1,
    });
}
