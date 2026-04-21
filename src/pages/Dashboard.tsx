import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboardStats } from '@/hooks/useCrmData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { buildClientFilter } from '@/lib/clientFilter';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_POLICY } from '@/lib/queryPolicy';
import { queryInvalidation } from '@/lib/queryInvalidation';

const DAY_LABELS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
import {
  UserPlus,
  History,
  Phone,
  CalendarX,
  FileText,
  CalendarDays,
  TrendingUp,
  Bolt,
} from 'lucide-react';

const supabaseAny = supabase as any;

const InstallPrompt = lazy(() =>
  import('@/components/InstallPrompt').then((module) => ({ default: module.InstallPrompt }))
);

export default function Dashboard() {
  const { profile, isAdmin, isSuperAdmin, assignedClients, client } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Handle OAuth callback tokens if user lands directly on dashboard (implicit flow)
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    
    if (url.hash && url.hash.startsWith('#')) {
      const hashParams = new URLSearchParams(url.hash.slice(1));
      hashParams.forEach((value, key) => params.append(key, value));
    }
    
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (accessToken) {
      console.debug('[Dashboard] OAuth tokens detected in hash, setting session...');
      
      // Let Supabase auto-handle first, then clean up
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
          } catch (err) {
            console.error('[Dashboard] Failed to set session from hash:', err);
          }
        }
        
        // Clean up URL
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = '';
        window.history.replaceState({}, '', cleanUrl.toString());
      }, 100);
    }
  }, []);

  const clientFilter = buildClientFilter({
    isSuperAdmin, isAdmin, assignedClients,
    clientId: client?.id,
  });

  const { data: stats, isLoading, isError } = useDashboardStats(clientFilter);

  const { data: actionData } = useQuery({
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

      if (clientFilter !== null) {
        leadsQuery = leadsQuery.in('client_id', clientFilter as any);
        appointmentsQuery = appointmentsQuery.in('client_id', clientFilter as any);
      }

      const [leadsRes, appointmentsRes] = await Promise.all([leadsQuery, appointmentsQuery]);
      if (leadsRes.error) throw leadsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      return {
        leads: leadsRes.data || [],
        noShowAppointments: appointmentsRes.data || [],
        upcomingAppointments: [],
      };
    },
    staleTime: QUERY_POLICY.crm.dashboardActions.staleTime,
    gcTime: QUERY_POLICY.crm.dashboardActions.gcTime,
  });

  const { data: dailyOrdersData } = useQuery({
    queryKey: [...queryKeys.dashboard.stats, 'dailyOrders', clientFilter],
    queryFn: async () => {
      if (clientFilter !== null && clientFilter.length === 0) {
        return Array(7).fill(0);
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      let query = supabaseAny
        .from('appointments')
        .select('created_at')
        .eq('status', 'completed')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (clientFilter !== null) {
        query = query.in('client_id', clientFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;

      const counts = Array(7).fill(0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const row of data || []) {
        const created = new Date(row.created_at);
        created.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          counts[6 - diffDays]++;
        }
      }

      return counts;
    },
    staleTime: QUERY_POLICY.crm.dashboardActions.staleTime,
    gcTime: QUERY_POLICY.crm.dashboardActions.gcTime,
  });

  const actionBuckets = useMemo(() => {
    const leads = actionData?.leads || [];
    const noShowAppointments = actionData?.noShowAppointments || [];
    const now = Date.now();
    const overdueCutoff = now - 1000 * 60 * 60 * 48;
    const followUpCutoff = now - 1000 * 60 * 60 * 72;
    const noShowCutoff = now - 1000 * 60 * 60 * 24 * 14;

    const newLeadsToday = leads.filter((lead: any) => {
      const created = new Date(lead.created_at).getTime();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return created >= todayStart.getTime() && lead.status === 'new';
    });

    const overdueLeads = leads.filter(
      (lead: any) =>
        lead.status === 'new' &&
        !lead.first_contact_at &&
        new Date(lead.created_at).getTime() < overdueCutoff
    );

    const followUps = leads.filter(
      (lead: any) =>
        lead.status === 'contacting' &&
        new Date(lead.updated_at).getTime() < followUpCutoff
    );

    const noShowRecovery = noShowAppointments.filter(
      (appt: any) => new Date(appt.scheduled_at).getTime() > noShowCutoff
    );

    return {
      newLeadsCount: newLeadsToday.length,
      delayedCount: overdueLeads.length,
      followUpsCount: followUps.length,
      noShowCount: noShowRecovery.length,
    };
  }, [actionData]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8 animate-pulse">
          <div className="h-40 bg-muted rounded-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-muted rounded-2xl" />
              ))}
            </div>
            <div className="lg:col-span-8">
              <div className="h-[400px] bg-muted rounded-3xl" />
            </div>
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
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats })}
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            إعادة المحاولة
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const userName = profile?.full_name?.split(' ')[0] || 'بك';

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Hero Section */}
        <section className="relative group">
          <div className="dashboard-glass-card rounded-[2rem] p-8 overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                  أهلاً بك، <span className="text-emerald-500 italic">{userName}</span>
                </h1>
                <p className="text-muted-foreground mt-2 font-light max-w-md">
                  نظرة شاملة على أداء نظامك اليوم. كل شيء تحت السيطرة.
                </p>
              </div>
              <button
                onClick={() => void queryInvalidation.invalidateDomain(queryClient, 'dashboard')}
                className="group/btn relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full text-white font-bold shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  تحديث سريع
                  <Bolt className="w-4 h-4" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Metric Cards (Vertical Stack) */}
          <div className="lg:col-span-4 space-y-4">
            {/* New Clients */}
            <div className="dashboard-glass-card rounded-2xl p-6 border-r-4 border-r-emerald-500 group hover:bg-card/80 transition-all cursor-pointer" onClick={() => navigate('/leads')}>
              <div className="flex justify-between items-start">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-5xl font-black text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                  {actionBuckets.newLeadsCount}
                </span>
              </div>
              <p className="mt-4 font-medium text-muted-foreground">العملاء الجدد</p>
            </div>

            {/* Delayed Clients */}
            <div className="dashboard-glass-card rounded-2xl p-6 border-r-4 border-r-yellow-400 group hover:bg-card/80 transition-all cursor-pointer" onClick={() => navigate('/leads')}>
              <div className="flex justify-between items-start">
                <div className="bg-yellow-400/10 p-3 rounded-xl text-yellow-400">
                  <History className="w-6 h-6" />
                </div>
                <span className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                  {actionBuckets.delayedCount}
                </span>
              </div>
              <p className="mt-4 font-medium text-muted-foreground">الطلبات الراجعة</p>
            </div>

            {/* Follow-ups */}
            <div className="dashboard-glass-card rounded-2xl p-6 border-r-4 border-r-cyan-400 group hover:bg-card/80 transition-all cursor-pointer" onClick={() => navigate('/leads')}>
              <div className="flex justify-between items-start">
                <div className="bg-cyan-400/10 p-3 rounded-xl text-cyan-400">
                  <Phone className="w-6 h-6" />
                </div>
                <span className="text-5xl font-black text-cyan-400 drop-shadow-[0_0_10px rgba(34,211,238,0.4)]">
                  {actionBuckets.followUpsCount}
                </span>
              </div>
              <p className="mt-4 font-medium text-muted-foreground">متابعات مطلوبة</p>
            </div>

            {/* Missed Appointments */}
            <div className="dashboard-glass-card rounded-2xl p-6 border-r-4 border-r-red-400 group hover:bg-card/80 transition-all cursor-pointer" onClick={() => navigate('/appointments')}>
              <div className="flex justify-between items-start">
                <div className="bg-red-400/10 p-3 rounded-xl text-red-400">
                  <CalendarX className="w-6 h-6" />
                </div>
                <span className="text-5xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.4)]">
                  {actionBuckets.noShowCount}
                </span>
              </div>
              <p className="mt-4 font-medium text-muted-foreground">طلبات راجعة</p>
            </div>
          </div>

          {/* Insight Center & Chart */}
          <div className="lg:col-span-8 space-y-8">
            <div className="dashboard-glass-card rounded-[2.5rem] p-8 h-full min-h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">مركز الرؤى</h2>
                  <p className="text-muted-foreground font-light text-sm">تحليل النشاط الأسبوعي</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-muted text-[10px] border border-border text-muted-foreground">
                    آخر 7 أيام
                  </span>
                </div>
              </div>

              <InsightBarChart dailyOrders={dailyOrdersData || Array(7).fill(0)} />

              <div className="mt-8 p-6 rounded-3xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-12 bg-emerald-500 rounded-full" />
                  <div>
                    <p className="text-xs text-muted-foreground">النمو العام</p>
                    <p className="text-xl font-bold text-foreground">
                      {stats.conversionRate > 0 ? `+${stats.conversionRate}%` : `${stats.conversionRate}%`}
                    </p>
                  </div>
                </div>
                <TrendingUp className="w-10 h-10 text-emerald-500 opacity-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold px-2 text-muted-foreground">الإجراءات السريعة</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/leads')}
              className="dashboard-glass-card p-6 rounded-[1.5rem] flex flex-col items-center gap-4 group hover:bg-emerald-500/5 transition-all duration-500 hover:-translate-y-2 border-transparent hover:border-emerald-500/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-emerald-500 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all">
                <UserPlus className="w-7 h-7" />
              </div>
              <span className="font-medium text-sm text-foreground">إضافة طلبية</span>
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="dashboard-glass-card p-6 rounded-[1.5rem] flex flex-col items-center gap-4 group hover:bg-cyan-400/5 transition-all duration-500 hover:-translate-y-2 border-transparent hover:border-cyan-400/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all">
                <FileText className="w-7 h-7" />
              </div>
              <span className="font-medium text-sm text-foreground">متابعة التقارير</span>
            </button>

            <button
              onClick={() => navigate('/appointments')}
              className="dashboard-glass-card p-6 rounded-[1.5rem] flex flex-col items-center gap-4 group hover:bg-yellow-400/5 transition-all duration-500 hover:-translate-y-2 border-transparent hover:border-yellow-400/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-yellow-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.2)] transition-all">
                <CalendarDays className="w-7 h-7" />
              </div>
              <span className="font-medium text-sm text-foreground">حجز طلبية</span>
            </button>
          </div>
        </section>


        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}

function InsightBarChart({ dailyOrders }: { dailyOrders: number[] }) {
  const maxVal = Math.max(...dailyOrders, 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bars = dailyOrders.map((value, i) => {
    const dayDate = new Date(today);
    dayDate.setDate(today.getDate() - (6 - i));
    const dayIndex = dayDate.getDay();
    const label = DAY_LABELS[dayIndex];
    const fraction = value / maxVal;
    const heightClass = fraction > 0.8 ? 'h-56' : fraction > 0.6 ? 'h-48' : fraction > 0.4 ? 'h-40' : fraction > 0.2 ? 'h-32' : fraction > 0 ? 'h-24' : 'h-8';
    const fillClass = fraction > 0.8 ? 'h-full' : fraction > 0.6 ? 'h-3/4' : fraction > 0.4 ? 'h-3/5' : fraction > 0.2 ? 'h-2/5' : fraction > 0 ? 'h-1/4' : 'h-0';
    const isTop = fraction >= 0.7;

    return { label, value, heightClass, fillClass, isTop };
  });

  return (
    <div className="flex-grow flex items-end justify-between gap-4 px-4">
      {bars.map((bar, i) => (
        <div key={i} className="w-full flex flex-col items-center gap-3">
          <span className="text-xs font-bold text-emerald-500">{bar.value}</span>
          <div className={`w-full bg-muted rounded-t-xl ${bar.heightClass} relative overflow-hidden group`}>
            <div
              className={`absolute bottom-0 w-full transition-all duration-500 ${
                bar.isTop
                  ? 'bg-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : bar.value > 0
                    ? 'bg-emerald-500/30'
                    : 'bg-emerald-500/10'
              } ${bar.fillClass}`}
            />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
