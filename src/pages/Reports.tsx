import { useState, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, ShoppingCart, Package, Users, DollarSign, RefreshCw, BarChart3, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

const LeadsByStatusChart = lazy(() =>
    import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.LeadsByStatusChart }))
);
const WeeklyLeadsChart = lazy(() =>
    import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyLeadsChart }))
);
const WeeklyAppointmentsChart = lazy(() =>
    import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyAppointmentsChart }))
);

interface ReportStats {
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    totalCustomers: number;
    conversionRate: number;
}

export default function Reports() {
    const { isAdmin, isSuperAdmin, assignedClients, client } = useAuth();
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

    const clientFilter = isSuperAdmin
        ? null
        : isAdmin
            ? assignedClients
            : client?.id
                ? [client.id]
                : [];

    const { data: stats, isLoading, refetch } = useQuery({
        queryKey: ['reports-stats', clientFilter, dateRange],
        queryFn: async () => {
            if (clientFilter !== null && clientFilter.length === 0) {
                return {
                    totalOrders: 0,
                    pendingOrders: 0,
                    confirmedOrders: 0,
                    deliveredOrders: 0,
                    totalRevenue: 0,
                    averageOrderValue: 0,
                    totalCustomers: 0,
                    conversionRate: 0,
                };
            }

            let leadsQuery = supabase.from('leads').select('id, status, created_at');
            let appointmentsQuery = supabase.from('appointments').select('id, status');

            if (clientFilter !== null) {
                leadsQuery = leadsQuery.in('client_id', clientFilter as any);
                appointmentsQuery = appointmentsQuery.in('client_id', clientFilter as any);
            }

            // Date filter
            const now = new Date();
            let startDate: Date | null = null;
            if (dateRange === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (dateRange === 'week') {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (dateRange === 'month') {
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            if (startDate) {
                leadsQuery = leadsQuery.gte('created_at', startDate.toISOString());
                appointmentsQuery = appointmentsQuery.gte('created_at', startDate.toISOString());
            }

            const [leadsRes, appointmentsRes] = await Promise.all([leadsQuery, appointmentsQuery]);

            if (leadsRes.error) throw leadsRes.error;
            if (appointmentsRes.error) throw appointmentsRes.error;

            const leads = (leadsRes.data || []) as any[];
            const appointments = (appointmentsRes.data || []) as any[];

            const totalOrders = leads.length;
            const pendingOrders = leads.filter((l: any) => l.status === 'new').length;
            const confirmedOrders = leads.filter((l: any) => l.status === 'appointment_booked').length;
            const deliveredOrders = leads.filter((l: any) => l.status === 'sold').length;
            const conversionRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

            return {
                totalOrders,
                pendingOrders,
                confirmedOrders,
                deliveredOrders,
                totalRevenue: deliveredOrders * 150,
                averageOrderValue: deliveredOrders > 0 ? 150 : 0,
                totalCustomers: new Set(leads.map((l: any) => l.id)).size,
                conversionRate,
            };
        },
        staleTime: 1000 * 60 * 5,
    });

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold">التقارير والإحصائيات</h1>
                        <p className="text-muted-foreground">نظرة شاملة على أداء المتجر</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex border rounded-lg overflow-hidden">
                            {(['today', 'week', 'month', 'all'] as const).map((range) => (
                                <Button
                                    key={range}
                                    variant={dateRange === range ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDateRange(range)}
                                    className="rounded-none"
                                >
                                    {range === 'today' ? 'اليوم' : range === 'week' ? 'أسبوع' : range === 'month' ? 'شهر' : 'الكل'}
                                </Button>
                            ))}
                        </div>
                        <Button variant="outline" size="icon" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-blue-500" />
                                إجمالي الطلبات
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.totalOrders || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats?.pendingOrders || 0} معلق | {stats?.confirmedOrders || 0} مؤكد
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                الإيرادات
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{(stats?.totalRevenue || 0).toLocaleString()} د.ل</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                متوسط الطلب: {(stats?.averageOrderValue || 0).toLocaleString()} د.ل
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-purple-500" />
                                معدل التحويل
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.conversionRate || 0}%</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats?.deliveredOrders || 0} طلب تم تسليمه
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-amber-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4 text-amber-500" />
                                العملاء
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.totalCustomers || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                إجمالي العملاء المسجلين
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                        <LeadsByStatusChart />
                    </Suspense>
                    <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                        <WeeklyLeadsChart />
                    </Suspense>
                    <Suspense fallback={<div className="h-80 bg-muted animate-pulse rounded-xl" />}>
                        <WeeklyAppointmentsChart />
                    </Suspense>
                </div>

                {/* Order Status Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            تفصيل حالة الطلبات
                        </CardTitle>
                        <CardDescription>توزيع الطلبات حسب الحالة الحالية</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">معلق</span>
                                    <Badge variant="secondary">{stats?.pendingOrders || 0}</Badge>
                                </div>
                                <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${stats?.totalOrders ? (stats.pendingOrders / stats.totalOrders) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">مؤكد</span>
                                    <Badge variant="secondary">{stats?.confirmedOrders || 0}</Badge>
                                </div>
                                <div className="mt-2 h-2 bg-purple-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 rounded-full"
                                        style={{ width: `${stats?.totalOrders ? (stats.confirmedOrders / stats.totalOrders) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">تم التسليم</span>
                                    <Badge variant="secondary">{stats?.deliveredOrders || 0}</Badge>
                                </div>
                                <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${stats?.totalOrders ? (stats.deliveredOrders / stats.totalOrders) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-950/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">الإجمالي</span>
                                    <Badge>{stats?.totalOrders || 0}</Badge>
                                </div>
                                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gray-500 rounded-full w-full" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}