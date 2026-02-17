import { useState, useEffect, Suspense, lazy } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { callLogsService } from '@/services/callLogsService';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Phone, Clock } from 'lucide-react';
import { formatNumber, formatTime24 } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SetterOutcomeChart = lazy(() =>
    import('@/components/charts/SetterOutcomeChart').then((module) => ({ default: module.SetterOutcomeChart }))
);

export default function SetterStats() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [timeRange, setTimeRange] = useState('today'); // today, week, month

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const now = new Date();
                const start = new Date();

                if (timeRange === 'today') {
                    start.setHours(0, 0, 0, 0);
                } else if (timeRange === 'week') {
                    start.setDate(now.getDate() - 7);
                } else if (timeRange === 'month') {
                    start.setMonth(now.getMonth() - 1);
                }

                // If admin, maybe fetch all? For now let's just fetch current user stats or if admin allow selection (future improvement)
                // Defaulting to current user for setter view
                const data = await callLogsService.getStats(user?.id, { start, end: now });
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch stats", error);
                // If call_logs table doesn't exist yet, show empty stats
                if (error.message?.includes('relation "public.call_logs" does not exist')) {
                    setStats({
                        totalCalls: 0,
                        totalDuration: 0,
                        avgDuration: 0,
                        outcomeCounts: {},
                        goldPoints: 0,
                        recentLogs: []
                    });
                }
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchStats();
        }
    }, [user, timeRange]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    const outcomeData = stats ? Object.entries(stats.outcomeCounts).map(([name, value]) => ({ name, value })) : [];

    return (
        <DashboardLayout>
            <div className="space-y-6" dir="rtl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">أداء الاتصالات</h1>
                        <p className="text-muted-foreground">تتبع نشاط المكالمات والنتائج</p>
                    </div>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="الفترة الزمنية" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">اليوم</SelectItem>
                            <SelectItem value="week">آخر 7 أيام</SelectItem>
                            <SelectItem value="month">آخر 30 يوم</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">مجموع المكالمات</CardTitle>
                            <Phone className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatNumber(stats?.totalCalls || 0)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">مدة المكالمات (دقائق)</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatNumber(Math.round((stats?.totalDuration || 0) / 60))}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">متوسط مدة المكالمة</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatNumber(stats?.avgDuration || 0)} ثانية</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>توزيع نتائج المكالمات</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {outcomeData.length > 0 ? (
                                <Suspense fallback={<div className="h-full bg-muted/60 animate-pulse rounded-xl" />}>
                                    <SetterOutcomeChart data={outcomeData} />
                                </Suspense>
                            ) : (
                                <div className="flex justify-center items-center h-full text-muted-foreground">لا توجد بيانات</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>آخر النشاطات</CardTitle>
                            <CardDescription>آخر 10 مكالمات تم إجراؤها</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">العميل</TableHead>
                                        <TableHead className="text-right">النتيجة</TableHead>
                                        <TableHead className="text-right">المدة</TableHead>
                                        <TableHead className="text-right">الوقت</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats?.recentLogs && stats.recentLogs.map((log: any) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-medium">
                                                {log.lead?.first_name} {log.lead?.last_name}
                                            </TableCell>
                                            <TableCell>{log.status}</TableCell>
                                            <TableCell>{formatNumber(log.duration)}ث</TableCell>
                                            <TableCell>{formatTime24(log.created_at)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {(!stats?.recentLogs || stats.recentLogs.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">لا توجد سجلات</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
