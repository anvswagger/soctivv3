import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, Calendar, TrendingUp, Loader2, MessageSquare, Target, CheckCircle2 } from 'lucide-react';
import { LeadsByStatusChart, WeeklyLeadsChart, WeeklyAppointmentsChart } from '@/components/charts/PerformanceCharts';

const db = supabase as any;

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
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    newLeads: 0,
    appointmentsThisWeek: 0,
    conversionRate: 0,
    closeRate: 0,
    showRate: 0,
    bookingRate: 0,
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

        const [
          leadsRes, 
          newLeadsRes, 
          appointmentsRes, 
          soldRes, 
          contactedRes,
          appointmentBookedRes,
          completedAppRes,
          totalAppRes,
          usersRes, 
          smsRes
        ] = await Promise.all([
          db.from('leads').select('id', { count: 'exact', head: true }),
          db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
          db.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', weekStart.toISOString()),
          db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
          db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']),
          db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['appointment_booked', 'interviewed', 'sold', 'no_show']),
          db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          db.from('appointments').select('id', { count: 'exact', head: true }),
          isAdmin ? db.from('profiles').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
          db.from('sms_logs').select('id', { count: 'exact', head: true }),
        ]);

        const totalLeads = leadsRes.count || 0;
        const soldLeads = soldRes.count || 0;
        const contactedLeads = contactedRes.count || 0;
        const appointmentBookedLeads = appointmentBookedRes.count || 0;
        const completedAppointments = completedAppRes.count || 0;
        const totalAppointments = totalAppRes.count || 0;
        
        const conversionRate = totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0;
        const closeRate = contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0;
        const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
        const bookingRate = totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0;

        setStats({
          totalLeads,
          newLeads: newLeadsRes.count || 0,
          appointmentsThisWeek: appointmentsRes.count || 0,
          conversionRate,
          closeRate,
          showRate,
          bookingRate,
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
