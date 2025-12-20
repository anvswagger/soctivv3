import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Appointment, AppointmentStatus, Lead } from '@/types/database';
import { Plus, Search, Edit, Trash2, Calendar, Clock, Loader2 } from 'lucide-react';
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

const db = supabase as any;

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

export default function Appointments() {
  const { client } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_at: '',
    duration_minutes: 30,
    status: 'scheduled' as AppointmentStatus,
    location: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [appointmentsRes, leadsRes] = await Promise.all([
      db.from('appointments').select('*, lead:leads(first_name, last_name)').order('scheduled_at', { ascending: true }),
      db.from('leads').select('id, first_name, last_name'),
    ]);
    if (!appointmentsRes.error) setAppointments(appointmentsRes.data || []);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const appointmentData = { ...formData, client_id: client?.id || null };

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
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة الموعد بنجاح' });
        setDialogOpen(false);
        fetchData();
      }
    }
    resetForm();
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
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
    setFormData({ lead_id: '', scheduled_at: '', duration_minutes: 30, status: 'scheduled', location: '', notes: '' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">المواعيد</h1>
            <p className="text-muted-foreground">جدولة وإدارة المواعيد</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />إضافة موعد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingAppointment ? 'تعديل الموعد' : 'إضافة موعد جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>العميل المحتمل</Label>
                  <Select value={formData.lead_id} onValueChange={(value) => setFormData({ ...formData, lead_id: value })}>
                    <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
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

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا توجد مواعيد</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المدة</TableHead>
                    <TableHead className="text-right">الموقع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appointment: any) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        {appointment.lead?.first_name} {appointment.lead?.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(appointment.scheduled_at), 'PPP p', { locale: ar })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {appointment.duration_minutes} دقيقة
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
      </div>
    </DashboardLayout>
  );
}