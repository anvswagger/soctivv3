import { supabase } from '@/integrations/supabase/client';
import type { SuperAdminAnalyticsResponse, AnalyticsEventPayload } from '@/types/analytics';
import type { AnalyticsEventInsert } from '@/types/database';

export type { AnalyticsEventPayload };

type RpcError = { message?: string } | null;
type AnalyticsEventsInsertQuery = {
  insert: (values: AnalyticsEventInsert) => Promise<{ error: RpcError }>;
};
type SuperAdminAnalyticsRpc = (
  fn: 'get_super_admin_analytics',
  params: { start_at: string | null; end_at: string | null }
) => Promise<{ data: unknown; error: RpcError }>;

type AnalyticsSupabaseClient = {
  from: (table: string) => AnalyticsEventsInsertQuery;
  rpc: SuperAdminAnalyticsRpc;
};

const analyticsSupabase = supabase as unknown as AnalyticsSupabaseClient;
const analyticsEventsTable = (): AnalyticsEventsInsertQuery => analyticsSupabase.from('analytics_events');
// Helper functions for sanitization (module-scoped, not exported)
function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata) return null;

  const sanitized: Record<string, unknown> = {};
  const maxKeyCount = 20;
  const maxValueLength = 500;

  let count = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (count >= maxKeyCount) break;
    if (typeof value === 'string' && value.length > maxValueLength) {
      sanitized[key] = value.substring(0, maxValueLength) + '...[truncated]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      const nested = sanitizeMetadata(value as Record<string, unknown>);
      if (nested && Object.keys(nested).length > 0) {
        sanitized[key] = nested;
        count++;
      }
    } else {
      sanitized[key] = value;
      count++;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function logAnalyticsError(type: 'insert' | 'exception', error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (import.meta.env.DEV) {
    console.warn(`[Analytics] ${type} error:`, error);
  } else {
    console.warn(`[Analytics] ${type} failed: ${message.substring(0, 100)}`);
  }
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  if (value === null || typeof value === 'undefined') return undefined;
  const normalized = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeSuperAdminAnalytics(raw: unknown): SuperAdminAnalyticsResponse {
  const root = (raw ?? {}) as Record<string, unknown>;
  const summaryRaw = (root.summary ?? {}) as Record<string, unknown>;

  const summary: SuperAdminAnalyticsResponse['summary'] = {
    totalLeads: toFiniteNumber(summaryRaw.totalLeads ?? summaryRaw.total_leads),
    totalAppointments: toFiniteNumber(summaryRaw.totalAppointments ?? summaryRaw.total_appointments),
    totalCalls: toFiniteNumber(summaryRaw.totalCalls ?? summaryRaw.total_calls),
    avgLeadResponseMinutes: toOptionalFiniteNumber(summaryRaw.avgLeadResponseMinutes ?? summaryRaw.avg_lead_response_minutes),
    callsBeforeAppointmentRate: toOptionalFiniteNumber(summaryRaw.callsBeforeAppointmentRate ?? summaryRaw.calls_before_appointment_rate),
    avgCallsBeforeAppointment: toOptionalFiniteNumber(summaryRaw.avgCallsBeforeAppointment ?? summaryRaw.avg_calls_before_appointment),
    avgFirstCallToAppointmentMinutes: toOptionalFiniteNumber(summaryRaw.avgFirstCallToAppointmentMinutes ?? summaryRaw.avg_first_call_to_appointment_minutes),
  };

  const callHourlyRaw = Array.isArray(root.callHourly)
    ? root.callHourly
    : Array.isArray(root.call_hourly)
      ? root.call_hourly
      : [];
  const callHourly = callHourlyRaw.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      hour: Math.max(0, Math.min(23, Math.trunc(toFiniteNumber(row.hour)))),
      count: Math.max(0, Math.trunc(toFiniteNumber(row.count))),
    };
  });

  const companyMetricsRaw = Array.isArray(root.companyMetrics)
    ? root.companyMetrics
    : Array.isArray(root.company_metrics)
      ? root.company_metrics
      : [];
  const companyMetrics = companyMetricsRaw.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      companyId: String(row.companyId ?? row.company_id ?? row.client_id ?? ''),
      companyName: String(row.companyName ?? row.company_name ?? ''),
      callsCount: Math.max(0, Math.trunc(toFiniteNumber(row.callsCount ?? row.calls_count))),
      appointmentsCount: Math.max(0, Math.trunc(toFiniteNumber(row.appointmentsCount ?? row.appointments_count))),
      leadsCount: Math.max(0, Math.trunc(toFiniteNumber(row.leadsCount ?? row.leads_count))),
      avgLeadResponseMinutes: toOptionalFiniteNumber(row.avgLeadResponseMinutes ?? row.avg_lead_response_minutes),
      callsBeforeAppointmentRate: toOptionalFiniteNumber(row.callsBeforeAppointmentRate ?? row.calls_before_appointment_rate),
      avgCallsBeforeAppointment: toOptionalFiniteNumber(row.avgCallsBeforeAppointment ?? row.avg_calls_before_appointment),
      avgFirstCallToAppointmentMinutes: toOptionalFiniteNumber(row.avgFirstCallToAppointmentMinutes ?? row.avg_first_call_to_appointment_minutes),
    };
  });

  return {
    summary,
    callHourly,
    companyMetrics,
  };
}

/**
 * Analytics service for tracking user and system events.
 * Events are stored in the analytics_events table for super admin dashboards.
 * 
 * @note Analytics failures are non-blocking and logged only in development.
 */
export const analyticsService = {
  /**
   * Track a single analytics event.
   * @param payload - The event data to track
   */
  async trackEvent(payload: AnalyticsEventPayload): Promise<void> {
    // Validate required fields
    if (!payload.userId || !payload.eventType) {
      console.warn('[Analytics] Missing required fields: userId and eventType');
      return;
    }

    // Sanitize metadata - remove any potentially sensitive or oversized fields
    const sanitizedMetadata = sanitizeMetadata(payload.metadata);

    const insertPayload: AnalyticsEventInsert = {
      user_id: payload.userId,
      client_id: payload.clientId ?? null,
      lead_id: payload.leadId ?? null,
      event_type: payload.eventType,
      event_name: payload.eventName ?? null,
      metadata: sanitizedMetadata,
    };

    try {
      const { error } = await analyticsEventsTable().insert(insertPayload);

      if (error) {
        logAnalyticsError('insert', error);
      }
    } catch (err) {
      logAnalyticsError('exception', err);
    }
  },

  /**
   * Get analytics data for super admin dashboard.
   * @param params - Optional date range parameters
   */
  async getSuperAdminAnalytics(params?: { startAt?: string | null; endAt?: string | null }) {
    try {
      const { data, error } = await analyticsSupabase.rpc('get_super_admin_analytics', {
        start_at: params?.startAt ?? null,
        end_at: params?.endAt ?? null,
      });

      if (error) throw error;
      return normalizeSuperAdminAnalytics(data);
    } catch (err) {
      console.error('[Analytics] Failed to fetch super admin analytics:', err);
      throw err;
    }
  },
};
