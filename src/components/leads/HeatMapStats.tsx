import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { LeadWithRelations } from '@/types/app';
import { getHeatLevelFromTimestamp, type HeatLevel } from '@/hooks/useLeadTimer';
import { cn } from '@/lib/utils';
import { CountUp } from '@/components/ui/CountUp';

interface HeatMapStatsProps {
    leads: LeadWithRelations[];
    onFilterByHeat?: (level: HeatLevel) => void;
}

export function HeatMapStats({ leads, onFilterByHeat }: HeatMapStatsProps) {
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

    // Memoize the items array so motion/CountUp components don't receive new references each render.
    const heatItems = useMemo(() => [
        { level: 'gold' as HeatLevel, label: 'ذهبي', icon: Flame, color: 'text-amber-600', bgColor: 'bg-amber-500', count: stats.counts.gold, percentage: stats.percentages.gold },
        { level: 'warm' as HeatLevel, label: 'دافئ', icon: Thermometer, color: 'text-blue-600', bgColor: 'bg-blue-500', count: stats.counts.warm, percentage: stats.percentages.warm },
        { level: 'cold' as HeatLevel, label: 'بارد', icon: Snowflake, color: 'text-slate-500', bgColor: 'bg-slate-400', count: stats.counts.cold, percentage: stats.percentages.cold },
    ], [stats]);

    return (
        <Card className="shadow-sm border border-border/60">
            <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">تحليل الحرارة</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
                {/* Animated Progress Bar - using pure CSS to avoid re-mounting framer-motion children on every re-render */}
                <div className="h-3 w-full flex rounded-full overflow-hidden bg-secondary">
                    {heatItems.map((item) => (
                        item.count > 0 && (
                            <div
                                key={item.level}
                                className={cn(
                                    item.bgColor,
                                    'transition-[width] duration-700 ease-out',
                                    item.level === 'gold' && 'animate-pulse'
                                )}
                                style={{ width: `${item.percentage}%` }}
                            />
                        )
                    ))}
                </div>

                {/* Clickable Grid Stats - using simple CSS animations to avoid framer-motion layout thrash */}
                <div className="grid grid-cols-3 gap-3">
                    {heatItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.level}
                                onClick={() => onFilterByHeat?.(item.level)}
                                className={cn(
                                    "flex flex-col items-center p-3 rounded-xl transition-all duration-200",
                                    "hover:bg-muted/50 active:scale-95 motion-reduce:transition-none",
                                    onFilterByHeat && "cursor-pointer",
                                    "animate-fade-in-up"
                                )}
                                style={{ animationDelay: `${heatItems.indexOf(item) * 80}ms`, animationFillMode: 'both' }}
                            >
                                <CountUp
                                    end={item.count}
                                    className={cn("text-2xl font-bold tracking-tight", item.color)}
                                />
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                    <Icon className="h-3.5 w-3.5" />
                                    <span>{item.label}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
