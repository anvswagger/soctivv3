import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Client, Profile } from '@/types/database';
import type { AdminAccessRow } from '@/lib/adminAccess';

type SupabaseRepoError = {
    message: string;
    code?: string;
};

type RepoResult<T> = {
    data: T;
    error: SupabaseRepoError | null;
};

type AdminAccessQuery = {
    select: (columns?: string) => {
        eq: (column: string, value: string) => {
            maybeSingle: () => Promise<RepoResult<AdminAccessRow | null>>;
        };
    };
    upsert: (
        values: AdminAccessRow,
        options?: { onConflict?: string },
    ) => Promise<{ error: SupabaseRepoError | null }>;
};

const ADMIN_ACCESS_TABLE = 'admin_access_permissions';
const NO_ROWS_CODE = 'PGRST116';

function adminAccessTable(): AdminAccessQuery {
    const fromFn = supabase.from as unknown as (table: string) => AdminAccessQuery;
    return fromFn(ADMIN_ACCESS_TABLE);
}

function isNoRowsError(error: SupabaseRepoError | null): boolean {
    if (!error) return false;
    if (error.code === NO_ROWS_CODE) return true;
    const message = error.message.toLowerCase();
    return message.includes('0 rows') || message.includes('no rows');
}

export const authRepo = {
    async getProfile(userId: string): Promise<Profile | null> {
        console.debug('[AuthRepo] getProfile called for:', userId);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                // Log but don't throw - missing profile should not crash the app
                console.warn('[AuthRepo] getProfile error (non-fatal):', error.message);
                if (isNoRowsError(error)) return null;
                // Return null instead of throwing to prevent crash
                return null;
            }
            return (data as Profile | null) ?? null;
        } catch (err) {
            // Catch any unexpected errors and return null to prevent crash
            console.error('[AuthRepo] getProfile unexpected error:', err);
            return null;
        }
    },

    async getRoles(userId: string): Promise<AppRole[]> {
        console.debug('[AuthRepo] getRoles called for:', userId);
        try {
            const { data, error } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId);

            if (error) {
                // Log but don't throw - missing roles should not crash the app
                console.warn('[AuthRepo] getRoles error (non-fatal):', error.message);
                return [];
            }
            if (!data) return [];
            return data.map((row) => row.role as AppRole);
        } catch (err) {
            // Catch any unexpected errors and return empty array to prevent crash
            console.error('[AuthRepo] getRoles unexpected error:', err);
            return [];
        }
    },

    async getClientByUserId(userId: string): Promise<Client | null> {
        console.debug('[AuthRepo] getClientByUserId called for:', userId);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                // Log but don't throw - missing client should not crash the app
                console.warn('[AuthRepo] getClientByUserId error (non-fatal):', error.message);
                if (isNoRowsError(error)) return null;
                return null;
            }
            return (data as Client | null) ?? null;
        } catch (err) {
            // Catch any unexpected errors and return null to prevent crash
            console.error('[AuthRepo] getClientByUserId unexpected error:', err);
            return null;
        }
    },

    async getAssignedClientIds(userId: string): Promise<string[]> {
        console.debug('[AuthRepo] getAssignedClientIds called for:', userId);
        try {
            const { data, error } = await supabase
                .from('admin_clients')
                .select('client_id')
                .eq('user_id', userId);

            if (error) {
                console.warn('[AuthRepo] getAssignedClientIds error (non-fatal):', error.message);
                return [];
            }
            if (!data) return [];
            return data.map((row) => row.client_id);
        } catch (err) {
            console.error('[AuthRepo] getAssignedClientIds unexpected error:', err);
            return [];
        }
    },

    async getAdminAccessRow(userId: string): Promise<AdminAccessRow | null> {
        console.debug('[AuthRepo] getAdminAccessRow called for:', userId);
        try {
            const { data, error } = await adminAccessTable()
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.warn('[AuthRepo] getAdminAccessRow error (non-fatal):', error.message);
                if (isNoRowsError(error)) return null;
                return null;
            }
            if (!data) return null;
            return data;
        } catch (err) {
            console.error('[AuthRepo] getAdminAccessRow unexpected error:', err);
            return null;
        }
    },

    async upsertAdminAccess(userId: string, row: Omit<AdminAccessRow, 'user_id'>): Promise<SupabaseRepoError | null> {
        const { error } = await adminAccessTable().upsert(
            {
                user_id: userId,
                ...row,
            },
            { onConflict: 'user_id' },
        );

        return error;
    },
};
