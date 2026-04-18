import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { LeadWithRelations } from '@/types/app';
import { getHeatLevelFromTimestamp, type HeatLevel } from '@/hooks/useLeadTimer';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
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

    const heatItems = [
        { level: 'gold' as HeatLevel, label: 'ذهبي', icon: Flame, color: 'text-amber-600', bgColor: 'bg-amber-500', count: stats.counts.gold },
        { level: 'warm' as HeatLevel, label: 'دافئ', icon: Thermometer, color: 'text-blue-600', bgColor: 'bg-blue-500', count: stats.counts.warm },
        { level: 'cold' as HeatLevel, label: 'بارد', icon: Snowflake, color: 'text-slate-500', bgColor: 'bg-slate-400', count: stats.counts.cold },
    ];

    return (
        <Card className="shadow-sm border border-border/60">
            <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">تحليل الحرارة</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
                {/* Animated Progress Bar */}
                <div className="h-3 w-full flex rounded-full overflow-hidden bg-secondary">
                    {heatItems.map((item, i) => (
                        item.count > 0 && (
                            <motion.div
                                key={item.level}
                                className={cn(item.bgColor, item.level === 'gold' && 'animate-pulse-soft')}
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.percentages[item.level]}%` }}
                                transition={{ duration: 0.8, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                            />
                        )
                    ))}
                </div>

                {/* Clickable Grid Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {heatItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <motion.button
                                key={item.level}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.2 + heatItems.indexOf(item) * 0.1 }}
                                onClick={() => onFilterByHeat?.(item.level)}
                                className={cn(
                                    "flex flex-col items-center p-3 rounded-xl transition-all duration-200",
                                    "hover:bg-muted/50 active:scale-95",
                                    onFilterByHeat && "cursor-pointer"
                                )}
                            >
                                <CountUp
                                    end={item.count}
                                    className={cn("text-2xl font-bold tracking-tight", item.color)}
                                />
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                    <Icon className="h-3.5 w-3.5" />
                                    <span>{item.label}</span>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
