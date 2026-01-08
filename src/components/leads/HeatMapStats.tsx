import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { LeadWithRelations } from '@/types/app';
import { getHeatLevelFromTimestamp, type HeatLevel } from '@/hooks/useLeadTimer';
import { cn } from '@/lib/utils';

interface HeatMapStatsProps {
    leads: LeadWithRelations[];
}

export function HeatMapStats({ leads }: HeatMapStatsProps) {
    const stats = useMemo(() => {
        const counts: Record<HeatLevel, number> = { gold: 0, warm: 0, cold: 0 };

        leads.forEach(lead => {
            if (lead.status === 'new' || lead.status === 'contacting') {
                const heatLevel = getHeatLevelFromTimestamp(lead.created_at, null);
                counts[heatLevel]++;
            }
        });

        const total = counts.gold + counts.warm + counts.cold;

        return {
            counts,
            total,
            percentages: {
                gold: total > 0 ? (counts.gold / total) * 100 : 0,
                warm: total > 0 ? (counts.warm / total) * 100 : 0,
                cold: total > 0 ? (counts.cold / total) * 100 : 0,
            }
        };
    }, [leads]);

    const heatItems = [
        { level: 'gold' as HeatLevel, label: 'ذهبي', icon: Flame, color: 'text-amber-600', count: stats.counts.gold },
        { level: 'warm' as HeatLevel, label: 'دافئ', icon: Thermometer, color: 'text-blue-600', count: stats.counts.warm },
        { level: 'cold' as HeatLevel, label: 'بارد', icon: Snowflake, color: 'text-slate-500', count: stats.counts.cold },
    ];

    return (
        <Card className="shadow-sm border border-border/60">
            <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">تحليل الحرارة</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
                {/* Minimalist Progress Bar */}
                <div className="h-2 w-full flex rounded-full overflow-hidden bg-secondary">
                    {stats.percentages.gold > 0 && <div className="bg-amber-500" style={{ width: `${stats.percentages.gold}%` }} />}
                    {stats.percentages.warm > 0 && <div className="bg-blue-500" style={{ width: `${stats.percentages.warm}%` }} />}
                    {stats.percentages.cold > 0 && <div className="bg-slate-300 dark:bg-slate-700" style={{ width: `${stats.percentages.cold}%` }} />}
                </div>

                {/* Clean Grid Stats */}
                <div className="grid grid-cols-3 gap-4">
                    {heatItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <div key={item.level} className="flex flex-col items-center">
                                <span className={cn("text-2xl font-bold tracking-tight", item.color)}>
                                    {item.count}
                                </span>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                    <Icon className="h-3 w-3" />
                                    <span>{item.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
