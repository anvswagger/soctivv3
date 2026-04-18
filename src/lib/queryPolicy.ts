/**
 * @module queryPolicy
 * Centralized `staleTime` / `gcTime` policies for TanStack Query.
 * All durations are defined in milliseconds using SECOND / MINUTE / HOUR
 * constants. Import `QUERY_POLICY` in hooks to keep cache behaviour consistent.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const QUERY_POLICY = {
    /** Default query behaviour applied when no domain-specific policy overrides it. */
    appDefaults: {
        staleTime: 30 * SECOND,
        gcTime: 6 * HOUR,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        retry: 1,
    },
    /** Domain-specific cache windows for CRM data. */
    crm: {
        /** Leads list — moderately fresh (45s) since pipeline data changes frequently. */
        leads: {
            staleTime: 45 * SECOND,
            gcTime: 2 * HOUR,
        },
        /** Dashboard KPI stats — refreshed every minute. */
        dashboardStats: {
            staleTime: 1 * MINUTE,
            gcTime: 2 * HOUR,
        },
        /** Dashboard quick-action items — refreshed every 2 minutes. */
        dashboardActions: {
            staleTime: 2 * MINUTE,
            gcTime: 2 * HOUR,
        },
        /** Dashboard activity feed — refreshed every 2 minutes. */
        dashboardActivities: {
            staleTime: 2 * MINUTE,
            gcTime: 2 * HOUR,
        },
        /** Notification bell / header count — moderately fresh (45s). */
        notifications: {
            staleTime: 45 * SECOND,
            gcTime: 2 * HOUR,
        },
        /** SMS send logs — changes infrequently (5 min). */
        smsLogs: {
            staleTime: 5 * MINUTE,
            gcTime: 2 * HOUR,
        },
        /** SMS templates — rarely change (30 min). */
        smsTemplates: {
            staleTime: 30 * MINUTE,
            gcTime: 12 * HOUR,
        },
    },
    /** Maximum age for persisted (offline) cache entries. */
    persistence: {
        maxAgeMs: 6 * HOUR,
    },
} as const;
