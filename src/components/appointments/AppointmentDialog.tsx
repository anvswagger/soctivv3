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
import { cn } from '@/lib/utils';
import { Clock, Package } from 'lucide-react';
import { ordersService } from '@/services/ordersService';
import { clientsService } from '@/services/clientsService';
import { confirmedOrdersService } from '@/services/confirmedOrdersService';
import { useToast } from '@/hooks/use-toast';
import { AppointmentStatus } from '@/types/database';
import { AppointmentWithRelations, LeadWithRelations } from '@/types/app';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import { toArabicErrorMessage } from '@/lib/errors';
import { supabase } from '@/integrations/supabase/client';

type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

interface Product {
    id: string;
    name: string;
    price: number;
    code: string | null;
    stock_quantity: number;
    client_id: string | null;
}

interface AppointmentFormData {
    lead_id: string;
    client_id: string;
    product_id: string;
    quantity: number;
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

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AppointmentFormData>({
        defaultValues: {
            quantity: 1,
            status: 'scheduled',
            location: '',
            notes: '',
            product_id: '',
        }
    });

    const selectedClientId = watch('client_id');
    const selectedProductId = watch('product_id');
    const quantity = watch('quantity') || 1;

    // Fetch Clients (Admin only)
    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => clientsService.getClients(),
        enabled: !!isAdmin && open,
    });

    // Fetch Leads based on selected client or current user's client
    const activeClientId = isAdmin ? selectedClientId : client?.id;
    const { data: leadsData } = useQuery({
        queryKey: ['leads', activeClientId, 'dropdown'],
        queryFn: () => activeClientId ? ordersService.getLeads(1, 100, { clientId: activeClientId }) : Promise.resolve({ data: [], count: 0 }),
        enabled: !!activeClientId && open,
    });

    // Fetch Products based on selected client
    const { data: productsData } = useQuery({
        queryKey: ['products', activeClientId, 'dropdown'],
        queryFn: async () => {
            if (!activeClientId) return [];
            const { data, error } = await (supabase as any)
                .from('products')
                .select('id, name, price, code, stock_quantity, client_id')
                .eq('client_id', activeClientId)
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return (data || []) as Product[];
        },
        enabled: !!activeClientId && open,
    });

    const products = productsData || [];

    const selectedProduct = useMemo(() => {
        return products.find(p => p.id === selectedProductId) || null;
    }, [products, selectedProductId]);

    const totalPrice = useMemo(() => {
        if (!selectedProduct) return 0;
        return Number(selectedProduct.price) * quantity;
    }, [selectedProduct, quantity]);

    const leads = useMemo(() => {
        const fetchedLeads = leadsData?.data || [];
        const leadOptions = [...fetchedLeads];

        if (defaultLead && !leadOptions.find(l => l.id === defaultLead.id)) {
            leadOptions.unshift(defaultLead);
        }

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
                setValue('lead_id', appointment.lead_id);
                setValue('client_id', appointment.client_id);
                setValue('location', appointment.location || '');
                setValue('notes', appointment.notes || '');
                setValue('status', appointment.status);
            } else {
                reset();
                setValue('quantity', 1);

                if (defaultLead) {
                    setValue('lead_id', defaultLead.id);
                    if (isAdmin && defaultLead.client_id) {
                        setValue('client_id', defaultLead.client_id);
                    }
                }

                if (client?.id && !isAdmin) setValue('client_id', client.id);
            }
        }
    }, [open, appointment, defaultLead, client, reset, setValue, isAdmin]);

    const createMutation = useMutation({
        mutationFn: confirmedOrdersService.createAppointment,
        onSuccess: () => {
            toast({
                title: 'تم بنجاح',
                description: 'تم تأكيد الطلب بنجاح.',
            });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({
                title: 'خطأ',
                description: toArabicErrorMessage(error, 'تعذر إنشاء الطلب'),
                variant: 'destructive'
            });
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, updates, originalScheduledAt }: { id: string; updates: AppointmentUpdate; originalScheduledAt?: string }) =>
            confirmedOrdersService.updateAppointment(id, updates, originalScheduledAt),
        onSuccess: () => {
            toast({ title: 'تم التحديث', description: 'تم تحديث الطلب بنجاح' });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({ title: 'خطأ', description: toArabicErrorMessage(error, 'تعذر تحديث الطلب'), variant: 'destructive' });
        }
    });

    const onSubmit = (data: AppointmentFormData) => {
        if (!isAdmin && !client?.id) {
            toast({
                title: 'خطأ',
                description: 'لا يمكن تحديد العميل الخاص بك',
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

        const now = new Date();

        const basePayload = {
            lead_id: leadId,
            client_id: clientId,
            scheduled_at: appointment?.scheduled_at || now.toISOString(),
            duration_minutes: appointment?.duration_minutes || 60,
            location: data.location || null,
            notes: data.notes || null,
            status,
        };

        if (appointment) {
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
                        {appointment ? 'تعديل الطلب' : 'تأكيد طلب جديد'}
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
                                    {(clients as any[]).map((c) => (
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
                                {(leads as any[]).map((l) => (
                                    <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>المنتج</Label>
                            <Select
                                onValueChange={(val) => setValue('product_id', val)}
                                value={watch('product_id')}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر المنتج" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name} {p.code ? `(${p.code})` : ''} - {Number(p.price).toLocaleString()} د.ل
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>الكمية</Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="1"
                                {...register('quantity', { valueAsNumber: true, min: 1 })}
                            />
                        </div>
                    </div>

                    {selectedProduct && (
                        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">سعر الوحدة</span>
                                <span className="font-medium">{Number(selectedProduct.price).toLocaleString()} د.ل</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">الكمية</span>
                                <span className="font-medium">{quantity}</span>
                            </div>
                            <div className="border-t pt-2 flex items-center justify-between">
                                <span className="font-semibold">الإجمالي</span>
                                <span className="text-lg font-bold text-primary">{totalPrice.toLocaleString()} د.ل</span>
                            </div>
                        </div>
                    )}

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
                                    <SelectItem value="scheduled">محجوز</SelectItem>
                                    <SelectItem value="completed">تم التسليم</SelectItem>
                                    <SelectItem value="cancelled">راجع</SelectItem>
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
