import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, RefreshCw, TrendingUp, Users, Calendar } from 'lucide-react';
import { subDays, startOfDay, endOfDay, format, differenceInDays } from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    Line,
    AreaChart,
    Area,
    ComposedChart,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar
} from 'recharts';

// Date range presets
const DATE_PRESETS = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 days', value: '7days' },
    { label: 'Last 30 days', value: '30days' },
    { label: 'Last 90 days', value: '90days' },
    { label: 'This month', value: 'thisMonth' },
    { label: 'This quarter', value: 'thisQuarter' },
    { label: 'This year', value: 'thisYear' },
    { label: 'Custom', value: 'custom' },
];

// Chart color palette

interface MetricCardProps {
    title: string;
    value: number | string;
    change?: number;
    icon: React.ReactNode;
    description?: string;
}

function MetricCard({ title, value, change, icon, description }: MetricCardProps) {
    const isPositive = change && change > 0;
    const isNegative = change && change < 0;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="text-muted-foreground">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {change !== undefined && (
                    <p className={`text-xs ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {isPositive ? '+' : ''}{change}% from previous period
                    </p>
                )}
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
            </CardContent>
        </Card>
    );
}

interface AdvancedAnalyticsDashboardProps {
    isAdmin?: boolean;
    clientId?: string;
}

export function AdvancedAnalyticsDashboard({ }: AdvancedAnalyticsDashboardProps) {
    const [dateRange, setDateRange] = useState<string>('30days');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Calculate date range based on preset
    const dateRangeValue = useMemo(() => {
        const now = new Date();
        switch (dateRange) {
            case 'today':
                return { from: startOfDay(now), to: endOfDay(now) };
            case '7days':
                return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
            case '30days':
                return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
            case '90days':
                return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
            case 'thisMonth':
                return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
            case 'thisQuarter': {
                const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
                return { from: startOfDay(new Date(now.getFullYear(), quarterMonth, 1)), to: endOfDay(now) };
            }
            case 'thisYear':
                return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) };
            default:
                return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
        }
    }, [dateRange]);

    // Mock data for demonstration - replace with actual data fetching
    const metrics = useMemo(() => ({
        totalLeads: 1247,
        leadsChange: 12.5,
        conversionRate: 23.4,
        conversionChange: 3.2,
        appointmentsScheduled: 456,
        appointmentsChange: 8.7,
        revenue: 125000,
        revenueChange: 15.3,
        avgCallDuration: '4:32',
        avgCallDurationChange: -2.1,
    }), []);

    const leadsBySourceData = useMemo(() => [
        { name: 'Website', value: 35, color: '#3b82f6' },
        { name: 'Referral', value: 28, color: '#10b981' },
        { name: 'Social Media', value: 18, color: '#f59e0b' },
        { name: 'Ads', value: 12, color: '#ef4444' },
        { name: 'Other', value: 7, color: '#8b5cf6' },
    ], []);

    const performanceTrendData = useMemo(() => {
        const days = differenceInDays(dateRangeValue.to, dateRangeValue.from);
        return Array.from({ length: Math.min(days, 30) }, (_, i) => {
            const date = subDays(dateRangeValue.to, i);
            return {
                date: format(date, 'MMM dd'),
                leads: Math.floor(Math.random() * 50) + 20,
                appointments: Math.floor(Math.random() * 20) + 5,
                sales: Math.floor(Math.random() * 10) + 1,
            };
        }).reverse();
    }, [dateRangeValue]);

    const conversionFunnelData = useMemo(() => [
        { stage: 'New Leads', value: 1000, fill: '#3b82f6' },
        { stage: 'Contacted', value: 650, fill: '#8b5cf6' },
        { stage: 'Appointments', value: 320, fill: '#a855f7' },
        { stage: 'Interviews', value: 180, fill: '#c084fc' },
        { stage: 'Proposals', value: 100, fill: '#d8b4fe' },
        { stage: 'Sales', value: 45, fill: '#10b981' },
    ], []);

    const hourlyPerformanceData = useMemo(() => {
        return Array.from({ length: 24 }, (_, hour) => ({
            hour: `${hour}:00`,
            calls: Math.floor(Math.random() * 20) + 5,
            conversions: Math.floor(Math.random() * 8) + 1,
        }));
    }, []);

    const teamPerformanceData = useMemo(() => [
        { name: 'Ahmed', calls: 145, sales: 23, rating: 4.5 },
        { name: 'Sara', calls: 132, sales: 28, rating: 4.8 },
        { name: 'Mohammed', calls: 156, sales: 19, rating: 4.2 },
        { name: 'Fatima', calls: 128, sales: 25, rating: 4.6 },
        { name: 'Omar', calls: 142, sales: 21, rating: 4.4 },
    ], []);

    const radarData = useMemo(() => [
        { metric: 'Call Volume', value: 85 },
        { metric: 'Conversion Rate', value: 72 },
        { metric: 'Avg. Handle Time', value: 68 },
        { metric: 'Customer Satisfaction', value: 90 },
        { metric: 'Follow-up Rate', value: 78 },
        { metric: 'Lead Quality', value: 82 },
    ], []);

    const handleRefresh = useCallback(async () => {
        setIsLoading(true);
        // Simulate data refresh - replace with actual data fetching
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
    }, []);

    const handleExport = useCallback((_format: 'csv' | 'pdf') => {
        // Implement export logic
        // Could use libraries like jspdf for PDF or simple CSV generation
    }, []);

    return (
        <div className="space-y-6">
            {/* Header with controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
                    <p className="text-muted-foreground">Track your performance and insights</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_PRESETS.map(preset => (
                                <SelectItem key={preset.value} value={preset.value}>
                                    {preset.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" onClick={() => handleExport('csv')}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Leads"
                    value={metrics.totalLeads}
                    change={metrics.leadsChange}
                    icon={<Users className="h-4 w-4" />}
                    description="New leads in selected period"
                />
                <MetricCard
                    title="Conversion Rate"
                    value={`${metrics.conversionRate}%`}
                    change={metrics.conversionChange}
                    icon={<TrendingUp className="h-4 w-4" />}
                    description="Lead to sale conversion"
                />
                <MetricCard
                    title="Appointments"
                    value={metrics.appointmentsScheduled}
                    change={metrics.appointmentsChange}
                    icon={<Calendar className="h-4 w-4" />}
                    description="Scheduled appointments"
                />
                <MetricCard
                    title="Revenue"
                    value={`$${metrics.revenue.toLocaleString()}`}
                    change={metrics.revenueChange}
                    icon={<TrendingUp className="h-4 w-4" />}
                    description="Total revenue generated"
                />
            </div>

            {/* Tabs for different analytics views */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="funnel">Funnel</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Leads by Source */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Leads by Source</CardTitle>
                                <CardDescription>Distribution of leads across channels</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={leadsBySourceData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {leadsBySourceData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Performance Trend */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Performance Trend</CardTitle>
                                <CardDescription>Leads, appointments, and sales over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={performanceTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Line type="monotone" dataKey="appointments" stroke="#10b981" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="sales" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Performance Tab */}
                <TabsContent value="performance" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Hourly Performance */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Hourly Performance</CardTitle>
                                <CardDescription>Call and conversion activity by hour</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={hourlyPerformanceData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="hour" fontSize={10} interval={2} />
                                        <YAxis fontSize={12} />
                                        <Tooltip />
                                        <Legend />
                                        <Area type="monotone" dataKey="calls" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                        <Area type="monotone" dataKey="conversions" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Key Metrics Radar */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Key Performance Metrics</CardTitle>
                                <CardDescription>Overall performance scores</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={radarData}>
                                        <PolarGrid />
                                        <PolarAngleAxis dataKey="metric" fontSize={12} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                        <Radar name="Performance" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Funnel Tab */}
                <TabsContent value="funnel" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Conversion Funnel</CardTitle>
                            <CardDescription>Lead to sale conversion pipeline</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={conversionFunnelData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis type="category" dataKey="stage" fontSize={12} width={100} />
                                    <Tooltip />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {conversionFunnelData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Team Tab */}
                <TabsContent value="team" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Team Performance</CardTitle>
                            <CardDescription>Individual team member statistics</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={teamPerformanceData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="calls" fill="#3b82f6" name="Calls" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="sales" fill="#10b981" name="Sales" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
