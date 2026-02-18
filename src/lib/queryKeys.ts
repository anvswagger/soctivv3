export type ClientFilterValue = string[] | null | undefined;

type FilterPrimitive = string | number | boolean | null | undefined;

function normalizeFilters(filters: Record<string, unknown>): Record<string, FilterPrimitive | FilterPrimitive[]> {
    const normalizedEntries = Object.entries(filters).sort(([a], [b]) => a.localeCompare(b));
    const normalized: Record<string, FilterPrimitive | FilterPrimitive[]> = {};

    for (const [key, rawValue] of normalizedEntries) {
        if (Array.isArray(rawValue)) {
            normalized[key] = rawValue
                .map((item) => (typeof item === 'object' ? JSON.stringify(item) : (item as FilterPrimitive)))
                .sort() as FilterPrimitive[];
            continue;
        }

        if (typeof rawValue === 'object' && rawValue !== null) {
            normalized[key] = JSON.stringify(rawValue);
            continue;
        }

        normalized[key] = rawValue as FilterPrimitive;
    }

    return normalized;
}

function normalizeClientFilter(clientFilter: ClientFilterValue): 'all' | 'none' | string[] {
    if (clientFilter === null || clientFilter === undefined) {
        return 'all';
    }

    if (clientFilter.length === 0) {
        return 'none';
    }

    return Array.from(new Set(clientFilter)).sort();
}

const leadsRoot = ['leads'] as const;
const dashboardRoot = ['dashboard'] as const;
const appointmentsRoot = ['appointments'] as const;
const notificationsRoot = ['notifications'] as const;
const smsRoot = ['sms'] as const;
const setterStatsRoot = ['setter-stats'] as const;

export const queryKeys = {
    leads: {
        root: leadsRoot,
        listRoot: [...leadsRoot, 'list'] as const,
        list: (page: number, pageSize: number, filters: Record<string, unknown> = {}) =>
            [...leadsRoot, 'list', { page, pageSize, filters: normalizeFilters(filters) }] as const,
    },
    dashboard: {
        root: dashboardRoot,
        stats: [...dashboardRoot, 'stats'] as const,
        actionsRoot: [...dashboardRoot, 'actions'] as const,
        actions: (clientFilter: ClientFilterValue) =>
            [...dashboardRoot, 'actions', { clientFilter: normalizeClientFilter(clientFilter) }] as const,
        activitiesRoot: [...dashboardRoot, 'activities'] as const,
        activities: (clientFilter: ClientFilterValue) =>
            [...dashboardRoot, 'activities', { clientFilter: normalizeClientFilter(clientFilter) }] as const,
    },
    appointments: {
        root: appointmentsRoot,
    },
    notifications: {
        root: notificationsRoot,
        header: (userId?: string | null) =>
            [...notificationsRoot, 'header', userId ?? 'anonymous'] as const,
    },
    sms: {
        root: smsRoot,
        logs: [...smsRoot, 'logs'] as const,
        templates: [...smsRoot, 'templates'] as const,
    },
    setterStats: {
        root: setterStatsRoot,
    },
} as const;

