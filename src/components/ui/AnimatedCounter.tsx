import { CountUp } from "./CountUp";
import { TrendIndicator } from "./TrendIndicator";
import { MiniSparkline } from "./MiniSparkline";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  label?: string;
  trend?: number;
  sparkData?: number[];
  sparkColor?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  valueClassName?: string;
}

export function AnimatedCounter({
  value,
  label,
  trend,
  sparkData,
  sparkColor,
  prefix,
  suffix,
  decimals = 0,
  duration = 2,
  className,
  valueClassName,
}: AnimatedCounterProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-2">
        <CountUp
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          duration={duration}
          className={valueClassName}
        />
        {trend !== undefined && <TrendIndicator value={trend} />}
        {sparkData && (
          <MiniSparkline data={sparkData} color={sparkColor} />
        )}
      </div>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
