const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const QUERY_POLICY = {
    appDefaults: {
        staleTime: 30 * SECOND,
        gcTime: 6 * HOUR,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        retry: 1,
    },
    crm: {
        leads: {
            staleTime: 45 * SECOND,
            gcTime: 2 * HOUR,
        },
        dashboardStats: {
            staleTime: 1 * MINUTE,
            gcTime: 2 * HOUR,
        },
        dashboardActions: {
            staleTime: 2 * MINUTE,
            gcTime: 2 * HOUR,
        },
        dashboardActivities: {
            staleTime: 2 * MINUTE,
            gcTime: 2 * HOUR,
        },
        notifications: {
            staleTime: 45 * SECOND,
            gcTime: 2 * HOUR,
        },
        smsLogs: {
            staleTime: 5 * MINUTE,
            gcTime: 2 * HOUR,
        },
        smsTemplates: {
            staleTime: 30 * MINUTE,
            gcTime: 12 * HOUR,
        },
    },
    persistence: {
        maxAgeMs: 6 * HOUR,
    },
} as const;
