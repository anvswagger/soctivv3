import { supabase } from '@/integrations/supabase/client';

type SupabaseRepoError = {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
    context?: unknown;
};

type RepoResult<T> = {
    data: T | null;
    error: SupabaseRepoError | null;
};

type QueryResult<T> = Promise<RepoResult<T[]>>;

type QueryBuilder<T> = QueryResult<T> & {
    select: (columns?: string, options?: { count?: 'exact'; head?: boolean }) => QueryBuilder<T>;
    eq: (column: string, value: unknown) => QueryBuilder<T>;
    in: (column: string, values: readonly unknown[]) => QueryBuilder<T>;
    order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
    limit: (count: number) => QueryBuilder<T>;
    insert: (values: unknown) => QueryBuilder<T>;
    update: (values: unknown) => QueryBuilder<T>;
    delete: () => QueryBuilder<T>;
    single: () => Promise<RepoResult<T>>;
    maybeSingle: () => Promise<RepoResult<T>>;
};

type SettingsRepoDbClient = {
    auth: {
        updateUser: (attributes: { password: string }) => Promise<{ error: SupabaseRepoError | null }>;
    };
    functions: {
        invoke: <T = unknown>(
            functionName: string,
            options?: { body?: unknown; headers?: Record<string, string> },
        ) => Promise<RepoResult<T>>;
    };
    from: <T = Record<string, unknown>>(table: string) => QueryBuilder<T>;
};

// Transitional repository for legacy Settings page queries until feature modules are fully migrated.
export const settingsRepoDb = supabase as unknown as SettingsRepoDbClient;

