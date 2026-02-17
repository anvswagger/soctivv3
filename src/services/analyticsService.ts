import { supabase } from '@/integrations/supabase/client';
import type { SuperAdminAnalyticsResponse } from '@/types/analytics';
import type { AnalyticsEventInsert } from '@/types/database';

export type AnalyticsEventPayload = {
  userId: string;
  clientId?: string | null;
  leadId?: string | null;
  eventType: string;
  eventName?: string;
  metadata?: Record<string, unknown> | null;
};

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
      const { error } = await (supabase as any)
        .from('analytics_events')
        .insert(insertPayload);

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
      const { data, error } = await (supabase as any).rpc('get_super_admin_analytics', {
        start_at: params?.startAt ?? null,
        end_at: params?.endAt ?? null,
      });

      if (error) throw error;
      return data as SuperAdminAnalyticsResponse;
    } catch (err) {
      console.error('[Analytics] Failed to fetch super admin analytics:', err);
      throw err;
    }
  },
};
