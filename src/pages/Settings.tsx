import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Copy,
  RefreshCw,
  Building2,
  User,
  Webhook,
  Loader2,
  MessageSquare,
  Users,
  Database,
  ExternalLink,
  UserPlus,
  Calendar,
  TrendingUp,
  Target,
  CheckCircle2,
  Download,
  BarChart3,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LeadsByStatusChart, WeeklyLeadsChart, WeeklyAppointmentsChart, ClientsComparisonChart } from '@/components/charts/PerformanceCharts';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const db = supabase as any;

interface SystemStats {
  totalLeads: number;
  totalAppointments: number;
  totalSms: number;
  totalClients: number;
  totalUsers: number;
  closeRate: number;
  showRate: number;
  bookingRate: number;
  conversionRate: number;
  soldLeads: number;
  contactedLeads: number;
  completedAppointments: number;
  appointmentBookedLeads: number;
  newLeads: number;
  noShowAppointments: number;
  cancelledAppointments: number;
  scheduledAppointments: number;
  smsSent: number;
  smsDelivered: number;
  smsFailed: number;
}

interface ClientPerformance {
  id: string;
  company_name: string;
  leads_count: number;
  appointments_count: number;
  sold_count: number;
  close_rate: number;
}

export default function Settings() {
  const { client, profile, isSuperAdmin, isClient, refreshUserData } = useAuth();
  const { toast } = useToast();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Company state (Client only)
  const [webhookCode, setWebhookCode] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [regeneratingWebhook, setRegeneratingWebhook] = useState(false);

  // Insights stats (Super Admin only)
  const [insightsStats, setInsightsStats] = useState<SystemStats>({
    totalLeads: 0,
    totalAppointments: 0,
    totalSms: 0,
    totalClients: 0,
    totalUsers: 0,
    closeRate: 0,
    showRate: 0,
    bookingRate: 0,
    conversionRate: 0,
    soldLeads: 0,
    contactedLeads: 0,
    completedAppointments: 0,
    appointmentBookedLeads: 0,
    newLeads: 0,
    noShowAppointments: 0,
    cancelledAppointments: 0,
    scheduledAppointments: 0,
    smsSent: 0,
    smsDelivered: 0,
    smsFailed: 0,
  });
  const [clientsPerformance, setClientsPerformance] = useState<ClientPerformance[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
    if (client) {
      fetchClientData();
    }
    if (isSuperAdmin) {
      fetchInsightsStats();
    }
  }, [profile, client, isSuperAdmin]);

  const fetchClientData = async () => {
    if (!client?.id) return;
    const { data } = await db.from('clients').select('webhook_code, phone').eq('id', client.id).single();
    if (data) {
      setWebhookCode(data.webhook_code || '');
      setCompanyPhone(data.phone || '');
    }
  };

  const fetchInsightsStats = async () => {
    setLoadingInsights(true);
    try {
      const [
        leadsRes,
        newLeadsRes,
        soldLeadsRes,
        contactedLeadsRes,
        appointmentBookedRes,
        appointmentsRes,
        completedRes,
        noShowRes,
        cancelledRes,
        scheduledRes,
        clientsRes,
        usersRes,
        smsRes,
        smsSentRes,
        smsDeliveredRes,
        smsFailedRes
      ] = await Promise.all([
        db.from('leads').select('id', { count: 'exact', head: true }),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
        db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']),
        db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['appointment_booked', 'interviewed', 'sold', 'no_show']),
        db.from('appointments').select('id', { count: 'exact', head: true }),
        db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show'),
        db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
        db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('profiles').select('id', { count: 'exact', head: true }),
        db.from('sms_logs').select('id', { count: 'exact', head: true }),
        db.from('sms_logs').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
        db.from('sms_logs').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
        db.from('sms_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      ]);

      const totalLeads = leadsRes.count || 0;
      const soldLeads = soldLeadsRes.count || 0;
      const contactedLeads = contactedLeadsRes.count || 0;
      const appointmentBookedLeads = appointmentBookedRes.count || 0;
      const totalAppointments = appointmentsRes.count || 0;
      const completedAppointments = completedRes.count || 0;

      const closeRate = contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0;
      const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
      const bookingRate = totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0;
      const conversionRate = totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0;

      setInsightsStats({
        totalLeads,
        totalAppointments,
        totalSms: smsRes.count || 0,
        totalClients: clientsRes.count || 0,
        totalUsers: usersRes.count || 0,
        closeRate,
        showRate,
        bookingRate,
        conversionRate,
        soldLeads,
        contactedLeads,
        completedAppointments,
        appointmentBookedLeads,
        newLeads: newLeadsRes.count || 0,
        noShowAppointments: noShowRes.count || 0,
        cancelledAppointments: cancelledRes.count || 0,
        scheduledAppointments: scheduledRes.count || 0,
        smsSent: smsSentRes.count || 0,
        smsDelivered: smsDeliveredRes.count || 0,
        smsFailed: smsFailedRes.count || 0,
      });

      // Fetch client performance
      const { data: clients } = await db.from('clients').select('id, company_name');
      if (clients) {
        const performanceData = await Promise.all(
          clients.map(async (client: { id: string; company_name: string }) => {
            const [leadsCount, appointmentsCount, soldCount] = await Promise.all([
              db.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
              db.from('appointments').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
              db.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'sold'),
            ]);

            const leads = leadsCount.count || 0;
            const sold = soldCount.count || 0;

            return {
              id: client.id,
              company_name: client.company_name,
              leads_count: leads,
              appointments_count: appointmentsCount.count || 0,
              sold_count: sold,
              close_rate: leads > 0 ? Math.round((sold / leads) * 100) : 0,
            };
          })
        );
        setClientsPerformance(performanceData);
      }
    } catch (error) {
      console.error('Error fetching insights stats:', error);
    }
    setLoadingInsights(false);
  };

  const saveProfile = async () => {
    if (!profile?.id) return;
    setSavingProfile(true);

    const { error } = await db.from('profiles').update({ full_name: fullName }).eq('id', profile.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ البيانات', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ', description: 'تم تحديث بياناتك بنجاح' });
      await refreshUserData();
    }
    setSavingProfile(false);
  };

  const saveCompanyPhone = async () => {
    if (!client?.id) return;
    setSavingPhone(true);

    const { error } = await db.from('clients').update({ phone: companyPhone }).eq('id', client.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ رقم الهاتف', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ', description: 'تم حفظ رقم هاتف الشركة بنجاح' });
    }
    setSavingPhone(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: `تم نسخ ${label}` });
  };

  const regenerateWebhookCode = async () => {
    if (!client?.id) return;
    setRegeneratingWebhook(true);

    const newCode = crypto.randomUUID().replace(/-/g, '').substring(0, 32);

    const { error } = await db.from('clients').update({ webhook_code: newCode }).eq('id', client.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تجديد الرمز', variant: 'destructive' });
    } else {
      setWebhookCode(newCode);
      toast({ title: 'تم التجديد', description: 'تم تجديد رمز Webhook بنجاح' });
    }
    setRegeneratingWebhook(false);
  };

  const webhookUrl = `https://yplbixiwtxhaeohombcf.supabase.co/functions/v1/facebook-leads-webhook`;

  const smsDeliveryRate = insightsStats.totalSms > 0
    ? Math.round((insightsStats.smsDelivered / insightsStats.totalSms) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">إدارة إعدادات حسابك والنظام</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
            {isClient && <TabsTrigger value="company">الشركة</TabsTrigger>}
            {isClient && <TabsTrigger value="integrations">التكاملات</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="insights">الإحصائيات</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="system">النظام</TabsTrigger>}
          </TabsList>

          {/* Profile Tab - All Users */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  المعلومات الشخصية
                </CardTitle>
                <CardDescription>قم بتحديث معلومات ملفك الشخصي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input value={profile?.id || ''} readOnly className="bg-muted" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input value={profile?.phone || ''} readOnly className="bg-muted" dir="ltr" />
                </div>
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  حفظ التغييرات
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Tab - Clients Only */}
          {isClient && (
            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    معلومات الشركة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم الشركة</Label>
                      <Input value={client?.company_name || ''} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>القطاع</Label>
                      <Input value={client?.industry || '-'} readOnly className="bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم هاتف الشركة</Label>
                    <p className="text-xs text-muted-foreground">يستخدم في رسائل SMS كمتغير {"{c_phone}"}</p>
                    <div className="flex gap-2">
                      <Input
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="00218XXXXXXXXX"
                        dir="ltr"
                      />
                      <Button onClick={saveCompanyPhone} disabled={savingPhone}>
                        {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Integrations Tab - Clients Only */}
          {isClient && (
            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    إعدادات Webhook
                  </CardTitle>
                  <CardDescription>
                    استخدم هذه الإعدادات لربط نظامك مع Facebook Lead Ads عبر Make.com
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>رمز العميل (Client Code)</Label>
                    <div className="flex gap-2">
                      <Input value={webhookCode} readOnly className="font-mono bg-muted" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookCode, 'رمز العميل')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={regenerateWebhookCode} disabled={regeneratingWebhook}>
                        {regeneratingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>رابط Webhook</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" dir="ltr" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, 'رابط Webhook')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">تعليمات الإعداد في Make.com:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>أنشئ سيناريو جديد في Make.com</li>
                      <li>أضف وحدة Facebook Lead Ads كمحفز</li>
                      <li>أضف وحدة HTTP Request</li>
                      <li>اختر Method: POST</li>
                      <li>الصق رابط Webhook في حقل URL</li>
                      <li>أضف Headers: Content-Type = application/json</li>
                      <li>في Body، أرسل JSON بالشكل التالي:</li>
                    </ol>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto" dir="ltr">
                      {`{
  "client_code": "${webhookCode || 'YOUR_CLIENT_CODE'}",
  "first_name": "{{firstName}}",
  "last_name": "{{lastName}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "source": "Facebook Lead Ads"
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Insights Tab - Super Admin Only */}
          {isSuperAdmin && (
            <TabsContent value="insights" className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                  <Activity className="h-6 w-6" />
                  نظرة شاملة على الأداء
                </h2>
                <p className="text-muted-foreground text-sm mb-6">جميع المقاييس والإحصائيات في مكان واحد</p>

                {loadingInsights ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Key Performance Metrics */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                      <Card className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل الإغلاق</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-green-600">{insightsStats.closeRate}%</div>
                          <p className="text-xs text-muted-foreground">{insightsStats.soldLeads} من {insightsStats.contactedLeads}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل الحضور</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-blue-600">{insightsStats.showRate}%</div>
                          <p className="text-xs text-muted-foreground">{insightsStats.completedAppointments} من {insightsStats.totalAppointments}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-amber-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل الحجز</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-amber-600">{insightsStats.bookingRate}%</div>
                          <p className="text-xs text-muted-foreground">{insightsStats.appointmentBookedLeads} من {insightsStats.totalLeads}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل التحويل</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-purple-600">{insightsStats.conversionRate}%</div>
                          <p className="text-xs text-muted-foreground">من إجمالي العملاء</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Leads Breakdown */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <UserPlus className="h-5 w-5" />
                          تفصيل العملاء المحتملين
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                            <p className="text-2xl font-bold">{insightsStats.totalLeads}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">جديد</p>
                            <p className="text-2xl font-bold text-blue-600">{insightsStats.newLeads}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم التواصل</p>
                            <p className="text-2xl font-bold text-amber-600">{insightsStats.contactedLeads}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم البيع</p>
                            <p className="text-2xl font-bold text-green-600">{insightsStats.soldLeads}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Appointments Breakdown */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          تفصيل المواعيد
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي المواعيد</p>
                            <p className="text-2xl font-bold">{insightsStats.totalAppointments}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">مجدول</p>
                            <p className="text-2xl font-bold text-blue-600">{insightsStats.scheduledAppointments}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">مكتمل</p>
                            <p className="text-2xl font-bold text-green-600">{insightsStats.completedAppointments}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">لم يحضر</p>
                            <p className="text-2xl font-bold text-orange-600">{insightsStats.noShowAppointments}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* SMS Analytics */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          تحليل الرسائل النصية
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي الرسائل</p>
                            <p className="text-2xl font-bold">{insightsStats.totalSms}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم الإرسال</p>
                            <p className="text-2xl font-bold text-blue-600">{insightsStats.smsSent}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم التسليم</p>
                            <p className="text-2xl font-bold text-green-600">{insightsStats.smsDelivered}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">فشل</p>
                            <p className="text-2xl font-bold text-red-600">{insightsStats.smsFailed}</p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">معدل التسليم</span>
                            <span className="text-lg font-semibold text-green-600">{smsDeliveryRate}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* System Overview */}
                    <div className="grid gap-4 md:grid-cols-2 mb-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            العملاء والمستخدمين
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">إجمالي العملاء (الشركات)</span>
                              <span className="text-xl font-bold">{insightsStats.totalClients}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">إجمالي المستخدمين</span>
                              <span className="text-xl font-bold">{insightsStats.totalUsers}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            معدلات الأداء
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">معدل الإغلاق</span>
                              <Badge variant={insightsStats.closeRate >= 50 ? "default" : "secondary"} className={insightsStats.closeRate >= 50 ? "bg-green-600" : ""}>
                                {insightsStats.closeRate}%
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">معدل الحضور</span>
                              <Badge variant={insightsStats.showRate >= 70 ? "default" : "secondary"} className={insightsStats.showRate >= 70 ? "bg-green-600" : ""}>
                                {insightsStats.showRate}%
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">معدل التحويل</span>
                              <Badge variant={insightsStats.conversionRate >= 30 ? "default" : "secondary"} className={insightsStats.conversionRate >= 30 ? "bg-green-600" : ""}>
                                {insightsStats.conversionRate}%
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                      <LeadsByStatusChart />
                      <WeeklyLeadsChart />
                      <WeeklyAppointmentsChart />
                    </div>

                    {/* Client Performance Comparison */}
                    {clientsPerformance.length > 0 && (
                      <>
                        <ClientsComparisonChart clientsData={clientsPerformance} />

                        <Card className="mt-6">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5" />
                              جدول أداء العملاء
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">الشركة</TableHead>
                                  <TableHead className="text-center">العملاء المحتملين</TableHead>
                                  <TableHead className="text-center">المواعيد</TableHead>
                                  <TableHead className="text-center">المبيعات</TableHead>
                                  <TableHead className="text-center">معدل الإغلاق</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientsPerformance.map((client) => (
                                  <TableRow key={client.id}>
                                    <TableCell className="font-medium">{client.company_name}</TableCell>
                                    <TableCell className="text-center">{client.leads_count}</TableCell>
                                    <TableCell className="text-center">{client.appointments_count}</TableCell>
                                    <TableCell className="text-center">{client.sold_count}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge
                                        variant={client.close_rate >= 50 ? 'default' : client.close_rate >= 25 ? 'secondary' : 'outline'}
                                        className={client.close_rate >= 50 ? 'bg-green-600' : ''}
                                      >
                                        {client.close_rate}%
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          )}

          {/* System Tab - Super Admin Only */}
          {isSuperAdmin && (
            <TabsContent value="system" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">إعدادات النظام</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        إعدادات SMS
                      </CardTitle>
                      <CardDescription>إدارة خدمة الرسائل النصية</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>مزود الخدمة</Label>
                        <Input value="Resala.ly" readOnly className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>حالة الخدمة</Label>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm text-muted-foreground">نشط</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        إدارة المستخدمين
                      </CardTitle>
                      <CardDescription>إدارة حسابات المستخدمين والصلاحيات</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link to="/users">
                        <Button variant="outline" className="w-full justify-between">
                          فتح إدارة المستخدمين
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        معلومات النظام
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">الإصدار</span>
                        <span className="font-mono">1.0.0</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">البيئة</span>
                        <span className="font-mono">Production</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        تصدير البيانات
                      </CardTitle>
                      <CardDescription>تصدير بيانات النظام</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" disabled>
                        <Download className="h-4 w-4 ml-2" />
                        تصدير التقرير (قريباً)
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}