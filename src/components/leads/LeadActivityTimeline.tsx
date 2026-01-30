
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
    MessageSquare,
    Calendar,
    Clock,
    UserPlus,
    History
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeadActivityTimelineProps {
    leadId: string;
    leadCreatedAt: string;
}

export function LeadActivityTimeline({ leadId, leadCreatedAt }: LeadActivityTimelineProps) {
    const { data: activities = [], isLoading } = useQuery({
        queryKey: ['lead-activities', leadId],
        queryFn: async () => {
            const [smsRes, appointmentsRes] = await Promise.all([
                supabase.from('sms_logs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
                supabase.from('appointments').select('*').eq('lead_id', leadId).order('scheduled_at', { ascending: false }),
            ]);

            const events: any[] = [
                {
                    type: 'creation',
                    date: new Date(leadCreatedAt),
                    title: 'تمت إضافة العميل',
                    icon: <UserPlus className="h-4 w-4" />,
                    color: 'bg-blue-500'
                }
            ];

            if (smsRes.data) {
                smsRes.data.forEach(sms => {
                    events.push({
                        type: 'sms',
                        date: new Date(sms.created_at),
                        title: `إرسال رسالة: ${sms.status === 'sent' ? 'تم الإرسال' : 'فشل'}`,
                        description: sms.message,
                        icon: <MessageSquare className="h-4 w-4" />,
                        color: 'bg-green-500'
                    });
                });
            }

            if (appointmentsRes.data) {
                appointmentsRes.data.forEach(apt => {
                    events.push({
                        type: 'appointment',
                        date: new Date(apt.created_at), // When it was created
                        title: `تم حجز موعد: ${format(new Date(apt.scheduled_at), 'PPP p', { locale: ar })}`,
                        description: apt.notes ? `ملاحظات: ${apt.notes}` : undefined,
                        icon: <Calendar className="h-4 w-4" />,
                        color: 'bg-purple-500'
                    });
                });
            }

            return events.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
    });

    if (isLoading) return <div className="p-4 text-center">جاري التحميل...</div>;

    return (
        <ScrollArea className="h-[400px] w-full pr-4" dir="rtl">
            <div className="space-y-8 relative before:absolute before:right-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-muted">
                {activities.map((activity, index) => (
                    <div key={index} className="relative pr-8">
                        <div className={`absolute right-0 top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${activity.color} text-white`}>
                            {/* Optional: Small icon or dot */}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{activity.title}</span>
                                <span className="text-[10px] text-muted-foreground">
                                    {format(activity.date, 'PPP p', { locale: ar })}
                                </span>
                            </div>
                            {activity.description && (
                                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                    {activity.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
