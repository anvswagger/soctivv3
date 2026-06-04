import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Send, Wrench, Stethoscope, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getPushPermissionState, getCurrentPushSubscription, isPushSupported, enablePushNotifications, disablePushNotifications, getPushErrorMessage } from '@/lib/pushNotifications';

interface PushEventLogEntry {
    at: string;
    title?: string;
    body?: string;
    tag?: string;
    url?: string | null;
    error?: string;
}

interface DebugSnapshot {
    runtime_settings?: {
        present?: boolean;
        supabase_url?: string;
        service_role_key_length?: number;
        has_supabase_url?: boolean;
        has_service_role_key?: boolean;
    };
    extensions?: {
        net_available?: boolean;
        cron_available?: boolean;
        appointment_reminders_cron_job?: boolean;
    };
    push_subscriptions?: {
        total?: number;
        active?: number;
        inactive?: number;
        recent?: Array<{
            id: string;
            user_id: string;
            platform: string;
            is_active: boolean;
            last_seen_at: string;
            created_at: string;
        }>;
    };
    automation_rules?: {
        total?: number;
        enabled?: number;
        immediate_enabled?: number;
        by_event?: Array<{ event_type: string; rule_count: number; any_enabled: boolean; any_enabled_push: boolean }>;
    };
    last_delivery_metrics?: Array<{
        id: string;
        mode: string;
        event_type: string | null;
        source: string | null;
        targets: number;
        in_app_sent: number;
        push_sent: number;
        push_failed: number;
        subscriptions_found: number;
        subscriptions_disabled: number;
        push_skipped_reason: string | null;
        created_at: string;
    }>;
}

interface VapidInfo {
    ok: boolean;
    public_key?: string;
    error?: string;
    raw?: unknown;
}

const PUSH_EVENT_LOG_KEY = 'soctiv_sw_push_events';
const PUSH_EVENT_LOG_MAX = 10;

function readPushEventLog(): PushEventLogEntry[] {
    try {
        const raw = localStorage.getItem(PUSH_EVENT_LOG_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writePushEventLog(entries: PushEventLogEntry[]): void {
    try {
        localStorage.setItem(PUSH_EVENT_LOG_KEY, JSON.stringify(entries));
    } catch {
        // best-effort
    }
}

function StatusPill({ ok, label, okLabel = 'OK', badLabel = 'مشكلة' }: { ok: boolean; label: string; okLabel?: string; badLabel?: string }) {
    return (
        <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            {ok ? (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    {okLabel}
                </Badge>
            ) : (
                <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 ml-1" />
                    {badLabel}
                </Badge>
            )}
        </div>
    );
}

export function NotificationHealthCheck() {
    const { user, isSuperAdmin } = useAuth();
    const { toast } = useToast();

    // Browser-side state
    const [pushSupported, setPushSupported] = useState(false);
    const [permission, setPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported');
    const [hasSubscription, setHasSubscription] = useState(false);
    const [swActive, setSwActive] = useState(false);

    // Backend health
    const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null);
    const [snapshotError, setSnapshotError] = useState<string | null>(null);
    const [loadingSnapshot, setLoadingSnapshot] = useState(false);

    // VAPID config
    const [vapid, setVapid] = useState<VapidInfo | null>(null);
    const [loadingVapid, setLoadingVapid] = useState(false);

    // Actions
    const [sendingTest, setSendingTest] = useState(false);
    const [repairing, setRepairing] = useState(false);
    const [enabling, setEnabling] = useState(false);
    const [disabling, setDisabling] = useState(false);

    // Lead notification pipeline diagnosis
    interface LeadPipelineDiag {
        pg_net_available?: boolean;
        runtime_settings?: { present?: boolean; has_url?: boolean; key_length?: number };
        leads_trigger_exists?: boolean;
        automation_rules?: { total?: number; enabled?: number; lead_created_enabled?: number };
        push_subscriptions?: { total?: number; active?: number };
        diagnosis?: string;
    }
    const [leadDiag, setLeadDiag] = useState<LeadPipelineDiag | null>(null);
    const [loadingLeadDiag, setLoadingLeadDiag] = useState(false);

    // Service worker event log (last 10 push events)
    const [eventLog, setEventLog] = useState<PushEventLogEntry[]>(() => readPushEventLog());

    const refreshBrowserState = useCallback(async () => {
        const supported = isPushSupported();
        setPushSupported(supported);
        if (!supported) {
            setPermission('unsupported');
            setHasSubscription(false);
            setSwActive(false);
            return;
        }

        setPermission(getPushPermissionState());

        try {
            const sub = await getCurrentPushSubscription();
            setHasSubscription(Boolean(sub));
        } catch (error) {
            console.warn('[HealthCheck] getCurrentPushSubscription failed:', error);
            setHasSubscription(false);
        }

        try {
            const reg = await navigator.serviceWorker.getRegistration();
            setSwActive(Boolean(reg && (reg.active || reg.waiting || reg.installing)));
        } catch (error) {
            console.warn('[HealthCheck] getRegistration failed:', error);
            setSwActive(false);
        }
    }, []);

    const fetchSnapshot = useCallback(async () => {
        setLoadingSnapshot(true);
        setSnapshotError(null);
        try {
            const { data, error } = await supabase.rpc('debug_notification_pipeline');
            if (error) {
                setSnapshotError(error.message || 'تعذر تنفيذ التشخيص');
                setSnapshot(null);
                return;
            }
            setSnapshot((data as DebugSnapshot) ?? null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setSnapshotError(message);
            setSnapshot(null);
        } finally {
            setLoadingSnapshot(false);
        }
    }, []);

    const fetchVapid = useCallback(async () => {
        setLoadingVapid(true);
        try {
            const { data, error } = await supabase.functions.invoke('push-config');
            if (error) {
                setVapid({ ok: false, error: error.message || 'فشل استدعاء push-config' });
                return;
            }
            const key = (data as { web_push_public_key?: string } | null)?.web_push_public_key;
            if (typeof key === 'string' && key.trim()) {
                setVapid({ ok: true, public_key: key });
            } else {
                setVapid({ ok: false, error: 'لم يُرجع push-config مفتاح VAPID' });
            }
        } catch (error: unknown) {
            setVapid({ ok: false, error: error instanceof Error ? error.message : String(error) });
        } finally {
            setLoadingVapid(false);
        }
    }, []);

    // Subscribe to BroadcastChannel from the service worker to keep the
    // event log in sync with the actual received push events.
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel('soctiv_sw_events');
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'PUSH_EVENT') {
                setEventLog((prev) => {
                    const next = [event.data.payload, ...prev].slice(0, PUSH_EVENT_LOG_MAX);
                    writePushEventLog(next);
                    return next;
                });
            }
        };
        channel.addEventListener('message', handler);
        return () => {
            channel.removeEventListener('message', handler);
            channel.close();
        };
    }, []);

    useEffect(() => {
        void refreshBrowserState();
        void fetchVapid();
        if (isSuperAdmin) {
            void fetchSnapshot();
        }
    }, [refreshBrowserState, fetchVapid, fetchSnapshot, isSuperAdmin, user?.id]);

    const handleEnablePush = async () => {
        if (!user?.id) return;
        setEnabling(true);
        try {
            await enablePushNotifications(user.id);
            toast({ title: 'تم التفعيل', description: 'تم تفعيل الإشعارات لهذا الجهاز بنجاح' });
            await refreshBrowserState();
        } catch (error: unknown) {
            toast({
                title: 'فشل التفعيل',
                description: getPushErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setEnabling(false);
        }
    };

    const handleDisablePush = async () => {
        if (!user?.id) return;
        setDisabling(true);
        try {
            await disablePushNotifications(user.id);
            toast({ title: 'تم الإيقاف', description: 'تم إيقاف إشعارات هذا الجهاز' });
            await refreshBrowserState();
        } catch (error: unknown) {
            toast({
                title: 'فشل الإيقاف',
                description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
                variant: 'destructive',
            });
        } finally {
            setDisabling(false);
        }
    };

    const handleSendTestPush = async () => {
        setSendingTest(true);
        try {
            const { data, error } = await supabase.functions.invoke<{
                summary?: Record<string, unknown>;
                vapid_configured?: boolean;
                warning?: string | null;
                template_id?: string | null;
            }>('send-push-notification', {
                body: {
                    title: 'اختبار إشعار Soctiv',
                    message: 'هذا إشعار تجريبي للتحقق من سلسلة الإشعارات. ' + new Date().toLocaleTimeString('en-GB'),
                    type: 'info',
                    url: '/notifications',
                    target_roles: ['super_admin'],
                    send_push: true,
                    send_in_app: true,
                },
            });
            if (error) {
                toast({
                    title: 'فشل إرسال الاختبار',
                    description: error.message || 'تعذر استدعاء send-push-notification',
                    variant: 'destructive',
                });
                return;
            }
            const summary = data?.summary ?? {};
            const pushSent = Number(summary.push_sent ?? 0);
            const inAppSent = Number(summary.in_app_sent ?? 0);
            const subsFound = Number(summary.subscriptions_found ?? 0);
            const skipReason = (summary.push_skipped_reason as string | null) ?? null;
            const warning = data?.warning ?? null;
            const desc = [
                `in_app=${inAppSent}`,
                `push=${pushSent}`,
                `subs=${subsFound}`,
                skipReason ? `skip=${skipReason}` : null,
            ].filter(Boolean).join(' · ');
            toast({
                title: warning ? 'تم الإرسال (مع تنبيه)' : 'تم إرسال الاختبار',
                description: warning ? `${desc}\n${warning}` : desc,
                variant: warning ? 'destructive' : 'default',
            });
            if (isSuperAdmin) void fetchSnapshot();
        } catch (error: unknown) {
            toast({
                title: 'فشل إرسال الاختبار',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        } finally {
            setSendingTest(false);
        }
    };

    const handleRepairRuntime = async () => {
        if (!isSuperAdmin) return;
        setRepairing(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
            // The service role key is intentionally not exposed in the frontend
            // by default. We read it from the same env var the edge function
            // uses (Cloudflare Pages / Netlify) when running in the browser.
            const candidates = [
                import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined,
                import.meta.env.VITE_SERVICE_ROLE_KEY as string | undefined,
            ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
            const serviceKey = candidates[0];
            if (!supabaseUrl || !serviceKey) {
                toast({
                    title: 'لا يمكن الإصلاح تلقائياً',
                    description:
                        'مفتاح service_role غير مكشوف للمتصفح. شغّل scripts/setup-notifications.ps1 من الجذر أو عيّن VITE_SUPABASE_SERVICE_ROLE_KEY في إعدادات الاستضافة كمتغير للواجهة (للاستخدام التشخيصي فقط).',
                    variant: 'destructive',
                });
                return;
            }
            const { data, error } = await supabase.rpc('upsert_app_runtime_settings', {
                p_supabase_url: supabaseUrl,
                p_service_role_key: serviceKey,
            });
            if (error) {
                toast({
                    title: 'فشل الإصلاح',
                    description: error.message || 'تعذر تحديث app_runtime_settings',
                    variant: 'destructive',
                });
                return;
            }
            toast({
                title: 'تم إصلاح runtime settings',
                description: 'تم تحديث app_runtime_settings بنجاح. جرّب الآن اختبار الإشعار.',
            });
            void fetchSnapshot();
        } catch (error: unknown) {
            toast({
                title: 'فشل الإصلاح',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        } finally {
            setRepairing(false);
        }
    };

    const fetchLeadPipelineDiag = useCallback(async () => {
        setLoadingLeadDiag(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)('diagnose_lead_notification_pipeline');
            if (error) {
                console.warn('[HealthCheck] diagnose_lead_notification_pipeline failed:', error);
                setLeadDiag(null);
                return;
            }
            setLeadDiag((data as LeadPipelineDiag) ?? null);
        } catch {
            setLeadDiag(null);
        } finally {
            setLoadingLeadDiag(false);
        }
    }, []);

    const handleTestLeadNotification = async () => {
        try {
            // Find the most recent lead to test with
            const { data: leads, error: leadsError } = await supabase
                .from('leads')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (leadsError || !leads) {
                toast({ title: 'لا يوجد عميل محتمل', description: 'لم يتم العثور على أي عميل محتمل للاختبار', variant: 'destructive' });
                return;
            }
            const leadRow = leads as { id: string };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase.rpc as any)('fire_lead_notification_manual', { p_lead_id: leadRow.id });
            if (error) {
                toast({ title: 'فشل الاختبار', description: error.message || 'تعذر استدعاء fire_lead_notification_manual', variant: 'destructive' });
                return;
            }
            const result = data as { ok?: boolean; message?: string; error?: string } | null;
            if (result?.ok) {
                toast({ title: 'تم إطلاق الإشعار', description: result.message || 'تم إطلاق حدث lead_created. تحقق من سجلات edge function.' });
            } else {
                toast({ title: 'فشل', description: result?.error || 'Unknown error', variant: 'destructive' });
            }
            void fetchLeadPipelineDiag();
        } catch (error: unknown) {
            toast({ title: 'فشل', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
        }
    };

    const userActiveSubs = useMemo(() => {
        if (!snapshot?.push_subscriptions?.recent || !user?.id) return 0;
        return snapshot.push_subscriptions.recent.filter(
            (row) => row.user_id === user.id && row.is_active
        ).length;
    }, [snapshot, user?.id]);

    const issues = useMemo(() => {
        const list: string[] = [];
        if (!pushSupported) list.push('المتصفح لا يدعم Web Push (جرّب Chrome أو Edge).');
        if (permission === 'denied') list.push('تم رفض إذن الإشعارات. فعّله من إعدادات المتصفح.');
        if (pushSupported && permission === 'granted' && !hasSubscription) {
            list.push('لا يوجد اشتراك Push نشط على هذا المتصفح. اضغط "تفعيل".');
        }
        if (!swActive) list.push('Service Worker غير مُسجّل. حدّث الصفحة (Ctrl+F5) أو فعّل الإشعارات.');
        if (vapid && !vapid.ok) {
            list.push(`VAPID غير مهيأ: ${vapid.error ?? ''}`.trim());
        }
        if (snapshot?.runtime_settings && !snapshot.runtime_settings.has_supabase_url) {
            list.push('app_runtime_settings.supabase_url فارغ — مشغّل قاعدة البيانات سيتجاهل طلبات الإشعارات.');
        }
        if (snapshot?.runtime_settings && !snapshot.runtime_settings.has_service_role_key) {
            list.push('app_runtime_settings.service_role_key فارغ — مشغّل قاعدة البيانات سيتجاهل طلبات الإشعارات.');
        }
        if (snapshot?.extensions && snapshot.extensions.net_available === false) {
            list.push('امتداد pg_net غير مفعّل في قاعدة البيانات (مطلوب لـ DB triggers).');
        }
        if (snapshot?.push_subscriptions && (snapshot.push_subscriptions.active ?? 0) === 0) {
            list.push('لا توجد push_subscriptions نشطة. يجب أن يفعّل كل مستخدم الإشعارات في متصفحه.');
        }
        return list;
    }, [pushSupported, permission, hasSubscription, swActive, vapid, snapshot]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Stethoscope className="h-5 w-5" />
                            تشخيص سلسلة الإشعارات
                        </CardTitle>
                        <CardDescription>
                            فحص لحظي للمتصفح، Service Worker، VAPID، قاعدة البيانات، وقواعد الأتمتة.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                void refreshBrowserState();
                                void fetchVapid();
                                if (isSuperAdmin) void fetchSnapshot();
                            }}
                            disabled={loadingSnapshot || loadingVapid}
                        >
                            {(loadingSnapshot || loadingVapid) ? (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            ) : (
                                <RefreshCw className="h-4 w-4 ml-2" />
                            )}
                            تحديث
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {issues.length > 0 && (
                    <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>مشاكل مكتشفة ({issues.length})</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                                {issues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {issues.length === 0 && (
                    <Alert>
                        <ShieldCheck className="h-4 w-4" />
                        <AlertTitle>كل شيء يبدو سليماً</AlertTitle>
                        <AlertDescription>
                            سلسلة الإشعارات جاهزة للإرسال. اضغط "إرسال إشعار تجريبي" للتحقق الكامل.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4 space-y-1">
                        <div className="font-semibold text-sm flex items-center gap-2 mb-2">
                            <Activity className="h-4 w-4" />
                            المتصفح
                        </div>
                        <StatusPill ok={pushSupported} label="دعم Web Push" okLabel="مدعوم" badLabel="غير مدعوم" />
                        <StatusPill
                            ok={permission === 'granted'}
                            label={`إذن الإشعارات: ${permission}`}
                            okLabel="ممنوح"
                            badLabel="غير ممنوح"
                        />
                        <StatusPill ok={swActive} label="Service Worker" okLabel="نشط" badLabel="غير نشط" />
                        <StatusPill
                            ok={hasSubscription}
                            label="اشتراك Push في المتصفح"
                            okLabel="موجود"
                            badLabel="غير موجود"
                        />
                        <div className="pt-3 flex flex-wrap gap-2">
                            {hasSubscription ? (
                                <Button variant="destructive" size="sm" onClick={handleDisablePush} disabled={disabling}>
                                    {disabling ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                    إيقاف في هذا المتصفح
                                </Button>
                            ) : (
                                <Button size="sm" onClick={handleEnablePush} disabled={enabling || !pushSupported}>
                                    {enabling ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                    تفعيل
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-1">
                        <div className="font-semibold text-sm flex items-center gap-2 mb-2">
                            <Wrench className="h-4 w-4" />
                            الخادم (VAPID + DB)
                        </div>
                        <StatusPill
                            ok={Boolean(vapid?.ok)}
                            label="VAPID عام (push-config)"
                            okLabel="مُهيأ"
                            badLabel="غير مُهيأ"
                        />
                        <StatusPill
                            ok={Boolean(snapshot?.runtime_settings?.has_supabase_url)}
                            label="app_runtime_settings.supabase_url"
                            okLabel="مُعبّأ"
                            badLabel="فارغ"
                        />
                        <StatusPill
                            ok={Boolean(snapshot?.runtime_settings?.has_service_role_key)}
                            label="app_runtime_settings.service_role_key"
                            okLabel="مُعبّأ"
                            badLabel="فارغ"
                        />
                        <StatusPill
                            ok={Boolean(snapshot?.extensions?.net_available)}
                            label="pg_net"
                            okLabel="مفعّل"
                            badLabel="غير مفعّل"
                        />
                        {snapshotError && (
                            <p className="text-xs text-destructive pt-1" dir="ltr">
                                snapshot error: {snapshotError}
                            </p>
                        )}
                        {vapid && !vapid.ok && (
                            <p className="text-xs text-destructive pt-1" dir="ltr">
                                vapid error: {vapid.error}
                            </p>
                        )}
                        {isSuperAdmin && (
                            <div className="pt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRepairRuntime}
                                    disabled={repairing}
                                >
                                    {repairing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Wrench className="h-4 w-4 ml-2" />}
                                    إصلاح runtime settings تلقائياً
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                    <div className="font-semibold text-sm flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        اختبار سريع
                    </div>
                    <p className="text-xs text-muted-foreground">
                        يستدعي send-push-notification ويستهدف جميع السوبر أدمن. النتيجة تظهر فوراً في الأسفل وفي آخر مقاييس التسليم.
                    </p>
                    <Button onClick={handleSendTestPush} disabled={sendingTest}>
                        {sendingTest ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Send className="h-4 w-4 ml-2" />}
                        إرسال إشعار تجريبي للسوبر أدمن
                    </Button>
                </div>

                {isSuperAdmin && (
                    <div className="rounded-lg border p-4 space-y-2">
                        <div className="font-semibold text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            تشخيص سلسلة إشعارات العملاء المحتملين (Lead Notifications)
                        </div>
                        <p className="text-xs text-muted-foreground">
                            يتحقق من: pg_net، app_runtime_settings، قاعدة A44trigger على Leads، قواعد الأتمتة، واشتراكات Push.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void fetchLeadPipelineDiag()}
                                disabled={loadingLeadDiag}
                            >
                                {loadingLeadDiag ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Stethoscope className="h-4 w-4 ml-2" />}
                                تشخيص سلسلة Lead
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleTestLeadNotification()}
                            >
                                <Send className="h-4 w-4 ml-2" />
                                اختبار إشعار Lead
                            </Button>
                        </div>
                        {leadDiag && (
                            <div className="space-y-1 text-sm">
                                <StatusPill
                                    ok={Boolean(leadDiag.pg_net_available)}
                                    label="pg_net"
                                    okLabel="مفعّل"
                                    badLabel="غير مفعّل"
                                />
                                <StatusPill
                                    ok={Boolean(leadDiag.runtime_settings?.present)}
                                    label="app_runtime_settings"
                                    okLabel="مُعبّأ"
                                    badLabel="فارغ"
                                />
                                <StatusPill
                                    ok={Boolean(leadDiag.leads_trigger_exists)}
                                    label="Lead notification trigger"
                                    okLabel="موجود"
                                    badLabel="غير موجود"
                                />
                                <StatusPill
                                    ok={Boolean((leadDiag.automation_rules?.lead_created_enabled ?? 0) > 0)}
                                    label={`Lead_created rule enabled: ${leadDiag.automation_rules?.lead_created_enabled ?? 0}`}
                                    okLabel="مفعّل"
                                    badLabel="غير مفعّل"
                                />
                                <StatusPill
                                    ok={Boolean((leadDiag.push_subscriptions?.active ?? 0) > 0)}
                                    label={`Active push subscriptions: ${leadDiag.push_subscriptions?.active ?? 0}`}
                                    okLabel="موجود"
                                    badLabel="غير موجود"
                                />
                                {leadDiag.diagnosis && (
                                    <Alert variant={leadDiag.diagnosis.startsWith('OK') ? 'default' : 'destructive'} className="mt-2">
                                        <AlertDescription className="text-sm">{leadDiag.diagnosis}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {isSuperAdmin && snapshot && (
                    <div className="rounded-lg border p-4 space-y-2">
                        <div className="font-semibold text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            إحصائيات قاعدة البيانات
                        </div>
                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                            <div>
                                <div className="text-muted-foreground">Push subscriptions</div>
                                <div>
                                    نشط: <span className="font-semibold">{snapshot.push_subscriptions?.active ?? 0}</span> · معطّل: {snapshot.push_subscriptions?.inactive ?? 0} · إجمالي: {snapshot.push_subscriptions?.total ?? 0}
                                </div>
                                <div className="text-xs text-muted-foreground">اشتراكاتك النشطة: {userActiveSubs}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">قواعد الأتمتة</div>
                                <div>
                                    مفعلة: <span className="font-semibold">{snapshot.automation_rules?.enabled ?? 0}</span> · إجمالي: {snapshot.automation_rules?.total ?? 0}
                                </div>
                                <div className="text-xs text-muted-foreground">قواعد فورية مفعلة: {snapshot.automation_rules?.immediate_enabled ?? 0}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Cron</div>
                                <div>
                                    pg_cron: {snapshot.extensions?.cron_available ? '✓' : '✗'} · appointment-reminders: {snapshot.extensions?.appointment_reminders_cron_job ? '✓' : '✗'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isSuperAdmin && snapshot?.last_delivery_metrics && snapshot.last_delivery_metrics.length > 0 && (
                    <div className="rounded-lg border p-4 space-y-2">
                        <div className="font-semibold text-sm">آخر مقاييس التسليم</div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">الوقت</TableHead>
                                        <TableHead className="text-right">الوضع</TableHead>
                                        <TableHead className="text-right">الحدث</TableHead>
                                        <TableHead className="text-right">in_app</TableHead>
                                        <TableHead className="text-right">push</TableHead>
                                        <TableHead className="text-right">subs</TableHead>
                                        <TableHead className="text-right">سبب التخطي</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {snapshot.last_delivery_metrics.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="text-xs" dir="ltr">{new Date(m.created_at).toLocaleString('en-GB')}</TableCell>
                                            <TableCell className="text-xs">{m.mode}</TableCell>
                                            <TableCell className="text-xs">{m.event_type ?? '-'}</TableCell>
                                            <TableCell className="text-xs">{m.in_app_sent}</TableCell>
                                            <TableCell className="text-xs">{m.push_sent}/{m.push_failed}</TableCell>
                                            <TableCell className="text-xs">{m.subscriptions_found}</TableCell>
                                            <TableCell className="text-xs text-destructive">{m.push_skipped_reason ?? '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                <div className="rounded-lg border p-4 space-y-2">
                    <div className="font-semibold text-sm">سجل push events (آخر {PUSH_EVENT_LOG_MAX})</div>
                    {eventLog.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            لم يصل أي push event إلى Service Worker في هذا المتصفح حتى الآن. الإشعارات الواردة ستظهر هنا تلقائياً.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {eventLog.map((entry, idx) => (
                                <li key={idx} className="text-xs border rounded p-2" dir="ltr">
                                    <div className="text-muted-foreground">{new Date(entry.at).toLocaleString('en-GB')}</div>
                                    {entry.error ? (
                                        <div className="text-destructive">ERROR: {entry.error}</div>
                                    ) : (
                                        <>
                                            <div className="font-semibold">{entry.title}</div>
                                            {entry.body && <div>{entry.body}</div>}
                                            {entry.url && <div className="text-muted-foreground">url: {entry.url}</div>}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}


