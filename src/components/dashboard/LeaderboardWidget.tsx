import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    points: number;
    rank: number;
}

const rankStyles: Record<number, { border: string; badge: string; icon: typeof Trophy }> = {
    1: { border: 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: Trophy },
    2: { border: 'border-slate-300', badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400', icon: Medal },
    3: { border: 'border-orange-300', badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', icon: Medal },
};

export function LeaderboardWidget() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const { data: pointsData, error } = await supabase
                .from('user_gold_points')
                .select('user_id, points, created_at:earned_at');

            if (error) throw error;

            const userPoints: Record<string, number> = {};
            pointsData.forEach((p: any) => {
                userPoints[p.user_id] = (userPoints[p.user_id] || 0) + (p.points || 0);
            });

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

            const leaderboard = (profiles || []).map(profile => ({
                user_id: profile.id,
                full_name: profile.full_name || 'مستخدم',
                avatar_url: profile.avatar_url,
                points: userPoints[profile.id] || 0,
                rank: 0
            }))
                .sort((a, b) => b.points - a.points)
                .map((entry, index) => ({ ...entry, rank: index + 1 }))
                .slice(0, 5);

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
        <Card className="col-span-1 border-amber-200/50 dark:border-amber-900/30 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/15 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400/60 via-amber-500/30 to-transparent" />
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
                <div className="space-y-3">
                    {leaders.length === 0 ? (
                        <EmptyState
                            icon={Trophy}
                            title="لا توجد بيانات"
                            description="لا توجد بيانات تصنيف حالياً"
                            compact
                        />
                    ) : (
                        leaders.map((leader, index) => {
                            const style = rankStyles[leader.rank] || { border: 'border-transparent', badge: 'bg-muted text-muted-foreground', icon: Award };
                            const RankIcon = style.icon;

                            return (
                                <motion.div
                                    key={leader.user_id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.06 }}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-500/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className={cn("h-10 w-10 border-2", style.border)}>
                                                <AvatarImage src={leader.avatar_url || undefined} />
                                                <AvatarFallback className="text-sm font-bold">{leader.full_name[0]}</AvatarFallback>
                                            </Avatar>
                                            {leader.rank <= 3 && (
                                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                                                    <RankIcon className={cn(
                                                        "h-3 w-3",
                                                        leader.rank === 1 && "text-amber-500 fill-amber-500",
                                                        leader.rank === 2 && "text-slate-400 fill-slate-400",
                                                        leader.rank === 3 && "text-orange-400 fill-orange-400",
                                                    )} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-none">{leader.full_name}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">الترتيب #{leader.rank}</p>
                                        </div>
                                    </div>
                                    <Badge className={cn("flex items-center gap-1 font-mono tabular-nums", style.badge)}>
                                        <Award className="h-3 w-3" />
                                        {leader.points}
                                    </Badge>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
