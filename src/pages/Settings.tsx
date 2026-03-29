import { useState, useEffect, Suspense, lazy } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { settingsRepoDb as db } from '@/repositories/settingsRepo';
import { leadRepo } from '@/repositories/leadRepo';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushErrorMessage,
  getCurrentPushSubscription,
  getPushPermissionState,
  isPushSupported,
} from '@/lib/pushNotifications';
import {
  Copy,
  RefreshCw,
  Building2,
  User,
  Webhook,
  Loader2,
  MessageSquare,
  Users,
  Database,
  ExternalLink,
  UserPlus,
  Calendar,
  TrendingUp,
  Target,
  CheckCircle2,
  Download,
  BarChart3,
  Activity,
  BellRing,
  Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AUTOMATION_EVENT_OPTIONS,
  AUTOMATION_TEMPLATE_VARIABLE_OPTIONS,
  DEFAULT_AUTOMATION_EVENT,
  formatRolesLabel,
  formatTimingSummary,
  getAutomationEventOption,
  getDefaultTimingAnchor,
  getMetricEventLabel,
  isDelayCapableEvent,
  PUSH_PERMISSION_LABELS,
  TIMING_ANCHOR_LABELS,
  type AutomationTimingMode,
  type AutomationTimingUnit,
  type NotificationAutomationRule,
  type NotificationDeliveryMetric,
  type NotificationEventType,
  type NotificationTemplate,
  type PushTargetRole,
} from '@/features/settings/notificationAutomationConfig';

const LeadsByStatusChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.LeadsByStatusChart }))
);
const WeeklyLeadsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyLeadsChart }))
);
const WeeklyAppointmentsChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.WeeklyAppointmentsChart }))
);
const ClientsComparisonChart = lazy(() =>
  import('@/components/charts/PerformanceCharts').then((module) => ({ default: module.ClientsComparisonChart }))
);
const ThemeCustomizer = lazy(() =>
  import('@/components/settings/ThemeCustomizer').then((module) => ({ default: module.ThemeCustomizer }))
);
const AdminAccessSettings = lazy(() =>
  import('@/components/settings/AdminAccessSettings').then((module) => ({ default: module.AdminAccessSettings }))
);
const WebhookManager = lazy(() =>
  import('@/components/settings/WebhookManager').then((module) => ({ default: module.WebhookManager }))
);

interface SystemStats {
  totalLeads: number;
  totalAppointments: number;
  totalSms: number;
  totalClients: number;
  totalUsers: number;
  closeRate: number;
  showRate: number;
  bookingRate: number;
  conversionRate: number;
  soldLeads: number;
  contactedLeads: number;
  completedAppointments: number;
  appointmentBookedLeads: number;
  newLeads: number;
  noShowAppointments: number;
  cancelledAppointments: number;
  scheduledAppointments: number;
  smsSent: number;
  smsDelivered: number;
  smsFailed: number;
}

interface ClientPerformance {
  id: string;
  company_name: string;
  leads_count: number;
  appointments_count: number;
  sold_count: number;
  close_rate: number;
}


interface JobRun {
  id: string;
  job_name: string;
  job_type: string;
  status: 'running' | 'success' | 'failed';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
}

interface JobDeadLetter {
  id: string;
  source: string;
  job_name: string | null;
  error_message: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface WebhookEvent {
  id: string;
  provider: string;
  status: 'received' | 'processed' | 'failed';
  client_id: string | null;
  lead_id: string | null;
  error_message: string | null;
  created_at: string;
}

const formatMetricTimestamp = (value: string) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Tripoli' }).format(new Date(value));
  } catch {
    return value;
  }
};

const getNotificationStudioErrorMessage = (error: unknown, fallback: string) => {
  const normalizedError = error as { code?: unknown; message?: unknown } | null;
  const code = typeof normalizedError?.code === 'string' ? normalizedError.code : undefined;
  const message = typeof normalizedError?.message === 'string' ? normalizedError.message : undefined;

  // undefined_table
  if (code === '42P01' || code === 'PGRST205') {
    return 'جداول الإشعارات غير موجودة بعد. نفّذ migrations الخاصة بالإشعارات ثم أعد التحميل.';
  }

  // insufficient_privilege
  if (code === '42501') {
    return 'لا توجد صلاحية كافية. تأكد أن الحساب يملك صلاحية السوبر أدمن.';
  }

  if (message?.toLowerCase().includes('schema cache') || message?.toLowerCase().includes('could not find the table')) {
    return 'جداول الإشعارات غير مفعّلة في قاعدة البيانات الحالية. نفّذ migrations ثم أعد التحميل.';
  }

  return message || fallback;
};

const getEdgeFunctionErrorMessage = async (error: unknown, functionName: string, fallback: string) => {
  const normalizedError = error as {
    message?: unknown;
    context?: { status?: unknown; text?: unknown };
  } | null;
  const status = typeof normalizedError?.context?.status === 'number' ? normalizedError.context.status : undefined;
  const baseMessage = typeof normalizedError?.message === 'string' ? normalizedError.message : undefined;
  const lowered = (baseMessage || '').toLowerCase();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'لا يوجد اتصال إنترنت. تحقق من الشبكة ثم أعد المحاولة.';
  }

  if (status === 404) {
    return `دالة ${functionName} غير منشورة على مشروع Supabase الحالي. قم بعمل deploy للدالة ثم أعد المحاولة.`;
  }

  if (status === 401 || status === 403) {
    return 'غير مصرح لك باستدعاء الدالة. تأكد من تسجيل الدخول بحساب السوبر أدمن.';
  }

  if (status !== undefined && status >= 500) {
    return `حدث خطأ داخلي في دالة ${functionName}. راجع Logs في Supabase Functions.`;
  }

  if (
    lowered.includes('failed to send a request to the edge function') ||
    lowered.includes('networkerror') ||
    lowered.includes('failed to fetch')
  ) {
    return `تعذر الوصول إلى دالة ${functionName}. تأكد من نشر الدالة وصحة إعدادات Supabase في التطبيق.`;
  }

  if (typeof normalizedError?.context?.text === 'function') {
    try {
      const contextText = normalizedError.context.text as () => Promise<string>;
      const raw = (await contextText()) || '';
      const rawLower = raw.toLowerCase();
      if (rawLower.includes('requested function was not found') || rawLower.includes('"code":"not_found"')) {
        return `دالة ${functionName} غير موجودة على المشروع. قم بعمل deploy ثم أعد المحاولة.`;
      }
    } catch (_e) {
      // ignore parsing issues and fall back to generic message
    }
  }

  return baseMessage || fallback;
};

const getUnknownErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }
  }

  return fallback;
};

export default function Settings() {
  const { client, profile, user, isSuperAdmin, isClient, refreshUserData } = useAuth();
  const { toast } = useToast();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Company state (Client only)
  const [webhookCode, setWebhookCode] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [regeneratingWebhook, setRegeneratingWebhook] = useState(false);

  // Insights stats (السوبر أدمن only)
  const [insightsStats, setInsightsStats] = useState<SystemStats>({
    totalLeads: 0,
    totalAppointments: 0,
    totalSms: 0,
    totalClients: 0,
    totalUsers: 0,
    closeRate: 0,
    showRate: 0,
    bookingRate: 0,
    conversionRate: 0,
    soldLeads: 0,
    contactedLeads: 0,
    completedAppointments: 0,
    appointmentBookedLeads: 0,
    newLeads: 0,
    noShowAppointments: 0,
    cancelledAppointments: 0,
    scheduledAppointments: 0,
    smsSent: 0,
    smsDelivered: 0,
    smsFailed: 0,
  });
  const [clientsPerformance, setClientsPerformance] = useState<ClientPerformance[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [egressIp, setEgressIp] = useState<string | null>(null);
  const [checkingIp, setCheckingIp] = useState(false);

  // Push enrollment state (all users)
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Notification studio (super admin only)
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [loadingNotificationTemplates, setLoadingNotificationTemplates] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [deliveryMetrics, setDeliveryMetrics] = useState<NotificationDeliveryMetric[]>([]);
  const [loadingDeliveryMetrics, setLoadingDeliveryMetrics] = useState(false);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [deadLetters, setDeadLetters] = useState<JobDeadLetter[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [loadingObservability, setLoadingObservability] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    template_name: '',
    title: '',
    message: '',
    type: 'info',
    url: '/notifications',
    target_role: 'client' as 'all' | PushTargetRole,
    send_push: true,
    send_in_app: true,
    save_template: false,
  });
  const [automationRules, setAutomationRules] = useState<NotificationAutomationRule[]>([]);
  const [loadingAutomationRules, setLoadingAutomationRules] = useState(false);
  const [savingAutomationRule, setSavingAutomationRule] = useState(false);
  const [automationForm, setAutomationForm] = useState({
    name: '',
    event_type: DEFAULT_AUTOMATION_EVENT.value,
    notification_type: DEFAULT_AUTOMATION_EVENT.default_type,
    url: DEFAULT_AUTOMATION_EVENT.default_url,
    title_template: DEFAULT_AUTOMATION_EVENT.default_title,
    message_template: DEFAULT_AUTOMATION_EVENT.default_message,
    timing_mode: 'immediate' as AutomationTimingMode,
    timing_value: '1',
    timing_unit: 'hours' as AutomationTimingUnit,
    timing_anchor: getDefaultTimingAnchor(DEFAULT_AUTOMATION_EVENT.value),
    target_role: 'client' as 'all' | PushTargetRole,
    send_push: true,
    send_in_app: true,
    only_event_client: true,
    enabled: true,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
    if (client) {
      fetchClientData();
    }
    if (isSuperAdmin) {
      fetchInsightsStats();
      fetchNotificationTemplates();
      fetchAutomationRules();
      fetchDeliveryMetrics();
      fetchObservability();
    }
    refreshPushStatus();
  }, [profile, client, isSuperAdmin]);


  const fetchClientData = async () => {
    if (!client?.id) return;
    const { data } = await db
      .from<{ webhook_code: string | null; phone: string | null; website: string | null; address: string | null }>('clients')
      .select('webhook_code, phone, website, address')
      .eq('id', client.id)
      .single();
    if (data) {
      setWebhookCode(data.webhook_code || '');
      setCompanyPhone(data.phone || '');
      setCompanyWebsite(data.website || '');
      setCompanyAddress(data.address || '');
    }
  };

  const updatePassword = async () => {
    if (!newPassword) {
      toast({ title: 'خطأ', description: 'يرجى إدخال كلمة المرور الجديدة', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'خطأ', description: 'كلمات المرور غير متطابقة', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'خطأ', description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', variant: 'destructive' });
      return;
    }

    setUpdatingPassword(true);
    const { error } = await db.auth.updateUser({ password: newPassword });

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم التحديث', description: 'تم تغيير كلمة المرور بنجاح' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setUpdatingPassword(false);
  };

  const saveCompanySettings = async () => {
    if (!client?.id) return;
    setSavingCompany(true);

    const { error } = await db.from('clients').update({
      phone: companyPhone,
      website: companyWebsite,
      address: companyAddress
    }).eq('id', client.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ بيانات الشركة', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات الشركة بنجاح' });
    }
    setSavingCompany(false);
  };

  const fetchInsightsStats = async () => {
    setLoadingInsights(true);
    try {
      const [
        totalLeads,
        newLeads,
        soldLeads,
        contactedLeads,
        appointmentBookedLeads,
        totalAppointments,
        completedAppointments,
        noShowAppointments,
        cancelledAppointments,
        scheduledAppointments,
        totalClients,
        totalUsers,
        totalSms,
        smsSent,
        smsDelivered,
        smsFailed,
      ] = await Promise.all([
        leadRepo.countLeads(),
        leadRepo.countLeadsByStatus('new'),
        leadRepo.countLeadsByStatus('sold'),
        leadRepo.countLeadsByStatuses(['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']),
        leadRepo.countLeadsByStatuses(['appointment_booked', 'interviewed', 'sold', 'no_show']),
        leadRepo.countAppointments(),
        leadRepo.countAppointmentsByStatus('completed'),
        leadRepo.countAppointmentsByStatus('no_show'),
        leadRepo.countAppointmentsByStatus('cancelled'),
        leadRepo.countAppointmentsByStatus('scheduled'),
        leadRepo.countClients(),
        leadRepo.countProfiles(),
        leadRepo.countSmsLogs(),
        leadRepo.countSmsLogsByStatus('sent'),
        leadRepo.countSmsLogsByStatus('delivered'),
        leadRepo.countSmsLogsByStatus('failed'),
      ]);

      const closeRate = contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0;
      const showRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
      const bookingRate = totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0;
      const conversionRate = totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0;

      setInsightsStats({
        totalLeads,
        totalAppointments,
        totalSms,
        totalClients,
        totalUsers,
        closeRate,
        showRate,
        bookingRate,
        conversionRate,
        soldLeads,
        contactedLeads,
        completedAppointments,
        appointmentBookedLeads,
        newLeads,
        noShowAppointments,
        cancelledAppointments,
        scheduledAppointments,
        smsSent,
        smsDelivered,
        smsFailed,
      });

      // Fetch client performance
      const { data: clients } = await db.from('clients').select('id, company_name');
      if (clients) {
        const performanceData = await Promise.all(
          clients.map(async (client: { id: string; company_name: string }) => {
            const [leadsCount, appointmentsCount, soldCount] = await Promise.all([
              leadRepo.countLeadsByClient(client.id),
              leadRepo.countAppointmentsByClient(client.id),
              leadRepo.countLeadsByClientAndStatus(client.id, 'sold'),
            ]);

            const leads = leadsCount || 0;
            const sold = soldCount || 0;

            return {
              id: client.id,
              company_name: client.company_name,
              leads_count: leads,
              appointments_count: appointmentsCount || 0,
              sold_count: sold,
              close_rate: leads > 0 ? Math.round((sold / leads) * 100) : 0,
            };
          })
        );
        setClientsPerformance(performanceData);
      }
    } catch (error) {
      console.error('الخطأ fetching insights stats:', error);
    }
    setLoadingInsights(false);
  };

  const refreshPushStatus = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    setPushPermission(getPushPermissionState());

    if (!supported) {
      setPushEnabled(false);
      return;
    }

    try {
      const subscription = await getCurrentPushSubscription();
      setPushEnabled(!!subscription);
    } catch (error) {
      console.error('الخطأ reading local push subscription:', error);
      setPushEnabled(false);
    }
  };

  const handleEnablePush = async () => {
    if (!user?.id) return;
    setPushLoading(true);
    try {
      const result = await enablePushNotifications(user.id);
      toast({
        title: 'تم التفعيل',
        description: 'تم تفعيل الإشعارات لهذا الجهاز بنجاح',
      });
    } catch (error: unknown) {
      toast({
        title: 'خطأ',
        description: getPushErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      await refreshPushStatus();
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    if (!user?.id) return;
    setPushLoading(true);
    try {
      await disablePushNotifications(user.id);
      toast({ title: 'تم الإيقاف', description: 'تم إيقاف إشعارات هذا الجهاز' });
    } catch (error: unknown) {
      toast({
        title: 'خطأ',
        description: getPushErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      await refreshPushStatus();
      setPushLoading(false);
    }
  };

  const fetchNotificationTemplates = async () => {
    if (!isSuperAdmin) return;
    setLoadingNotificationTemplates(true);
    try {
      const { data, error } = await db
        .from<NotificationTemplate>('notification_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotificationTemplates(data || []);
    } catch (error: unknown) {
      console.error('الخطأ loading notification templates:', error);
      toast({
        title: 'خطأ',
        description: getNotificationStudioErrorMessage(error, 'فشل تحميل قوالب الإشعارات'),
        variant: 'destructive',
      });
    } finally {
      setLoadingNotificationTemplates(false);
    }
  };

  const fetchAutomationRules = async () => {
    if (!isSuperAdmin) return;
    setLoadingAutomationRules(true);
    try {
      const { data, error } = await db
        .from<NotificationAutomationRule>('notification_automation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAutomationRules(data || []);
    } catch (error: unknown) {
      console.error('الخطأ loading automation rules:', error);
      toast({
        title: 'خطأ',
        description: getNotificationStudioErrorMessage(error, 'فشل تحميل قواعد الإشعارات التلقائية'),
        variant: 'destructive',
      });
    } finally {
      setLoadingAutomationRules(false);
    }
  };

  const fetchObservability = async () => {
    if (!isSuperAdmin) return;
    setLoadingObservability(true);
    try {
      const [runsRes, deadRes, webhookRes] = await Promise.all([
        db.from<JobRun>('job_runs').select('*').order('started_at', { ascending: false }).limit(20),
        db.from<JobDeadLetter>('job_dead_letters').select('*').order('created_at', { ascending: false }).limit(20),
        db.from<WebhookEvent>('webhook_events').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      if (runsRes.error) throw runsRes.error;
      if (deadRes.error) throw deadRes.error;
      if (webhookRes.error) throw webhookRes.error;

      setJobRuns(runsRes.data || []);
      setDeadLetters(deadRes.data || []);
      setWebhookEvents(webhookRes.data || []);
    } catch (error: unknown) {
      console.error('الخطأ loading observability data:', error);
      toast({
        title: 'خطأ',
        description: getNotificationStudioErrorMessage(error, 'فشل تحميل بيانات مراقبة المهام'),
        variant: 'destructive',
      });
    } finally {
      setLoadingObservability(false);
    }
  };

  const fetchDeliveryMetrics = async () => {
    if (!isSuperAdmin) return;
    setLoadingDeliveryMetrics(true);
    try {
      const { data, error } = await db
        .from<NotificationDeliveryMetric>('notification_delivery_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDeliveryMetrics(data || []);
    } catch (error: unknown) {
      console.error('الخطأ loading delivery metrics:', error);
      toast({
        title: 'خطأ',
        description: getNotificationStudioErrorMessage(error, 'فشل تحميل مقاييس تسليم الإشعارات'),
        variant: 'destructive',
      });
    } finally {
      setLoadingDeliveryMetrics(false);
    }
  };

  const saveAutomationRule = async () => {
    if (!isSuperAdmin) return;

    if (!automationForm.name.trim() || !automationForm.title_template.trim() || !automationForm.message_template.trim()) {
      toast({
        title: 'خطأ',
        description: 'أدخل اسم القاعدة والعنوان والمحتوى',
        variant: 'destructive',
      });
      return;
    }

    const targetRoles: PushTargetRole[] = automationForm.target_role === 'all'
      ? ['client', 'admin', 'super_admin']
      : [automationForm.target_role];
    const eventOption = getAutomationEventOption(automationForm.event_type);
    const delayCapable = isDelayCapableEvent(automationForm.event_type);
    const timingMode: AutomationTimingMode = delayCapable ? automationForm.timing_mode : 'immediate';
    const timingAnchor = getDefaultTimingAnchor(automationForm.event_type);

    let timingValue: number | null = null;
    let timingUnit: AutomationTimingUnit | null = null;

    if (timingMode !== 'immediate') {
      const parsedValue = Number.parseInt(automationForm.timing_value, 10);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        toast({
          title: 'خطأ',
          description: 'أدخل قيمة زمنية صحيحة أكبر من صفر',
          variant: 'destructive',
        });
        return;
      }
      timingValue = parsedValue;
      timingUnit = automationForm.timing_unit;
    }

    setSavingAutomationRule(true);
    try {
      const { error } = await db
        .from('notification_automation_rules')
        .insert({
          name: automationForm.name.trim(),
          event_type: automationForm.event_type,
          notification_type: automationForm.notification_type,
          url: automationForm.url.trim() || eventOption.default_url,
          title_template: automationForm.title_template.trim(),
          message_template: automationForm.message_template.trim(),
          send_push: automationForm.send_push,
          send_in_app: automationForm.send_in_app,
          target_roles: targetRoles,
          only_event_client: automationForm.only_event_client,
          timing_mode: timingMode,
          timing_value: timingValue,
          timing_unit: timingUnit,
          timing_anchor: timingAnchor,
          enabled: automationForm.enabled,
          created_by: user?.id || null,
        });

      if (error) throw error;

      toast({ title: 'تم الحفظ', description: 'تم إنشاء قاعدة إذا ? ثم بنجاح' });
      setAutomationForm({
        name: '',
        event_type: DEFAULT_AUTOMATION_EVENT.value,
        notification_type: DEFAULT_AUTOMATION_EVENT.default_type,
        url: DEFAULT_AUTOMATION_EVENT.default_url,
        title_template: DEFAULT_AUTOMATION_EVENT.default_title,
        message_template: DEFAULT_AUTOMATION_EVENT.default_message,
        timing_mode: 'immediate',
        timing_value: '1',
        timing_unit: 'hours',
        timing_anchor: getDefaultTimingAnchor(DEFAULT_AUTOMATION_EVENT.value),
        target_role: 'client',
        send_push: true,
        send_in_app: true,
        only_event_client: true,
        enabled: true,
      });
      await fetchAutomationRules();
    } catch (error: unknown) {
      toast({
        title: 'خطأ',
        description: getUnknownErrorMessage(error, 'فشل حفظ القاعدة'),
        variant: 'destructive',
      });
    } finally {
      setSavingAutomationRule(false);
    }
  };

  const toggleAutomationRule = async (rule: NotificationAutomationRule, enabled: boolean) => {
    try {
      const { error } = await db
        .from('notification_automation_rules')
        .update({ enabled })
        .eq('id', rule.id);

      if (error) throw error;
      setAutomationRules((prev) =>
        prev.map((row) => (row.id === rule.id ? { ...row, enabled } : row))
      );
    } catch (error: unknown) {
      toast({
        title: 'خطأ',
        description: getUnknownErrorMessage(error, 'فشل تحديث حالة القاعدة'),
        variant: 'destructive',
      });
    }
  };

  const deleteAutomationRule = async (ruleId: string) => {
    try {
      const { error } = await db
        .from('notification_automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      setAutomationRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      toast({ title: 'تم الحذف', description: 'تم حذف القاعدة التلقائية' });
    } catch (error: unknown) {
      toast({
        title: 'خطأ',
        description: getUnknownErrorMessage(error, 'فشل حذف القاعدة'),
        variant: 'destructive',
      });
    }
  };

  const applyTemplate = (template: NotificationTemplate) => {
    const hasMultipleRoles = Array.isArray(template.target_roles) && template.target_roles.length > 1;
    const firstRole = (template.target_roles?.[0] || 'client') as PushTargetRole;

    setNotificationForm((prev) => ({
      ...prev,
      template_name: template.name || '',
      title: template.title || '',
      message: template.message || '',
      type: template.type || 'info',
      url: template.url || '/notifications',
      target_role: hasMultipleRoles ? 'all' : firstRole,
    }));
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await db.from('notification_templates').delete().eq('id', templateId);
      if (error) throw error;

      setNotificationTemplates((prev) => prev.filter((template) => template.id !== templateId));
      toast({ title: 'تم الحذف', description: 'تم حذف قالب الإشعار' });
    } catch (error: unknown) {
      toast({
        title: 'خطأ',
        description: getUnknownErrorMessage(error, 'فشل حذف قالب الإشعار'),
        variant: 'destructive',
      });
    }
  };

  const sendNotificationCampaign = async () => {
    if (!isSuperAdmin) return;

    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      toast({
        title: 'خطأ',
        description: 'الرجاء إدخال عنوان ومحتوى الإشعار',
        variant: 'destructive',
      });
      return;
    }

    if (!notificationForm.send_in_app && !notificationForm.send_push) {
      toast({
        title: 'خطأ',
        description: 'اختر قناة إرسال واحدة على الأقل (داخل التطبيق أو Push)',
        variant: 'destructive',
      });
      return;
    }

    const targetRoles: PushTargetRole[] = notificationForm.target_role === 'all'
      ? ['client', 'admin', 'super_admin']
      : [notificationForm.target_role];

    setSendingNotification(true);
    try {
      const { data, error } = await db.functions.invoke<{ summary?: Record<string, unknown> }>('send-push-notification', {
        body: {
          title: notificationForm.title.trim(),
          message: notificationForm.message.trim(),
          type: notificationForm.type,
          url: notificationForm.url.trim() || '/notifications',
          target_roles: targetRoles,
          send_push: notificationForm.send_push,
          send_in_app: notificationForm.send_in_app,
          save_template: notificationForm.save_template,
          template_name: notificationForm.template_name.trim() || notificationForm.title.trim(),
        },
      });

      if (error) throw error;

      const summary = (data?.summary ?? {}) as Record<string, unknown>;
      const pushSkippedReason = typeof summary.push_skipped_reason === 'string' ? summary.push_skipped_reason : undefined;
      const subscriptionsFound = Number(summary.subscriptions_found || 0);
      toast({
        title: 'تم الإرسال',
        description: `المستهدفون: ${summary.targets || 0} | داخل التطبيق: ${summary.in_app_sent || 0} | Push: ${summary.push_sent || 0} | اشتراكات: ${subscriptionsFound} | فشل: ${summary.push_failed || 0} | تم تعطيل: ${summary.subscriptions_disabled || 0}`,
      });

      if (notificationForm.send_push && (summary.push_sent || 0) === 0) {
        if (pushSkippedReason === 'VAPID_NOT_CONFIGURED') {
          toast({
            title: 'Push غير مهيأ',
            description: 'مفاتيح VAPID غير مضبوطة على Supabase. شغّل scripts/setup-notifications.ps1 أو اضبط WEB_PUSH_PUBLIC_KEY/WEB_PUSH_PRIVATE_KEY كسكرتس للـ Edge Function.',
            variant: 'destructive',
          });
        } else if (pushSkippedReason === 'NO_ACTIVE_SUBSCRIPTIONS' || subscriptionsFound === 0) {
          toast({
            title: 'لا توجد اشتراكات Push',
            description: 'لم يتم إرسال Push لأن المستلمين لم يفعلوا Push على أجهزتهم. اطلب منهم فتح الإعدادات > الملف الشخصي > تفعيل Push (على نفس المتصفح/الجهاز).',
          });
        }
      }

      if (notificationForm.save_template) {
        await fetchNotificationTemplates();
      }

      await fetchDeliveryMetrics();
    } catch (error: unknown) {
      console.error('sendNotificationCampaign error:', error);
      const edgeErrorMessage = await getEdgeFunctionErrorMessage(
        error,
        'send-push-notification',
        'فشل إرسال الحملة'
      );
      toast({
        title: 'خطأ',
        description: edgeErrorMessage,
        variant: 'destructive',
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const checkEgressIp = async () => {
    setCheckingIp(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setEgressIp(data.ip);
    } catch (error) {
      console.error('الخطأ fetching egress IP:', error);
      toast({ title: 'خطأ', description: 'فشل في جلب عنوان IP', variant: 'destructive' });
    }
    setCheckingIp(false);
  };

  const saveProfile = async () => {
    if (!profile?.id) return;
    setSavingProfile(true);

    const { error } = await db.from('profiles').update({
      full_name: fullName,
      avatar_url: avatarUrl
    }).eq('id', profile.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ البيانات', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ', description: 'تم تحديث بياناتك بنجاح' });
      await refreshUserData({
        force: true,
        mode: 'silent',
        reason: 'profile-save',
      });
    }
    setSavingProfile(false);
  };

  const saveCompanyPhone = async () => {
    if (!client?.id) return;
    setSavingPhone(true);

    const { error } = await db.from('clients').update({ phone: companyPhone }).eq('id', client.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ رقم الهاتف', variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ', description: 'تم حفظ رقم هاتف الشركة بنجاح' });
    }
    setSavingPhone(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: `تم نسخ ${label}` });
  };

  const appendAutomationVariable = (token: string, field: 'title_template' | 'message_template') => {
    setAutomationForm((prev) => {
      if (field === 'title_template') {
        const nextTitle = prev.title_template.trim().length > 0
          ? `${prev.title_template} ${token}`
          : token;
        return { ...prev, title_template: nextTitle };
      }

      const nextMessage = prev.message_template.trim().length > 0
        ? `${prev.message_template} ${token}`
        : token;
      return { ...prev, message_template: nextMessage };
    });
  };

  const regenerateWebhookCode = async () => {
    if (!client?.id) return;
    setRegeneratingWebhook(true);

    const newCode = crypto.randomUUID().replace(/-/g, '').substring(0, 32);

    const { error } = await db.from('clients').update({ webhook_code: newCode }).eq('id', client.id);

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تجديد الرمز', variant: 'destructive' });
    } else {
      setWebhookCode(newCode);
      toast({ title: 'تم التجديد', description: 'تم تجديد رمز الويبهوك بنجاح' });
    }
    setRegeneratingWebhook(false);
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/facebook-leads-webhook` : '';

  const smsDeliveryRate = insightsStats.totalSms > 0
    ? Math.round((insightsStats.smsDelivered / insightsStats.totalSms) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">إدارة إعدادات حسابك والنظام</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
          <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1 scrollbar-hide sm:max-w-3xl">
            <TabsTrigger value="profile" className="shrink-0 px-3 py-2 text-xs sm:text-sm">الملف الشخصي</TabsTrigger>
            <TabsTrigger value="appearance" className="shrink-0 px-3 py-2 text-xs sm:text-sm">المظهر</TabsTrigger>
            {isClient && <TabsTrigger value="company" className="shrink-0 px-3 py-2 text-xs sm:text-sm">الشركة</TabsTrigger>}
            {isClient && <TabsTrigger value="integrations" className="shrink-0 px-3 py-2 text-xs sm:text-sm">التكاملات</TabsTrigger>}
            {(isClient || isSuperAdmin) && <TabsTrigger value="sms" className="shrink-0 px-3 py-2 text-xs sm:text-sm">SMS</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="notifications" className="shrink-0 px-3 py-2 text-xs sm:text-sm">الإشعارات</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="insights" className="shrink-0 px-3 py-2 text-xs sm:text-sm">الإحصائيات</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="access" className="shrink-0 px-3 py-2 text-xs sm:text-sm">صلاحيات الوصول</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="system" className="shrink-0 px-3 py-2 text-xs sm:text-sm">النظام</TabsTrigger>}
          </TabsList>

          {/* Profile Tab - All Users */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  المعلومات الشخصية
                </CardTitle>
                <CardDescription>قم بتحديث معلومات ملفك الشخصي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input value={user?.email || ''} readOnly className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input value={profile?.phone || ''} readOnly className="bg-muted" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>رابط الصورة الشخصية (Avatar URL)</Label>
                    <Input
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      dir="ltr"
                    />
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  حفظ التغييرات
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-5 w-5" />
                  إعدادات الإشعارات
                </CardTitle>
                <CardDescription>
                  تفعيل الإشعارات لتلقي التنبيهات المباشرة على هذا الجهاز.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">حالة الإشعارات</div>
                    <div className="text-sm text-muted-foreground">
                      {pushSupported
                        ? pushEnabled
                          ? 'الإشعارات مفعلة حالياً على هذا الجهاز'
                          : 'الإشعارات متوقفة حالياً'
                        : 'الإشعارات غير مدعومة على هذا المتصفح'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pushSupported && (
                      pushEnabled ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisablePush}
                          disabled={pushLoading}
                        >
                          {pushLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                          إيقاف
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleEnablePush}
                          disabled={pushLoading}
                        >
                          {pushLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                          تفعيل
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {!pushSupported && (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                    ملاحظة: هذا المتصفح لا يدعم خاصية الإشعارات المباشرة. يرجى استخدام متصفح حديث مثل Chrome أو Safari.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  تغيير كلمة المرور
                </CardTitle>
                <CardDescription>تأكد من اختيار كلمة مرور قوية وسهلة التذكر</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>كلمة المرور الجديدة</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تأكيد كلمة المرور</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={updatePassword} disabled={updatingPassword}>
                  {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  تحديث كلمة المرور
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab - All Users */}
          <TabsContent value="appearance" className="space-y-4">
            <Suspense fallback={<div className="h-64 rounded-xl bg-muted/60 animate-pulse" />}>
              <ThemeCustomizer />
            </Suspense>
          </TabsContent>

          {/* Company Tab - Clients Only */}
          {isClient && (
            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    معلومات الشركة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم الشركة</Label>
                      <Input value={client?.company_name || ''} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>القطاع</Label>
                      <Input value={client?.industry || '-'} readOnly className="bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم هاتف الشركة</Label>
                    <p className="text-xs text-muted-foreground">يستخدم في رسائل SMS كمتغير {"{c_phone}"}</p>
                    <Input
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="00218XXXXXXXXX"
                      dir="ltr"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الموقع الإلكتروني</Label>
                      <Input
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                        placeholder="https://example.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>العنوان الكامل</Label>
                      <Input
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="طرابلس، ليبيا"
                      />
                    </div>
                  </div>
                  <Button onClick={saveCompanySettings} disabled={savingCompany}>
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    حفظ بيانات الشركة
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Integrations Tab - Clients Only */}
          {isClient && (
            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    إعدادات الويبهوك
                  </CardTitle>
                  <CardDescription>
                    استخدم هذه الإعدادات لربط نظامك مع Facebook العميل المحتمل Ads عبر Make.com
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>رمز العميل</Label>
                    <div className="flex gap-2">
                      <Input value={webhookCode} readOnly className="font-mono bg-muted" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookCode, 'رمز العميل')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={regenerateWebhookCode} disabled={regeneratingWebhook}>
                        {regeneratingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>رابط الويبهوك</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" dir="ltr" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, 'رابط الويبهوك')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">تعليمات الإعداد في Make.com:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>أنشئ سيناريو جديد في Make.com</li>
                      <li>أضف وحدة Facebook العميل المحتمل Ads كمحفز</li>
                      <li>أضف وحدة HTTP Request</li>
                      <li>اختر Method: POST</li>
                      <li>الصق رابط الويبهوك في حقل URL</li>
                      <li>أضف Headers: Content-Type = application/json</li>
                      <li>في Body، أرسل JSON بالشكل التالي:</li>
                    </ol>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto" dir="ltr">
                      {`{
  "client_code": "${webhookCode || 'YOUR_CLIENT_CODE'}",
  "full_name": "{{fullName}}",
  "phone": "{{phone}}",
  "source": "Facebook Leads Ads"
}`}
                    </pre>
                  </div>

                  <div className="pt-6 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <Webhook className="h-5 w-5 text-primary" />
                      <h4 className="font-medium text-lg">إدارة الويبهوك المتقدمة</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">
                      قم بإنشاء روابط ويبهوك مخصصة لاستقبال تنبيهات حول الأحداث المختلفة في النظام.
                    </p>
                    <Suspense fallback={<div className="h-48 rounded-xl bg-muted/60 animate-pulse" />}>
                      <WebhookManager />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* SMS Tab - Combined */}
          {(isClient || isSuperAdmin) && (
            <TabsContent value="sms" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    إعدادات خدمة SMS
                  </CardTitle>
                  <CardDescription>إدارة الربط مع Ersaal (Lamah) وتحليل المشاكل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      أداة التشخيص (Diagnostics)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      استخدم هذه الأداة لمعرفة الـ IP الذي يجب وضعه في "القائمة البيضاء" (Whitelist) في لوحة Ersaal.
                    </p>
                    <div className="flex items-center gap-4">
                      <Button variant="outline" size="sm" onClick={checkEgressIp} disabled={checkingIp}>
                        {checkingIp ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                        فحص عنوان الـ IP الحالي
                      </Button>
                      {egressIp && (
                        <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded border border-primary/30">
                          <code className="text-sm font-bold text-primary">{egressIp}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(egressIp!, 'IP')}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>مزود الخدمة</Label>
                      <Input value="Ersaal (Lamah)" readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع الدفع</Label>
                      <Badge variant="outline" className="py-1.5">Wallet (المحفظة)</Badge>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <h4 className="font-medium">الخطوات اللازمة لتفعيل الإرسال:</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                      <li>تأكد من شحن رصيد المحفظة في لوحة Ersaal.</li>
                      <li>تأكد من أن الـ Sender ID (اسم المرسل) مفعّل في حسابك.</li>
                      <li>قم بنسخ الـ IP الظاهر في أداة التشخيص أعلاه وأضفه إلى Whitelist في Ersaal.</li>
                    </ul>
                  </div>

                  <div className="pt-4">
                    <Link to="/sms">
                      <Button variant="outline" className="w-full justify-between">
                        فتح سجل الرسائل (SMS Logs)
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Notifications Tab - السوبر أدمن Only */}
          {isSuperAdmin && (
            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BellRing className="h-5 w-5" />
                    استديو الإشعارات (Web + PWA)
                  </CardTitle>
                  <CardDescription>
                    إرسال حملات إشعار بدون تعديل كود. الوصول مخصص لـ السوبر أدمن فقط.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>اسم القالب (اختياري)</Label>
                      <Input
                        value={notificationForm.template_name}
                        onChange={(e) => setNotificationForm((prev) => ({ ...prev, template_name: e.target.value }))}
                        placeholder="مثال: تنبيه عام"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع الإشعار</Label>
                      <Select
                        value={notificationForm.type}
                        onValueChange={(value) => setNotificationForm((prev) => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر النوع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">معلوماتي</SelectItem>
                          <SelectItem value="success">نجاح</SelectItem>
                          <SelectItem value="warning">تحذير</SelectItem>
                          <SelectItem value="error">خطأ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>العنوان</Label>
                    <Input
                      value={notificationForm.title}
                      onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="عنوان الإشعار"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>المحتوى</Label>
                    <Textarea
                      value={notificationForm.message}
                      onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder="محتوى الإشعار"
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>الرابط عند الضغط</Label>
                      <Input
                        value={notificationForm.url}
                        onChange={(e) => setNotificationForm((prev) => ({ ...prev, url: e.target.value }))}
                        placeholder="/notifications"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الفئة المستهدفة</Label>
                      <Select
                        value={notificationForm.target_role}
                        onValueChange={(value) => setNotificationForm((prev) => ({ ...prev, target_role: value as 'all' | PushTargetRole }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الجمهور" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="client">العملاء</SelectItem>
                          <SelectItem value="admin">المسؤولون</SelectItem>
                          <SelectItem value="super_admin">السوبر أدمن</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">إرسال Push</p>
                        <p className="text-xs text-muted-foreground">Web/PWA</p>
                      </div>
                      <Switch
                        checked={notificationForm.send_push}
                        onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, send_push: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">داخل التطبيق</p>
                        <p className="text-xs text-muted-foreground">Inbox</p>
                      </div>
                      <Switch
                        checked={notificationForm.send_in_app}
                        onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, send_in_app: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">حفظ كقالب</p>
                        <p className="text-xs text-muted-foreground">لإعادة الاستخدام</p>
                      </div>
                      <Switch
                        checked={notificationForm.save_template}
                        onCheckedChange={(checked) => setNotificationForm((prev) => ({ ...prev, save_template: checked }))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={sendNotificationCampaign} disabled={sendingNotification}>
                      {sendingNotification ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Send className="h-4 w-4 ml-2" />}
                      إرسال الآن
                    </Button>
                    <Button variant="outline" onClick={fetchNotificationTemplates} disabled={loadingNotificationTemplates}>
                      {loadingNotificationTemplates ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                      تحديث القوالب
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>قواعد إذا - ثم التلقائية</CardTitle>
                  <CardDescription>
                    أنشئ سيناريوهات قوية: أحداث مباشرة، وأحداث مؤجلة، ومراحل البايبلاين بالكامل.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>اسم القاعدة</Label>
                      <Input
                        value={automationForm.name}
                        onChange={(e) => setAutomationForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="مثال: تنبيه قبل وقت الموعد"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>حدث IF</Label>
                      <Select
                        value={automationForm.event_type}
                        onValueChange={(value) => {
                          const eventType = value as NotificationEventType;
                          const eventOption = getAutomationEventOption(eventType);
                          const supportsDelay = isDelayCapableEvent(eventType);
                          setAutomationForm((prev) => ({
                            ...prev,
                            event_type: eventType,
                            notification_type: eventOption.default_type,
                            url: eventOption.default_url,
                            title_template: eventOption.default_title,
                            message_template: eventOption.default_message,
                            timing_mode: supportsDelay ? prev.timing_mode : 'immediate',
                            timing_anchor: getDefaultTimingAnchor(eventType),
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الحدث" />
                        </SelectTrigger>
                        <SelectContent>
                          {AUTOMATION_EVENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isDelayCapableEvent(automationForm.event_type) && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>التوقيت</Label>
                        <Select
                          value={automationForm.timing_mode}
                          onValueChange={(value) =>
                            setAutomationForm((prev) => ({
                              ...prev,
                              timing_mode: value as AutomationTimingMode,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر التوقيت" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">فوري</SelectItem>
                            <SelectItem value="before">قبل</SelectItem>
                            <SelectItem value="after">بعد</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {automationForm.timing_mode !== 'immediate' && (
                        <>
                          <div className="space-y-2">
                            <Label>القيمة</Label>
                            <Input
                              type="number"
                              min={1}
                              value={automationForm.timing_value}
                              onChange={(e) =>
                                setAutomationForm((prev) => ({
                                  ...prev,
                                  timing_value: e.target.value,
                                }))
                              }
                              placeholder="مثال: 48"
                              dir="ltr"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>الوحدة</Label>
                            <Select
                              value={automationForm.timing_unit}
                              onValueChange={(value) =>
                                setAutomationForm((prev) => ({
                                  ...prev,
                                  timing_unit: value as AutomationTimingUnit,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر الوحدة" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">دقيقة</SelectItem>
                                <SelectItem value="hours">ساعة</SelectItem>
                                <SelectItem value="days">يوم</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {isDelayCapableEvent(automationForm.event_type) && (
                    <p className="text-xs text-muted-foreground">
                      مرجع الوقت: {TIMING_ANCHOR_LABELS[automationForm.timing_anchor]}
                    </p>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>نوع الإشعار</Label>
                      <Select
                        value={automationForm.notification_type}
                        onValueChange={(value) => setAutomationForm((prev) => ({ ...prev, notification_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="النوع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">info</SelectItem>
                          <SelectItem value="success">success</SelectItem>
                          <SelectItem value="warning">warning</SelectItem>
                          <SelectItem value="error">error</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الرابط عند الضغط</Label>
                      <Input
                        value={automationForm.url}
                        onChange={(e) => setAutomationForm((prev) => ({ ...prev, url: e.target.value }))}
                        placeholder="/appointments"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>عنوان THEN</Label>
                    <Input
                      value={automationForm.title_template}
                      onChange={(e) => setAutomationForm((prev) => ({ ...prev, title_template: e.target.value }))}
                      placeholder="عنوان الإشعار"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>محتوى THEN</Label>
                    <Textarea
                      value={automationForm.message_template}
                      onChange={(e) => setAutomationForm((prev) => ({ ...prev, message_template: e.target.value }))}
                      rows={3}
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-medium">المتغيرات المتاحة (خيارات جاهزة)</p>
                      <p className="text-xs text-muted-foreground">
                        كل متغير ينضاف وقت الإرسال تلقائيا حسب بيانات الحدث. تقدر تنسخه أو تضيفه مباشرة للعنوان أو المحتوى.
                      </p>
                      <div className="rounded-lg border max-h-80 overflow-auto divide-y">
                        {AUTOMATION_TEMPLATE_VARIABLE_OPTIONS.map((option) => (
                          <div key={option.token} className="p-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <code className="text-xs">{option.token}</code>
                                <Badge variant="secondary" className="text-[10px]">{option.category}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => copyToClipboard(option.token, option.label)}
                                >
                                  نسخ
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => appendAutomationVariable(option.token, 'title_template')}
                                >
                                  إضافة للعنوان
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => appendAutomationVariable(option.token, 'message_template')}
                                >
                                  إضافة للمحتوى
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{option.label}:</span> {option.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>الجمهور المستهدف</Label>
                      <Select
                        value={automationForm.target_role}
                        onValueChange={(value) => setAutomationForm((prev) => ({ ...prev, target_role: value as 'all' | PushTargetRole }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الأدوار</SelectItem>
                          <SelectItem value="client">العملاء</SelectItem>
                          <SelectItem value="admin">الإداريون</SelectItem>
                          <SelectItem value="super_admin">السوبر أدمن</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>النطاق</Label>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">فقط فريق عميل الحدث</p>
                          <p className="text-xs text-muted-foreground">مالك العميل + الإداريون المرتبطون</p>
                        </div>
                        <Switch
                          checked={automationForm.only_event_client}
                          onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, only_event_client: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">مفعّل</span>
                      <Switch
                        checked={automationForm.enabled}
                        onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, enabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">Push</span>
                      <Switch
                        checked={automationForm.send_push}
                        onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, send_push: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">In-App</span>
                      <Switch
                        checked={automationForm.send_in_app}
                        onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, send_in_app: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-center rounded-lg border p-3">
                      <Button onClick={saveAutomationRule} disabled={savingAutomationRule} className="w-full">
                        {savingAutomationRule ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                        حفظ القاعدة
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">القواعد النشطة</h4>
                      <Button variant="outline" size="sm" onClick={fetchAutomationRules} disabled={loadingAutomationRules}>
                        {loadingAutomationRules ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                        تحديث
                      </Button>
                    </div>

                    {loadingAutomationRules ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : automationRules.length === 0 ? (
                      <div className="text-sm text-muted-foreground">لا توجد قواعد تلقائية بعد</div>
                    ) : (
                      <div className="space-y-3">
                        {automationRules.map((rule) => (
                          <div key={rule.id} className="rounded-lg border p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-1">
                                <p className="font-medium">{rule.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  إذا {getAutomationEventOption(rule.event_type).label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  التوقيت: {formatTimingSummary(rule)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  الأدوار: {formatRolesLabel(rule.target_roles)} | النطاق: {rule.only_event_client ? 'فريق عميل الحدث' : 'عام'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={(checked) => toggleAutomationRule(rule, checked)}
                                />
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteAutomationRule(rule.id)}>
                                  حذف
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm">{rule.title_template}</p>
                            <p className="text-sm text-muted-foreground">{rule.message_template}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Notification delivery metrics</CardTitle>
                      <CardDescription>Last 20 sends (manual + automation)</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchDeliveryMetrics} disabled={loadingDeliveryMetrics}>
                      {loadingDeliveryMetrics ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                      تحديث
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingDeliveryMetrics ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : deliveryMetrics.length === 0 ? (
                    <div className="text-sm text-muted-foreground">لا توجد مقاييس تسليم بعد.</div>
                  ) : (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Targets</TableHead>
                            <TableHead>In-app</TableHead>
                            <TableHead>Push sent</TableHead>
                            <TableHead>Push failed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliveryMetrics.map((metric) => (
                            <TableRow key={metric.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatMetricTimestamp(metric.created_at)}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{getMetricEventLabel(metric)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Targets: {metric.targets} | Subscriptions: {metric.subscriptions_found}
                                  {metric.subscriptions_disabled > 0 ? ` | Disabled: ${metric.subscriptions_disabled}` : ''}
                                </div>
                                {metric.push_skipped_reason ? (
                                  <Badge variant="outline" className="mt-1 text-[10px]">
                                    {metric.push_skipped_reason}
                                  </Badge>
                                ) : null}
                              </TableCell>
                              <TableCell>{metric.targets}</TableCell>
                              <TableCell>{metric.in_app_sent}</TableCell>
                              <TableCell>{metric.push_sent}</TableCell>
                              <TableCell>{metric.push_failed}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>القوالب المحفوظة</CardTitle>
                  <CardDescription>اختر قالبًا لتعبئة النموذج بسرعة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingNotificationTemplates ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : notificationTemplates.length === 0 ? (
                    <div className="text-sm text-muted-foreground">لا توجد قوالب محفوظة بعد</div>
                  ) : (
                    notificationTemplates.map((template) => (
                      <div key={template.id} className="rounded-lg border p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <p className="font-medium">{template.name}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>النوع: {template.type}</span>
                              <span>الأدوار: {formatRolesLabel(template.target_roles)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => applyTemplate(template)}>
                              استخدام
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteTemplate(template.id)}>
                              حذف
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{template.title}</p>
                        <p className="text-sm">{template.message}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Insights Tab - السوبر أدمن Only */}
          {isSuperAdmin && (
            <TabsContent value="insights" className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                  <Activity className="h-6 w-6" />
                  نظرة شاملة على الأداء
                </h2>
                <p className="text-muted-foreground text-sm mb-6">جميع المقاييس والإحصائيات في مكان واحد</p>

                {loadingInsights ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Key Performance Metrics */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                      <Card className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل الإغلاق</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-green-600">{insightsStats.closeRate}%</div>
                          <p className="text-xs text-muted-foreground">{insightsStats.soldLeads} من {insightsStats.contactedLeads}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل الحضور</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-blue-600">{insightsStats.showRate}%</div>
                          <p className="text-xs text-muted-foreground">{insightsStats.completedAppointments} من {insightsStats.totalAppointments}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-amber-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل الحجز</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-amber-600">{insightsStats.bookingRate}%</div>
                          <p className="text-xs text-muted-foreground">{insightsStats.appointmentBookedLeads} من {insightsStats.totalLeads}</p>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">معدل التحويل</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-purple-600">{insightsStats.conversionRate}%</div>
                          <p className="text-xs text-muted-foreground">من إجمالي العملاء</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* تفصيل العملاء المحتملين */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <UserPlus className="h-5 w-5" />
                          تفصيل العملاء المحتملين
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                            <p className="text-2xl font-bold">{insightsStats.totalLeads}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                            <p className="text-2xl font-bold text-blue-600">{insightsStats.newLeads}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم التواصل</p>
                            <p className="text-2xl font-bold text-amber-600">{insightsStats.contactedLeads}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم البيع</p>
                            <p className="text-2xl font-bold text-green-600">{insightsStats.soldLeads}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Appointments Breakdown */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          تفصيل الطلبات المؤكدة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي الطلبات المؤكدة</p>
                            <p className="text-2xl font-bold">{insightsStats.totalAppointments}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">مجدول</p>
                            <p className="text-2xl font-bold text-blue-600">{insightsStats.scheduledAppointments}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">مكتمل</p>
                            <p className="text-2xl font-bold text-green-600">{insightsStats.completedAppointments}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">لم يحضر</p>
                            <p className="text-2xl font-bold text-orange-600">{insightsStats.noShowAppointments}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* SMS Analytics */}
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          تحليل الرسائل النصية
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي الرسائل</p>
                            <p className="text-2xl font-bold">{insightsStats.totalSms}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم الإرسال</p>
                            <p className="text-2xl font-bold text-blue-600">{insightsStats.smsSent}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تم التسليم</p>
                            <p className="text-2xl font-bold text-green-600">{insightsStats.smsDelivered}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">فشل</p>
                            <p className="text-2xl font-bold text-red-600">{insightsStats.smsFailed}</p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">معدل التسليم</span>
                            <span className="text-lg font-semibold text-green-600">{smsDeliveryRate}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* System Overview */}
                    <div className="grid gap-4 md:grid-cols-2 mb-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            العملاء والمستخدمين
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">إجمالي العملاء (الشركات)</span>
                              <span className="text-xl font-bold">{insightsStats.totalClients}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">إجمالي المستخدمين</span>
                              <span className="text-xl font-bold">{insightsStats.totalUsers}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            معدلات الأداء
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">معدل الإغلاق</span>
                              <Badge variant={insightsStats.closeRate >= 50 ? "default" : "secondary"} className={insightsStats.closeRate >= 50 ? "bg-green-600" : ""}>
                                {insightsStats.closeRate}%
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">معدل الحضور</span>
                              <Badge variant={insightsStats.showRate >= 70 ? "default" : "secondary"} className={insightsStats.showRate >= 70 ? "bg-green-600" : ""}>
                                {insightsStats.showRate}%
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">معدل التحويل</span>
                              <Badge variant={insightsStats.conversionRate >= 30 ? "default" : "secondary"} className={insightsStats.conversionRate >= 30 ? "bg-green-600" : ""}>
                                {insightsStats.conversionRate}%
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                      <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
                        <LeadsByStatusChart />
                      </Suspense>
                      <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
                        <WeeklyLeadsChart />
                      </Suspense>
                      <Suspense fallback={<div className="h-72 bg-muted/60 animate-pulse rounded-xl" />}>
                        <WeeklyAppointmentsChart />
                      </Suspense>
                    </div>

                    {/* Client Performance Comparison */}
                    {clientsPerformance.length > 0 && (
                      <>
                        <Suspense fallback={<div className="h-80 bg-muted/60 animate-pulse rounded-xl" />}>
                          <ClientsComparisonChart clientsData={clientsPerformance} />
                        </Suspense>

                        <Card className="mt-6">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5" />
                              جدول أداء العملاء
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">الشركة</TableHead>
                                  <TableHead className="text-center">الطلبات</TableHead>
                                  <TableHead className="text-center">الطلبات المؤكدة</TableHead>
                                  <TableHead className="text-center">المبيعات</TableHead>
                                  <TableHead className="text-center">معدل الإغلاق</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientsPerformance.map((client) => (
                                  <TableRow key={client.id}>
                                    <TableCell className="font-medium">{client.company_name}</TableCell>
                                    <TableCell className="text-center">{client.leads_count}</TableCell>
                                    <TableCell className="text-center">{client.appointments_count}</TableCell>
                                    <TableCell className="text-center">{client.sold_count}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge
                                        variant={client.close_rate >= 50 ? 'default' : client.close_rate >= 25 ? 'secondary' : 'outline'}
                                        className={client.close_rate >= 50 ? 'bg-green-600' : ''}
                                      >
                                        {client.close_rate}%
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="access" className="space-y-6">
              <Suspense fallback={<div className="h-64 rounded-xl bg-muted/60 animate-pulse" />}>
                <AdminAccessSettings />
              </Suspense>
            </TabsContent>
          )}

          {/* System Tab - السوبر أدمن Only */}
          {isSuperAdmin && (
            <TabsContent value="system" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">إعدادات النظام</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        إعدادات SMS
                      </CardTitle>
                      <CardDescription>إدارة خدمة الرسائل النصية</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>مزود الخدمة</Label>
                        <Input value="Resala.ly" readOnly className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>حالة الخدمة</Label>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm text-muted-foreground">نشط</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        إدارة المستخدمين
                      </CardTitle>
                      <CardDescription>إدارة حسابات المستخدمين والصلاحيات</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link to="/users">
                        <Button variant="outline" className="w-full justify-between">
                          فتح إدارة المستخدمين
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        معلومات النظام
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">الإصدار</span>
                        <span className="font-mono">1.0.0</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">البيئة</span>
                        <span className="font-mono">الإنتاج</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        تصدير البيانات
                      </CardTitle>
                      <CardDescription>تصدير بيانات النظام</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" disabled>
                        <Download className="h-4 w-4 ml-2" />
                        تصدير التقرير (قريباً)
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">مراقبة المهام</h3>
                    <Button variant="outline" size="sm" onClick={fetchObservability} disabled={loadingObservability}>
                      {loadingObservability ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                      تحديث
                    </Button>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>أحدث تشغيلات المهام</CardTitle>
                      <CardDescription>آخر 20 مهمة خلفية</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingObservability ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : jobRuns.length === 0 ? (
                        <div className="text-sm text-muted-foreground">لا توجد تشغيلات بعد.</div>
                      ) : (
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>المهمة</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>البدء</TableHead>
                                <TableHead>المدة (مللي ثانية)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {jobRuns.map((run) => (
                                <TableRow key={run.id}>
                                  <TableCell>{run.job_name}</TableCell>
                                  <TableCell>
                                    <Badge variant={run.status === 'failed' ? 'destructive' : run.status === 'success' ? 'default' : 'secondary'}>
                                      {run.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{formatMetricTimestamp(run.started_at)}</TableCell>
                                  <TableCell>{run.duration_ms ?? '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>الرسائل الميتة</CardTitle>
                      <CardDescription>المهام الفاشلة وحمولات الويبهوك</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingObservability ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : deadLetters.length === 0 ? (
                        <div className="text-sm text-muted-foreground">لا توجد رسائل ميتة.</div>
                      ) : (
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>المصدر</TableHead>
                                <TableHead>المهمة</TableHead>
                                <TableHead>الخطأ</TableHead>
                                <TableHead>تاريخ الإنشاء</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {deadLetters.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.source}</TableCell>
                                  <TableCell>{item.job_name || '-'}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{item.error_message || '-'}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{formatMetricTimestamp(item.created_at)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>أحداث الويبهوك</CardTitle>
                      <CardDescription>آخر 20 ويبهوك وارد</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingObservability ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : webhookEvents.length === 0 ? (
                        <div className="text-sm text-muted-foreground">لا توجد أحداث ويبهوك بعد.</div>
                      ) : (
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>المزوّد</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>العميل المحتمل</TableHead>
                                <TableHead>تاريخ الإنشاء</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {webhookEvents.map((evt) => (
                                <TableRow key={evt.id}>
                                  <TableCell>{evt.provider}</TableCell>
                                  <TableCell>
                                    <Badge variant={evt.status === 'failed' ? 'destructive' : evt.status === 'processed' ? 'default' : 'secondary'}>
                                      {evt.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{evt.lead_id || '-'}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{formatMetricTimestamp(evt.created_at)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
















