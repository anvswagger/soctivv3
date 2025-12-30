import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SmsTemplate, SmsLog, Lead, SmsStatus } from '@/types/database';
import { Plus, Send, Loader2, MessageSquare, Copy, AlertTriangle, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

// المتغيرات المتاحة للقوالب
const AVAILABLE_VARIABLES = [
  { key: '{{lead_first_name}}', label: 'الاسم الأول', description: 'الاسم الأول للعميل' },
  { key: '{{lead_last_name}}', label: 'الاسم الأخير', description: 'الاسم الأخير للعميل' },
  { key: '{{lead_full_name}}', label: 'الاسم الكامل', description: 'الاسم الكامل للعميل' },
  { key: '{{company_name}}', label: 'اسم الشركة', description: 'اسم الشركة/العميل' },
  { key: '{{c_phone}}', label: 'رقم الشركة', description: 'رقم هاتف الشركة' },
  { key: '{{appointment_date}}', label: 'تاريخ الموعد', description: 'تاريخ الموعد المحدد' },
  { key: '{{appointment_time}}', label: 'وقت الموعد', description: 'وقت الموعد المحدد' },
  { key: '{{appointment_location}}', label: 'مكان الموعد', description: 'مكان/عنوان الموعد' },
];

interface Appointment {
  id: string;
  scheduled_at: string;
  location: string | null;
  notes: string | null;
}

export default function SMS() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ 
    lead_id: '', 
    template_id: '', 
    message: '', 
    payment_type: 'wallet' as 'wallet' | 'subscription',
    appointment_id: ''
  });
  const [templateForm, setTemplateForm] = useState({ name: '', content: '' });

  const fetchData = async () => {
    setLoading(true);
    const [templatesRes, logsRes, leadsRes] = await Promise.all([
      db.from('sms_templates').select('*').order('created_at', { ascending: false }),
      db.from('sms_logs').select('*, lead:leads(first_name, last_name, phone)').order('created_at', { ascending: false }),
      db.from('leads').select('id, first_name, last_name, phone, client_id').not('phone', 'is', null),
    ]);
    if (!templatesRes.error) setTemplates(templatesRes.data || []);
    if (!logsRes.error) setLogs(logsRes.data || []);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    setLoading(false);
  };

  // Fetch appointments when lead changes
  const fetchAppointmentsForLead = async (leadId: string) => {
    if (!leadId) {
      setAppointments([]);
      return;
    }
    const { data, error } = await db
      .from('appointments')
      .select('id, scheduled_at, location, notes')
      .eq('lead_id', leadId)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });
    
    if (!error && data) {
      setAppointments(data);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (sendForm.lead_id) {
      fetchAppointmentsForLead(sendForm.lead_id);
    } else {
      setAppointments([]);
    }
  }, [sendForm.lead_id]);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSendForm({ ...sendForm, template_id: templateId, message: template?.content || '' });
  };

  // Check if message uses appointment variables
  const usesAppointmentVars = useMemo(() => {
    return sendForm.message.includes('{{appointment_');
  }, [sendForm.message]);

  // Generate preview with replaced variables
  const messagePreview = useMemo(() => {
    const lead = leads.find(l => l.id === sendForm.lead_id);
    const appointment = appointments.find(a => a.id === sendForm.appointment_id);
    
    let preview = sendForm.message;
    
    if (lead) {
      preview = preview
        .replace(/\{\{lead_first_name\}\}/g, lead.first_name || '')
        .replace(/\{\{lead_last_name\}\}/g, lead.last_name || '')
        .replace(/\{\{lead_full_name\}\}/g, `${lead.first_name || ''} ${lead.last_name || ''}`.trim());
    }
    
    // Company name and phone would be fetched from client - for now show placeholder
    preview = preview.replace(/\{\{company_name\}\}/g, '[اسم الشركة]');
    preview = preview.replace(/\{\{c_phone\}\}/g, '[رقم الشركة]');
    
    if (appointment) {
      const appointmentDate = new Date(appointment.scheduled_at);
      preview = preview
        .replace(/\{\{appointment_date\}\}/g, format(appointmentDate, 'yyyy/MM/dd', { locale: ar }))
        .replace(/\{\{appointment_time\}\}/g, format(appointmentDate, 'HH:mm', { locale: ar }))
        .replace(/\{\{appointment_location\}\}/g, appointment.location || '');
    }
    
    return preview;
  }, [sendForm.message, sendForm.lead_id, sendForm.appointment_id, leads, appointments]);

  // Insert variable at cursor position
  const insertVariable = (variable: string, target: 'send' | 'template') => {
    if (target === 'send') {
      setSendForm({ ...sendForm, message: sendForm.message + variable });
    } else {
      setTemplateForm({ ...templateForm, content: templateForm.content + variable });
    }
  };

  const [lastError, setLastError] = useState<{
    message: string;
    ip?: string;
    hint?: string;
  } | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{
    message_id: string;
    cost: number;
  } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: 'تم نسخ الـ IP إلى الحافظة' });
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = leads.find(l => l.id === sendForm.lead_id);
    if (!lead?.phone) {
      toast({ title: 'خطأ', description: 'العميل المحتمل ليس لديه رقم هاتف', variant: 'destructive' });
      return;
    }

    // Warn if appointment variables used without appointment selected
    if (usesAppointmentVars && !sendForm.appointment_id) {
      toast({ 
        title: 'تحذير', 
        description: 'الرسالة تحتوي على متغيرات الموعد ولكن لم يتم اختيار موعد', 
        variant: 'destructive' 
      });
      return;
    }

    setSending(true);
    setLastError(null);
    setLastSuccess(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone_number: lead.phone,
          message: sendForm.message,
          lead_id: sendForm.lead_id,
          template_id: sendForm.template_id || null,
          payment_type: sendForm.payment_type,
          appointment_id: sendForm.appointment_id || null,
        },
      });

      if (error) throw error;

      if (data.success) {
        setLastSuccess({
          message_id: data.message_id,
          cost: data.cost,
        });
        toast({ title: 'تم الإرسال', description: `تم إرسال الرسالة بنجاح (ID: ${data.message_id})` });
        setSendDialogOpen(false);
        setSendForm({ lead_id: '', template_id: '', message: '', payment_type: 'wallet', appointment_id: '' });
      } else {
        const apiError = data.api_response?.message || 'خطأ غير معروف من مزود الخدمة';
        setLastError({
          message: apiError,
          ip: data.debug_egress_ip,
          hint: data.whitelist_hint,
        });
        toast({ 
          title: 'فشل الإرسال', 
          description: apiError, 
          variant: 'destructive' 
        });
      }
      
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

  // Variable badges component
  const VariableBadges = ({ target }: { target: 'send' | 'template' }) => (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">المتغيرات المتاحة (اضغط للإضافة)</Label>
      <div className="flex flex-wrap gap-2">
        <TooltipProvider>
          {AVAILABLE_VARIABLES.map((v) => (
            <Tooltip key={v.key}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => insertVariable(v.key, target)}
                >
                  {v.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{v.description}</p>
                <code className="text-xs">{v.key}</code>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );

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
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader><DialogTitle>إرسال رسالة نصية</DialogTitle></DialogHeader>
              <form onSubmit={handleSendSms} className="space-y-4">
                <div className="space-y-2">
                  <Label>العميل المحتمل</Label>
                  <Select value={sendForm.lead_id} onValueChange={(value) => setSendForm({ ...sendForm, lead_id: value, appointment_id: '' })}>
                    <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>{lead.first_name} {lead.last_name} - {lead.phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sendForm.lead_id && appointments.length > 0 && (
                  <div className="space-y-2">
                    <Label>الموعد (اختياري - للمتغيرات)</Label>
                    <Select value={sendForm.appointment_id} onValueChange={(value) => setSendForm({ ...sendForm, appointment_id: value })}>
                      <SelectTrigger><SelectValue placeholder="اختر موعد" /></SelectTrigger>
                      <SelectContent>
                        {appointments.map((apt) => (
                          <SelectItem key={apt.id} value={apt.id}>
                            {format(new Date(apt.scheduled_at), 'yyyy/MM/dd - HH:mm', { locale: ar })}
                            {apt.location && ` - ${apt.location}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {usesAppointmentVars && !sendForm.appointment_id && sendForm.lead_id && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      الرسالة تحتوي على متغيرات موعد. {appointments.length === 0 ? 'لا توجد مواعيد قادمة لهذا العميل.' : 'يرجى اختيار موعد.'}
                    </AlertDescription>
                  </Alert>
                )}

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
                  <Label>نوع الدفع</Label>
                  <Select value={sendForm.payment_type} onValueChange={(value: 'wallet' | 'subscription') => setSendForm({ ...sendForm, payment_type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wallet">المحفظة (wallet)</SelectItem>
                      <SelectItem value="subscription">الاشتراك (subscription)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <VariableBadges target="send" />

                <div className="space-y-2">
                  <Label>نص الرسالة</Label>
                  <Textarea 
                    value={sendForm.message} 
                    onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} 
                    required 
                    rows={4} 
                    placeholder="مرحباً {{lead_first_name}}، نذكرك بموعدك يوم {{appointment_date}}..."
                  />
                </div>

                {sendForm.message && sendForm.lead_id && (
                  <div className="space-y-2 p-3 bg-muted rounded-lg">
                    <Label className="flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4" />
                      معاينة الرسالة
                    </Label>
                    <p className="text-sm whitespace-pre-wrap">{messagePreview}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />جاري الإرسال...</> : 'إرسال'}
                </Button>

                {lastError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>فشل الإرسال</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{lastError.message}</p>
                      {lastError.ip && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded">
                          <code className="text-sm font-mono">{lastError.ip}</code>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="outline" 
                            onClick={() => copyToClipboard(lastError.ip!)}
                            className="gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            نسخ IP
                          </Button>
                        </div>
                      )}
                      {lastError.hint && (
                        <p className="text-xs mt-1">{lastError.hint}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
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
                  <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader><DialogTitle>إنشاء قالب جديد</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateTemplate} className="space-y-4">
                      <div className="space-y-2">
                        <Label>اسم القالب</Label>
                        <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} required />
                      </div>

                      <VariableBadges target="template" />

                      <div className="space-y-2">
                        <Label>محتوى الرسالة</Label>
                        <Textarea 
                          value={templateForm.content} 
                          onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} 
                          required 
                          rows={4}
                          placeholder="مرحباً {{lead_first_name}}، نذكرك بموعدك مع {{company_name}} يوم {{appointment_date}} الساعة {{appointment_time}}."
                        />
                      </div>

                      {templateForm.content && (
                        <div className="p-3 bg-muted rounded-lg">
                          <Label className="text-sm text-muted-foreground">مثال على الاستخدام:</Label>
                          <p className="text-sm mt-1">{templateForm.content}</p>
                        </div>
                      )}

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
