import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export type QueryRefetchType = 'active' | 'all' | 'inactive' | 'none';

const invalidationContracts = {
    dashboard: [
        queryKeys.dashboard.stats,
        queryKeys.dashboard.actionsRoot,
        queryKeys.dashboard.activitiesRoot,
    ],
    leads: [
        queryKeys.leads.root,
        queryKeys.dashboard.stats,
        queryKeys.dashboard.actionsRoot,
        queryKeys.dashboard.activitiesRoot,
    ],
    appointments: [
        queryKeys.appointments.root,
        queryKeys.dashboard.stats,
        queryKeys.dashboard.actionsRoot,
        queryKeys.dashboard.activitiesRoot,
    ],
    sms: [
        queryKeys.sms.logs,
        queryKeys.sms.templates,
        queryKeys.dashboard.stats,
    ],
    notifications: [
        queryKeys.notifications.root,
    ],
    setterStats: [
        queryKeys.setterStats.root,
    ],
} as const;

export type InvalidationDomain = keyof typeof invalidationContracts;

function uniqueQueryKeys(queryKeysList: readonly (readonly unknown[])[]): readonly (readonly unknown[])[] {
    const seen = new Map<string, readonly unknown[]>();
    for (const queryKey of queryKeysList) {
        seen.set(JSON.stringify(queryKey), queryKey);
    }
    return Array.from(seen.values());
}

function resolveExactQueryKeys(
    queryClient: QueryClient,
    queryKeysList: readonly (readonly unknown[])[],
): readonly (readonly unknown[])[] {
    const expandedKeys: (readonly unknown[])[] = [];

    for (const contractKey of queryKeysList) {
        const matchedQueries = queryClient
            .getQueryCache()
            .findAll({ queryKey: contractKey })
            .map((query) => query.queryKey as readonly unknown[]);

        if (matchedQueries.length === 0) {
            expandedKeys.push(contractKey);
            continue;
        }

        expandedKeys.push(...matchedQueries);
    }

    return uniqueQueryKeys(expandedKeys);
}

async function invalidateByKeys(
    queryClient: QueryClient,
    queryKeysList: readonly (readonly unknown[])[],
    refetchType: QueryRefetchType,
): Promise<void> {
    const exactKeys = resolveExactQueryKeys(queryClient, queryKeysList);
    await Promise.all(
        exactKeys.map((queryKey) =>
            queryClient.invalidateQueries({
                queryKey,
                exact: true,
                refetchType,
            }),
        ),
    );
}

export const queryInvalidation = {
    contracts: invalidationContracts,
    invalidateDomain: (
        queryClient: QueryClient,
        domain: InvalidationDomain,
        refetchType: QueryRefetchType = 'active',
    ) => invalidateByKeys(queryClient, invalidationContracts[domain], refetchType),
    invalidateKeys: (
        queryClient: QueryClient,
        queryKeysList: readonly (readonly unknown[])[],
        refetchType: QueryRefetchType = 'active',
    ) => invalidateByKeys(queryClient, queryKeysList, refetchType),
};
