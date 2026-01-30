import {
    Persister,
    PersistedClient,
} from '@tanstack/react-query-persist-client'
import { get, set, del } from 'idb-keyval'

/**
 * Creates an IndexedDB persister for TanStack Query.
 */
export function createIndexedDBPersister(idbValidKey: string = 'react-query'): Persister {
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
