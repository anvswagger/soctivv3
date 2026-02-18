import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsService } from '@/services/leadsService';
import { clientsService } from '@/services/clientsService';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { hapticLight } from '@/lib/haptics';
import { formatDate } from '@/lib/format';
import { Plus, Search, Loader2, LayoutGrid, List, Download, Upload, Calendar as CalendarIcon, X } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLeads, useUpdateLeadStatus, useDeleteLead } from '@/hooks/useCrmData';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LeadPipeline } from '@/components/leads/LeadPipeline';
import { LeadListView } from '@/components/leads/LeadListView';
import { HeatMapStats } from '@/components/leads/HeatMapStats';
import { LeaderBoard } from '@/components/leads/LeaderBoard';
import { SkeletonCard, SkeletonList } from '@/components/ui/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Typed supabase client used directly

const statusLabels: Record<string, string> = {
  new: 'جديد',
  contacting: 'قيد التواصل',
  appointment_booked: 'موعد محجوز',
  interviewed: 'تمت المقابلة',
  no_show: 'غائب',
  sold: 'تم البيع',
  cancelled: 'ملغاة',
};

import { AppointmentDialog } from '@/components/appointments/AppointmentDialog';
import { translateNameWithAI } from '@/lib/transliterate';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];

import { LeadWithRelations } from '@/types/app';

export default function Leads() {
  const { client, isAdmin, isSuperAdmin, assignedClients } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // UI State
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedLeadForAppointment, setSelectedLeadForAppointment] = useState<LeadWithRelations | null>(null);


  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    status: 'new' as string,
    notes: '',
    client_id: '',
    worktype: '',
    stage: '',
  });

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearch(q);
    }
    const isNew = searchParams.get('new');
    if (isNew === 'true') {
      setEditingLead(null);
      setDialogOpen(true);
    }
  }, [searchParams]);


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'n' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        e.preventDefault();
        setEditingLead(null);
        setDialogOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedClientFilter('all');
    setSelectedClientFilter('all');
  };

  const handleQuickDatePreset = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'week': {
        const startWeek = startOfWeek(today, { weekStartsOn: 6 }); // Saturday start
        const endWeek = endOfWeek(today, { weekStartsOn: 6 });
        setStartDate(format(startWeek, 'yyyy-MM-dd'));
        setEndDate(format(endWeek, 'yyyy-MM-dd'));
        break;
      }
      case 'month': {
        const startMonth = startOfMonth(today);
        const endMonth = endOfMonth(today);
        setStartDate(format(startMonth, 'yyyy-MM-dd'));
        setEndDate(format(endMonth, 'yyyy-MM-dd'));
        break;
      }
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  // Queries
  const filters: any = useMemo(() => {
    const f: any = {};
    if (search) f.search = search;
    if (startDate) f.startDate = startDate;
    if (endDate) {
      // Ensure endDate is at the end of the day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      f.endDate = end.toISOString();
    }

    if (isSuperAdmin) {
      if (selectedClientFilter !== 'all') f.clientId = selectedClientFilter;
    } else if (isAdmin) {
      f.clientId = assignedClients;
    } else {
      f.clientId = client?.id;
    }

    return f;
  }, [search, startDate, endDate, selectedClientFilter, isSuperAdmin, isAdmin, assignedClients, client]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, selectedClientFilter]);

  const { data: leadsData, isLoading: leadsLoading } = useLeads(page, pageSize, filters);

  let leads: any[] = [];
  // Skip warning during loading state - this is expected behavior
  if (!leadsLoading) {
    if (leadsData?.data && Array.isArray(leadsData.data)) {
      leads = leadsData.data;
    } else if (Array.isArray(leadsData)) {
      // Fallback for backward compatibility
      leads = leadsData;
    } else if (leadsData !== undefined) {
      // Only warn if data exists but is in wrong format
      console.warn("Leads data is not in expected format:", leadsData);
      leads = [];
    } else {
      // Data is undefined but not loading - could be an error
      console.warn("Leads data is undefined (not loading):", leadsData);
      leads = [];
    }
  }
  const totalCount = leadsData?.count || 0;


  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients(),
    enabled: isAdmin || isSuperAdmin, // Only fetch clients for admin users
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: leadsService.createLead,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'تمت الإضافة', description: 'تمت إضافة العميل المحتمل بنجاح' });

      setDialogOpen(false);

      if (data && data.status === 'appointment_booked') {
        setSelectedLeadForAppointment(data as LeadWithRelations);
        setAppointmentDialogOpen(true);
      }

      resetForm();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message || 'فشل في إضافة العميل المحتمل', variant: 'destructive' });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: any }) => leadsService.updateLead(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث بيانات العميل المحتمل بنجاح' });

      setDialogOpen(false);

      if (variables.updates.status === 'appointment_booked' && editingLead) {
        setSelectedLeadForAppointment({ ...editingLead, ...variables.updates });
        setAppointmentDialogOpen(true);
      }

      resetForm();
    },
    onError: (error) => {
      toast({ title: 'خطأ', description: error.message || 'فشل في تحديث العميل المحتمل', variant: 'destructive' });
    }
  });

  const deleteLeadMutation = useDeleteLead();
  const updateStatusMutation = useUpdateLeadStatus();

  const parseFullName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return { firstName, lastName };
  };

  const [isTranslating, setIsTranslating] = useState(false);

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

    // ترجمة الاسم بالذكاء الاصطناعي (مع caching)
    setIsTranslating(true);
    try {
      const [arabicFirstName, arabicLastName] = await Promise.all([
        translateNameWithAI(firstName),
        translateNameWithAI(lastName)
      ]);

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
    } catch (error) {
      console.error('Translation error:', error);
      toast({ title: 'خطأ', description: 'فشل في ترجمة الاسم', variant: 'destructive' });
    } finally {
      setIsTranslating(false);
    }
  };

  const availableClients = useMemo(() => {
    if (isSuperAdmin) return clients;
    if (isAdmin) return clients.filter(c => assignedClients.includes(c.id));
    return [];
  }, [clients, isSuperAdmin, isAdmin, assignedClients]);

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
    await updateStatusMutation.mutateAsync({ id: leadId, status: newStatus as LeadStatus });

    // Smoothly handle side effects
    if (newStatus === 'appointment_booked') {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLeadForAppointment(lead);
        setAppointmentDialogOpen(true);
      }
    }
  };

  const resetForm = () => {
    setEditingLead(null);
    setFormData({
      full_name: '',
      phone: '',
      status: 'new',
      notes: '',
      client_id: isAdmin && !isSuperAdmin && assignedClients.length === 1 ? assignedClients[0] : '',
      worktype: '',
      stage: ''
    });
  };

  // Server-side filtered leads - ensure it's always an array
  const filteredLeads = Array.isArray(leads) ? leads : [];

  const displayLeads = filteredLeads;


  const exportLeadsToCSV = () => {
    if (filteredLeads.length === 0) {
      toast({
        title: 'تنبيه',
        description: 'لا توجد بيانات للتصدير',
        variant: 'default'
      });
      return;
    }

    try {
      const headers = ['الاسم الأول', 'اسم العائلة', 'الهاتف', 'الحالة', 'ملاحظات', 'نوع العمل', 'المرحلة', 'تاريخ الإنشاء'];
      const csvContent = [
        headers.join(','),
        ...filteredLeads.map(lead => [
          `"${lead.first_name || ''}"`,
          `"${lead.last_name || ''}"`,
          `"${lead.phone || ''}"`,
          `"${statusLabels[lead.status] || lead.status}"`,
          `"${(lead.notes || '').replace(/"/g, '""')}"`,
          `"${lead.worktype || ''}"`,
          `"${lead.stage || ''}"`,
          `"${formatDate(lead.created_at, { dateStyle: 'short' })}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'تم التصدير', description: 'تم تحميل ملف العملاء بنجاح' });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: 'خطأ في التصدير',
        description: 'حدث خطأ أثناء تصدير البيانات. يرجى المحاولة مرة أخرى.',
        variant: 'destructive'
      });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        const nextChar = line[i + 1];
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());
    return result;
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = ((event.target?.result as string) || '').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        toast({ title: 'ملف غير صالح', description: 'لم يتم العثور على صفوف صالحة داخل ملف CSV', variant: 'destructive' });
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));

      const leadsToImport = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = parseCSVLine(line).map(v => v.replace(/"/g, ''));
        const lead: any = {};
        headers.forEach((header, index) => {
          const key = header.trim().toLowerCase().replace(/\s+/g, '_');

          // Support both English and Arabic headers (export uses Arabic by default).
          if (key === 'first_name' || key === 'الاسم_الأول' || key === 'الاسم_الاول') lead.first_name = values[index];
          if (key === 'last_name' || key === 'اسم_العائلة') lead.last_name = values[index];
          if (key === 'phone' || key === 'الهاتف' || key === 'رقم_الهاتف') lead.phone = values[index];
          if (key === 'notes' || key === 'ملاحظات' || key === 'الملاحظات') lead.notes = values[index];
          if (key === 'worktype' || key === 'نوع_العمل') lead.worktype = values[index];
          if (key === 'stage' || key === 'المرحلة') lead.stage = values[index];
        });

        // Use default admin client or current client
        lead.client_id = isAdmin ? (formData.client_id || clients[0]?.id) : client?.id;
        lead.status = 'new';
        return lead;
      }).filter(l => l.first_name && l.phone);

      if (leadsToImport.length === 0) {
        toast({ title: 'خطأ', description: 'لم يتم العثور على بيانات صالحة للملف', variant: 'destructive' });
        return;
      }

      try {
        const { error } = await supabase.from('leads').insert(leadsToImport);
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['leads'] });
        toast({ title: 'تم الاستيراد', description: `تم استيراد ${leadsToImport.length} عميل بنجاح` });
      } catch (err: any) {
        toast({ title: 'خطأ في الاستيراد', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">العملاء المحتملين</h1>
            <p className="text-muted-foreground">إدارة وتتبع العملاء المحتملين</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex border rounded-lg bg-background overflow-hidden w-full sm:w-auto overflow-x-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={exportLeadsToCSV}
                className="flex-shrink-0 gap-2 border-0 rounded-none h-10 border-l px-3"
                title="تصدير إلى CSV"
              >
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">تصدير</span>
              </Button>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImportCSV}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 gap-2 border-0 rounded-none h-10 border-l px-3"
                title="استيراد من CSV"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden md:inline">استيراد</span>
              </Button>
              <div className="flex flex-1 sm:flex-none">
                <Button
                  variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('pipeline')}
                  className="flex-1 sm:flex-none rounded-none h-10 border-l px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="flex-1 sm:flex-none rounded-none h-10 px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => hapticLight()}
                  className="w-full sm:w-auto h-10 gap-2 shadow-sm hover:shadow-md transition-all active:ring-2 active:ring-primary/20 shrink-0"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>إضافة عميل</span>
                </Button>
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
                          {availableClients.map((c) => (
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
                  <Button type="submit" className="w-full h-10" disabled={isTranslating || createLeadMutation.isPending || updateLeadMutation.isPending}>
                    {isTranslating ? (
                      <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الترجمة...</>
                    ) : editingLead ? 'تحديث' : 'إضافة'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Heat Map & Leaderboard Stats - For Admin */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HeatMapStats leads={displayLeads} />
            <LeaderBoard />
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="بحث سريع (بالاسم أو الرقم)..."
                  className="pr-10 h-10 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                  {/* Quick Presets */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-[130px] justify-between h-10">
                        الفترة
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('today')}>
                        اليوم
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('week')}>
                        هذا الأسبوع
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('month')}>
                        هذا الشهر
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('all')}>
                        كل الوقت
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Start Date Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`h-10 w-[140px] justify-start text-start font-normal ${!startDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {startDate ? format(new Date(startDate), 'yyyy/MM/dd') : 'من'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate ? new Date(startDate) : undefined}
                        onSelect={(date) => setStartDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-muted-foreground">→</span>

                  {/* End Date Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`h-10 w-[140px] justify-start text-start font-normal ${!endDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {endDate ? format(new Date(endDate), 'yyyy/MM/dd') : 'إلى'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate ? new Date(endDate) : undefined}
                        onSelect={(date) => setEndDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFilters}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {leadsLoading && leads.length === 0 ? (
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
              ) : displayLeads.length === 0 ? (
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <LeadPipeline
                    leads={displayLeads}
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <LeadListView
                    leads={displayLeads}
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

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              عرض {displayLeads.length} من أصل {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPage(p => Math.max(1, p - 1));
                  hapticLight();
                }}
                disabled={page === 1 || leadsLoading}
              >
                السابق
              </Button>
              <span className="text-sm font-medium mx-2">
                صفحة {page} من {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPage(p => p + 1);
                  hapticLight();
                }}
                disabled={leads.length < pageSize || leadsLoading}
              >
                التالي
              </Button>
            </div>
          </div>
        </Card>

        <AppointmentDialog
          open={appointmentDialogOpen}
          onOpenChange={setAppointmentDialogOpen}
          defaultLead={selectedLeadForAppointment}
          isAdmin={isAdmin}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
