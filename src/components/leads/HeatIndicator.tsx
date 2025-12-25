import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeatLevel } from '@/hooks/useLeadTimer';

interface HeatIndicatorProps {
  heatLevel: HeatLevel;
  formattedTime: string;
  isExpiring?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const heatConfig = {
  gold: {
    label: 'ذهبي',
    icon: Flame,
    bgClass: 'bg-amber-500/20',
    textClass: 'text-amber-500',
    borderClass: 'border-amber-500',
    glowClass: 'shadow-[0_0_15px_hsl(38_92%_50%/0.5)]',
  },
  warm: {
    label: 'دافئ',
    icon: Thermometer,
    bgClass: 'bg-blue-500/20',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500',
    glowClass: '',
  },
  cold: {
    label: 'بارد',
    icon: Snowflake,
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-muted',
    glowClass: '',
  },
};

const sizeConfig = {
  sm: {
    container: 'px-2 py-1 text-xs gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    container: 'px-3 py-1.5 text-sm gap-1.5',
    icon: 'h-4 w-4',
  },
  lg: {
    container: 'px-4 py-2 text-base gap-2',
    icon: 'h-5 w-5',
  },
};

export function HeatIndicator({ 
  heatLevel, 
  formattedTime, 
  isExpiring = false,
  size = 'md',
  showLabel = true 
}: HeatIndicatorProps) {
  const config = heatConfig[heatLevel];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bgClass,
        config.textClass,
        config.borderClass,
        sizeStyles.container,
        heatLevel === 'gold' && config.glowClass,
        isExpiring && 'animate-pulse'
      )}
    >
      <Icon className={cn(sizeStyles.icon, heatLevel === 'gold' && 'animate-bounce')} />
      <span className="font-mono tabular-nums">{formattedTime}</span>
      {showLabel && <span className="font-normal">• {config.label}</span>}
    </div>
  );
}
