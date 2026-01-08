import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import { statsService } from '@/services/statsService';
import { cn } from '@/lib/utils';

export function LeaderBoard() {
    const { data: entries = [], isLoading: loading } = useQuery({
        queryKey: ['leaderboard'],
        queryFn: statsService.getLeaderboard,
    });

    return (
        <Card className="shadow-sm border border-border/60 h-full">
            <CardHeader className="pb-3 pt-5 px-5 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-600" />
                    <span>المتصدرين اليوم</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        لا توجد نقاط اليوم
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {entries.map((entry, index) => (
                            <div
                                key={entry.user_id}
                                className="flex items-center justify-between py-3 px-5 hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "flex items-center justify-center w-6 h-6 rounded text-xs font-bold",
                                        index === 0 ? "text-amber-700 bg-amber-50" :
                                            index === 1 ? "text-slate-700 bg-slate-100" :
                                                index === 2 ? "text-orange-800 bg-orange-50" : "text-muted-foreground"
                                    )}>
                                        {entry.rank}
                                    </span>
                                    <span className={cn("text-sm font-medium", index === 0 && "font-semibold")}>
                                        {entry.full_name}
                                    </span>
                                </div>
                                <div className="font-mono font-medium text-sm">
                                    {entry.gold_points} <span className="text-xs text-muted-foreground font-sans">نقطة</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
