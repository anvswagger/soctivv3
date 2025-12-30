import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Appointment, AppointmentStatus, Lead, Client } from '@/types/database';
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Clock, Loader2, List, CalendarDays, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';

const db = supabase as any;

// دالة لتنسيق الوقت بنظام 12 ساعة
const formatTime12h = (dateString: string) => {
  const date = new Date(dateString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'م' : 'ص';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};

const statusColors: Record<AppointmentStatus, string> = {
  scheduled: 'bg-info text-info-foreground',
  completed: 'bg-success text-success-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
  no_show: 'bg-warning text-warning-foreground',
};

interface AppointmentWithRelations extends Appointment {
  lead?: Lead;
  client?: Client;
}

export default function Appointments() {
  const { client, isAdmin } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'date_asc' | 'date_desc'>('newest');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_at: '',
    duration_minutes: 120,
    status: 'scheduled' as AppointmentStatus,
    location: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    
    const [appointmentsRes, leadsRes, clientsRes] = await Promise.all([
      db.from('appointments').select('*, lead:leads(first_name, last_name, phone, email, source, client_id), client:clients(company_name)').order('scheduled_at', { ascending: true }),
      db.from('leads').select('id, first_name, last_name, client_id'),
      isAdmin ? db.from('clients').select('*').order('company_name') : Promise.resolve({ data: [] }),
    ]);
    
    if (!appointmentsRes.error) setAppointments(appointmentsRes.data || []);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    if (clientsRes && !clientsRes.error) setClients(clientsRes.data || []);
    
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Filter leads based on selected client (for admins)
  const filteredLeadsForForm = isAdmin && selectedClientId 
    ? leads.filter(lead => lead.client_id === selectedClientId)
    : leads;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.lead_id) {
      toast({ title: 'خطأ', description: 'يرجى اختيار العميل المحتمل', variant: 'destructive' });
      return;
    }

    const selectedLead = leads.find(l => l.id === formData.lead_id);
    const clientId = isAdmin ? selectedClientId : client?.id;

    const appointmentData = { 
      ...formData, 
      client_id: clientId || selectedLead?.client_id || null 
    };

    if (editingAppointment) {
      const { error } = await db.from('appointments').update(appointmentData).eq('id', editingAppointment.id);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في تحديث الموعد', variant: 'destructive' });
      } else {
        toast({ title: 'تم التحديث', description: 'تم تحديث الموعد بنجاح' });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await db.from('appointments').insert(appointmentData);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في إضافة الموعد', variant: 'destructive' });
      } else {
        // Update lead status to qualified when appointment is created
        if (formData.lead_id) {
          await db.from('leads').update({ status: 'qualified' }).eq('id', formData.lead_id);
        }
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة الموعد بنجاح' });
        setDialogOpen(false);
        fetchData();
      }
    }
    resetForm();
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const appointmentLead = leads.find(l => l.id === appointment.lead_id);
    if (isAdmin && appointmentLead?.client_id) {
      setSelectedClientId(appointmentLead.client_id);
    }
    setFormData({
      lead_id: appointment.lead_id,
      scheduled_at: appointment.scheduled_at.slice(0, 16),
      duration_minutes: appointment.duration_minutes,
      status: appointment.status,
      location: appointment.location || '',
      notes: appointment.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from('appointments').delete().eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف الموعد', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحذف', description: 'تم حذف الموعد بنجاح' });
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingAppointment(null);
    setSelectedClientId('');
    setFormData({ lead_id: '', scheduled_at: '', duration_minutes: 120, status: 'scheduled', location: '', notes: '' });
  };

  // Filter and sort appointments
  const filteredAppointments = appointments
    .filter(apt => {
      const matchesClient = selectedClientFilter === 'all' || apt.client_id === selectedClientFilter;
      const matchesDate = !selectedDate || viewMode === 'list' || 
        format(new Date(apt.scheduled_at), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      return matchesClient && matchesDate;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_asc':
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        case 'date_desc':
          return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
        default:
          return 0;
      }
    });

  // Get appointments for calendar dates
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => 
      format(new Date(apt.scheduled_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">المواعيد</h1>
            <p className="text-muted-foreground">جدولة وإدارة المواعيد</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="rounded-r-none"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />إضافة موعد</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader className="pb-4">
                  <DialogTitle>{editingAppointment ? 'تعديل الموعد' : 'إضافة موعد جديد'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label>العميل</Label>
                      <Select value={selectedClientId} onValueChange={(value) => {
                        setSelectedClientId(value);
                        setFormData({ ...formData, lead_id: '' });
                      }}>
                        <SelectTrigger><SelectValue placeholder="اختر العميل أولاً" /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>العميل المحتمل</Label>
                    <Select 
                      value={formData.lead_id} 
                      onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
                      disabled={isAdmin && !selectedClientId}
                    >
                      <SelectTrigger><SelectValue placeholder={isAdmin && !selectedClientId ? "اختر العميل أولاً" : "اختر العميل المحتمل"} /></SelectTrigger>
                      <SelectContent>
                        {filteredLeadsForForm.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>{lead.first_name} {lead.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>التاريخ والوقت</Label>
                    <Input type="datetime-local" value={formData.scheduled_at} onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>المدة (دقائق)</Label>
                    <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>الحالة</Label>
                    <Select value={formData.status} onValueChange={(value: AppointmentStatus) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الموقع</Label>
                    <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>ملاحظات</Label>
                    <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full">{editingAppointment ? 'تحديث' : 'إضافة'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
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
          <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest' | 'date_asc' | 'date_desc') => setSortOrder(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="ترتيب حسب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث إضافة</SelectItem>
              <SelectItem value="oldest">الأقدم إضافة</SelectItem>
              <SelectItem value="date_asc">تاريخ الموعد (تصاعدي)</SelectItem>
              <SelectItem value="date_desc">تاريخ الموعد (تنازلي)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {viewMode === 'calendar' ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>التقويم</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                  modifiers={{
                    hasAppointment: (date) => getAppointmentsForDate(date).length > 0,
                  }}
                  modifiersStyles={{
                    hasAppointment: { backgroundColor: 'hsl(var(--primary) / 0.1)', fontWeight: 'bold' },
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  مواعيد {selectedDate ? format(selectedDate, 'PPP', { locale: ar }) : 'اليوم'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">لا توجد مواعيد</p>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((apt: any) => (
                      <div key={apt.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                          <p className="font-medium">{apt.lead?.first_name} {apt.lead?.last_name}</p>
                            {apt.lead?.phone && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {apt.lead.phone}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime12h(apt.scheduled_at)}
                            </p>
                            {apt.location && <p className="text-sm text-muted-foreground">{apt.location}</p>}
                          </div>
                          <Badge className={statusColors[apt.status as AppointmentStatus]}>
                            {statusLabels[apt.status as AppointmentStatus]}
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(apt)}>تعديل</Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(apt.id)}>حذف</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد مواعيد</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العميل المحتمل</TableHead>
                      <TableHead className="text-right">رقم الهاتف</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الموقع</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment: any) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">
                          {appointment.lead?.first_name} {appointment.lead?.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {appointment.lead?.phone || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {format(new Date(appointment.scheduled_at), 'PPP', { locale: ar })} - {formatTime12h(appointment.scheduled_at)}
                          </div>
                        </TableCell>
                        <TableCell>{appointment.location || '-'}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[appointment.status as AppointmentStatus]}>
                            {statusLabels[appointment.status as AppointmentStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(appointment)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(appointment.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
