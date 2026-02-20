import { Suspense, lazy, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboardStats } from '@/hooks/useCrmData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Calendar, TrendingUp, MessageSquare, Target, CheckCircle2, PhoneCall, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime, formatNumber } from '@/lib/format';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_POLICY } from '@/lib/queryPolicy';
import { queryInvalidation } from '@/lib/queryInvalidation';

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

// Use the typed supabase client directly

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

const dashboardFeatures = [
  {
    icon: Users,
    title: 'إدارة العملاء',
    description: 'تتبع وإدارة جميع العملاء المحتملين',
  },
  {
    icon: Calendar,
    title: 'جدولة المواعيد',
    description: 'نظام متكامل لإدارة المواعيد',
  },
  {
    icon: MessageSquare,
    title: 'رسائل SMS',
    description: 'تواصل مباشر مع العملاء',
  },
  {
    icon: TrendingUp,
    title: 'تقارير وإحصائيات',
    description: 'تحليلات شاملة لأداء فريقك',
  },
];

const statusLabels: Record<string, string> = {
  new: 'جديد',
  contacting: 'قيد التواصل',
  appointment_booked: 'موعد محجوز',
  interviewed: 'تمت المقابلة',
  no_show: 'غائب',
  sold: 'تم البيع',
  cancelled: 'ملغاة',
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
        return { leads: [], noShowAppointments: [] };
      }

      let leadsQuery = supabase
        .from('leads')
        .select('id, first_name, last_name, status, created_at, updated_at, first_contact_at, client_id, phone')
        .order('created_at', { ascending: false })
        .limit(200);

      let appointmentsQuery = supabase
        .from('appointments')
        .select('id, scheduled_at, status, lead:leads(first_name, last_name, phone), client_id')
        .eq('status', 'no_show')
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (clientFilter !== null) {
        leadsQuery = leadsQuery.in('client_id', clientFilter);
        appointmentsQuery = appointmentsQuery.in('client_id', clientFilter);
      }

      const [leadsRes, appointmentsRes] = await Promise.all([leadsQuery, appointmentsQuery]);
      if (leadsRes.error) throw leadsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      return {
        leads: leadsRes.data || [],
        noShowAppointments: appointmentsRes.data || [],
      };
    },
    staleTime: QUERY_POLICY.crm.dashboardActions.staleTime,
    gcTime: QUERY_POLICY.crm.dashboardActions.gcTime,
  });

  const { data: activityEvents = [] } = useQuery({
    queryKey: queryKeys.dashboard.activities(clientFilter),
    queryFn: async () => {
      // For now, derive some events from leads and appointments
      // In a real scenario, this would come from an interactions table
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

    return { overdueLeads, followUps, noShowRecovery };
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-black tracking-tight text-foreground">لوحة التحكم</h1>
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">مرحباً {profile?.full_name}، إليك ما يحدث اليوم.</p>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Button variant="outline" size="lg" className="h-10 w-full px-4 text-sm font-semibold sm:h-12 sm:w-auto sm:px-6" onClick={() => { void queryInvalidation.invalidateDomain(queryClient, 'dashboard'); }}>
              تحديث البيانات
            </Button>
          </div>
        </div>

        {/* --- CLIENT VERSION (SIMPLE) --- */}
        {(!isAdmin && !isSuperAdmin) ? (
          <div className="space-y-12">
            <Suspense fallback={<div className="h-56 bg-muted animate-pulse rounded-2xl" />}>
              <ClientQuickHub />
            </Suspense>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>نظرة عامة على الأداء</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col justify-center items-center p-6 bg-primary/5 rounded-2xl border border-primary/10">
                    <span className="text-sm font-medium text-muted-foreground mb-1">العملاء المحتملون</span>
                    <span className="text-5xl font-black text-primary">{stats.totalLeads}</span>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>+5 عملاء جدد هذا الأسبوع</span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center items-center p-6 bg-secondary/20 rounded-2xl border border-border">
                    <span className="text-sm font-medium text-muted-foreground mb-1">المواعيد</span>
                    <span className="text-5xl font-black text-foreground">{stats.appointmentsThisWeek}</span>
                    <div className="mt-4 text-xs font-bold text-muted-foreground">
                      <span>خطة العمل للأيام القادمة</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Suspense fallback={<div className="h-[420px] bg-muted animate-pulse rounded-2xl" />}>
                <ActivityFeed events={activityEvents} className="max-h-[420px] sm:max-h-[500px]" />
              </Suspense>
            </div>
          </div>
        ) : (
          /* --- ADMIN VERSION (COMMAND CENTER) --- */
          <div className="space-y-8">
            {/* Actions & Activity Area */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                    الإجراءات المقترحة (الأولوية القصوى)
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-warning/50 bg-warning/5 shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-warning-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        عملاء بدون تواصل (48 ساعة+)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {actionBuckets.overdueLeads.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">كل شيء تحت السيطرة!</p>
                      ) : (
                        actionBuckets.overdueLeads.slice(0, 3).map((lead: any) => (
                          <div key={lead.id} className="flex items-center justify-between group/item">
                            <span className="text-sm font-medium">{lead.first_name} {lead.last_name}</span>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-warning-foreground hover:bg-warning/10" asChild>
                              <Link to="/leads">متابعة</Link>
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-info/50 bg-info/5 shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-info-foreground">
                        <RefreshCw className="h-4 w-4" />
                        استرجاع حالات عدم الحضور
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {actionBuckets.noShowRecovery.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">لا توجد مواعيد مفقودة مؤخراً.</p>
                      ) : (
                        actionBuckets.noShowRecovery.slice(0, 3).map((appt: any) => (
                          <div key={appt.id} className="flex items-center justify-between group/item">
                            <span className="text-sm font-medium">{appt.lead?.first_name}</span>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-info-foreground hover:bg-info/10" asChild>
                              <Link to="/appointments">استخلاص</Link>
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-xl" />}>
                  <PriorityInbox />
                </Suspense>
              </div>

              <Suspense fallback={<div className="h-[420px] bg-muted animate-pulse rounded-2xl" />}>
                <ActivityFeed events={activityEvents} className="lg:sticky lg:top-8 max-h-[calc(100vh-12rem)]" />
              </Suspense>
            </div>

            {/* Stats & Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-4">
              {[
                { label: 'معدل الإغلاق', val: `${stats.closeRate}%`, icon: Target, color: 'text-green-500' },
                { label: 'معدل الحضور', val: `${stats.showRate}%`, icon: CheckCircle2, color: 'text-blue-500' },
                { label: 'معدل الحجز', val: `${stats.bookingRate}%`, icon: Calendar, color: 'text-purple-500' },
                { label: 'رسائل مرسلة', val: stats.totalSms, icon: MessageSquare, color: 'text-amber-500' },
              ].map((m, i) => (
                <Card key={i} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl bg-background border", m.color.replace('text', 'border'))}>
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

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                <LeadsByStatusChart clientFilter={clientFilter} />
              </Suspense>
              <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                <WeeklyLeadsChart clientFilter={clientFilter} />
              </Suspense>
              <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                <LeaderboardWidget />
              </Suspense>
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
