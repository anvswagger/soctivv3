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
    
    const { data, error } = await (supabase as any)
      .from('user_gold_points')
      .select(`
        user_id,
        profiles!inner(full_name)
      `)
      .gte('earned_at', today.toISOString());

    if (!error && data) {
      // Aggregate points per user
      const userPoints: Record<string, { full_name: string; points: number }> = {};
      
      data.forEach((entry: any) => {
        const userId = entry.user_id;
        if (!userPoints[userId]) {
          userPoints[userId] = {
            full_name: entry.profiles?.full_name || 'مستخدم',
            points: 0
          };
        }
        userPoints[userId].points++;
      });

      // Convert to array and sort
      const sorted = Object.entries(userPoints)
        .map(([user_id, data], index) => ({
          user_id,
          full_name: data.full_name,
          gold_points: data.points,
          rank: index + 1
        }))
        .sort((a, b) => b.gold_points - a.gold_points)
        .slice(0, 5);

      // Update ranks after sorting
      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setEntries(sorted);
    }
    
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
