import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Client, Profile } from '@/types/database';
import { Edit, Trash2, Building2, Loader2, Copy, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const db = supabase as any;

interface ClientWithProfile extends Omit<Client, 'webhook_code' | 'onboarding_completed' | 'specialty' | 'work_area' | 'strength' | 'min_contract_value' | 'headquarters' | 'achievements' | 'promotional_offer'> {
  profile?: Profile;
  webhook_code?: string;
  onboarding_completed?: boolean;
  specialty?: string | null;
  work_area?: string | null;
  strength?: string | null;
  min_contract_value?: string | null;
  headquarters?: string | null;
  achievements?: string | null;
  promotional_offer?: string | null;
}

export default function Clients() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithProfile | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    website: '',
    address: '',
    notes: '',
  });

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await db.from('clients').select('*, profile:profiles(*)').order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحميل العملاء', variant: 'destructive' });
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      const { error } = await db.from('clients').update(formData).eq('id', editingClient.id);
      if (error) {
        toast({ title: 'خطأ', description: 'فشل في تحديث العميل', variant: 'destructive' });
      } else {
        toast({ title: 'تم التحديث', description: 'تم تحديث بيانات العميل بنجاح' });
        setDialogOpen(false);
        fetchClients();
      }
    }
    resetForm();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      industry: client.industry || '',
      website: client.website || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    setDialogOpen(true);
  };

  const handleViewDetails = (client: ClientWithProfile) => {
    setSelectedClient(client);
    setDetailsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from('clients').delete().eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حذف العميل', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحذف', description: 'تم حذف العميل بنجاح' });
      fetchClients();
    }
  };

  const copyWebhookCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'تم النسخ', description: 'تم نسخ رمز Webhook' });
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({ company_name: '', industry: '', website: '', address: '', notes: '' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">إدارة العملاء</h1>
          <p className="text-muted-foreground">عرض وإدارة حسابات العملاء</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />العملاء</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا يوجد عملاء</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الشركة</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">القطاع</TableHead>
                    <TableHead className="text-right">رمز Webhook</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.company_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={client.profile?.avatar_url || undefined} />
                            <AvatarFallback>{client.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <span>{client.profile?.full_name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{client.industry || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {client.webhook_code?.substring(0, 8)}...
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyWebhookCode(client.webhook_code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(client)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(client.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل بيانات العميل</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم الشركة</Label>
                <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>القطاع</Label>
                <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الموقع الإلكتروني</Label>
                <Input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>العنوان</Label>
                <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">تحديث</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تفاصيل العميل</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedClient.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xl">{selectedClient.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg">{selectedClient.company_name}</h3>
                    <p className="text-muted-foreground">{selectedClient.profile?.full_name}</p>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <Label className="text-muted-foreground">القطاع</Label>
                    <p>{selectedClient.industry || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">الهاتف</Label>
                    <p dir="ltr" className="text-left">{selectedClient.profile?.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">الموقع الإلكتروني</Label>
                    <p>{selectedClient.website || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">رمز Webhook</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-muted px-3 py-2 rounded text-sm flex-1 overflow-x-auto">
                        {selectedClient.webhook_code}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => copyWebhookCode(selectedClient.webhook_code || '')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
