import {
    Persister,
    PersistedClient,
} from '@tanstack/react-query-persist-client'
import { get, set, del } from 'idb-keyval'
import { QUERY_POLICY } from '@/lib/queryPolicy';

export const DEFAULT_PERSIST_KEY = 'react-query';
export const DEFAULT_PERSIST_MAX_AGE_MS = QUERY_POLICY.persistence.maxAgeMs;

/**
 * Creates an IndexedDB persister for TanStack Query.
 */
export function createIndexedDBPersister(idbValidKey: string = DEFAULT_PERSIST_KEY): Persister {
    return {
        persistClient: async (client: PersistedClient) => {
            try {
                await set(idbValidKey, client)
            } catch (error) {
                // Never let persistence failures break app rendering.
                if (import.meta.env.DEV) {
                    console.warn('[QueryPersistence] persistClient failed:', error)
                }
            }
        },
        restoreClient: async () => {
            try {
                return await get<PersistedClient>(idbValidKey)
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn('[QueryPersistence] restoreClient failed:', error)
                }
                return undefined
            }
        },
        removeClient: async () => {
            try {
                await del(idbValidKey)
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn('[QueryPersistence] removeClient failed:', error)
                }
            }
        },
    }
}

/**
 * Clears persisted TanStack Query cache from IndexedDB.
 */
export async function clearPersistedQueryClient(idbValidKey: string = DEFAULT_PERSIST_KEY): Promise<void> {
    try {
        await del(idbValidKey)
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('[QueryPersistence] clearPersistedQueryClient failed:', error)
        }
    }
}
