import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsService } from '@/services/leadsService';
import { clientsService } from '@/services/clientsService';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { Client } from '@/types/database';
import { Plus, Search, Loader2, LayoutGrid, List } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LeadPipeline } from '@/components/leads/LeadPipeline';
import { LeadListView } from '@/components/leads/LeadListView';
import { HeatMapStats } from '@/components/leads/HeatMapStats';
import { LeaderBoard } from '@/components/leads/LeaderBoard';
import { SkeletonCard, SkeletonList } from '@/components/ui/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';

const db = supabase as any;

const statusLabels: Record<string, string> = {
  new: 'جديد',
  contacting: 'قيد التواصل',
  appointment_booked: 'موعد محجوز',
  interviewed: 'تمت المقابلة',
  no_show: 'غائب',
  sold: 'تم البيع',
  cancelled: 'ملغاة',
};

import { format } from 'date-fns';
import { AppointmentDialog } from '@/components/appointments/AppointmentDialog';
import { transliterateName } from '@/lib/transliterate';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];

import { LeadWithRelations } from '@/types/app';

export default function Leads() {
  const { client, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // UI State
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedLeadForAppointment, setSelectedLeadForAppointment] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    status: 'new' as string,
    notes: '',
    client_id: '',
    worktype: '',
    stage: '',
  });

  // Queries
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', isAdmin, client?.id],
    queryFn: () => leadsService.getLeads(isAdmin, client?.id) as Promise<LeadWithRelations[]>,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients(),
    enabled: isAdmin,
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: leadsService.createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'تمت الإضافة', description: 'تمت إضافة العميل المحتمل بنجاح' });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message || 'فشل في إضافة العميل المحتمل', variant: 'destructive' });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: any }) => leadsService.updateLead(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث بيانات العميل المحتمل بنجاح' });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message || 'فشل في تحديث العميل المحتمل', variant: 'destructive' });
    }
  });

  const deleteLeadMutation = useMutation({
    mutationFn: leadsService.deleteLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'تم الحذف', description: 'تم حذف العميل المحتمل بنجاح' });
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message || 'فشل في حذف العميل المحتمل', variant: 'destructive' });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => leadsService.updateLead(id, { status: status as LeadStatus }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث حالة العميل المحتمل' });

      if (variables.status === 'appointment_booked') {
        setSelectedLeadForAppointment(variables.id);
        setAppointmentDialogOpen(true);
      }
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message || 'فشل في تحديث الحالة', variant: 'destructive' });
    }
  });

  const parseFullName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return { firstName, lastName };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { firstName, lastName } = parseFullName(formData.full_name);

    if (!firstName) {
      toast({ title: 'خطأ', description: 'يرجى إدخال الاسم', variant: 'destructive' });
      return;
    }

    const clientId = isAdmin ? formData.client_id : client?.id;

    if (!clientId) {
      toast({ title: 'خطأ', description: 'يرجى اختيار العميل', variant: 'destructive' });
      return;
    }

    // Auto-transliterate to Arabic if needed
    const arabicFirstName = transliterateName(firstName);
    const arabicLastName = transliterateName(lastName);

    const leadData: any = {
      first_name: arabicFirstName,
      last_name: arabicLastName || arabicFirstName,
      phone: formData.phone,
      status: formData.status as LeadStatus,
      notes: formData.notes,
      client_id: clientId,
      worktype: formData.worktype || null,
      stage: formData.stage || null,
    };

    if (editingLead) {
      updateLeadMutation.mutate({ id: editingLead.id, updates: leadData });
    } else {
      createLeadMutation.mutate(leadData);
    }
  };

  const handleEdit = (lead: LeadWithRelations) => {
    setEditingLead(lead);
    setFormData({
      full_name: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone || '',
      status: lead.status,
      notes: lead.notes || '',
      client_id: lead.client_id || '',
      worktype: lead.worktype || '',
      stage: lead.stage || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteLeadMutation.mutate(id);
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    await updateStatusMutation.mutateAsync({ id: leadId, status: newStatus });
  };

  const resetForm = () => {
    setEditingLead(null);
    setFormData({ full_name: '', phone: '', status: 'new', notes: '', client_id: '', worktype: '', stage: '' });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.includes(search);
    const matchesClient = selectedClientFilter === 'all' || lead.client_id === selectedClientFilter;

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(lead.created_at) >= new Date(startDate);
    }
    if (endDate) {
      // Set end date to end of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(lead.created_at) <= end;
    }

    return matchesSearch && matchesClient && matchesDate;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">العملاء المحتملين</h1>
            <p className="text-muted-foreground">إدارة وتتبع العملاء المحتملين</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('pipeline')}
                className="rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <motion.div whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
                  <Button
                    onClick={() => hapticLight()}
                    className="gap-2 shadow-sm hover:shadow-md transition-all active:ring-2 active:ring-primary/20"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة عميل محتمل
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-lg">{editingLead ? 'تعديل العميل المحتمل' : 'إضافة عميل محتمل جديد'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {isAdmin && (
                    <div className="space-y-1">
                      <Label className="text-sm">العميل</Label>
                      <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">الاسم الكامل</Label>
                      <Input
                        placeholder="أحمد محمد"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        required
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">رقم الهاتف</Label>
                      <Input
                        placeholder="+218 91 1234567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">الحالة</Label>
                      <Select value={formData.status} onValueChange={(value: string) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">نوع المشروع</Label>
                      <Input
                        placeholder="تجاري، سكني..."
                        value={formData.worktype}
                        onChange={(e) => setFormData({ ...formData, worktype: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">المرحلة</Label>
                    <Input
                      placeholder="مرحلة التصميم..."
                      value={formData.stage}
                      onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">ملاحظات</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="min-h-[60px] resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full h-10">{editingLead ? 'تحديث' : 'إضافة'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Heat Map & Leaderboard Stats - For Admin */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HeatMapStats leads={filteredLeads} />
            <LeaderBoard />
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="space-y-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
              </div>
              {isAdmin && (
                <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="كل العملاء" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل العملاء</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {leadsLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6"
                >
                  {viewMode === 'pipeline' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                    </div>
                  ) : (
                    <SkeletonList />
                  )}
                </motion.div>
              ) : filteredLeads.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12 text-muted-foreground"
                >
                  <div className="mb-2 text-4xl">🔎</div>
                  لا يوجد عملاء محتملين
                </motion.div>
              ) : viewMode === 'pipeline' ? (
                <motion.div
                  key="pipeline"
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.05
                      }
                    }
                  }}
                >
                  <LeadPipeline
                    leads={filteredLeads}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
                    onStatusChange={async (id, status) => {
                      hapticLight();
                      await handleStatusChange(id, status);
                    }}
                    isAdmin={isAdmin}
                    clients={clients}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.03
                      }
                    }
                  }}
                >
                  <LeadListView
                    leads={filteredLeads}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
                    onStatusChange={async (id, status) => {
                      hapticLight();
                      await handleStatusChange(id, status);
                    }}
                    isAdmin={isAdmin}
                    clients={clients}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <AppointmentDialog
          open={appointmentDialogOpen}
          onOpenChange={setAppointmentDialogOpen}
          defaultLeadId={selectedLeadForAppointment}
          isAdmin={isAdmin}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
        />
      </div>
    </DashboardLayout>
  );
}
