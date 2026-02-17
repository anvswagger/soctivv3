import {
    Persister,
    PersistedClient,
} from '@tanstack/react-query-persist-client'
import { get, set, del } from 'idb-keyval'

export const DEFAULT_PERSIST_KEY = 'react-query';
export const DEFAULT_PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Creates an IndexedDB persister for TanStack Query.
 */
export function createIndexedDBPersister(idbValidKey: string = DEFAULT_PERSIST_KEY): Persister {
    return {
        persistClient: async (client: PersistedClient) => {
            await set(idbValidKey, client)
        },
        restoreClient: async () => {
            return await get<PersistedClient>(idbValidKey)
        },
        removeClient: async () => {
            await del(idbValidKey)
        },
    }
}

/**
 * Clears persisted TanStack Query cache from IndexedDB.
 */
export async function clearPersistedQueryClient(idbValidKey: string = DEFAULT_PERSIST_KEY): Promise<void> {
    await del(idbValidKey)
}
