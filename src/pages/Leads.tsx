import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lead, LeadStatus } from '@/types/database';
import { Plus, Search, Edit, Trash2, Phone, Mail, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const db = supabase as any;

const statusLabels: Record<LeadStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  qualified: 'مؤهل',
  converted: 'محول',
  lost: 'مفقود',
};

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-info text-info-foreground',
  contacted: 'bg-warning text-warning-foreground',
  qualified: 'bg-primary text-primary-foreground',
  converted: 'bg-success text-success-foreground',
  lost: 'bg-destructive text-destructive-foreground',
};

export default function Leads() {
  const { client, isAdmin } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    source: '',
    status: 'new' as LeadStatus,
    notes: '',
  });

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await db.from('leads').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحميل العملاء المحتملين', variant: 'destructive' });
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client?.id && !isAdmin) {
      toast({ title: 'خطأ', description: 'لم يتم العثور على بيانات العميل', variant: 'destructive' });
      return;
    }

    const leadData = {
      ...formData,
      client_id: client?.id || null,
    };

    if (editingLead) {
      const { error } = await db.from('leads').update(leadData).eq('id', editingLead.id);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في تحديث العميل المحتمل', variant: 'destructive' });
      } else {
        toast({ title: 'تم التحديث', description: 'تم تحديث بيانات العميل المحتمل بنجاح' });
        setDialogOpen(false);
        fetchLeads();
      }
    } else {
      const { error } = await db.from('leads').insert(leadData);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في إضافة العميل المحتمل', variant: 'destructive' });
      } else {
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة العميل المحتمل بنجاح' });
        setDialogOpen(false);
        fetchLeads();
      }
    }
    resetForm();
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      status: lead.status,
      notes: lead.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from('leads').delete().eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف العميل المحتمل', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحذف', description: 'تم حذف العميل المحتمل بنجاح' });
      fetchLeads();
    }
  };

  const resetForm = () => {
    setEditingLead(null);
    setFormData({ first_name: '', last_name: '', email: '', phone: '', source: '', status: 'new', notes: '' });
  };

  const filteredLeads = leads.filter(lead =>
    `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    lead.email?.toLowerCase().includes(search.toLowerCase()) ||
    lead.phone?.includes(search)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">العملاء المحتملين</h1>
            <p className="text-muted-foreground">إدارة وتتبع العملاء المحتملين</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة عميل محتمل
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editingLead ? 'تعديل العميل المحتمل' : 'إضافة عميل محتمل جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم الأول</Label>
                    <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم الأخير</Label>
                    <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>المصدر</Label>
                  <Input placeholder="موقع ويب، إعلان، إحالة..." value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={formData.status} onValueChange={(value: LeadStatus) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">{editingLead ? 'تحديث' : 'إضافة'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا يوجد عملاء محتملين</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">التواصل</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.first_name} {lead.last_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {lead.email && <span className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" />{lead.email}</span>}
                          {lead.phone && <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{lead.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{lead.source || '-'}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[lead.status]}>{statusLabels[lead.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(lead)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(lead.id)}><Trash2 className="h-4 w-4" /></Button>
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