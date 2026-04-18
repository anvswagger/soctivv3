import { cn } from "@/lib/utils";

interface MiniSparklineProps {
  data: number[];
  className?: string;
  color?: string;
  height?: number;
  width?: number;
}

export function MiniSparkline({
  data,
  className,
  color = "hsl(var(--primary))",
  height = 24,
  width = 64,
}: MiniSparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 2;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * effectiveWidth;
    const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;

  // Area fill path
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.split(",")[0]},${height - padding} L ${firstPoint.split(",")[0]},${height - padding} Z`;

  const trend = data[data.length - 1] - data[0];
  const trendColor = trend >= 0 ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)";

  return (
    <svg
      width={width}
      height={height}
      className={cn("inline-block", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={`sparkline-grad-${width}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend >= 0 ? color : trendColor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={trend >= 0 ? color : trendColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#sparkline-grad-${width})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke={trend >= 0 ? color : trendColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
