import { supabase } from '@/integrations/supabase/client';
import type { SuperAdminAnalyticsResponse, AnalyticsEventPayload } from '@/types/analytics';
import type { AnalyticsEventInsert } from '@/types/database';

// Facebook Pixel type declaration
declare global {
  interface Window {
    fbq: any;
  }
}

const PIXEL_ID = '1454656709210600';

/**
 * SHA-256 hash a string (used for Advanced Matching email/phone hashing).
 * Returns hex string via SubtleCrypto API.
 */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the Facebook Browser ID (_fbp) cookie value if it exists.
 * Facebook drops this cookie on the first page view.
 */
function getFbp(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/_fbp=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Get the Facebook Click ID (_fbc) cookie or URL parameter.
 * This comes from an ad click (fbclid URL param) and is stored as a cookie by the pixel.
 */
function getFbc(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  // Try URL param first (present on landing from an ad)
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid');
  if (fbclid) {
    // Format: fb.1.{timestamp}.{fbclid}
    return `fb.1.${Date.now()}.${fbclid}`;
  }
  // Fall back to cookie (set by pixel on first page load)
  const match = document.cookie.match(/_fbc=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Generate a globally unique eventID for deduplication.
 * Used when firing both browser pixel and server-side CAPI events.
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${crypto.randomUUID?.()?.slice(0, 8) ?? 'xxxxxxxx'}`;
}

/**
 * Retry queue for pixel events that failed because fbq wasn't loaded yet.
 * Events are retried up to maxRetries times with exponential backoff.
 */
const pixelRetryQueue: Array<{
  fn: () => void;
  eventName: string;
  retries: number;
  maxRetries: number;
  nextRetry: number;
}> = [];

let retryTimer: ReturnType<typeof setTimeout> | null = null;

function processRetryQueue(): void {
  const now = Date.now();
  const pending: typeof pixelRetryQueue = [];
  for (const item of pixelRetryQueue) {
    if (item.retries >= item.maxRetries) {
      if (import.meta.env.DEV) {
        console.warn(`[Soctiv Pixel] Dropping event "${item.eventName}" after ${item.maxRetries} failed retries`);
      }
      continue;
    }
    if (now < item.nextRetry) {
      pending.push(item);
      continue;
    }
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      try {
        item.fn();
        continue; // succeeded, don't re-enqueue
      } catch {
        // failed, retry later
      }
    }
    item.retries++;
    // Exponential backoff: 1s, 2s, 4s, 8s...
    item.nextRetry = now + Math.min(1000 * Math.pow(2, item.retries), 16000);
    pending.push(item);
  }
  pixelRetryQueue.length = 0;
  pixelRetryQueue.push(...pending);

  if (pixelRetryQueue.length > 0) {
    retryTimer = setTimeout(processRetryQueue, 1000);
  } else if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function enqueueOrRun(fn: () => void, eventName: string, maxRetries = 5): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    try {
      fn();
      return;
    } catch {
      // fall through to retry queue
    }
  }
  pixelRetryQueue.push({
    fn,
    eventName,
    retries: 0,
    maxRetries,
    nextRetry: Date.now() + 1000,
  });
  if (!retryTimer) {
    retryTimer = setTimeout(processRetryQueue, 1000);
  }
}

/**
 * Facebook Pixel tracking utility
 * Safely tracks standard Facebook pixel events with:
 * - Advanced Matching (email/phone hashing)
 * - fbp/fbc click attribution
 * - eventID deduplication
 * - Retry queue for delayed script loads
 */
export const facebookPixel = {
  PIXEL_ID,

  /**
   * Initialize the pixel with Advanced Matching customer data.
   * Call this early in the page lifecycle (e.g., when customer data becomes available).
   * @param customerData - Optional customer identifiers for advanced matching
   */
  init(customerData?: { em?: string; ph?: string; fn?: string; ln?: string }): void {
    if (typeof window === 'undefined') return;

    // If fbq already initialized with advanced matching data, skip
    if (customerData) {
      const hashed: Record<string, string> = {};
      const promises: Promise<void>[] = [];

      if (customerData.em) {
        promises.push(
          sha256(customerData.em).then((hash) => { hashed.em = hash; })
        );
      }
      if (customerData.ph) {
        // Normalize phone: remove all non-digit characters
        const phone = customerData.ph.replace(/\D/g, '');
        if (phone.length >= 7) {
          promises.push(
            sha256(phone).then((hash) => { hashed.ph = hash; })
          );
        }
      }
      if (customerData.fn) {
        promises.push(
          sha256(customerData.fn).then((hash) => { hashed.fn = hash; })
        );
      }
      if (customerData.ln) {
        promises.push(
          sha256(customerData.ln).then((hash) => { hashed.ln = hash; })
        );
      }

      Promise.all(promises).then(() => {
        if (typeof window.fbq === 'function') {
          window.fbq('init', PIXEL_ID, hashed);
        }
      });
    }
  },

  /**
   * Track a standard Facebook Pixel event with full enrichment.
   * Automatically includes fbp, fbc, eventID, and timestamp.
   * @param eventName - Standard Facebook event name (Lead, CompleteRegistration, Purchase, etc.)
   * @param parameters - Optional event parameters
   * @param options - Advanced options (eventID override, skip retry, etc.)
   */
  track(
    eventName: string,
    parameters?: Record<string, any>,
    options?: { eventID?: string; skipRetry?: boolean }
  ): void {
    const enrichedParams: Record<string, any> = {
      ...parameters,
    };

    // Auto-inject fbp and fbc for click attribution
    const fbp = getFbp();
    const fbc = getFbc();
    if (fbp) enrichedParams._fbp = fbp;
    if (fbc) enrichedParams._fbc = fbc;

    // Auto-inject eventID for deduplication
    const eventID = options?.eventID ?? generateEventId();
    enrichedParams.eventID = eventID;

    const fireFn = () => {
      if (typeof window !== 'undefined' && typeof window.fbq !== 'undefined') {
        window.fbq('track', eventName, enrichedParams);
      }
    };

    if (options?.skipRetry) {
      fireFn();
    } else {
      enqueueOrRun(fireFn, eventName);
    }
  },

  /**
   * Track a custom Facebook Pixel event with full enrichment.
   * @param eventName - Custom event name
   * @param parameters - Optional event parameters
   * @param options - Advanced options
   */
  trackCustom(
    eventName: string,
    parameters?: Record<string, any>,
    options?: { eventID?: string; skipRetry?: boolean }
  ): void {
    const enrichedParams: Record<string, any> = {
      ...parameters,
    };

    const fbp = getFbp();
    const fbc = getFbc();
    if (fbp) enrichedParams._fbp = fbp;
    if (fbc) enrichedParams._fbc = fbc;

    const eventID = options?.eventID ?? generateEventId();
    enrichedParams.eventID = eventID;

    const fireFn = () => {
      if (typeof window !== 'undefined' && typeof window.fbq !== 'undefined') {
        window.fbq('trackCustom', eventName, enrichedParams);
      }
    };

    if (options?.skipRetry) {
      fireFn();
    } else {
      enqueueOrRun(fireFn, eventName);
    }
  },

  /**
   * Fire a direct image pixel as fallback (works even without fbq script loaded).
   * @param eventName - Event name for the pixel
   * @param parameters - Key-value pairs to send as cd[] parameters
   */
  fireImagePixel(eventName: string, parameters?: Record<string, string>): void {
    if (typeof document === 'undefined') return;
    const params = parameters ?? {};
    const cdParams = Object.entries(params)
      .map(([key, value]) => `cd[${encodeURIComponent(key)}]=${encodeURIComponent(value ?? '')}`)
      .join('&');
    const fbParam = getFbp() ? `&fbp=${encodeURIComponent(getFbp()!)}` : '';
    const fcParam = getFbc() ? `&fbc=${encodeURIComponent(getFbc()!)}` : '';
    const src = `https://www.facebook.com/tr?id=${PIXEL_ID}&ev=${encodeURIComponent(eventName)}&${cdParams}${fbParam}${fcParam}&noscript=1`;

    const img = new Image();
    img.src = src;
    img.style.display = 'none';
    img.setAttribute('aria-hidden', 'true');
    document.body.appendChild(img);
    setTimeout(() => {
      try { document.body.removeChild(img); } catch { /* ignore */ }
    }, 2000);
  },
};

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
    if (!payload.eventType) {
      console.warn('[Analytics] Missing required field: eventType');
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