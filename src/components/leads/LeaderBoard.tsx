import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LeaderBoardEntry {
  user_id: string;
  full_name: string;
  gold_points: number;
  rank: number;
}

export function LeaderBoard() {
  const [entries, setEntries] = useState<LeaderBoardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    
    // Get today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // First get gold points for today
    const { data: pointsData, error: pointsError } = await (supabase as any)
      .from('user_gold_points')
      .select('user_id, points')
      .gte('earned_at', today.toISOString());

    if (pointsError) {
      console.error('Error fetching gold points:', pointsError);
      setLoading(false);
      return;
    }

    if (!pointsData || pointsData.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Aggregate points per user
    const userPoints: Record<string, number> = {};
    pointsData.forEach((entry: any) => {
      const userId = entry.user_id;
      if (!userPoints[userId]) {
        userPoints[userId] = 0;
      }
      userPoints[userId] += entry.points || 1;
    });

    // Get unique user IDs
    const userIds = Object.keys(userPoints);

    // Fetch profiles for these users
    const { data: profilesData, error: profilesError } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    // Map profiles
    const profilesMap: Record<string, string> = {};
    (profilesData || []).forEach((profile: any) => {
      profilesMap[profile.id] = profile.full_name || 'مستخدم';
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

    setEntries(sorted);
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-amber-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-slate-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-700" />;
      default:
        return <Star className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-amber-500/10 border-amber-500/30';
      case 2:
        return 'bg-slate-400/10 border-slate-400/30';
      case 3:
        return 'bg-amber-700/10 border-amber-700/30';
      default:
        return 'bg-muted/50';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          لوحة المتصدرين اليوم
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            لا توجد نقاط ذهبية اليوم بعد
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg border',
                  getRankBg(entry.rank)
                )}
              >
                <div className="flex items-center gap-2">
                  {getRankIcon(entry.rank)}
                  <span className="font-medium text-sm">{entry.full_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-amber-500 font-bold">{entry.gold_points}</span>
                  <span className="text-xs text-muted-foreground">نقطة</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
