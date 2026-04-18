import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InteractionEvent } from '@/types/analytics';
import { Phone, MessageSquare, Calendar, UserPlus, RefreshCw, AlertCircle, Activity } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { EmptyState } from '@/components/ui/EmptyState';

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 7) return `منذ ${days} يوم`;
  return formatDateTime(timestamp);
}

interface ActivityFeedProps {
    events: InteractionEvent[];
    className?: string;
}

const eventTypeConfig: Record<string, { icon: any; color: string; bgColor: string; borderColor: string; label: string }> = {
    call: { icon: Phone, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-l-blue-500', label: 'مكالمة' },
    sms: { icon: MessageSquare, color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-l-green-500', label: 'رسالة' },
    appointment: { icon: Calendar, color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-l-purple-500', label: 'موعد' },
    new_lead: { icon: UserPlus, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-l-amber-500', label: 'عميل جديد' },
    status_change: { icon: RefreshCw, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', borderColor: 'border-l-cyan-500', label: 'تحديث حالة' },
    default: { icon: AlertCircle, color: 'text-muted-foreground', bgColor: 'bg-muted/50', borderColor: 'border-l-muted-foreground/30', label: 'نشاط' },
};

export function ActivityFeed({ events, className }: ActivityFeedProps) {
    return (
        <Card className={cn("flex flex-col h-full", className)}>
            <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    نشرة النشاط المباشرة
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-4 sm:px-6 scrollbar-hide pb-6">
                <div className="relative space-y-1 before:absolute before:inset-y-0 before:right-[1.15rem] before:w-[1px] before:bg-gradient-to-b before:from-border/60 before:to-transparent">
                    {events.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="لا توجد أنشطة حديثة"
                            description="ستظهر هنا آخر التحديثات والنشاطات"
                            compact
                        />
                    ) : (
                        events.map((event, index) => {
                            const config = eventTypeConfig[event.eventType] || eventTypeConfig.default;
                            const Icon = config.icon;
                            const borderColorClass = config.borderColor;

                            return (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        duration: 0.35,
                                        delay: index * 0.06,
                                        ease: [0.16, 1, 0.3, 1],
                                    }}
                                    className={cn(
                                        "relative pr-10 py-3 pl-3 rounded-lg border-l-[3px] bg-card/30 hover:bg-muted/30 transition-colors",
                                        borderColorClass
                                    )}
                                >
                                    {/* Timeline Dot & Icon */}
                                    {index < 2 && (
                                        <span className="absolute right-[-2px] top-[6px] flex h-3 w-3">
                                            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.bgColor)} />
                                            <span className={cn("relative inline-flex rounded-full h-3 w-3", config.bgColor)} />
                                        </span>
                                    )}
                                    <div className={cn(
                                        "absolute right-0 top-3 flex h-10 w-10 items-center justify-center rounded-full border bg-background z-10 transition-transform hover:scale-110",
                                        config.color,
                                        "border-current/15 shadow-sm"
                                    )}>
                                        <Icon className="h-5 w-5" />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className={cn(
                                                "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                                                config.bgColor,
                                                config.color
                                            )}>
                                                {config.label}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {timeAgo(event.timestamp)}
                                            </span>
                                        </div>

                                        <p className="text-sm font-medium leading-tight text-foreground">
                                            {event.notes || 'نشاط جديد في النظام'}
                                        </p>

                                        {event.outcome && (
                                            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground w-fit">
                                                {event.outcome}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
