import React, { Suspense, lazy, useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  Edit,
  Trash2,
  Building2,
  Loader2,
  Copy,
  Eye,
  Check,
  Phone,
  Key,
  User,
  CheckCircle2,
  XCircle,
  Database,
  Package,
  TrendingUp,
  Tag,
} from 'lucide-react';
const VaultDialog = lazy(() =>
  import('@/components/vault/VaultDialog').then((module) => ({ default: module.VaultDialog }))
);
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';
import { fixArabicMojibakeObject } from '@/lib/text';

type Client = Tables<"clients">;

interface ClientWithProfile extends Client {
  profile?: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

export default function Clients() {
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithProfile | null>(null);
  const [editingClient, setEditingClient] = useState<ClientWithProfile | null>(null);
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [selectedVaultClient, setSelectedVaultClient] = useState<ClientWithProfile | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [searchParams] = useSearchParams();
  const [clientProducts, setClientProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    website: '',
    phone: '',
    address: '',
    notes: '',
  });

  const { isSuperAdmin, assignedClients } = useAuth();

  const fetchClients = async () => {
    setLoading(true);
    let query = supabase
      .from('clients')
      .select(`
        *,
        profile:profiles!clients_user_id_fkey (
          full_name,
          phone,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (!isSuperAdmin) {
      if (assignedClients.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }
      query = query.in('id', assignedClients as any);
    }

    const { data, error } = await (query as any);

    if (error) {
      toast.error('فشل في تحميل العملاء');
      console.error(error);
    } else {
      const sanitized = (Array.isArray(data) ? data.map((client) => fixArabicMojibakeObject(client)) : []) as any as ClientWithProfile[];
      setClients(sanitized);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (!clientId || clients.length == 0) return;
    const match = clients.find((c) => c.id === clientId);
    if (match) {
      setSelectedClient(match);
      setDetailsDialogOpen(true);
    }
  }, [searchParams, clients]);

  const fetchClientProducts = async (clientId: string) => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('client_id', clientId as any)
        .order('created_at', { ascending: false }) as { data: any[] | null; error: any };

      if (error) throw error;
      setClientProducts(data || []);
    } catch (err) {
      console.error('Error fetching client products:', err);
      setClientProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (detailsDialogOpen && selectedClient) {
      fetchClientProducts(selectedClient.id);
    } else {
      setClientProducts([]);
    }
  }, [detailsDialogOpen, selectedClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const { error } = await (supabase as any)
      .from('clients')
      .update(formData as any)
      .eq('id', editingClient.id as any);

    if (error) {
      toast.error('فشل في تحديث العميل');
    } else {
      toast.success('تم تحديث بيانات العميل بنجاح');
      setDialogOpen(false);
      resetForm();
      fetchClients();
    }
  };

  const handleEdit = (client: ClientWithProfile) => {
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      industry: client.industry || '',
      website: client.website || '',
      phone: client.phone || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    setDialogOpen(true);
  };

  const handleViewDetails = (client: ClientWithProfile) => {
    setSelectedClient(client);
    setCopiedWebhook(false);
    setDetailsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id as any);
    if (error) {
      toast.error('فشل في حذف العميل');
    } else {
      toast.success('تم حذف العميل بنجاح');
      fetchClients();
    }
  };

  const copyWebhookCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedWebhook(true);
    toast.success('تم نسخ رمز الويبهوك');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({ company_name: '', industry: '', website: '', phone: '', address: '', notes: '' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">العملاء</h1>
            <p className="text-muted-foreground text-sm mt-1">
              إدارة حسابات العملاء وبياناتهم
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {clients.length} عميل
          </Badge>
        </div>

        {/* Clients Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-muted-foreground">جاري التحميل...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-0">
                        <EmptyState
                          icon={Building2}
                          title="لا يوجد عملاء حتى الآن"
                          description="هنا ستظهر جميع عملائك والمحلات التجارية التي تتعامل معهم."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client) => (
                      <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                              <AvatarImage src={client.profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {client.company_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{client.company_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {client.profile?.full_name || "بدون اسم"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedVaultClient(client);
                                setVaultDialogOpen(true);
                              }}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="المخزن"
                            >
                              <Database className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(client)}
                              className="h-8 w-8"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(client)}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(client.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                <Label htmlFor="company_name">اسم الشركة</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">القطاع</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">الهاتف</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">الموقع الإلكتروني</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">حفظ التغييرات</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Details Dialog - Enhanced */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden" dir="rtl">
            {selectedClient && (
              <>
                {/* Header with Avatar */}
                <div className="bg-gradient-to-l from-primary/5 to-primary/10 p-6 border-b">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
                      <AvatarImage src={selectedClient.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                        {selectedClient.company_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold truncate">{selectedClient.company_name}</h2>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {selectedClient.profile?.full_name || "بدون اسم"}
                        </span>
                        {selectedClient.profile?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {selectedClient.profile.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedClient.onboarding_completed ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        تسجيل مكتمل
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                        <XCircle className="h-3 w-3" />
                        تسجيل غير مكتمل
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Scrollable Content */}
                <ScrollArea className="max-h-[calc(90vh-140px)]">
                  <div className="p-6 space-y-6">

                    {/* Products Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                المنتجات
                                {clientProducts.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                        {clientProducts.length}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingProducts ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : clientProducts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">لا توجد منتجات</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {clientProducts.map((product: any) => (
                                        <div key={product.id} className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-start gap-3">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                        <Package className="h-6 w-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-sm truncate">{product.name}</p>
                                                    {product.code && (
                                                        <Badge variant="outline" className="text-[10px] mt-0.5 font-mono">
                                                            {product.code}
                                                        </Badge>
                                                    )}
                                                    <p className="text-primary font-semibold text-sm mt-1">
                                                        {Number(product.price).toLocaleString()} د.ل
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {product.return_rate != null && (
                                                            <Badge variant="secondary" className="text-[10px] gap-0.5">
                                                                <TrendingUp className="h-2.5 w-2.5" />
                                                                {product.return_rate}%
                                                            </Badge>
                                                        )}
                                                        {product.offer && (
                                                            <Badge variant="secondary" className="text-[10px] gap-0.5">
                                                                <Tag className="h-2.5 w-2.5" />
                                                                عرض
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Webhook Section */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Key className="h-4 w-4 text-primary" />
                                رمز الويبهوك
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                                <code className="flex-1 text-sm font-mono truncate" dir="ltr">
                                    {selectedClient.webhook_code}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-8 w-8"
                                    onClick={() => copyWebhookCode(selectedClient.webhook_code)}
                                >
                                    {copiedWebhook ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {selectedVaultClient && (
        <Suspense fallback={null}>
          <VaultDialog
            open={vaultDialogOpen}
            onOpenChange={setVaultDialogOpen}
            clientId={selectedVaultClient.id}
            clientName={selectedVaultClient.company_name}
            client={selectedVaultClient}
          />
        </Suspense>
      )}
    </DashboardLayout >
  );
}
