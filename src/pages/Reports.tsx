import { useState, useMemo, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonStat, SkeletonChart } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { TrendIndicator } from '@/components/ui/TrendIndicator';
import { MiniSparkline } from '@/components/ui/MiniSparkline';
import {
  ShoppingCart,
  Users,
  DollarSign,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Calendar,
  Sparkles,
  Award,
  Activity,
  Inbox,
  CheckCircle2,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildClientFilter } from '@/lib/clientFilter';
import { formatWeekday } from '@/lib/format';
import { subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];

const LeadsByStatusChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.LeadsByStatusChart }))
);
const WeeklyLeadsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyLeadsChart }))
);
const WeeklyAppointmentsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyAppointmentsChart }))
);

type DateRange = 'today' | 'week' | 'month' | 'all';

interface StatusCount {
  status: LeadStatus;
  label: string;
  count: number;
  color: string;
}

interface ReportStats {
  totalOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalCustomers: number;
  conversionRate: number;
  dailyOrders: number[];
  dailyRevenue: number[];
  dailyCustomers: number[];
  dailySold: number[];
  bestDayIndex: number | null;
  avgDailyOrders: number;
  avgDailyCustomers: number;
  statusBreakdown: StatusCount[];
  topStatus: StatusCount | null;
  trends: {
    totalOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    conversionRate: number;
  };
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'hsl(217 91% 60%)',
  contacting: 'hsl(48 96% 53%)',
  appointment_booked: 'hsl(271 91% 65%)',
  interviewed: 'hsl(189 94% 43%)',
  no_show: 'hsl(25 95% 53%)',
  sold: 'hsl(142 76% 36%)',
  cancelled: 'hsl(0 84% 60%)',
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'قيد الانتظار',
  contacting: 'قيد المعالجة',
  appointment_booked: 'مؤكد',
  interviewed: 'تم الشحن',
  no_show: 'مرتجع',
  sold: 'تم التسليم',
  cancelled: 'ملغي',
};

const ALL_STATUSES: LeadStatus[] = [
  'new',
  'contacting',
  'appointment_booked',
  'interviewed',
  'no_show',
  'sold',
  'cancelled',
];

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'اليوم',
  week: 'أسبوع',
  month: 'شهر',
  all: 'الكل',
};

const PRICE_PER_DELIVERED = 150;

const getRangeBounds = (range: DateRange): { start: Date | null; days: number } => {
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, days: 1 };
  }
  if (range === 'week') return { start: subDays(now, 7), days: 7 };
  if (range === 'month') return { start: subDays(now, 30), days: 30 };
  return { start: null, days: 0 };
};

const getPriorRangeBounds = (range: DateRange): { start: Date | null; end: Date | null } => {
  const now = new Date();
  if (range === 'today') {
    const yesterday = subDays(now, 1);
    return {
      start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }
  if (range === 'week') return { start: subDays(now, 14), end: subDays(now, 7) };
  if (range === 'month') return { start: subDays(now, 60), end: subDays(now, 30) };
  return { start: null, end: null };
};

const formatRelativeTime = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `قبل ${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `قبل ${diffHr} س`;
  return formatWeekday(date, 'long');
};

const calculateTrendPct = (current: number, previous: number): number => {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export default function Reports() {
  const { isAdmin, isSuperAdmin, assignedClients, client } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const clientFilter = buildClientFilter({
    isSuperAdmin,
    isAdmin,
    assignedClients,
    clientId: client?.id,
  });

  const { data: stats, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['reports-stats', clientFilter, dateRange],
    queryFn: async (): Promise<ReportStats> => {
      const emptyStats: ReportStats = {
        totalOrders: 0,
        deliveredOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        totalCustomers: 0,
        conversionRate: 0,
        dailyOrders: [],
        dailyRevenue: [],
        dailyCustomers: [],
        dailySold: [],
        bestDayIndex: null,
        avgDailyOrders: 0,
        avgDailyCustomers: 0,
        statusBreakdown: ALL_STATUSES.map((s) => ({
          status: s,
          label: STATUS_LABELS[s],
          count: 0,
          color: STATUS_COLORS[s],
        })),
        topStatus: null,
        trends: {
          totalOrders: 0,
          deliveredOrders: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          conversionRate: 0,
        },
      };

      if (clientFilter !== null && clientFilter.length === 0) {
        return emptyStats;
      }

      const { start, days } = getRangeBounds(dateRange);
      const prior = getPriorRangeBounds(dateRange);

      // Period totals (for KPIs + trend)
      let currentQuery = supabase
        .from('appointments')
        .select('id, status, lead_id, created_at');
      if (clientFilter !== null) currentQuery = currentQuery.in('client_id', clientFilter);
      if (start) currentQuery = currentQuery.gte('created_at', start.toISOString());

      let priorQuery = supabase
        .from('appointments')
        .select('id, status, lead_id, created_at');
      if (clientFilter !== null) priorQuery = priorQuery.in('client_id', clientFilter);
      if (prior.start) priorQuery = priorQuery.gte('created_at', prior.start.toISOString());
      if (prior.end) priorQuery = priorQuery.lt('created_at', prior.end.toISOString());

      // Last 7 days breakdown (for sparklines — always 7 days)
      const last7Start = startOfDay(subDays(new Date(), 6)).toISOString();
      const last7End = endOfDay(new Date()).toISOString();
      let sparklineQuery = supabase
        .from('appointments')
        .select('id, status, lead_id, created_at')
        .gte('created_at', last7Start)
        .lte('created_at', last7End);
      if (clientFilter !== null) sparklineQuery = sparklineQuery.in('client_id', clientFilter);

      // Status breakdown counts
      const statusQueries = ALL_STATUSES.map(async (status) => {
        let q = supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', status as any);
        if (clientFilter !== null && clientFilter.length > 0) {
          q = q.in('client_id', clientFilter as any);
        }
        if (start) q = q.gte('created_at', start.toISOString());
        const { count } = await q;
        return {
          status,
          label: STATUS_LABELS[status],
          count: count || 0,
          color: STATUS_COLORS[status],
        };
      });

      const [currentRes, priorRes, sparklineRes, statusResults] = await Promise.all([
        currentQuery,
        prior.start || prior.end ? priorQuery : Promise.resolve({ data: [], error: null } as any),
        sparklineQuery,
        Promise.all(statusQueries),
      ]);

      if (currentRes.error) throw currentRes.error;

      const current = (currentRes.data || []) as {
        id: string;
        status: string;
        lead_id: string | null;
        created_at: string;
      }[];
      const priorData = (priorRes.data || []) as {
        id: string;
        status: string;
        lead_id: string | null;
        created_at: string;
      }[];
      const sparklineRows = (sparklineRes.data || []) as {
        id: string;
        status: string;
        lead_id: string | null;
        created_at: string;
      }[];

      // Period totals
      const deliveredCurrent = current.filter((a) => a.status === 'completed').length;
      const deliveredPrior = priorData.filter((a) => a.status === 'completed').length;
      const totalOrders = current.length;
      const totalPrior = priorData.length;
      const conversionRate = totalOrders > 0 ? Math.round((deliveredCurrent / totalOrders) * 100) : 0;
      const conversionPrior = totalPrior > 0 ? Math.round((deliveredPrior / totalPrior) * 100) : 0;
      const totalRevenue = deliveredCurrent * PRICE_PER_DELIVERED;
      const totalRevenuePrior = deliveredPrior * PRICE_PER_DELIVERED;
      const uniqueCustomers = new Set(current.map((a) => a.lead_id).filter(Boolean)).size;
      const uniqueCustomersPrior = new Set(priorData.map((a) => a.lead_id).filter(Boolean)).size;

      // 7-day sparkline buckets
      const today = startOfDay(new Date());
      const dailyOrders: number[] = [0, 0, 0, 0, 0, 0, 0];
      const dailyRevenue: number[] = [0, 0, 0, 0, 0, 0, 0];
      const dailyCustomers: number[] = [0, 0, 0, 0, 0, 0, 0];
      const dailySold: number[] = [0, 0, 0, 0, 0, 0, 0];
      const dayCustomerSets = Array.from({ length: 7 }, () => new Set<string>());

      sparklineRows.forEach((row) => {
        const rowDate = new Date(row.created_at);
        const dayIndex = 6 - differenceInDays(today, startOfDay(rowDate));
        if (dayIndex < 0 || dayIndex > 6) return;
        dailyOrders[dayIndex] += 1;
        if (row.status === 'completed') {
          dailySold[dayIndex] += 1;
          dailyRevenue[dayIndex] += PRICE_PER_DELIVERED;
        }
        if (row.lead_id) dayCustomerSets[dayIndex].add(row.lead_id);
      });

      for (let i = 0; i < 7; i += 1) {
        dailyCustomers[i] = dayCustomerSets[i].size;
      }

      const bestDayIndex = dailyOrders.length
        ? dailyOrders.reduce((bestIdx, value, idx, arr) => (value > arr[bestIdx] ? idx : bestIdx), 0)
        : null;
      const effectiveDays = Math.max(days, 1);
      const avgDailyOrders = Math.round(totalOrders / effectiveDays);
      const avgDailyCustomers = Math.round(uniqueCustomers / effectiveDays);

      const statusBreakdown = statusResults.sort((a, b) => b.count - a.count);
      const topStatus = statusBreakdown.find((s) => s.count > 0) || null;

      return {
        totalOrders,
        deliveredOrders: deliveredCurrent,
        totalRevenue,
        averageOrderValue: deliveredCurrent > 0 ? PRICE_PER_DELIVERED : 0,
        totalCustomers: uniqueCustomers,
        conversionRate,
        dailyOrders,
        dailyRevenue,
        dailyCustomers,
        dailySold,
        bestDayIndex,
        avgDailyOrders,
        avgDailyCustomers,
        statusBreakdown,
        topStatus,
        trends: {
          totalOrders: calculateTrendPct(totalOrders, totalPrior),
          deliveredOrders: calculateTrendPct(deliveredCurrent, deliveredPrior),
          totalRevenue: calculateTrendPct(totalRevenue, totalRevenuePrior),
          totalCustomers: calculateTrendPct(uniqueCustomers, uniqueCustomersPrior),
          conversionRate: conversionRate - conversionPrior,
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleRefresh = async () => {
    await refetch();
    setLastRefreshed(new Date());
  };

  const lastUpdatedLabel = useMemo(() => {
    if (isFetching) return 'جاري التحديث...';
    return formatRelativeTime(new Date(dataUpdatedAt || lastRefreshed.getTime()));
  }, [dataUpdatedAt, isFetching, lastRefreshed]);

  // -------- Render helpers --------

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-72 rounded-md" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <SkeletonChart /><SkeletonChart /><SkeletonChart />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const safe = stats!;
  const hasAnyData =
    safe.totalOrders > 0 ||
    safe.deliveredOrders > 0 ||
    safe.totalCustomers > 0 ||
    safe.statusBreakdown.some((s) => s.count > 0);

  const totalStatusCount = safe.statusBreakdown.reduce((sum, s) => sum + s.count, 0) || 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          {...fadeUp(0)}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h1 className="text-3xl font-heading font-bold tracking-tight">
                التقارير والإحصائيات
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              نظرة شاملة على أداء المتجر للفترة المختارة
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <TabsList>
                {(['today', 'week', 'month', 'all'] as const).map((range) => (
                  <TabsTrigger key={range} value={range}>
                    {DATE_RANGE_LABELS[range]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isFetching}
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                آخر تحديث: {lastUpdatedLabel}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Hero band — 2 featured KPIs */}
        <motion.div
          {...fadeUp(0.05)}
          className="grid gap-4 lg:grid-cols-2"
        >
          <HeroKpi
            label="إجمالي الإيرادات"
            value={safe.totalRevenue}
            suffix=" د.ل"
            icon={DollarSign}
            sparkData={safe.dailyRevenue}
            trend={safe.trends.totalRevenue}
            accent="green"
            helperText={`${safe.deliveredOrders} عملية تسليم`}
          />
          <HeroKpi
            label="معدل التحويل"
            value={safe.conversionRate}
            suffix="%"
            icon={Target}
            sparkData={safe.dailySold}
            trend={safe.trends.conversionRate}
            accent="indigo"
            helperText={`${safe.deliveredOrders} من ${safe.totalOrders} طلب`}
            ringValue={safe.conversionRate}
          />
        </motion.div>

        {/* 4-tile StatCard grid */}
        <motion.div
          {...fadeUp(0.1)}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            label="إجمالي الطلبات"
            value={safe.totalOrders}
            icon={ShoppingCart}
            color="blue"
            trend={safe.trends.totalOrders}
            sparkData={safe.dailyOrders}
            delay={0}
          />
          <StatCard
            label="المنتجات المباعة"
            value={safe.deliveredOrders}
            icon={CheckCircle2}
            color="green"
            trend={safe.trends.deliveredOrders}
            sparkData={safe.dailySold}
            delay={1}
          />
          <StatCard
            label="العملاء"
            value={safe.totalCustomers}
            icon={Users}
            color="amber"
            trend={safe.trends.totalCustomers}
            sparkData={safe.dailyCustomers}
            delay={2}
          />
          <StatCard
            label="متوسط قيمة الطلب"
            value={safe.averageOrderValue}
            icon={TrendingUp}
            color="purple"
            suffix=" د.ل"
            delay={3}
          />
        </motion.div>

        {/* Weekly performance + Quick insights */}
        <motion.div {...fadeUp(0.15)} className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  الأداء الأسبوعي
                </CardTitle>
                <CardDescription>الطلبات والمبيعات خلال آخر 7 أيام</CardDescription>
              </div>
              <Badge variant="secondary" className="font-normal">
                آخر 7 أيام
              </Badge>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="h-[320px] bg-muted/30 animate-pulse rounded-lg" />}>
                <WeeklyLeadsChart clientFilter={clientFilter} />
              </Suspense>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                رؤى سريعة
              </CardTitle>
              <CardDescription>أبرز المؤشرات للفترة المختارة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <InsightRow
                icon={Award}
                iconColor="text-amber-500"
                iconBg="bg-amber-500/10"
                label="أفضل يوم (الطلبات)"
                value={
                  safe.bestDayIndex !== null && safe.dailyOrders[safe.bestDayIndex] > 0
                    ? `${formatWeekday(subDays(new Date(), 6 - safe.bestDayIndex), 'long')} · ${safe.dailyOrders[safe.bestDayIndex]}`
                    : '—'
                }
              />
              <InsightRow
                icon={Target}
                iconColor="text-indigo-500"
                iconBg="bg-indigo-500/10"
                label="الحالة الأكثر"
                value={safe.topStatus ? safe.topStatus.label : '—'}
                trailing={
                  safe.topStatus ? (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: safe.topStatus.color }}
                    />
                  ) : null
                }
              />
              <InsightRow
                icon={Calendar}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
                label="متوسط الطلبات اليومية"
                value={`${safe.avgDailyOrders} طلب`}
              />
              <InsightRow
                icon={Users}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
                label="متوسط العملاء اليوميين"
                value={`${safe.avgDailyCustomers} عميل`}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Status breakdown + Weekly appointments */}
        <motion.div {...fadeUp(0.2)} className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                توزيع حالات العملاء
              </CardTitle>
              <CardDescription>حسب الحالة للفترة المختارة</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasAnyData ? (
                <EmptyState
                  icon={Inbox}
                  title="لا توجد بيانات"
                  description="لا توجد بيانات لعرضها في هذه الفترة"
                  compact
                />
              ) : (
                <div className="space-y-3">
                  {safe.statusBreakdown.map((s) => {
                    const pct = Math.round((s.count / totalStatusCount) * 100);
                    return (
                      <div key={s.status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="font-medium text-foreground">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">{pct}%</span>
                            <span className="font-semibold tabular-nums">{s.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                المواعيد الأسبوعية
              </CardTitle>
              <CardDescription>الحالة حسب اليوم — آخر 7 أيام</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="h-[320px] bg-muted/30 animate-pulse rounded-lg" />}>
                <WeeklyAppointmentsChart clientFilter={clientFilter} />
              </Suspense>
            </CardContent>
          </Card>
        </motion.div>

        {/* Leads by status — pie */}
        <motion.div {...fadeUp(0.25)}>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4 text-primary" />
                توزيع العملاء المحتملين
              </CardTitle>
              <CardDescription>النسبة المئوية لكل حالة من إجمالي العملاء</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="h-[300px] bg-muted/30 animate-pulse rounded-lg" />}>
                <LeadsByStatusChart clientFilter={clientFilter} />
              </Suspense>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

// ---------- Subcomponents ----------

interface HeroKpiProps {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  sparkData: number[];
  trend: number;
  accent: 'green' | 'indigo';
  helperText: string;
  ringValue?: number;
}

function HeroKpi({
  label,
  value,
  suffix = '',
  icon: Icon,
  sparkData,
  trend,
  accent,
  helperText,
  ringValue,
}: HeroKpiProps) {
  const accentClass = accent === 'green'
    ? 'from-emerald-500/15 via-emerald-500/5 to-transparent'
    : 'from-indigo-500/15 via-indigo-500/5 to-transparent';
  const iconClass = accent === 'green'
    ? 'bg-emerald-500/10 text-emerald-500'
    : 'bg-indigo-500/10 text-indigo-500';

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${accentClass} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums">
              {value.toLocaleString('ar-SA')}
              {suffix}
            </span>
            <TrendIndicator value={trend} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{helperText}</p>
        </div>
        {ringValue !== undefined ? (
          <ConversionRing value={ringValue} />
        ) : sparkData.length >= 2 ? (
          <div className="hidden sm:block">
            <MiniSparkline
              data={sparkData}
              width={120}
              height={48}
              color={accent === 'green' ? 'hsl(160 84% 39%)' : 'hsl(239 84% 67%)'}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConversionRing({ value }: { value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-20 w-20 shrink-0 hidden sm:flex items-center justify-center">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="6"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="hsl(239 84% 67%)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as const }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

interface InsightRowProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  trailing?: React.ReactNode;
}

function InsightRow({ icon: Icon, iconColor, iconBg, label, value, trailing }: InsightRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 transition-colors hover:bg-card/60">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
      {trailing}
    </div>
  );
}
