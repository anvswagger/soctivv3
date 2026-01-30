import { supabase } from '@/integrations/supabase/client';
import { transliterateName } from '@/lib/transliterate';

export interface LeaderBoardEntry {
    user_id: string;
    full_name: string;
    gold_points: number;
    rank: number;
}

export const statsService = {
    getDashboardStats: async (isAdmin: boolean) => {
        // @ts-ignore - get_dashboard_stats is newly added to database
        const { data, error } = await supabase.rpc('get_dashboard_stats', {
            is_admin_query: isAdmin
        });
        if (error) throw error;
        return data;
    },

    getLeaderboard: async (): Promise<LeaderBoardEntry[]> => {
        // Get today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // First get gold points for today
        const { data: pointsData, error: pointsError } = await supabase
            .from('user_gold_points')
            .select('user_id, points')
            .gte('earned_at', today.toISOString());

        if (pointsError) {
            console.error('Error fetching gold points:', pointsError);
            throw pointsError;
        }

        if (!pointsData || pointsData.length === 0) {
            return [];
        }

        // Aggregate points per user
        const userPoints: Record<string, number> = {};
        pointsData.forEach((entry) => {
            const userId = entry.user_id;
            if (!userPoints[userId]) {
                userPoints[userId] = 0;
            }
            userPoints[userId] += entry.points || 1;
        });

        // Get unique user IDs
        const userIds = Object.keys(userPoints);

        // Fetch profiles for these users
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            throw profilesError;
        }

        // Map profiles
        const profilesMap: Record<string, string> = {};
        (profilesData || []).forEach((profile: any) => {
            profilesMap[profile.id] = transliterateName(profile.full_name) || 'مستخدم';
        });

        // Convert to array and sort
        const sorted = Object.entries(userPoints)
            .map(([user_id, points]) => ({
                user_id,
                full_name: profilesMap[user_id] || 'مستخدم',
                gold_points: points,
                rank: 0
            }))
            .sort((a, b) => b.gold_points - a.gold_points)
            .slice(0, 5);

        // Update ranks after sorting
        sorted.forEach((entry, index) => {
            entry.rank = index + 1;
        });

        return sorted;
    }
};
