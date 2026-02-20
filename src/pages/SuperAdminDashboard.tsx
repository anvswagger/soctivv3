import { useMemo, useState, useEffect, Suspense, lazy } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserPlus, 
  Calendar, 
  TrendingUp, 
  Loader2, 
  MessageSquare,
  Building2,
  Target,
  CheckCircle2,
  XCircle,
  BarChart3,
  Clock,
  PhoneCall,
  Activity,
  Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { analyticsService } from '@/services/analyticsService';
import type { SuperAdminAnalyticsResponse } from '@/types/analytics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
const LeadsByStatusChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.LeadsByStatusChart }))
);
const WeeklyLeadsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyLeadsChart }))
);
const WeeklyAppointmentsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyAppointmentsChart }))
);
const ClientsComparisonChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.ClientsComparisonChart }))
);
const SuperAdminHourlyCallsChart = lazy(() =>
  import('@/components/charts/SuperAdminHourlyCallsChart').then((module) => ({ default: module.SuperAdminHourlyCallsChart }))
);

interface SystemStats {
  totalLeads: number;
  totalAppointments: number;
  completedAppointments: number;
  noShowAppointments: number;
  soldLeads: number;
  contactedLeads: number;
  totalClients: number;
  totalUsers: number;
  totalSms: number;
  closeRate: number;
  showRate: number;
  bookingRate: number;
}

interface ClientPerformance {
  id: string;
  company_name: string;
  leads_count: number;
  appointments_count: number;
  sold_count: number;
  close_rate: number;
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<SystemStats>({
    totalLeads: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    noShowAppointments: 0,
    soldLeads: 0,
    contactedLeads: 0,
    totalClients: 0,
    totalUsers: 0,
    totalSms: 0,
    closeRate: 0,
    showRate: 0,
    bookingRate: 0,
  });
  const [clientsPerformance, setClientsPerformance] = useState<ClientPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsRange, setAnalyticsRange] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState<SuperAdminAnalyticsResponse | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Fetch core totals and rate inputs
        const [
          leadsRes,
          soldLeadsRes,
          contactedLeadsRes,
          appointmentBookedRes,
          appointmentsRes,
          completedRes,
          noShowRes,
          clientsRes,
          usersRes,
          smsRes
        ] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
          supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']),
          supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['appointment_booked', 'interviewed', 'sold', 'no_show']),
          supabase.from('appointments').select('id', { count: 'exact', head: true }),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show'),
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('sms_logs').select('id', { count: 'exact', head: true }),
        ]);

        const totalLeads = leadsRes.count || 0;
        const soldLeads = soldLeadsRes.count || 0;
        const contactedLeads = contactedLeadsRes.count || 0;
        const appointmentBookedLeads = appointmentBookedRes.count || 0;
        const totalAppointments = appointmentsRes.count || 0;
        const completedAppointments = completedRes.count || 0;
        const noShowAppointments = noShowRes.count || 0;
        const scheduledAppointments = totalAppointments - (completedAppointments + noShowAppointments);

        // Compute rates
        const closeRate = contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0;
        const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
        const bookingRate = totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0;

        setStats({
          totalLeads,
          totalAppointments,
          completedAppointments,
          noShowAppointments,
          soldLeads,
          contactedLeads,
          totalClients: clientsRes.count || 0,
          totalUsers: usersRes.count || 0,
          totalSms: smsRes.count || 0,
          closeRate,
          showRate,
          bookingRate,
        });

        // Per-client performance rollup
        const { data: clients } = await supabase.from('clients').select('id, company_name');
        if (clients) {
          const performanceData = await Promise.all(
            clients.map(async (client: { id: string; company_name: string }) => {
              const [leadsCount, appointmentsCount, soldCount] = await Promise.all([
                supabase.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
                supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
                supabase.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'sold'),
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
        console.error('Error fetching stats:', error);
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const now = new Date();
        let startAt: string | null = null;

        if (analyticsRange === '7d') {
          const start = new Date(now);
          start.setDate(now.getDate() - 7);
          startAt = start.toISOString();
        } else if (analyticsRange === '30d') {
          const start = new Date(now);
          start.setDate(now.getDate() - 30);
          startAt = start.toISOString();
        } else if (analyticsRange === '90d') {
          const start = new Date(now);
          start.setDate(now.getDate() - 90);
          startAt = start.toISOString();
        }

        const result = await analyticsService.getSuperAdminAnalytics({
          startAt,
          endAt: now.toISOString(),
        });
        setAnalyticsData(result);
      } catch (error) {
        console.error('Error fetching super admin analytics:', error);
        setAnalyticsData(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, [analyticsRange]);

  const hourlyCallData = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    if (!analyticsData?.callHourly) return base;
    const map = new Map<number, number>();
    analyticsData.callHourly.forEach((entry) => {
      map.set(entry.hour, entry.count);
    });
    return base.map((entry) => ({
      hour: entry.hour,
      count: map.get(entry.hour) ?? 0,
    }));
  }, [analyticsData]);

  const companyMetrics = useMemo(() => {
    const list = analyticsData?.companyMetrics ?? [];
    return [...list].sort((a, b) => (b.callsCount ?? 0) - (a.callsCount ?? 0));
  }, [analyticsData]);

  const formatMinutes = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return '--';
    if (value < 60) return `${Math.round(value)}m`;
    const hours = Math.floor(value / 60);
    const minutes = Math.round(value % 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">لوحة تحكم السوبر أدمن</h1>
          <p className="text-muted-foreground">مرحباً {profile?.full_name}، إليك نظرة عامة على أداء النظام</p>
        </div>

        {/* المؤشرات الرئيسية */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل الإغلاق</CardTitle>
              <Target className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.closeRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.soldLeads} من {stats.contactedLeads} تم التواصل معهم
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل الحضور</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{stats.showRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedAppointments} من {stats.totalAppointments} موعد
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل حجز الموعد</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.bookingRate}%</div>
              <p className="text-xs text-muted-foreground">
                من إجمالي العملاء المحتملين: {stats.totalLeads}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* إحصائيات النظام */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">العملاء المحتملين</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
              <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground">{stats.soldLeads} تم البيع</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المواعيد</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-success">{stats.completedAppointments} مكتمل</span>
                {' - '}
                <span className="text-destructive">{stats.noShowAppointments} لم يحضر</span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">الشركات (العملاء)</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
              <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">إجمالي الشركات</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المستخدمون</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
              <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">الرسائل النصية</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
              <CardContent>
              <div className="text-2xl font-bold">{stats.totalSms}</div>
              <p className="text-xs text-muted-foreground">رسالة مرسلة</p>
            </CardContent>
          </Card>
        </div>

        {/* الرسوم البيانية */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
            <LeadsByStatusChart />
          </Suspense>
          <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
            <WeeklyLeadsChart />
          </Suspense>
          <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
            <WeeklyAppointmentsChart />
          </Suspense>
        </div>

        {/* مقارنة أداء الشركات */}
        <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
          <ClientsComparisonChart clientsData={clientsPerformance} />
        </Suspense>

        {/* جدول أداء الشركات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              جدول أداء الشركات
            </CardTitle>
            <CardDescription>مقارنة الأداء بين الشركات</CardDescription>
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
                {clientsPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      لا توجد بيانات
                    </TableCell>
                  </TableRow>
                ) : (
                  clientsPerformance.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.company_name}</TableCell>
                      <TableCell className="text-center">{client.leads_count}</TableCell>
                      <TableCell className="text-center">{client.appointments_count}</TableCell>
                      <TableCell className="text-center">{client.sold_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={client.close_rate >= 50 ? 'default' : client.close_rate >= 25 ? 'secondary' : 'outline'}
                          className={client.close_rate >= 50 ? 'bg-success' : ''}
                        >
                          {client.close_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Intelligence Center */}
        <Card className="border-border/70 bg-gradient-to-br from-background via-background to-muted/40">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Intelligence Center
              </CardTitle>
              <CardDescription>تحليلات متقدمة عبر كل الشركات: الاستجابة، المكالمات، وسلوك الفريق.</CardDescription>
            </div>
            <Select value={analyticsRange} onValueChange={setAnalyticsRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="النطاق الزمني" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">آخر 7 أيام</SelectItem>
                <SelectItem value="30d">آخر 30 يوم</SelectItem>
                <SelectItem value="90d">آخر 90 يوم</SelectItem>
                <SelectItem value="all">كل الوقت</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">متوسط وقت الاستجابة للعميل</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {formatMinutes(analyticsData?.summary?.avgLeadResponseMinutes)}
                      </div>
                      <p className="text-xs text-muted-foreground">من تسجيل العميل حتى أول تواصل</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">نسبة الاتصال قبل الموعد</CardTitle>
                      <PhoneCall className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {analyticsData?.summary?.callsBeforeAppointmentRate
                          ? `${Math.round(analyticsData.summary.callsBeforeAppointmentRate * 100)}%`
                          : '0%'}
                      </div>
                      <p className="text-xs text-muted-foreground">نسبة العملاء الذين تم الاتصال بهم قبل الموعد</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">متوسط المكالمات قبل الموعد</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {analyticsData?.summary?.avgCallsBeforeAppointment
                          ? analyticsData.summary.avgCallsBeforeAppointment.toFixed(1)
                          : '0.0'}
                      </div>
                      <p className="text-xs text-muted-foreground">مكالمة</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">متوسط الوقت من أول مكالمة إلى الموعد</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {formatMinutes(analyticsData?.summary?.avgFirstCallToAppointmentMinutes)}
                      </div>
                      <p className="text-xs text-muted-foreground">من أول مكالمة حتى الموعد</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>المكالمات حسب الساعة</CardTitle>
                      <CardDescription>توزيع المكالمات على مدار اليوم</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      <Suspense fallback={<div className="h-full bg-muted/60 animate-pulse rounded-xl" />}>
                        <SuperAdminHourlyCallsChart data={hourlyCallData} />
                      </Suspense>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>ملخص الفترة</CardTitle>
                      <CardDescription>أرقام سريعة للنطاق المحدد</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">إجمالي العملاء المحتملين</span>
                        <span className="text-lg font-semibold">{analyticsData?.summary?.totalLeads ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">إجمالي المواعيد</span>
                        <span className="text-lg font-semibold">{analyticsData?.summary?.totalAppointments ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">إجمالي المكالمات</span>
                        <span className="text-lg font-semibold">{analyticsData?.summary?.totalCalls ?? 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>أداء الشركات حسب الاتصال</CardTitle>
                    <CardDescription>مقارنة الشركات حسب المكالمات والاستجابة والالتزام قبل الموعد</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الشركة</TableHead>
                          <TableHead className="text-center">العملاء</TableHead>
                          <TableHead className="text-center">المكالمات</TableHead>
                          <TableHead className="text-center">متوسط الاستجابة</TableHead>
                          <TableHead className="text-center">نسبة الاتصال قبل الموعد</TableHead>
                          <TableHead className="text-center">متوسط المكالمات قبل الموعد</TableHead>
                          <TableHead className="text-center">متوسط (أول مكالمة - موعد)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyMetrics.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              لا توجد بيانات للفترة المحددة
                            </TableCell>
                          </TableRow>
                        ) : (
                          companyMetrics.map((client) => (
                            <TableRow key={client.companyId}>
                              <TableCell className="font-medium">{client.companyName}</TableCell>
                              <TableCell className="text-center">{client.leadsCount ?? 0}</TableCell>
                              <TableCell className="text-center">{client.callsCount ?? 0}</TableCell>
                              <TableCell className="text-center">{formatMinutes(client.avgLeadResponseMinutes)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">
                                  {client.callsBeforeAppointmentRate
                                    ? `${Math.round(client.callsBeforeAppointmentRate * 100)}%`
                                    : '0%'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {client.avgCallsBeforeAppointment ? client.avgCallsBeforeAppointment.toFixed(1) : '0.0'}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatMinutes(client.avgFirstCallToAppointmentMinutes)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

















