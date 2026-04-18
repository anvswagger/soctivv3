import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

interface TrendIndicatorProps {
  value?: number;
  showIcon?: boolean;
  showSign?: boolean;
  className?: string;
}

export function TrendIndicator({
  value,
  showIcon = true,
  showSign = true,
  className,
}: TrendIndicatorProps) {
  if (value === undefined || value === 0) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground",
          className
        )}
      >
        {showIcon && <Minus className="h-3 w-3" />}
        <span>0%</span>
      </motion.span>
    );
  }

  const isPositive = value > 0;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
        className
      )}
    >
      {showIcon &&
        (isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        ))}
      <span>
        {showSign && isPositive ? "+" : ""}
        {value}%
      </span>
    </motion.span>
  );
}
