import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, Calendar, TrendingUp, Loader2, MessageSquare } from 'lucide-react';

const db = supabase as any;

interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  appointmentsThisWeek: number;
  conversionRate: number;
  totalUsers: number;
  totalSms: number;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    newLeads: 0,
    appointmentsThisWeek: 0,
    conversionRate: 0,
    totalUsers: 0,
    totalSms: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const [leadsRes, newLeadsRes, appointmentsRes, convertedRes, usersRes, smsRes] = await Promise.all([
          db.from('leads').select('id', { count: 'exact', head: true }),
          db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
          db.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', weekStart.toISOString()),
          db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
          isAdmin ? db.from('profiles').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
          db.from('sms_logs').select('id', { count: 'exact', head: true }),
        ]);

        const totalLeads = leadsRes.count || 0;
        const convertedLeads = convertedRes.count || 0;
        const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

        setStats({
          totalLeads,
          newLeads: newLeadsRes.count || 0,
          appointmentsThisWeek: appointmentsRes.count || 0,
          conversionRate,
          totalUsers: usersRes.count || 0,
          totalSms: smsRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
      setLoading(false);
    };

    fetchStats();
  }, [isAdmin]);

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
          <h1 className="text-3xl font-heading font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground">مرحباً {profile?.full_name}، إليك ملخص نشاطك</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">العملاء المحتملين</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground">{stats.newLeads} جديد</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">المواعيد</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.appointmentsThisWeek}</div>
              <p className="text-xs text-muted-foreground">مواعيد هذا الأسبوع</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل التحويل</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">من العملاء المحتملين</p>
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
          {isAdmin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">المستخدمين</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">مستخدم نشط</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
