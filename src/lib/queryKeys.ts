/**
 * @module queryKeys
 * Structured query key factory for TanStack Query.
 * Provides deterministic, normalized cache keys for every query domain
 * (leads, dashboard, appointments, notifications, SMS, setter-stats).
 */

type ClientFilterValue = string[] | null | undefined;

type FilterPrimitive = string | number | boolean | null | undefined;

/** Normalizes a generic filter object so that equivalent filters produce identical keys. */
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

/** Normalizes client filter arrays into a canonical form for cache key stability. */
function normalizeClientFilter(clientFilter: ClientFilterValue): 'all' | 'none' | string[] {
    if (clientFilter === null || clientFilter === undefined) {
        return 'all';
    }

    if (clientFilter.length === 0) {
        return 'none';
    }

    return Array.from(new Set(clientFilter)).sort();
}

// Top-level query key prefixes
const leadsRoot = ['leads'] as const;
const dashboardRoot = ['dashboard'] as const;
const appointmentsRoot = ['appointments'] as const;
const notificationsRoot = ['notifications'] as const;
const smsRoot = ['sms'] as const;
const setterStatsRoot = ['setter-stats'] as const;

export const queryKeys = {
    /** Lead list queries with pagination and normalized filters. */
    leads: {
        root: leadsRoot,
        listRoot: [...leadsRoot, 'list'] as const,
        list: (page: number, pageSize: number, filters: Record<string, unknown> = {}) =>
            [...leadsRoot, 'list', { page, pageSize, filters: normalizeFilters(filters) }] as const,
    },
    /** Dashboard aggregate stats, actions, and activity feed queries. */
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
    /** Appointment queries. */
    appointments: {
        root: appointmentsRoot,
    },
    /** Notification queries scoped by user ID. */
    notifications: {
        root: notificationsRoot,
        header: (userId?: string | null) =>
            [...notificationsRoot, 'header', userId ?? 'anonymous'] as const,
    },
    /** SMS logs and templates queries. */
    sms: {
        root: smsRoot,
        logs: [...smsRoot, 'logs'] as const,
        templates: [...smsRoot, 'templates'] as const,
    },
    /** Setter performance statistics queries. */
    setterStats: {
        root: setterStatsRoot,
    },
} as const;

