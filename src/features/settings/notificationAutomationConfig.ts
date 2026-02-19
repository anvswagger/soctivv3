export type PushTargetRole = 'client' | 'admin' | 'super_admin';

export type NotificationEventType =
    | 'appointment_created'
    | 'appointment_updated'
    | 'appointment_rescheduled'
    | 'appointment_status_changed'
    | 'appointment_completed'
    | 'appointment_cancelled'
    | 'appointment_no_show'
    | 'appointment_start_time'
    | 'appointment_no_show_after_48h'
    | 'lead_created'
    | 'lead_updated'
    | 'lead_status_changed'
    | 'lead_stage_changed'
    | 'lead_sold'
    | 'lead_pipeline_new'
    | 'lead_pipeline_contacting'
    | 'lead_pipeline_appointment_booked'
    | 'lead_pipeline_interviewed'
    | 'lead_pipeline_no_show'
    | 'lead_pipeline_sold'
    | 'lead_pipeline_cancelled'
    | 'lead_assigned'
    | 'approval_status_changed'
    | 'approval_approved'
    | 'approval_rejected'
    | 'appointment_after_1h';

type AutomationEventOption = {
    value: NotificationEventType;
    label: string;
    default_type: string;
    default_url: string;
    default_title: string;
    default_message: string;
};

type AutomationVariableOption = {
    token: string;
    label: string;
    description: string;
    category: 'عام' | 'الموعد' | 'التوقيت' | 'العميل المحتمل' | 'المعرفات';
};

export type AutomationTimingMode = 'immediate' | 'before' | 'after';
export type AutomationTimingUnit = 'minutes' | 'hours' | 'days';
export type AutomationTimingAnchor = 'event_time' | 'appointment_start' | 'no_show_time';

export interface NotificationDeliveryMetric {
    id: string;
    mode: string;
    event_type: NotificationEventType | null;
    source: string | null;
    targets: number;
    in_app_sent: number;
    push_sent: number;
    push_failed: number;
    subscriptions_disabled: number;
    subscriptions_found: number;
    push_skipped_reason: string | null;
    created_at: string;
}

export interface NotificationTemplate {
    id: string;
    name: string;
    title: string;
    message: string;
    type: string;
    url: string | null;
    target_roles: PushTargetRole[];
    created_at: string;
}

export interface NotificationAutomationRule {
    id: string;
    name: string;
    event_type: NotificationEventType;
    enabled: boolean;
    notification_type: string;
    url: string;
    title_template: string;
    message_template: string;
    send_push: boolean;
    send_in_app: boolean;
    target_roles: PushTargetRole[];
    only_event_client: boolean;
    client_id_filter: string | null;
    timing_mode: AutomationTimingMode | null;
    timing_value: number | null;
    timing_unit: AutomationTimingUnit | null;
    timing_anchor: AutomationTimingAnchor | null;
    created_at: string;
}

export const AUTOMATION_EVENT_OPTIONS: AutomationEventOption[] = [
    {
        value: 'appointment_created',
        label: 'تم إنشاء موعد',
        default_type: 'info',
        default_url: '/appointments',
        default_title: 'تمت إضافة موعد جديد',
        default_message: 'تمت إضافة موعد جديد {{scheduled_at_display}}',
    },
    {
        value: 'appointment_updated',
        label: 'تم تحديث موعد',
        default_type: 'warning',
        default_url: '/appointments',
        default_title: 'تم تحديث موعد',
        default_message: 'تم تحديث الموعد. الحالة الحالية: {{status}}',
    },
    {
        value: 'appointment_rescheduled',
        label: 'تمت إعادة جدولة الموعد',
        default_type: 'warning',
        default_url: '/appointments',
        default_title: 'تمت إعادة جدولة موعد',
        default_message: 'تم تغيير الموعد من {{old_scheduled_at_display}} إلى {{scheduled_at_display}}',
    },
    {
        value: 'appointment_status_changed',
        label: 'تغيرت حالة الموعد',
        default_type: 'warning',
        default_url: '/appointments',
        default_title: 'تغيرت حالة الموعد',
        default_message: 'تم تغيير حالة الموعد من {{old_status}} إلى {{status}}',
    },
    {
        value: 'appointment_completed',
        label: 'تم إكمال الموعد',
        default_type: 'success',
        default_url: '/appointments',
        default_title: 'تم إكمال الموعد',
        default_message: 'تم تعليم الموعد كمكتمل {{scheduled_at_display}}',
    },
    {
        value: 'appointment_cancelled',
        label: 'تم إلغاء الموعد',
        default_type: 'error',
        default_url: '/appointments',
        default_title: 'تم إلغاء الموعد',
        default_message: 'تم إلغاء الموعد {{scheduled_at_display}}',
    },
    {
        value: 'appointment_no_show',
        label: 'تم تعيين الموعد عدم حضور',
        default_type: 'warning',
        default_url: '/appointments',
        default_title: 'عدم حضور للموعد',
        default_message: 'تم تسجيل الموعد كعدم حضور {{scheduled_at_display}}',
    },
    {
        value: 'appointment_no_show_after_48h',
        label: 'متابعة عدم الحضور بعد 48 ساعة',
        default_type: 'warning',
        default_url: '/appointments',
        default_title: 'متابعة عدم الحضور بعد 48 ساعة',
        default_message: 'مرّت 48 ساعة على عدم حضور {{lead_name}}. الرجاء المتابعة.',
    },
    {
        value: 'appointment_start_time',
        label: 'وقت بداية الموعد',
        default_type: 'info',
        default_url: '/appointments',
        default_title: 'بدأ وقت الموعد',
        default_message: 'بدأ الآن موعد العميل {{lead_name}} {{scheduled_at_display}}',
    },
    {
        value: 'lead_created',
        label: 'تم إنشاء عميل محتمل',
        default_type: 'info',
        default_url: '/leads',
        default_title: 'تمت إضافة عميل محتمل جديد',
        default_message: 'تمت إضافة العميل {{lead_name}}',
    },
    {
        value: 'lead_updated',
        label: 'تم تحديث عميل محتمل',
        default_type: 'info',
        default_url: '/leads',
        default_title: 'تم تحديث عميل محتمل',
        default_message: 'تم تحديث بيانات العميل {{lead_name}}',
    },
    {
        value: 'lead_assigned',
        label: 'تم إسناد عميل محتمل',
        default_type: 'info',
        default_url: '/leads',
        default_title: 'تم إسناد عميل محتمل',
        default_message: 'تم إسناد العميل المحتمل {{lead_name}} لك.',
    },
    {
        value: 'lead_status_changed',
        label: 'تغيّرت حالة العميل المحتمل',
        default_type: 'warning',
        default_url: '/leads',
        default_title: 'تغيرت حالة العميل المحتمل',
        default_message: 'الحالة تغيرت من {{old_status}} إلى {{status}} للعميل {{lead_name}}',
    },
    {
        value: 'lead_stage_changed',
        label: 'تغيرت مرحلة العميل المحتمل',
        default_type: 'warning',
        default_url: '/leads',
        default_title: 'تغيرت مرحلة العميل المحتمل',
        default_message: 'المرحلة تغيرت من {{old_stage}} إلى {{stage}} للعميل {{lead_name}}',
    },
    {
        value: 'lead_sold',
        label: 'تم بيع العميل المحتمل',
        default_type: 'success',
        default_url: '/leads',
        default_title: 'تم بيع عميل محتمل',
        default_message: 'تم تحويل العميل {{lead_name}} إلى مبيع',
    },
    {
        value: 'lead_pipeline_new',
        label: 'بايبلاين: جديد',
        default_type: 'info',
        default_url: '/leads',
        default_title: 'بايبلاين: جديد',
        default_message: 'العميل {{lead_name}} دخل مرحلة جديد',
    },
    {
        value: 'lead_pipeline_contacting',
        label: 'بايبلاين: تواصل',
        default_type: 'info',
        default_url: '/leads',
        default_title: 'بايبلاين: تواصل',
        default_message: 'العميل {{lead_name}} دخل مرحلة تواصل',
    },
    {
        value: 'lead_pipeline_appointment_booked',
        label: 'بايبلاين: تم حجز موعد',
        default_type: 'warning',
        default_url: '/leads',
        default_title: 'بايبلاين: تم حجز موعد',
        default_message: 'العميل {{lead_name}} دخل مرحلة تم حجز موعد',
    },
    {
        value: 'lead_pipeline_interviewed',
        label: 'بايبلاين: تم المقابلة',
        default_type: 'warning',
        default_url: '/leads',
        default_title: 'بايبلاين: تم المقابلة',
        default_message: 'العميل {{lead_name}} دخل مرحلة تم المقابلة',
    },
    {
        value: 'lead_pipeline_no_show',
        label: 'بايبلاين: عدم حضور',
        default_type: 'warning',
        default_url: '/leads',
        default_title: 'بايبلاين: عدم حضور',
        default_message: 'العميل {{lead_name}} دخل مرحلة عدم حضور',
    },
    {
        value: 'lead_pipeline_sold',
        label: 'بايبلاين: مبيع',
        default_type: 'success',
        default_url: '/leads',
        default_title: 'بايبلاين: مبيع',
        default_message: 'العميل {{lead_name}} دخل مرحلة مبيع',
    },
    {
        value: 'lead_pipeline_cancelled',
        label: 'بايبلاين: ملغي',
        default_type: 'error',
        default_url: '/leads',
        default_title: 'بايبلاين: ملغي',
        default_message: 'العميل {{lead_name}} دخل مرحلة ملغي',
    },
    {
        value: 'approval_status_changed',
        label: 'تغيّرت حالة الموافقة',
        default_type: 'warning',
        default_url: '/pending-approval',
        default_title: 'تم تحديث حالة الموافقة',
        default_message: 'تم تغيير حالة الموافقة إلى {{approval_status}}.',
    },
    {
        value: 'approval_approved',
        label: 'تمت الموافقة على الحساب',
        default_type: 'success',
        default_url: '/dashboard',
        default_title: 'تمت الموافقة على حسابك',
        default_message: 'تمت الموافقة على حسابك. يمكنك البدء الآن.',
    },
    {
        value: 'approval_rejected',
        label: 'تم رفض الحساب',
        default_type: 'error',
        default_url: '/pending-approval',
        default_title: 'تم رفض طلبك',
        default_message: 'تم رفض طلبك. السبب: {{rejection_reason}}.',
    },
];

export const AUTOMATION_TEMPLATE_VARIABLE_OPTIONS: AutomationVariableOption[] = [
    { token: '{{event_type}}', label: 'نوع الحدث', description: 'اسم الحدث الذي شغّل القاعدة.', category: 'عام' },
    { token: '{{entity_type}}', label: 'نوع الكيان', description: 'هل الحدث مرتبط بـ موعد أو عميل محتمل.', category: 'عام' },

    { token: '{{scheduled_at}}', label: 'وقت الموعد الحالي', description: 'تاريخ/وقت الموعد الحالي.', category: 'الموعد' },
    { token: '{{old_scheduled_at}}', label: 'وقت الموعد السابق', description: 'وقت الموعد قبل آخر تعديل.', category: 'الموعد' },
    { token: '{{scheduled_at_display}}', label: 'عرض وقت الموعد', description: 'اليوم + الساعة بصيغة واضحة.', category: 'الموعد' },
    { token: '{{old_scheduled_at_display}}', label: 'عرض الوقت السابق', description: 'اليوم + الساعة قبل آخر تعديل.', category: 'الموعد' },
    { token: '{{status}}', label: 'الحالة الحالية', description: 'الحالة الحالية للموعد أو العميل المحتمل.', category: 'الموعد' },
    { token: '{{old_status}}', label: 'الحالة السابقة', description: 'الحالة قبل التعديل الأخير.', category: 'الموعد' },
    { token: '{{no_show_at}}', label: 'وقت تسجيل عدم الحضور', description: 'وقت تغيير الموعد إلى عدم الحضور.', category: 'الموعد' },
    { token: '{{old_no_show_at}}', label: 'وقت عدم الحضور السابق', description: 'القيمة السابقة لوقت عدم الحضور إن وُجدت.', category: 'الموعد' },
    { token: '{{duration_minutes}}', label: 'مدة الموعد', description: 'مدة الموعد بالدقائق.', category: 'الموعد' },
    { token: '{{location}}', label: 'موقع الموعد', description: 'مكان الموعد المسجل.', category: 'الموعد' },

    { token: '{{timer_due_at}}', label: 'وقت تنفيذ القاعدة', description: 'الوقت الذي تمت فيه مطابقة شرط قبل/بعد.', category: 'التوقيت' },
    { token: '{{timer_mode}}', label: 'وضع التوقيت', description: 'نوع التوقيت: فوري / قبل / بعد.', category: 'التوقيت' },
    { token: '{{timer_value}}', label: 'قيمة التوقيت', description: 'القيمة الرقمية للتوقيت مثل 48.', category: 'التوقيت' },
    { token: '{{timer_unit}}', label: 'وحدة التوقيت', description: 'وحدة التوقيت: دقيقة أو ساعة أو يوم.', category: 'التوقيت' },
    { token: '{{timer_anchor}}', label: 'مرجع التوقيت', description: 'المرجع الذي تم القياس منه (بداية الموعد أو غيره).', category: 'التوقيت' },

    { token: '{{stage}}', label: 'المرحلة الحالية', description: 'مرحلة العميل المحتمل الحالية في البايبلاين.', category: 'العميل المحتمل' },
    { token: '{{old_stage}}', label: 'المرحلة السابقة', description: 'المرحلة قبل آخر تحديث.', category: 'العميل المحتمل' },
    { token: '{{lead_name}}', label: 'اسم العميل المحتمل', description: 'الاسم الكامل الحالي (الاسم الأول + الأخير).', category: 'العميل المحتمل' },
    { token: '{{old_lead_name}}', label: 'الاسم السابق', description: 'الاسم الكامل قبل آخر تعديل.', category: 'العميل المحتمل' },
    { token: '{{first_name}}', label: 'الاسم الأول', description: 'الاسم الأول الحالي.', category: 'العميل المحتمل' },
    { token: '{{last_name}}', label: 'اسم العائلة', description: 'اسم العائلة الحالي.', category: 'العميل المحتمل' },
    { token: '{{phone}}', label: 'الهاتف', description: 'رقم الهاتف الحالي.', category: 'العميل المحتمل' },
    { token: '{{email}}', label: 'البريد الإلكتروني', description: 'البريد الإلكتروني الحالي.', category: 'العميل المحتمل' },
    { token: '{{source}}', label: 'مصدر العميل', description: 'قناة المصدر (إعلان، ويب، ...).', category: 'العميل المحتمل' },
    { token: '{{lead_status}}', label: 'حالة العميل المحتمل', description: 'الحالة العامة للعميل المحتمل.', category: 'العميل المحتمل' },
    { token: '{{assigned_user_id}}', label: 'معّف المسؤول', description: 'ID المسؤول المعيّن للعميل.', category: 'العميل المحتمل' },
    { token: '{{user_id}}', label: 'معّف المستخدم', description: 'ID المستخدم المرتبط بالحدث.', category: 'عام' },
    { token: '{{approval_status}}', label: 'حالة الاعتماد', description: 'الحالة الحالية لإعتماد الحساب.', category: 'عام' },
    { token: '{{old_approval_status}}', label: 'حالة الاعتماد السابقة', description: 'الحالة قبل آخر تعديل.', category: 'عام' },
    { token: '{{rejection_reason}}', label: 'سبب الرفض', description: 'سبب رفض الحساب (إن وجد).', category: 'عام' },
    { token: '{{reviewer_notes}}', label: 'ملاحظات المراجع', description: 'ملاحظات المراجع على الطلب.', category: 'عام' },
    { token: '{{client_id}}', label: 'معرّف العميل', description: 'ID الخاص بالعميل/الشركة.', category: 'المعرفات' },
    { token: '{{lead_id}}', label: 'معرّف العميل المحتمل', description: 'ID الخاص بالعميل المحتمل.', category: 'المعرفات' },
    { token: '{{appointment_id}}', label: 'معرّف الموعد', description: 'ID الخاص بالموعد.', category: 'المعرفات' },
];

export const DEFAULT_AUTOMATION_EVENT = AUTOMATION_EVENT_OPTIONS[0];

export const DELAY_CAPABLE_EVENTS: NotificationEventType[] = ['appointment_start_time', 'appointment_no_show'];

export const TIMING_UNIT_LABELS: Record<AutomationTimingUnit, string> = {
    minutes: 'دقيقة',
    hours: 'ساعة',
    days: 'يوم',
};

export const TIMING_ANCHOR_LABELS: Record<AutomationTimingAnchor, string> = {
    event_time: 'وقت الحدث',
    appointment_start: 'وقت بداية الموعد',
    no_show_time: 'وقت تسجيل عدم الحضور',
};

export const ROLE_LABELS: Record<PushTargetRole, string> = {
    client: 'عميل',
    admin: 'إداري',
    super_admin: 'سوبر أدمن',
};

export const PUSH_PERMISSION_LABELS: Record<'default' | 'granted' | 'denied' | 'unsupported', string> = {
    default: 'لم يُحدد بعد',
    granted: 'مسموح',
    denied: 'مرفوض',
    unsupported: 'غير مدعوم',
};

export const getAutomationEventOption = (eventType: NotificationEventType) =>
    AUTOMATION_EVENT_OPTIONS.find((option) => option.value === eventType) ?? DEFAULT_AUTOMATION_EVENT;

export const isDelayCapableEvent = (eventType: NotificationEventType) =>
    DELAY_CAPABLE_EVENTS.includes(eventType);

export const getDefaultTimingAnchor = (eventType: NotificationEventType): AutomationTimingAnchor => {
    if (eventType === 'appointment_start_time') return 'appointment_start';
    if (eventType === 'appointment_no_show') return 'no_show_time';
    return 'event_time';
};

export const formatRolesLabel = (roles: PushTargetRole[] | null | undefined) => {
    if (!Array.isArray(roles) || roles.length === 0) return ROLE_LABELS.client;
    return roles.map((role) => ROLE_LABELS[role] ?? role).join('، ');
};

export const getMetricEventLabel = (metric: NotificationDeliveryMetric) => {
    if (metric.event_type) {
        return getAutomationEventOption(metric.event_type).label;
    }
    if (metric.source) {
        return metric.source === 'manual' ? 'حملة يدوية' : metric.source;
    }
    return 'غير محدد';
};

export const formatTimingSummary = (rule: NotificationAutomationRule) => {
    if (rule.timing_mode !== 'before' && rule.timing_mode !== 'after') {
        return 'فوري';
    }

    const value = rule.timing_value ?? 0;
    const unit = rule.timing_unit ? TIMING_UNIT_LABELS[rule.timing_unit] ?? rule.timing_unit : 'دقيقة';
    const anchor = rule.timing_anchor
        ? TIMING_ANCHOR_LABELS[rule.timing_anchor] ?? rule.timing_anchor
        : TIMING_ANCHOR_LABELS.event_time;
    const direction = rule.timing_mode === 'before' ? 'قبل' : 'بعد';

    return `${direction} ${value} ${unit} من ${anchor}`;
};
