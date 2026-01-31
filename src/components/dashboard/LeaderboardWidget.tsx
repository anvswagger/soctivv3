import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface LeaderboardEntry {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    points: number;
    rank: number;
}

export function LeaderboardWidget() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            // This is a simplified client-side aggregation. 
            // For production with many users, use a database view or RPC.
            const { data: pointsData, error } = await supabase
                .from('user_gold_points')
                .select('user_id, points, created_at:earned_at');

            if (error) throw error;

            // Aggregate points per user
            const userPoints: Record<string, number> = {};
            pointsData.forEach((p: any) => {
                userPoints[p.user_id] = (userPoints[p.user_id] || 0) + (p.points || 0);
            });

            // Fetch user profiles
            const userIds = Object.keys(userPoints);
            if (userIds.length === 0) {
                setLeaders([]);
                setLoading(false);
                return;
            }

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds);

            // Combine and sort
            const leaderboard = (profiles || []).map(profile => ({
                user_id: profile.id,
                full_name: profile.full_name || 'مستخدم',
                avatar_url: profile.avatar_url,
                points: userPoints[profile.id] || 0,
                rank: 0
            }))
                .sort((a, b) => b.points - a.points)
                .map((entry, index) => ({ ...entry, rank: index + 1 }))
                .slice(0, 5); // Top 5

            setLeaders(leaderboard);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card className="col-span-1 border-amber-200 dark:border-amber-900 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                            <Trophy className="h-5 w-5 fill-amber-500 text-amber-600" />
                            لوحة المتصدرين
                        </CardTitle>
                        <CardDescription>أفضل الأداء هذا الشهر (النقاط الذهبية)</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {leaders.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-4">لا توجد بيانات كافية بعد 📉</p>
                    ) : (
                        leaders.map((leader) => (
                            <div key={leader.user_id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className={`h-10 w-10 border-2 ${leader.rank === 1 ? 'border-amber-500' :
                                                leader.rank === 2 ? 'border-slate-400' :
                                                    leader.rank === 3 ? 'border-orange-400' : 'border-transparent'
                                            }`}>
                                            <AvatarImage src={leader.avatar_url || undefined} />
                                            <AvatarFallback>{leader.full_name[0]}</AvatarFallback>
                                        </Avatar>
                                        {leader.rank <= 3 && (
                                            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                                                {leader.rank === 1 && <Trophy className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                                {leader.rank === 2 && <Medal className="h-3 w-3 text-slate-400 fill-slate-400" />}
                                                {leader.rank === 3 && <Medal className="h-3 w-3 text-orange-400 fill-orange-400" />}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-none">{leader.full_name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">الترتيب #{leader.rank}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="flex items-center gap-1 font-mono text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Award className="h-3 w-3" />
                                    {leader.points}
                                </Badge>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
