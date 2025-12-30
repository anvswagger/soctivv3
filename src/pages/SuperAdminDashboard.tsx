import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserPlus, 
  Calendar, 
  TrendingUp, 
  Loader2, 
  MessageSquare,
  Building2,
  Target,
  CheckCircle2,
  XCircle,
  BarChart3
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const db = supabase as any;

interface SystemStats {
  totalLeads: number;
  totalAppointments: number;
  completedAppointments: number;
  noShowAppointments: number;
  soldLeads: number;
  contactedLeads: number;
  totalClients: number;
  totalUsers: number;
  totalSms: number;
  closeRate: number;
  showRate: number;
  bookingRate: number;
}

interface ClientPerformance {
  id: string;
  company_name: string;
  leads_count: number;
  appointments_count: number;
  sold_count: number;
  close_rate: number;
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<SystemStats>({
    totalLeads: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    noShowAppointments: 0,
    soldLeads: 0,
    contactedLeads: 0,
    totalClients: 0,
    totalUsers: 0,
    totalSms: 0,
    closeRate: 0,
    showRate: 0,
    bookingRate: 0,
  });
  const [clientsPerformance, setClientsPerformance] = useState<ClientPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // جلب كل الإحصائيات بالتوازي
        const [
          leadsRes,
          soldLeadsRes,
          contactedLeadsRes,
          appointmentBookedRes,
          appointmentsRes,
          completedRes,
          noShowRes,
          clientsRes,
          usersRes,
          smsRes
        ] = await Promise.all([
          db.from('leads').select('id', { count: 'exact', head: true }),
          db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
          db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']),
          db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['appointment_booked', 'interviewed', 'sold', 'no_show']),
          db.from('appointments').select('id', { count: 'exact', head: true }),
          db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          db.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show'),
          db.from('clients').select('id', { count: 'exact', head: true }),
          db.from('profiles').select('id', { count: 'exact', head: true }),
          db.from('sms_logs').select('id', { count: 'exact', head: true }),
        ]);

        const totalLeads = leadsRes.count || 0;
        const soldLeads = soldLeadsRes.count || 0;
        const contactedLeads = contactedLeadsRes.count || 0;
        const appointmentBookedLeads = appointmentBookedRes.count || 0;
        const totalAppointments = appointmentsRes.count || 0;
        const completedAppointments = completedRes.count || 0;
        const noShowAppointments = noShowRes.count || 0;
        const scheduledAppointments = totalAppointments - (completedAppointments + noShowAppointments);

        // حساب المعدلات
        const closeRate = contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0;
        const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
        const bookingRate = totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0;

        setStats({
          totalLeads,
          totalAppointments,
          completedAppointments,
          noShowAppointments,
          soldLeads,
          contactedLeads,
          totalClients: clientsRes.count || 0,
          totalUsers: usersRes.count || 0,
          totalSms: smsRes.count || 0,
          closeRate,
          showRate,
          bookingRate,
        });

        // جلب أداء كل عميل
        const { data: clients } = await db.from('clients').select('id, company_name');
        if (clients) {
          const performanceData = await Promise.all(
            clients.map(async (client: { id: string; company_name: string }) => {
              const [leadsCount, appointmentsCount, soldCount] = await Promise.all([
                db.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
                db.from('appointments').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
                db.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'sold'),
              ]);

              const leads = leadsCount.count || 0;
              const sold = soldCount.count || 0;

              return {
                id: client.id,
                company_name: client.company_name,
                leads_count: leads,
                appointments_count: appointmentsCount.count || 0,
                sold_count: sold,
                close_rate: leads > 0 ? Math.round((sold / leads) * 100) : 0,
              };
            })
          );
          setClientsPerformance(performanceData);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

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
          <h1 className="text-3xl font-heading font-bold">لوحة المدير العام</h1>
          <p className="text-muted-foreground">مرحباً {profile?.full_name}، إليك نظرة شاملة على أداء النظام</p>
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
              <p className="text-xs text-muted-foreground">
                {stats.soldLeads} مبيعة من {stats.contactedLeads} تواصل
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل الحضور</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{stats.showRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedAppointments} حضر من {stats.totalAppointments} موعد
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">معدل حجز المواعيد</CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.bookingRate}%</div>
              <p className="text-xs text-muted-foreground">
                عملاء حجزوا مواعيد من إجمالي {stats.totalLeads}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* إحصائيات النظام */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي العملاء المحتملين</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground">{stats.soldLeads} تم البيع</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المواعيد</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-success">{stats.completedAppointments} مكتمل</span>
                {' • '}
                <span className="text-destructive">{stats.noShowAppointments} لم يحضر</span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">العملاء (الشركات)</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">شركة مسجلة</p>
            </CardContent>
          </Card>
          
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
        </div>

        {/* جدول أداء العملاء */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              أداء العملاء (الشركات)
            </CardTitle>
            <CardDescription>مقارنة أداء كل شركة</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-center">العملاء المحتملين</TableHead>
                  <TableHead className="text-center">المواعيد</TableHead>
                  <TableHead className="text-center">المبيعات</TableHead>
                  <TableHead className="text-center">معدل الإغلاق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      لا توجد بيانات
                    </TableCell>
                  </TableRow>
                ) : (
                  clientsPerformance.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.company_name}</TableCell>
                      <TableCell className="text-center">{client.leads_count}</TableCell>
                      <TableCell className="text-center">{client.appointments_count}</TableCell>
                      <TableCell className="text-center">{client.sold_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={client.close_rate >= 50 ? 'default' : client.close_rate >= 25 ? 'secondary' : 'outline'}
                          className={client.close_rate >= 50 ? 'bg-success' : ''}
                        >
                          {client.close_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
