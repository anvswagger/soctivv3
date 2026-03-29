import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
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
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { formatWeekday } from '@/lib/format';

// Typed supabase client used directly

interface LeadsByStatusData {
  name: string;
  value: number;
  color: string;
}

interface DailyLeadsData {
  date: string;
  leads: number;
  sold: number;
}

interface DailyAppointmentsData {
  date: string;
  completed: number;
  noShow: number;
  scheduled: number;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacting: '#eab308',
  appointment_booked: '#a855f7',
  interviewed: '#06b6d4',
  no_show: '#f97316',
  sold: '#22c55e',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'قيد الانتظار',
  contacting: 'قيد المعالجة',
  appointment_booked: 'مؤكد',
  interviewed: 'تم الشحن',
  no_show: 'مرتجع',
  sold: 'تم التسليم',
  cancelled: 'ملغي',
};

export function LeadsByStatusChart({ clientFilter }: { clientFilter?: string[] | null }) {
  const [data, setData] = useState<LeadsByStatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clientFilter]);

  const fetchData = async () => {
    if (clientFilter !== undefined && clientFilter !== null && clientFilter.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const statuses = ['new', 'contacting', 'appointment_booked', 'interviewed', 'no_show', 'sold', 'cancelled'];

    const results = await Promise.all(
      statuses.map(async (status) => {
        let query = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', status as any);
        if (clientFilter && clientFilter.length > 0) {
          query = query.in('client_id', clientFilter as any);
        }
        const { count } = await query;
        return {
          name: STATUS_LABELS[status],
          value: count || 0,
          color: STATUS_COLORS[status],
        };
      })
    );

    setData(results.filter(r => r.value > 0));
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">توزيع العملاء المحتملين</CardTitle>
        <CardDescription>حسب الحالة</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} عميل`, 'العدد']}
              contentStyle={{ direction: 'rtl', textAlign: 'right' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WeeklyLeadsChart({ clientFilter }: { clientFilter?: string[] | null }) {
  const [data, setData] = useState<DailyLeadsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clientFilter]);

  const fetchData = async () => {
    if (clientFilter !== undefined && clientFilter !== null && clientFilter.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const days = 7;
    const results: DailyLeadsData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();

      let leadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true })
        .gte('created_at', start).lte('created_at', end);
      let soldQuery = supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('status', 'sold' as any).gte('updated_at', start).lte('updated_at', end);

      if (clientFilter && clientFilter.length > 0) {
        leadsQuery = leadsQuery.in('client_id', clientFilter as any);
        soldQuery = soldQuery.in('client_id', clientFilter as any);
      }

      const [leadsRes, soldRes] = await Promise.all([leadsQuery, soldQuery]);

      results.push({
        date: formatWeekday(date, 'short'),
        leads: leadsRes.count || 0,
        sold: soldRes.count || 0,
      });
    }

    setData(results);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">العملاء المحتملين</CardTitle>
        <CardDescription>آخر 7 أيام</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name === 'leads' ? 'عملاء جدد' : 'مبيعات']}
              contentStyle={{ direction: 'rtl', textAlign: 'right' }}
            />
            <Area
              type="monotone"
              dataKey="leads"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorLeads)"
              name="عملاء جدد"
            />
            <Area
              type="monotone"
              dataKey="sold"
              stroke="#22c55e"
              fillOpacity={1}
              fill="url(#colorSold)"
              name="مبيعات"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WeeklyAppointmentsChart() {
  const [data, setData] = useState<DailyAppointmentsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const days = 7;
    const results: DailyAppointmentsData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();

      const [completedRes, noShowRes, scheduledRes] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('status', 'completed' as any).gte('scheduled_at', start).lte('scheduled_at', end),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('status', 'no_show' as any).gte('scheduled_at', start).lte('scheduled_at', end),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled' as any).gte('scheduled_at', start).lte('scheduled_at', end),
      ]);

      results.push({
        date: formatWeekday(date, 'short'),
        completed: completedRes.count || 0,
        noShow: noShowRes.count || 0,
        scheduled: scheduledRes.count || 0,
      });
    }

    setData(results);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">المواعيد</CardTitle>
        <CardDescription>آخر 7 أيام</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  completed: 'مكتمل',
                  noShow: 'لم يحضر',
                  scheduled: 'مجدول'
                };
                return [value, labels[name] || name];
              }}
              contentStyle={{ direction: 'rtl', textAlign: 'right' }}
            />
            <Legend
              formatter={(value) => {
                const labels: Record<string, string> = {
                  completed: 'مكتمل',
                  noShow: 'لم يحضر',
                  scheduled: 'مجدول'
                };
                return labels[value] || value;
              }}
            />
            <Bar dataKey="completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="noShow" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="scheduled" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ClientsComparisonChart({ clientsData }: { clientsData: { company_name: string; leads_count: number; sold_count: number; close_rate: number }[] }) {
  if (clientsData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">مقارنة أداء العملاء</CardTitle>
        <CardDescription>العملاء المحتملين والمبيعات لكل شركة</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={clientsData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="company_name" type="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name === 'leads_count' ? 'العملاء' : 'المبيعات']}
              contentStyle={{ direction: 'rtl', textAlign: 'right' }}
            />
            <Legend
              formatter={(value) => value === 'leads_count' ? 'العملاء المحتملين' : 'المبيعات'}
            />
            <Bar dataKey="leads_count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            <Bar dataKey="sold_count" fill="#22c55e" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
