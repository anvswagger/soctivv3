import { supabase } from '@/integrations/supabase/client';
import { CallLog, CallLogInsert } from '@/types/database';
import { analyticsService } from '@/services/analyticsService';

export interface CallLogStats {
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  outcomeCounts: Record<string, number>;
  goldPoints: number;
  recentLogs: (CallLog & {
    lead?: { first_name: string; last_name: string } | null;
  })[];
}

export const callLogsService = {
  async createLog(log: CallLogInsert) {
    const { data, error } = await (supabase as any)
      .from('call_logs')
      .insert(log)
      .select()
      .single();

    if (error) throw error;

    if (log.user_id) {
      void analyticsService.trackEvent({
        userId: log.user_id,
        clientId: log.client_id ?? null,
        leadId: log.lead_id ?? null,
        eventType: 'call_logged',
        eventName: log.status ?? 'unknown',
        metadata: {
          duration: log.duration ?? 0,
        },
      });
    }
    return data as CallLog;
  },

  async getLogs(filters?: { userId?: string; dateRange?: { start: Date; end: Date }; limit?: number }) {
    let query = (supabase as any)
      .from('call_logs')
      .select('*, lead:leads(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query as { data: any[] | null, error: any };
    if (error) throw error;

    return (data ?? []) as (CallLog & {
      lead?: { first_name: string; last_name: string } | null;
    })[];
  },

  async getGoldPoints(userId?: string, dateRange?: { start: Date; end: Date }) {
    let query = supabase
      .from('user_gold_points')
      .select('points, created_at:earned_at');

    if (userId) {
      query = query.eq('user_id', userId as any);
    }

    if (dateRange) {
      query = query
        .gte('earned_at', dateRange.start.toISOString())
        .lte('earned_at', dateRange.end.toISOString());
    }

    const { data, error } = await query as { data: any[] | null, error: any };

    if (error) {
      console.error('Error fetching gold points:', error);
      return 0;
    }

    return (data as any[] ?? []).reduce((acc, curr) => acc + (curr.points || 0), 0);
  },

  async getStats(userId?: string, dateRange?: { start: Date; end: Date }): Promise<CallLogStats> {
    const [logs, goldPoints] = await Promise.all([
      this.getLogs({ userId, dateRange }),
      this.getGoldPoints(userId, dateRange),
    ]);

    const totalCalls = logs.length;
    const totalDuration = logs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    const outcomeCounts = logs.reduce((acc: Record<string, number>, curr) => {
      const key = curr.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      totalCalls,
      totalDuration,
      avgDuration,
      outcomeCounts,
      goldPoints,
      recentLogs: logs.slice(0, 10),
    };
  },
};
