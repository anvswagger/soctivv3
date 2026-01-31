import { supabase } from "@/integrations/supabase/client";
import { CallLog, CallLogInsert } from "@/types/database";

export const callLogsService = {
    // Create a new call log
    async createLog(log: CallLogInsert) {
        const { data, error } = await supabase
            .from('call_logs')
            .insert(log)
            .select()
            .single();

        if (error) {
            console.error('Error creating call log:', error);
            throw error;
        }

        return data;
    },

    // Get logs with optional filters
    async getLogs(filters?: { userId?: string, dateRange?: { start: Date, end: Date }, limit?: number }) {
        let query = supabase
            .from('call_logs')
            .select(`
        *,
        user:user_id(full_name, avatar_url),
        lead:lead_id(first_name, last_name, phone, status),
        client:client_id(company_name)
      `)
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

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching call logs:', error);
            throw error;
        }

        return data as CallLog[];
    },

    // Get gold points for a specific user and date range
    async getGoldPoints(userId?: string, dateRange?: { start: Date, end: Date }) {
        let query = supabase
            .from('user_gold_points')
            .select('points, created_at:earned_at');

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (dateRange) {
            query = query
                .gte('earned_at', dateRange.start.toISOString())
                .lte('earned_at', dateRange.end.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching gold points:', error);
            return 0;
        }

        return data.reduce((acc, curr) => acc + (curr.points || 0), 0);
    },

    // Get statistics for a specific user and date range
    async getStats(userId?: string, dateRange?: { start: Date, end: Date }) {
        // Note: This is a client-side aggregation. For large datasets, consider a database function (RPC).
        const [logs, goldPoints] = await Promise.all([
            this.getLogs({ userId, dateRange, limit: 10000 }),
            this.getGoldPoints(userId, dateRange)
        ]);

        const totalCalls = logs.length;

        const logsWithDuration = logs.filter(l => l.duration > 0);
        const totalDuration = logs.reduce((acc, log) => acc + (log.duration || 0), 0);
        const avgDuration = logsWithDuration.length ? Math.round(totalDuration / logsWithDuration.length) : 0;

        const outcomeCounts = logs.reduce((acc, log) => {
            acc[log.status] = (acc[log.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalCalls,
            totalDuration,
            avgDuration,
            outcomeCounts,
            goldPoints,
            recentLogs: logs.slice(0, 10)
        };
    }
};
