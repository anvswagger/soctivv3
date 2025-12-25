import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lead, Client } from '@/types/database';
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

interface LeadWithClient extends Lead {
  client?: Client;
}

export default function Leads() {
  const { client, isAdmin } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    status: 'new' as string,
    notes: '',
    client_id: '',
    worktype: '',
    stage: '',
  });

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch leads with client info
    const { data: leadsData, error: leadsError } = await db
      .from('leads')
      .select('*, client:clients(id, company_name)')
      .order('created_at', { ascending: false });
    
    if (leadsError) {
      toast({ title: 'خطأ', description: 'فشل في تحميل العملاء المحتملين', variant: 'destructive' });
    } else {
      setLeads(leadsData || []);
    }

    // Fetch clients for admin filter
    if (isAdmin) {
      const { data: clientsData } = await db.from('clients').select('*').order('company_name');
      if (clientsData) setClients(clientsData);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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

    const leadData = {
      first_name: firstName,
      last_name: lastName || firstName,
      phone: formData.phone,
      status: formData.status,
      notes: formData.notes,
      client_id: clientId,
      worktype: formData.worktype || null,
      stage: formData.stage || null,
    };

    if (editingLead) {
      const { error } = await db.from('leads').update(leadData).eq('id', editingLead.id);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في تحديث العميل المحتمل', variant: 'destructive' });
      } else {
        toast({ title: 'تم التحديث', description: 'تم تحديث بيانات العميل المحتمل بنجاح' });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await db.from('leads').insert(leadData);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في إضافة العميل المحتمل', variant: 'destructive' });
      } else {
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة العميل المحتمل بنجاح' });
        setDialogOpen(false);
        fetchData();
      }
    }
    resetForm();
  };

  const handleEdit = (lead: Lead) => {
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

  const handleDelete = async (id: string) => {
    const { error } = await db.from('leads').delete().eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف العميل المحتمل', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحذف', description: 'تم حذف العميل المحتمل بنجاح' });
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingLead(null);
    setFormData({ full_name: '', phone: '', status: 'new', notes: '', client_id: '', worktype: '', stage: '' });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.includes(search);
    const matchesClient = selectedClientFilter === 'all' || lead.client_id === selectedClientFilter;
    return matchesSearch && matchesClient;
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
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة عميل محتمل
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
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا يوجد عملاء محتملين</div>
            ) : viewMode === 'pipeline' ? (
              <LeadPipeline 
                leads={filteredLeads}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={fetchData}
                isAdmin={isAdmin}
                clients={clients}
              />
            ) : (
              <LeadListView 
                leads={filteredLeads}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={fetchData}
                isAdmin={isAdmin}
                clients={clients}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
