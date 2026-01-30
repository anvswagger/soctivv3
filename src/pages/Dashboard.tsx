import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardStats } from '@/hooks/useCrmData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, Calendar, TrendingUp, Loader2, MessageSquare, Target, CheckCircle2 } from 'lucide-react';
import { LeadsByStatusChart, WeeklyLeadsChart, WeeklyAppointmentsChart } from '@/components/charts/PerformanceCharts';

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

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useDashboardStats(!!isAdmin);

  useEffect(() => {
    // Subscribe to real-time changes and invalidate query
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading || !stats) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground">مرحباً {profile?.full_name}، إليك ملخص نشاطك</p>
        </div>

        {/* المعدلات الرئيسية */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل الإغلاق</CardTitle>
              <Target className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.closeRate}%</div>
              <p className="text-xs text-muted-foreground">من العملاء المتواصل معهم</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل الحضور</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{stats.showRate}%</div>
              <p className="text-xs text-muted-foreground">من المواعيد المحجوزة</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل حجز المواعيد</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.bookingRate}%</div>
              <p className="text-xs text-muted-foreground">من العملاء المحتملين</p>
            </CardContent>
          </Card>
        </div>

        {/* الإحصائيات الأساسية */}
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
              <p className="text-xs text-muted-foreground">من إجمالي العملاء</p>
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

        {/* الرسوم البيانية */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <LeadsByStatusChart />
          <WeeklyLeadsChart />
          <WeeklyAppointmentsChart />
        </div>
      </div>
    </DashboardLayout>
  );
}
