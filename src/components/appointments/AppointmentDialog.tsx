import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { formatDate } from '@/lib/format';
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { leadsService } from '@/services/leadsService';
import { clientsService } from '@/services/clientsService';
import { appointmentsService } from '@/services/appointmentsService';
import { useToast } from '@/hooks/use-toast';
import { AppointmentStatus } from '@/types/database';
import { AppointmentWithRelations, LeadWithRelations } from '@/types/app';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import { toArabicErrorMessage } from '@/lib/errors';

type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

interface AppointmentFormData {
    lead_id: string;
    client_id: string;
    date: Date;
    time: string;
    duration_minutes: number;
    location: string;
    notes: string;
    status: AppointmentStatus;
}

interface AppointmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointment?: AppointmentWithRelations | null;
    defaultLead?: LeadWithRelations | null;
    isAdmin?: boolean;
    onSuccess?: () => void;
}

export function AppointmentDialog({
    open,
    onOpenChange,
    appointment,
    defaultLead,
    isAdmin,
    onSuccess,
}: AppointmentDialogProps) {
    const { client } = useAuth();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AppointmentFormData>({
        defaultValues: {
            duration_minutes: 60,
            status: 'scheduled',
            location: '',
            notes: '',
        }
    });

    const selectedClientId = watch('client_id');

    // Fetch Clients (Admin only)
    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => clientsService.getClients(),
        enabled: !!isAdmin && open,
    });

    // Fetch Leads based on selected client or current user's client
    const activeClientId = isAdmin ? selectedClientId : client?.id;
    const { data: leadsData } = useQuery({
        queryKey: ['leads', activeClientId, 'dropdown'], // Added 'dropdown' to differentiate
        queryFn: () => activeClientId ? leadsService.getLeads(1, 100, { clientId: activeClientId }) : Promise.resolve({ data: [], count: 0 }),
        enabled: !!activeClientId && open,
    });

    const leads = useMemo(() => {
        const fetchedLeads = leadsData?.data || [];
        const leadOptions = [...fetchedLeads];

        if (defaultLead && !leadOptions.find(l => l.id === defaultLead.id)) {
            leadOptions.unshift(defaultLead);
        }

        // In edit mode the current lead may not be returned by the dropdown query (pagination/filtering),
        // which causes Radix Select to show the placeholder instead of the selected label.
        if (appointment?.lead && !leadOptions.find(l => l.id === appointment.lead?.id)) {
            leadOptions.unshift({
                ...appointment.lead,
                client: null,
            } as LeadWithRelations);
        }

        return leadOptions;
    }, [leadsData?.data, defaultLead, appointment?.lead]);

    useEffect(() => {
        if (open) {
            if (appointment) {
                // Edit Mode
                const aptDate = new Date(appointment.scheduled_at);
                setSelectedDate(aptDate);
                setValue('date', aptDate);
                setValue('time', format(aptDate, 'HH:mm'));
                setValue('lead_id', appointment.lead_id);
                setValue('client_id', appointment.client_id);
                setValue('duration_minutes', appointment.duration_minutes);
                setValue('location', appointment.location || '');
                setValue('notes', appointment.notes || '');
                setValue('status', appointment.status);
            } else {
                // Create Mode
                reset();
                setSelectedDate(new Date());
                setValue('date', new Date());
                setValue('time', '10:00');

                // Pre-fill from defaultLead
                if (defaultLead) {
                    setValue('lead_id', defaultLead.id);
                    // For admin, we must explicitly set client_id to the lead's client
                    if (isAdmin && defaultLead.client_id) {
                        setValue('client_id', defaultLead.client_id);
                    }
                }

                // If not admin and not overridden by defaultLead, set to current user's client
                if (client?.id && !isAdmin) setValue('client_id', client.id);
            }
        }
    }, [open, appointment, defaultLead, client, reset, setValue, isAdmin]);

    const createMutation = useMutation({
        mutationFn: appointmentsService.createAppointment,
        onSuccess: () => {
            toast({
                title: 'تم بنجاح',
                description: 'تم تحديد الموعد بنجاح.',
            });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({
                title: 'خطأ',
                description: toArabicErrorMessage(error, 'تعذر إنشاء الموعد'),
                variant: 'destructive'
            });
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, updates, originalScheduledAt }: { id: string; updates: AppointmentUpdate; originalScheduledAt?: string }) =>
            appointmentsService.updateAppointment(id, updates, originalScheduledAt),
        onSuccess: () => {
            toast({ title: 'تم التحديث', description: 'تم تحديث الموعد بنجاح' });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({ title: 'خطأ', description: toArabicErrorMessage(error, 'تعذر تحديث الموعد'), variant: 'destructive' });
        }
    });

    const onSubmit = (data: AppointmentFormData) => {
        if (!data.date || !data.time) return;
        if (!isAdmin && !client?.id) {
            toast({
                title: 'خطأ',
                description: 'لا يمكن تحديد العميل الخاص بك',
                variant: 'destructive',
            });
            return;
        }

        // Combine date and time
        const [hours, minutes] = data.time.split(':').map(Number);
        const scheduledAt = new Date(data.date);
        scheduledAt.setHours(hours, minutes, 0, 0);

        const durationMinutesRaw = Number(data.duration_minutes);
        const durationMinutes = Number.isFinite(durationMinutesRaw)
            ? durationMinutesRaw
            : (appointment?.duration_minutes ?? 60);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            toast({
                title: 'خطأ',
                description: 'مدة الموعد غير صالحة',
                variant: 'destructive',
            });
            return;
        }

        const leadId = data.lead_id || appointment?.lead_id;
        if (!leadId) {
            toast({
                title: 'خطأ',
                description: 'اختر العميل المحتمل أولاً',
                variant: 'destructive',
            });
            return;
        }
        const clientId = isAdmin
            ? (data.client_id || appointment?.client_id || undefined)
            : client.id;
        const status = (data.status || appointment?.status || 'scheduled') as AppointmentStatus;

        const basePayload = {
            lead_id: leadId,
            client_id: clientId,
            scheduled_at: Number.isNaN(scheduledAt.getTime())
                ? appointment?.scheduled_at
                : scheduledAt.toISOString(),
            duration_minutes: durationMinutes,
            location: data.location || null,
            notes: data.notes || null,
            status,
        };

        if (appointment) {
            // Lead/client are immutable in edit mode in this UI and can trip RLS/trigger checks when resent.
            const payload: AppointmentUpdate = {
                scheduled_at: basePayload.scheduled_at,
                duration_minutes: basePayload.duration_minutes,
                location: basePayload.location,
                notes: basePayload.notes,
                status: basePayload.status,
            };
            updateMutation.mutate({
                id: appointment.id,
                updates: payload,
                originalScheduledAt: appointment.scheduled_at,
            });
        } else {
            createMutation.mutate(basePayload);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="top-2 w-[calc(100vw-0.75rem)] translate-y-0 gap-3 overflow-y-auto p-3 max-h-[calc(100dvh-0.75rem)] sm:top-[50%] sm:w-full sm:translate-y-[-50%] sm:gap-4 sm:max-w-[420px] sm:p-6"
                dir="rtl"
            >
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold sm:text-lg">
                        {appointment ? 'تعديل الموعد' : 'حجز موعد جديد'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-1 sm:space-y-4 sm:py-2">
                    {isAdmin && (
                        <div className="space-y-1.5">
                            <Label>العميل</Label>
                            <Select
                                onValueChange={(val) => setValue('client_id', val)}
                                value={watch('client_id')}
                                disabled={!!appointment}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر العميل" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>العميل المحتمل</Label>
                        <Select
                            onValueChange={(val) => setValue('lead_id', val)}
                            value={watch('lead_id')}
                            disabled={!!appointment || (!activeClientId && !isAdmin)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="اختر العميل المحتمل" />
                            </SelectTrigger>
                            <SelectContent>
                                {leads.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>التاريخ</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start overflow-hidden text-right font-normal",
                                            !selectedDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? (
                                            <span className="truncate">
                                                {formatDate(selectedDate, { dateStyle: 'medium' })}
                                            </span>
                                        ) : (
                                            <span className="truncate">اختر تاريخ</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-50" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(date) => {
                                            setSelectedDate(date);
                                            if (date) setValue('date', date);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-1.5">
                            <Label>الوقت</Label>
                            <Input
                                type="time"
                                {...register('time', { required: true })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>المدة</Label>
                            <Select
                                onValueChange={(val) => setValue('duration_minutes', Number(val))}
                                defaultValue="60"
                                value={String(watch('duration_minutes'))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15">15 دقيقة</SelectItem>
                                    <SelectItem value="30">30 دقيقة</SelectItem>
                                    <SelectItem value="45">45 دقيقة</SelectItem>
                                    <SelectItem value="60">1 ساعة</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>المكان</Label>
                            <Input
                                placeholder="مكتب، زوم..."
                                {...register('location')}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>ملاحظات</Label>
                        <Textarea
                            {...register('notes')}
                            className="min-h-[72px] resize-none sm:min-h-[96px]"
                        />
                    </div>

                    {appointment && (
                        <div className="space-y-1.5">
                            <Label>الحالة</Label>
                            <Select
                                onValueChange={(val) => setValue('status', val as AppointmentStatus)}
                                value={watch('status') || 'scheduled'}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="scheduled">مجدول</SelectItem>
                                    <SelectItem value="completed">مكتمل</SelectItem>
                                    <SelectItem value="cancelled">ملغي</SelectItem>
                                    <SelectItem value="no_show">لم يحضر</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <DialogFooter className="mt-3 gap-2 sm:mt-4 sm:gap-0">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                        >
                            {(createMutation.isPending || updateMutation.isPending) ? (
                                <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                                appointment ? 'حفظ' : 'تأكيد'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
