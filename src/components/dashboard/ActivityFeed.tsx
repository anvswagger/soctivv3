import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InteractionEvent } from '@/types/analytics';
import { Phone, MessageSquare, Calendar, UserPlus, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
    events: InteractionEvent[];
    className?: string;
}

const eventTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
    call: { icon: Phone, color: 'text-blue-500', label: 'مكالمة' },
    sms: { icon: MessageSquare, color: 'text-green-500', label: 'رسالة' },
    appointment: { icon: Calendar, color: 'text-purple-500', label: 'موعد' },
    new_lead: { icon: UserPlus, color: 'text-amber-500', label: 'عميل جديد' },
    status_change: { icon: RefreshCw, color: 'text-info', label: 'تحديث حالة' },
    default: { icon: AlertCircle, color: 'text-muted-foreground', label: 'نشاط' },
};

export function ActivityFeed({ events, className }: ActivityFeedProps) {
    return (
        <Card className={cn("flex flex-col h-full", className)}>
            <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    نشرة النشاط المباشرة
                    <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-4 sm:px-6 scrollbar-hide pb-6">
                <div className="relative space-y-6 before:absolute before:inset-y-0 before:right-[1.15rem] before:w-[1px] before:bg-border/60">
                    {events.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            لا توجد أنشطة حديثة
                        </div>
                    ) : (
                        events.map((event) => {
                            const config = eventTypeConfig[event.eventType] || eventTypeConfig.default;
                            const Icon = config.icon;

                            return (
                                <div key={event.id} className="relative pr-10">
                                    {/* Timeline Dot & Icon */}
                                    <div className={cn(
                                        "absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border bg-background z-10",
                                        config.color,
                                        "border-current/20 shadow-sm"
                                    )}>
                                        <Icon className="h-4 w-4" />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                {config.label}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatDateTime(event.timestamp)}
                                            </span>
                                        </div>

                                        <p className="text-sm font-medium leading-tight text-foreground">
                                            {event.notes || 'نشاط جديد في النظام'}
                                        </p>

                                        {event.outcome && (
                                            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground w-fit">
                                                {event.outcome}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
