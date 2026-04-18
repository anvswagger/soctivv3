import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { CountUp } from "./CountUp";
import { MiniSparkline } from "./MiniSparkline";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: "blue" | "green" | "purple" | "amber" | "red" | "indigo" | "cyan";
  trend?: number;
  sparkData?: number[];
  suffix?: string;
  prefix?: string;
  decimals?: number;
  delay?: number;
  className?: string;
}

const colorMap: Record<string, {
  iconBg: string;
  iconColor: string;
  borderColor: string;
  sparkColor: string;
}> = {
  blue: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    borderColor: "border-blue-500/20 hover:border-blue-500/40",
    sparkColor: "hsl(217 91% 60%)",
  },
  green: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
    sparkColor: "hsl(160 84% 39%)",
  },
  purple: {
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    borderColor: "border-purple-500/20 hover:border-purple-500/40",
    sparkColor: "hsl(271 91% 65%)",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    borderColor: "border-amber-500/20 hover:border-amber-500/40",
    sparkColor: "hsl(38 92% 50%)",
  },
  red: {
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    borderColor: "border-red-500/20 hover:border-red-500/40",
    sparkColor: "hsl(0 84% 60%)",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    borderColor: "border-indigo-500/20 hover:border-indigo-500/40",
    sparkColor: "hsl(239 84% 67%)",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-500",
    borderColor: "border-cyan-500/20 hover:border-cyan-500/40",
    sparkColor: "hsl(189 94% 43%)",
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  sparkData,
  suffix = "",
  prefix = "",
  decimals = 0,
  delay = 0,
  className,
}: StatCardProps) {
  const colors = colorMap[color] || colorMap.blue;
  const isNumeric = typeof value === "number";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: delay * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn("stat-card", className)}
    >
      <div
        className={cn(
          "rounded-xl border bg-card p-4 sm:p-5 transition-all duration-300",
          colors.borderColor
        )}
      >
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border",
              colors.iconBg,
              colors.borderColor.split(" ")[0]
            )}
          >
            <Icon className={cn("h-5 w-5 sm:h-[22px] sm:w-[22px]", colors.iconColor)} />
          </div>
          {sparkData && sparkData.length >= 2 && (
            <MiniSparkline
              data={sparkData}
              color={colors.sparkColor}
              width={56}
              height={20}
            />
          )}
        </div>

        <div className="mt-3 sm:mt-4">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            {isNumeric ? (
              <CountUp
                end={value as number}
                decimals={decimals}
                prefix={prefix}
                suffix={suffix}
                className="text-xl sm:text-2xl font-black text-foreground"
              />
            ) : (
              <span className="text-xl sm:text-2xl font-black text-foreground">
                {prefix}
                {value}
                {suffix}
              </span>
            )}
            {trend !== undefined && (
              <span
                className={cn(
                  "text-xs font-semibold",
                  trend >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {trend >= 0 ? "+" : ""}
                {trend}%
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
