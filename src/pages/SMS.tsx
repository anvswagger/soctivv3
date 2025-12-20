import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SmsTemplate, SmsLog, Lead, SmsStatus } from '@/types/database';
import { Plus, Send, Loader2, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const db = supabase as any;

const statusLabels: Record<SmsStatus, string> = {
  pending: 'قيد الانتظار',
  sent: 'مرسل',
  delivered: 'تم التسليم',
  failed: 'فشل',
};

const statusColors: Record<SmsStatus, string> = {
  pending: 'bg-warning text-warning-foreground',
  sent: 'bg-info text-info-foreground',
  delivered: 'bg-success text-success-foreground',
  failed: 'bg-destructive text-destructive-foreground',
};

export default function SMS() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ lead_id: '', template_id: '', message: '' });
  const [templateForm, setTemplateForm] = useState({ name: '', content: '' });

  const fetchData = async () => {
    setLoading(true);
    const [templatesRes, logsRes, leadsRes] = await Promise.all([
      db.from('sms_templates').select('*').order('created_at', { ascending: false }),
      db.from('sms_logs').select('*, lead:leads(first_name, last_name, phone)').order('created_at', { ascending: false }),
      db.from('leads').select('id, first_name, last_name, phone').not('phone', 'is', null),
    ]);
    if (!templatesRes.error) setTemplates(templatesRes.data || []);
    if (!logsRes.error) setLogs(logsRes.data || []);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSendForm({ ...sendForm, template_id: templateId, message: template?.content || '' });
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = leads.find(l => l.id === sendForm.lead_id);
    if (!lead?.phone) {
      toast({ title: 'خطأ', description: 'العميل المحتمل ليس لديه رقم هاتف', variant: 'destructive' });
      return;
    }

    setSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone_number: lead.phone,
          message: sendForm.message,
          lead_id: sendForm.lead_id,
          template_id: sendForm.template_id || null,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: 'تم الإرسال', description: 'تم إرسال الرسالة بنجاح' });
      } else {
        toast({ title: 'تحذير', description: 'تم تسجيل الرسالة لكن قد يكون هناك مشكلة في الإرسال', variant: 'destructive' });
      }
      
      setSendDialogOpen(false);
      setSendForm({ lead_id: '', template_id: '', message: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      toast({ title: 'خطأ', description: error.message || 'فشل في إرسال الرسالة', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await db.from('sms_templates').insert({
      ...templateForm,
      is_system: false,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في إنشاء القالب', variant: 'destructive' });
    } else {
      toast({ title: 'تم الإنشاء', description: 'تم إنشاء القالب بنجاح' });
      setTemplateDialogOpen(false);
      setTemplateForm({ name: '', content: '' });
      fetchData();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">الرسائل النصية</h1>
            <p className="text-muted-foreground">إرسال وإدارة الرسائل النصية</p>
          </div>
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Send className="h-4 w-4" />إرسال رسالة</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader><DialogTitle>إرسال رسالة نصية</DialogTitle></DialogHeader>
              <form onSubmit={handleSendSms} className="space-y-4">
                <div className="space-y-2">
                  <Label>العميل المحتمل</Label>
                  <Select value={sendForm.lead_id} onValueChange={(value) => setSendForm({ ...sendForm, lead_id: value })}>
                    <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>{lead.first_name} {lead.last_name} - {lead.phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>قالب الرسالة (اختياري)</Label>
                  <Select value={sendForm.template_id} onValueChange={handleTemplateChange}>
                    <SelectTrigger><SelectValue placeholder="اختر قالب" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نص الرسالة</Label>
                  <Textarea value={sendForm.message} onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} required rows={4} />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />جاري الإرسال...</> : 'إرسال'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="logs" className="w-full">
          <TabsList>
            <TabsTrigger value="logs">سجل الرسائل</TabsTrigger>
            <TabsTrigger value="templates">القوالب</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">لا توجد رسائل</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المستلم</TableHead>
                        <TableHead className="text-right">الرسالة</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {log.lead?.first_name} {log.lead?.last_name}
                            <div className="text-sm text-muted-foreground">{log.phone_number}</div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[log.status as SmsStatus]}>{statusLabels[log.status as SmsStatus]}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(log.created_at), 'PPP p', { locale: ar })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>قوالب الرسائل</CardTitle>
                <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />قالب جديد</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader><DialogTitle>إنشاء قالب جديد</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateTemplate} className="space-y-4">
                      <div className="space-y-2">
                        <Label>اسم القالب</Label>
                        <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>محتوى الرسالة</Label>
                        <Textarea value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} required rows={4} />
                      </div>
                      <Button type="submit" className="w-full">إنشاء</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">لا توجد قوالب</div>
                ) : (
                  <div className="grid gap-4">
                    {templates.map((template) => (
                      <Card key={template.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              {template.name}
                            </h4>
                            {template.is_system && <Badge variant="secondary">نظام</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{template.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
