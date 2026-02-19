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

function adminAccessTable(): AdminAccessQuery {
    const fromFn = supabase.from as unknown as (table: string) => AdminAccessQuery;
    return fromFn(ADMIN_ACCESS_TABLE);
}

export const authRepo = {
    async getProfile(userId: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) return null;
        return data as Profile;
    },

    async getRoles(userId: string): Promise<AppRole[]> {
        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId);

        if (error || !data) return [];
        return data.map((row) => row.role as AppRole);
    },

    async getClientByUserId(userId: string): Promise<Client | null> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;
        return data as Client;
    },

    async getAssignedClientIds(userId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('admin_clients')
            .select('client_id')
            .eq('user_id', userId);

        if (error || !data) return [];
        return data.map((row) => row.client_id);
    },

    async getAdminAccessRow(userId: string): Promise<AdminAccessRow | null> {
        const { data, error } = await adminAccessTable()
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) return null;
        return data;
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

