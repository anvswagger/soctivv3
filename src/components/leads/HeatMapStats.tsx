import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { Lead } from '@/types/database';
import { getHeatLevelFromTimestamp, type HeatLevel } from '@/hooks/useLeadTimer';
import { cn } from '@/lib/utils';

interface HeatMapStatsProps {
  leads: Lead[];
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
    { 
      level: 'gold' as HeatLevel, 
      label: 'ذهبي', 
      icon: Flame, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-500',
      description: '0-5 دقائق'
    },
    { 
      level: 'warm' as HeatLevel, 
      label: 'دافئ', 
      icon: Thermometer, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500',
      description: '5-15 دقيقة'
    },
    { 
      level: 'cold' as HeatLevel, 
      label: 'بارد', 
      icon: Snowflake, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted-foreground',
      description: '+15 دقيقة'
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          خريطة الحرارة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Heat Bar */}
        <div className="h-3 rounded-full overflow-hidden flex bg-muted">
          {stats.percentages.gold > 0 && (
            <div 
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${stats.percentages.gold}%` }}
            />
          )}
          {stats.percentages.warm > 0 && (
            <div 
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${stats.percentages.warm}%` }}
            />
          )}
          {stats.percentages.cold > 0 && (
            <div 
              className="bg-muted-foreground/50 transition-all duration-500"
              style={{ width: `${stats.percentages.cold}%` }}
            />
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          {heatItems.map(item => {
            const Icon = item.icon;
            const count = stats.counts[item.level];
            
            return (
              <div 
                key={item.level}
                className={cn(
                  'text-center p-2 rounded-lg bg-muted/50',
                  count > 0 && item.level === 'gold' && 'ring-2 ring-amber-500/50'
                )}
              >
                <div className={cn('flex items-center justify-center gap-1', item.color)}>
                  <Icon className="h-4 w-4" />
                  <span className="text-xl font-bold">{count}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            );
          })}
        </div>

        {stats.counts.gold > 0 && (
          <p className="text-xs text-amber-500 text-center animate-pulse">
            🔥 {stats.counts.gold} leads تحتاج اتصال فوري!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
