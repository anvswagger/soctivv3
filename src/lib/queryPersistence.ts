import {
    Persister,
    PersistedClient,
} from '@tanstack/react-query-persist-client'
import { get, set, del } from 'idb-keyval'
import { QUERY_POLICY } from '@/lib/queryPolicy';

export const DEFAULT_PERSIST_KEY = 'soctiv:react-query:v1';
export const DEFAULT_PERSIST_MAX_AGE_MS = QUERY_POLICY.persistence.maxAgeMs;
const LEGACY_PERSIST_KEYS = ['react-query'];

function persistenceKeysFor(idbValidKey: string): string[] {
    const keys = [idbValidKey, ...LEGACY_PERSIST_KEYS];
    return Array.from(new Set(keys));
}

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
                const current = await get<PersistedClient>(idbValidKey)
                if (current) return current

                for (const legacyKey of persistenceKeysFor(idbValidKey).slice(1)) {
                    const legacyClient = await get<PersistedClient>(legacyKey)
                    if (!legacyClient) continue

                    await set(idbValidKey, legacyClient)
                    await del(legacyKey)
                    return legacyClient
                }

                return undefined
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn('[QueryPersistence] restoreClient failed:', error)
                }
                return undefined
            }
        },
        removeClient: async () => {
            try {
                await Promise.all(
                    persistenceKeysFor(idbValidKey).map((key) => del(key))
                )
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
        await Promise.all(
            persistenceKeysFor(idbValidKey).map((key) => del(key))
        )
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('[QueryPersistence] clearPersistedQueryClient failed:', error)
        }
    }
}

