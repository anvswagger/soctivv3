import { Suspense, lazy, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboardStats } from '@/hooks/useCrmData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Calendar, TrendingUp, MessageSquare, Target, CheckCircle2, PhoneCall, AlertTriangle, RefreshCw, Zap, ShoppingCart, Package, Clock, ArrowRight, Phone, ChevronLeft, Sparkles, BarChart3, Timer, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Use any-typed supabase client to avoid strict enum literal type errors
const supabaseAny = supabase as any;

import { formatDateTime, formatNumber } from '@/lib/format';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_POLICY } from '@/lib/queryPolicy';
import { queryInvalidation } from '@/lib/queryInvalidation';
import { Badge } from '@/components/ui/badge';

const LeadsByStatusChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.LeadsByStatusChart }))
);
const WeeklyLeadsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyLeadsChart }))
);
const PriorityInbox = lazy(() =>
  import('@/components/leads/PriorityInbox').then((module) => ({ default: module.PriorityInbox }))
);
const LeaderboardWidget = lazy(() =>
  import('@/components/dashboard/LeaderboardWidget').then((module) => ({ default: module.LeaderboardWidget }))
);
const ActivityFeed = lazy(() =>
  import('@/components/dashboard/ActivityFeed').then((module) => ({ default: module.ActivityFeed }))
);
const ClientQuickHub = lazy(() =>
  import('@/components/dashboard/ClientQuickHub').then((module) => ({ default: module.ClientQuickHub }))
);
const InstallPrompt = lazy(() =>
  import('@/components/InstallPrompt').then((module) => ({ default: module.InstallPrompt }))
);

interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  appointmentsThisWeek: number;
  conversionRate: number;
  closeRate: number;
  showRate: number;
  bookingRate: number;
  totalUsers: number;
  totalSms: number;
}

const statusLabels: Record<string, string> = {
  new: 'جديد',
  contacting: 'قيد التواصل',
  appointment_booked: 'موعد محجوز',
  interviewed: 'تمت المقابلة',
  no_show: 'لم يحضر',
  sold: 'تم البيع',
  cancelled: 'ملغي',
};

export default function Dashboard() {
  const { profile, isAdmin, isSuperAdmin, assignedClients, client } = useAuth();
  const queryClient = useQueryClient();

  const clientFilter = isSuperAdmin
    ? null
    : isAdmin
      ? assignedClients
      : client?.id
        ? [client.id]
        : [];

  const { data: stats, isLoading, isError, error } = useDashboardStats(clientFilter);

  const { data: actionData, isLoading: actionsLoading } = useQuery({
    queryKey: queryKeys.dashboard.actions(clientFilter),
    queryFn: async () => {
      if (clientFilter !== null && clientFilter.length === 0) {
        return { leads: [], noShowAppointments: [], upcomingAppointments: [] };
      }

      let leadsQuery = supabaseAny
        .from('leads')
        .select('id, first_name, last_name, status, created_at, updated_at, first_contact_at, client_id, phone')
        .order('created_at', { ascending: false })
        .limit(200);

      let appointmentsQuery = supabaseAny
        .from('appointments')
        .select('id, scheduled_at, status, lead:leads(first_name, last_name, phone), client_id')
        .eq('status', 'no_show' as any)
        .order('scheduled_at', { ascending: false })
        .limit(50);

      let upcomingAppointmentsQuery = supabaseAny
        .from('appointments')
        .select('id, scheduled_at, status, lead:leads(first_name, last_name, phone), client_id')
        .in('status', ['confirmed', 'pending'] as any)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (clientFilter !== null) {
        leadsQuery = leadsQuery.in('client_id', clientFilter as any);
        appointmentsQuery = appointmentsQuery.in('client_id', clientFilter as any);
        upcomingAppointmentsQuery = upcomingAppointmentsQuery.in('client_id', clientFilter as any);
      }

      const [leadsRes, appointmentsRes, upcomingRes] = await Promise.all([
        leadsQuery,
        appointmentsQuery,
        upcomingAppointmentsQuery
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (upcomingRes.error) throw upcomingRes.error;

      return {
        leads: leadsRes.data || [],
        noShowAppointments: appointmentsRes.data || [],
        upcomingAppointments: upcomingRes.data || [],
      };
    },
    staleTime: QUERY_POLICY.crm.dashboardActions.staleTime,
    gcTime: QUERY_POLICY.crm.dashboardActions.gcTime,
  });

  const { data: activityEvents = [] } = useQuery({
    queryKey: queryKeys.dashboard.activities(clientFilter),
    queryFn: async () => {
      const leads = actionData?.leads || [];
      const events: any[] = leads.slice(0, 10).map((l: any) => ({
        id: l.id,
        eventType: l.status === 'new' ? 'new_lead' : 'status_change',
        timestamp: l.updated_at || l.created_at,
        notes: l.status === 'new'
          ? `عميل جديد: ${l.first_name} ${l.last_name}`
          : `تحديث حالة العميل ${l.first_name} ${l.last_name} إلى ${statusLabels[(l.status || '').toLowerCase().trim()] || l.status}`,
        userId: profile?.id || '',
      }));
      return events;
    },
    enabled: !!actionData,
    staleTime: QUERY_POLICY.crm.dashboardActivities.staleTime,
    gcTime: QUERY_POLICY.crm.dashboardActivities.gcTime,
  });

  const actionBuckets = useMemo(() => {
    const leads = actionData?.leads || [];
    const noShowAppointments = actionData?.noShowAppointments || [];
    const now = Date.now();
    const overdueCutoff = now - 1000 * 60 * 60 * 48; // 48h
    const followUpCutoff = now - 1000 * 60 * 60 * 72; // 72h
    const noShowCutoff = now - 1000 * 60 * 60 * 24 * 14; // 14 days

    const overdueLeads = leads
      .filter((lead: any) => lead.status === 'new' && !lead.first_contact_at && new Date(lead.created_at).getTime() < overdueCutoff)
      .slice(0, 5);

    const followUps = leads
      .filter((lead: any) => lead.status === 'contacting' && new Date(lead.updated_at).getTime() < followUpCutoff)
      .slice(0, 5);

    const noShowRecovery = noShowAppointments
      .filter((appt: any) => new Date(appt.scheduled_at).getTime() > noShowCutoff)
      .slice(0, 5);

    const newLeadsToday = leads
      .filter((lead: any) => {
        const created = new Date(lead.created_at).getTime();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return created >= todayStart.getTime() && lead.status === 'new';
      });

    const contactingLeads = leads
      .filter((lead: any) => lead.status === 'contacting');

    return { overdueLeads, followUps, noShowRecovery, newLeadsToday, contactingLeads };
  }, [actionData]);

  const upcomingAppointments = useMemo(() => {
    return (actionData?.upcomingAppointments || []).slice(0, 5);
  }, [actionData]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !stats) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-destructive text-lg font-bold">عذراً، حدث خطأ في تحميل البيانات</div>
          <p className="text-muted-foreground">{(error as Error)?.message || 'يرجى التأكد من اتصال الإنترنت أو إعدادات قاعدة البيانات'}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats })}>
            إعادة المحاولة
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-black tracking-tight text-foreground">
              مرحباً {profile?.full_name?.split(' ')[0] || 'بك'} 👋
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mt-1">
              إليك نظرة سريعة على أداء عملك اليوم
            </p>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-10 w-full px-4 text-sm font-semibold sm:h-12 sm:w-auto sm:px-6"
              onClick={() => { void queryInvalidation.invalidateDomain(queryClient, 'dashboard'); }}
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث البيانات
            </Button>
          </div>
        </div>

        {/* --- CLIENT VERSION --- */}
        {(!isAdmin && !isSuperAdmin) ? (
          <div className="space-y-8">
            {/* Quick Stats for Client */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">إجمالي العملاء</p>
                    <p className="text-xl sm:text-2xl font-black">{formatNumber(stats.totalLeads)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">عملاء جدد</p>
                    <p className="text-xl sm:text-2xl font-black">{formatNumber(stats.newLeads)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">مواعيد هذا الأسبوع</p>
                    <p className="text-xl sm:text-2xl font-black">{formatNumber(stats.appointmentsThisWeek)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">معدل التحويل</p>
                    <p className="text-xl sm:text-2xl font-black">{stats.conversionRate}%</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Upcoming */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Suspense fallback={<div className="h-56 bg-muted animate-pulse rounded-2xl" />}>
                <ClientQuickHub />
              </Suspense>

              {/* Upcoming Appointments */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-500" />
                      الطلبات القادمة
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                      <Link to="/appointments" className="flex items-center gap-1">
                        عرض الكل
                        <ChevronLeft className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {upcomingAppointments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">لا توجد مواعيد قادمة</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAppointments.map((appt: any) => (
                        <div
                          key={appt.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <Clock className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {appt.lead?.first_name} {appt.lead?.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(appt.scheduled_at)}
                              </p>
                            </div>
                          </div>
                          <Badge variant={appt.status === 'confirmed' ? 'default' : 'secondary'}>
                            {appt.status === 'confirmed' ? 'مؤكد' : 'في الانتظار'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Activity Feed */}
            <Suspense fallback={<div className="h-[420px] bg-muted animate-pulse rounded-2xl" />}>
              <ActivityFeed events={activityEvents} className="max-h-[420px] sm:max-h-[500px]" />
            </Suspense>
          </div>
        ) : (
          /* --- ADMIN VERSION (COMMAND CENTER) --- */
          <div className="space-y-8">
            {/* Today's Focus - The Most Important Section */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary fill-primary" />
                  تركيز اليوم
                </CardTitle>
                <p className="text-sm text-muted-foreground">هذه أهم المهام التي تحتاج انتباهك الآن</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* New Leads Today */}
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 hover:border-green-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <UserPlus className="h-5 w-5 text-green-500" />
                      </div>
                      <span className="text-3xl font-black text-green-600">{actionBuckets.newLeadsToday.length}</span>
                    </div>
                    <p className="text-sm font-medium">عملاء جدد اليوم</p>
                    <p className="text-xs text-muted-foreground mt-1">يحتاجون أول تواصل</p>
                  </div>

                  {/* Overdue Leads */}
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 hover:border-red-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <span className="text-3xl font-black text-red-600">{actionBuckets.overdueLeads.length}</span>
                    </div>
                    <p className="text-sm font-medium">عملاء متأخرين</p>
                    <p className="text-xs text-muted-foreground mt-1">48+ ساعة بدون تواصل</p>
                  </div>

                  {/* Follow-ups Needed */}
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <RefreshCw className="h-5 w-5 text-amber-500" />
                      </div>
                      <span className="text-3xl font-black text-amber-600">{actionBuckets.followUps.length}</span>
                    </div>
                    <p className="text-sm font-medium">يحتاجون متابعة</p>
                    <p className="text-xs text-muted-foreground mt-1">72+ ساعة في قيد المعالجة</p>
                  </div>

                  {/* No-Show Recovery */}
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Timer className="h-5 w-5 text-blue-500" />
                      </div>
                      <span className="text-3xl font-black text-blue-600">{actionBuckets.noShowRecovery.length}</span>
                    </div>
                    <p className="text-sm font-medium">مواعيد فائتة</p>
                    <p className="text-xs text-muted-foreground mt-1">للإعادة الجدولة</p>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <Button asChild className="flex-1 sm:flex-none">
                    <Link to="/leads" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      بدء الاتصالات
                      {actionBuckets.newLeadsToday.length > 0 && (
                        <Badge variant="secondary" className="ml-1 bg-white/20">
                          {actionBuckets.newLeadsToday.length}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="flex-1 sm:flex-none">
                    <Link to="/appointments" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      ادارة الطلبات
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="flex-1 sm:flex-none">
                    <Link to="/reports" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      التقارير
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Performance Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'معدل الإغلاق', val: `${stats.closeRate}%`, icon: Target, color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' },
                { label: 'معدل الحضور', val: `${stats.showRate}%`, icon: CheckCircle2, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
                { label: 'معدل الحجز', val: `${stats.bookingRate}%`, icon: Calendar, color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
                { label: 'رسائل مرسلة', val: formatNumber(stats.totalSms), icon: MessageSquare, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
              ].map((m, i) => (
                <Card key={i} className={cn("hover:border-primary/50 transition-colors", m.borderColor)}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl border", m.bgColor, m.borderColor)}>
                      <m.icon className={cn("h-6 w-6", m.color)} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                      <p className="text-2xl font-black">{m.val}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Actions & Inbox */}
              <div className="lg:col-span-2 space-y-6">
                {/* Upcoming Appointments */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-purple-500" />
                        الطلبات القادمة
                      </CardTitle>
                      <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                        <Link to="/appointments" className="flex items-center gap-1">
                          عرض الكل
                          <ChevronLeft className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {upcomingAppointments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">لا توجد مواعيد قادمة</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingAppointments.map((appt: any) => (
                          <div
                            key={appt.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-purple-500/10">
                                <Clock className="h-4 w-4 text-purple-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {appt.lead?.first_name} {appt.lead?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(appt.scheduled_at)}
                                </p>
                              </div>
                            </div>
                            <Badge variant={appt.status === 'confirmed' ? 'default' : 'secondary'}>
                              {appt.status === 'confirmed' ? 'مؤكد' : 'في الانتظار'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Priority Inbox */}
                <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-xl" />}>
                  <PriorityInbox />
                </Suspense>
              </div>

              {/* Right Column - Activity & Leaderboard */}
              <div className="space-y-6">
                <Suspense fallback={<div className="h-[420px] bg-muted animate-pulse rounded-2xl" />}>
                  <ActivityFeed events={activityEvents} className="max-h-[420px]" />
                </Suspense>

                <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                  <LeaderboardWidget />
                </Suspense>
              </div>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                <LeadsByStatusChart clientFilter={clientFilter} />
              </Suspense>
              <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                <WeeklyLeadsChart clientFilter={clientFilter} />
              </Suspense>
              <Card className="flex flex-col items-center justify-center p-8 text-center">
                <Flame className="h-12 w-12 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">أداء الفريق</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  شاهد تقارير مفصلة عن أداء الفريق والتحويلات
                </p>
                <Button asChild>
                  <Link to="/reports" className="flex items-center gap-2">
                    عرض التقارير
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </Card>
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}