import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TargetRole = "client" | "admin" | "super_admin";

const AUTOMATION_EVENT_DEFAULTS = {
  appointment_created: {
    title: "تمت إضافة موعد جديد",
    message: "تمت إضافة موعد جديد بتاريخ {{scheduled_at}}",
    type: "info",
    url: "/appointments",
  },
  appointment_updated: {
    title: "تم تحديث موعد",
    message: "تم تحديث الموعد. الحالة الحالية: {{status}}",
    type: "warning",
    url: "/appointments",
  },
  appointment_rescheduled: {
    title: "تمت إعادة جدولة موعد",
    message: "تم تغيير الموعد من {{old_scheduled_at}} إلى {{scheduled_at}}",
    type: "warning",
    url: "/appointments",
  },
  appointment_status_changed: {
    title: "تغيرت حالة الموعد",
    message: "تم تغيير الحالة من {{old_status}} إلى {{status}}",
    type: "warning",
    url: "/appointments",
  },
  appointment_completed: {
    title: "تم إكمال الموعد",
    message: "تم تعليم الموعد كمكتمل بتاريخ {{scheduled_at}}",
    type: "success",
    url: "/appointments",
  },
  appointment_cancelled: {
    title: "تم إلغاء الموعد",
    message: "تم إلغاء الموعد بتاريخ {{scheduled_at}}",
    type: "error",
    url: "/appointments",
  },
  appointment_no_show: {
    title: "عدم حضور للموعد",
    message: "تم تسجيل الموعد كعدم حضور بتاريخ {{scheduled_at}}",
    type: "warning",
    url: "/appointments",
  },
  appointment_start_time: {
    title: "بدأ وقت الموعد",
    message: "بدأ الآن موعد العميل {{lead_name}} في {{scheduled_at}}",
    type: "info",
    url: "/appointments",
  },
  // Legacy fixed timer events (kept for backward compatibility)
  appointment_no_show_after_48h: {
    title: "متابعة عدم الحضور بعد 48 ساعة",
    message: "مرّت 48 ساعة على حالة عدم الحضور للعميل {{lead_name}}",
    type: "warning",
    url: "/appointments",
  },
  appointment_after_1h: {
    title: "متابعة بعد الموعد بساعة",
    message: "مرّت ساعة على الموعد للعميل {{lead_name}} (الحالة: {{status}})",
    type: "info",
    url: "/appointments",
  },
  lead_created: {
    title: "تمت إضافة عميل محتمل جديد",
    message: "تمت إضافة العميل {{lead_name}}",
    type: "info",
    url: "/leads",
  },
  lead_updated: {
    title: "تم تحديث عميل محتمل",
    message: "تم تحديث بيانات العميل {{lead_name}}",
    type: "info",
    url: "/leads",
  },
  lead_status_changed: {
    title: "تغيرت حالة العميل المحتمل",
    message: "الحالة تغيرت من {{old_status}} إلى {{status}} للعميل {{lead_name}}",
    type: "warning",
    url: "/leads",
  },
  lead_stage_changed: {
    title: "تغيرت مرحلة العميل المحتمل",
    message: "المرحلة تغيرت من {{old_stage}} إلى {{stage}} للعميل {{lead_name}}",
    type: "warning",
    url: "/leads",
  },
  lead_sold: {
    title: "تم بيع عميل محتمل",
    message: "تم تحويل العميل {{lead_name}} إلى مبيع",
    type: "success",
    url: "/leads",
  },
  lead_pipeline_new: {
    title: "Pipeline: New",
    message: "العميل {{lead_name}} دخل مرحلة New",
    type: "info",
    url: "/leads",
  },
  lead_pipeline_contacting: {
    title: "Pipeline: Contacting",
    message: "العميل {{lead_name}} دخل مرحلة Contacting",
    type: "info",
    url: "/leads",
  },
  lead_pipeline_appointment_booked: {
    title: "Pipeline: Appointment Booked",
    message: "العميل {{lead_name}} دخل مرحلة Appointment Booked",
    type: "warning",
    url: "/leads",
  },
  lead_pipeline_interviewed: {
    title: "Pipeline: Interviewed",
    message: "العميل {{lead_name}} دخل مرحلة Interviewed",
    type: "warning",
    url: "/leads",
  },
  lead_pipeline_no_show: {
    title: "Pipeline: No Show",
    message: "العميل {{lead_name}} دخل مرحلة No Show",
    type: "warning",
    url: "/leads",
  },
  lead_pipeline_sold: {
    title: "Pipeline: Sold",
    message: "العميل {{lead_name}} دخل مرحلة Sold",
    type: "success",
    url: "/leads",
  },
  lead_pipeline_cancelled: {
    title: "Pipeline: Cancelled",
    message: "العميل {{lead_name}} دخل مرحلة Cancelled",
    type: "error",
    url: "/leads",
  },
} as const;

type NotificationEventType = keyof typeof AUTOMATION_EVENT_DEFAULTS;

interface SendPushNotificationRequest {
  title?: string;
  message?: string;
  type?: string;
  url?: string | null;
  target_roles?: TargetRole[];
  send_push?: boolean;
  send_in_app?: boolean;
  save_template?: boolean;
  template_name?: string;
  template_id?: string | null;
  event_type?: NotificationEventType;
  event_payload?: Record<string, any>;
  old_payload?: Record<string, any>;
  actor_user_id?: string | null;
  source?: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface NotificationAutomationRuleRow {
  id: string;
  name: string;
  event_type: NotificationEventType;
  enabled: boolean;
  notification_type: string;
  url: string | null;
  title_template: string;
  message_template: string;
  send_push: boolean;
  send_in_app: boolean;
  target_roles: TargetRole[] | null;
  only_event_client: boolean;
  client_id_filter: string | null;
  timing_mode: "immediate" | "before" | "after" | null;
  timing_value: number | null;
  timing_unit: "minutes" | "hours" | "days" | null;
  timing_anchor: "event_time" | "appointment_start" | "no_show_time" | null;
}

interface DispatchOptions {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  url: string;
  sendPush: boolean;
  sendInApp: boolean;
  actorUserId: string | null;
  source: string;
  vapidPublicKey?: string | null;
  vapidPrivateKey?: string | null;
  vapidSubject?: string | null;
}

const DEFAULT_TARGET_ROLES: TargetRole[] = ["client"];

function sanitizeText(value: string | undefined | null, fallback = ""): string {
  return (value ?? fallback).trim().replace(/\s+/g, " ");
}

function normalizeTargetRoles(value: unknown): TargetRole[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_TARGET_ROLES;

  const valid = new Set<TargetRole>();
  for (const item of value) {
    if (item === "client" || item === "admin" || item === "super_admin") {
      valid.add(item);
    }
  }

  return valid.size > 0 ? Array.from(valid) : DEFAULT_TARGET_ROLES;
}

function normalizeEventType(value: unknown): NotificationEventType | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(AUTOMATION_EVENT_DEFAULTS, value)
    ? (value as NotificationEventType)
    : null;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
}

function toDisplayDate(value: any): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined) return "-";
    return String(value);
  });
}

function buildAutomationVariables(
  eventType: NotificationEventType,
  payload: Record<string, any>,
  oldPayload: Record<string, any>
): Record<string, any> {
  const leadName = [payload.first_name, payload.last_name]
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .join(" ")
    .trim() || "-";

  const oldLeadName = [oldPayload.first_name, oldPayload.last_name]
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .join(" ")
    .trim() || "-";

  return {
    event_type: eventType,
    entity_type: eventType.startsWith("appointment_") ? "appointment" : "lead",
    appointment_id: payload.appointment_id ?? "-",
    client_id: payload.client_id ?? "-",
    lead_id: payload.lead_id ?? "-",
    first_name: payload.first_name ?? "-",
    last_name: payload.last_name ?? "-",
    lead_name: leadName,
    old_first_name: oldPayload.first_name ?? "-",
    old_last_name: oldPayload.last_name ?? "-",
    old_lead_name: oldLeadName,
    phone: payload.phone ?? "-",
    old_phone: oldPayload.phone ?? "-",
    email: payload.email ?? "-",
    old_email: oldPayload.email ?? "-",
    source: payload.source ?? "-",
    old_source: oldPayload.source ?? "-",
    lead_status: payload.lead_status ?? "-",
    old_lead_status: oldPayload.lead_status ?? "-",
    worktype: payload.worktype ?? "-",
    old_worktype: oldPayload.worktype ?? "-",
    stage: payload.stage ?? "-",
    old_stage: oldPayload.stage ?? "-",
    status: payload.status ?? "-",
    old_status: oldPayload.status ?? "-",
    scheduled_at: toDisplayDate(payload.scheduled_at),
    old_scheduled_at: toDisplayDate(oldPayload.scheduled_at),
    no_show_at: toDisplayDate(payload.no_show_at),
    old_no_show_at: toDisplayDate(oldPayload.no_show_at),
    timer_due_at: toDisplayDate(payload.timer_due_at),
    timer_mode: payload.timer_mode ?? "-",
    timer_value: payload.timer_value ?? "-",
    timer_unit: payload.timer_unit ?? "-",
    timer_anchor: payload.timer_anchor ?? "-",
    duration_minutes: payload.duration_minutes ?? "-",
    old_duration_minutes: oldPayload.duration_minutes ?? "-",
    location: payload.location ?? "-",
    old_location: oldPayload.location ?? "-",
    notes: payload.notes ?? "-",
    old_notes: oldPayload.notes ?? "-",
  };
}

function uniqueStringArray(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function resolveTargetUserIdsByRoles(supabase: any, roles: TargetRole[]): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", roles);

  if (error) {
    console.error("Failed to resolve role audience:", error);
    return [];
  }

  return uniqueStringArray((data ?? []).map((row: any) => row.user_id));
}

async function resolveRuleTargetUserIds(
  supabase: any,
  rule: NotificationAutomationRuleRow,
  eventClientId: string | null
): Promise<string[]> {
  const roles = normalizeTargetRoles(rule.target_roles ?? []);

  if (!rule.only_event_client) {
    return resolveTargetUserIdsByRoles(supabase, roles);
  }

  const targetUserIds: string[] = [];

  if (roles.includes("super_admin")) {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    targetUserIds.push(...((data ?? []).map((row: any) => row.user_id)));
  }

  if (!eventClientId) {
    return uniqueStringArray(targetUserIds);
  }

  if (roles.includes("client")) {
    const { data } = await supabase
      .from("clients")
      .select("user_id")
      .eq("id", eventClientId)
      .maybeSingle();

    if (data?.user_id) targetUserIds.push(data.user_id);
  }

  if (roles.includes("admin")) {
    const { data } = await supabase
      .from("admin_clients")
      .select("user_id")
      .eq("client_id", eventClientId);

    targetUserIds.push(...((data ?? []).map((row: any) => row.user_id)));
  }

  return uniqueStringArray(targetUserIds);
}

async function dispatchNotifications(supabase: any, options: DispatchOptions) {
  const {
    userIds,
    title,
    message,
    type,
    url,
    sendPush,
    sendInApp,
    actorUserId,
    source,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
  } = options;

  if (userIds.length === 0) {
    return {
      in_app_sent: 0,
      push_sent: 0,
      push_failed: 0,
      subscriptions_disabled: 0,
    };
  }

  let inAppSent = 0;
  if (sendInApp) {
    const notificationRows = userIds.map((userId) => ({
      user_id: userId,
      title,
      message,
      type,
      data: {
        url,
        source,
        created_by: actorUserId,
      },
    }));

    for (const batch of chunkArray(notificationRows, 500)) {
      const { error } = await supabase.from("notifications").insert(batch);
      if (error) {
        console.error("Failed to insert in-app notifications:", error);
        throw new Error("Failed to create in-app notifications");
      }
      inAppSent += batch.length;
    }
  }

  let pushSent = 0;
  let pushFailed = 0;
  let disabledSubscriptions = 0;

  if (sendPush) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("Skipping push: VAPID keys are not configured");
    } else {
      webpush.setVapidDetails(vapidSubject ?? "mailto:admin@example.com", vapidPublicKey, vapidPrivateKey);

      const { data: subscriptions, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .in("user_id", userIds)
        .eq("is_active", true);

      if (subsError) {
        console.error("Failed to fetch subscriptions:", subsError);
        throw new Error("Failed to fetch push subscriptions");
      }

      const payload = JSON.stringify({
        title,
        body: message,
        icon: "/pwa-icon.jpg",
        badge: "/pwa-icon.jpg",
        tag: `${source}-${Date.now()}`,
        data: {
          url,
          type,
        },
      });

      const staleSubscriptionIds: string[] = [];

      for (const sub of (subscriptions ?? []) as PushSubscriptionRow[]) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
          pushSent += 1;
        } catch (error: any) {
          pushFailed += 1;
          const statusCode = error?.statusCode ?? error?.status;
          if (statusCode === 404 || statusCode === 410) {
            staleSubscriptionIds.push(sub.id);
          }
          console.error("Push send error:", {
            statusCode,
            endpoint: sub.endpoint?.slice(0, 60),
            message: error?.message,
          });
        }
      }

      if (staleSubscriptionIds.length > 0) {
        const { error } = await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("id", staleSubscriptionIds);

        if (!error) {
          disabledSubscriptions = staleSubscriptionIds.length;
        }
      }
    }
  }

  return {
    in_app_sent: inAppSent,
    push_sent: pushSent,
    push_failed: pushFailed,
    subscriptions_disabled: disabledSubscriptions,
  };
}

function getDefaultEventTemplates(eventType: NotificationEventType) {
  return AUTOMATION_EVENT_DEFAULTS[eventType];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SendPushNotificationRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("WEB_PUSH_SUBJECT") ?? "mailto:admin@example.com";

    const token = authHeader.replace("Bearer ", "");
    const isInternalServiceCall = token === serviceRoleKey;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let actorUserId: string | null = body.actor_user_id ?? null;

    if (!isInternalServiceCall) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      actorUserId = userData.user.id;

      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", actorUserId)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "Forbidden: super admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const eventType = normalizeEventType(body.event_type);

    // Automation mode: called internally by DB trigger (or super admin test calls)
    if (eventType) {
      const payload = body.event_payload ?? {};
      const oldPayload = body.old_payload ?? {};
      const source = sanitizeText(body.source, "automation_rule");
      const automationRuleId =
        typeof payload.automation_rule_id === "string" && payload.automation_rule_id.length > 0
          ? payload.automation_rule_id
          : null;

      let rulesQuery = supabase
        .from("notification_automation_rules")
        .select("*")
        .eq("enabled", true);

      if (automationRuleId) {
        rulesQuery = rulesQuery.eq("id", automationRuleId);
      } else {
        rulesQuery = rulesQuery
          .eq("event_type", eventType)
          .eq("timing_mode", "immediate");
      }

      const { data: rules, error: rulesError } = await rulesQuery;

      if (rulesError) {
        console.error("Failed to load automation rules:", rulesError);
        throw new Error("Failed to load automation rules");
      }

      let rulesTriggered = 0;
      let totalTargets = 0;
      let totalInApp = 0;
      let totalPushSent = 0;
      let totalPushFailed = 0;
      let totalDisabledSubs = 0;

      for (const rule of (rules ?? []) as NotificationAutomationRuleRow[]) {
        if (rule.event_type !== eventType) {
          continue;
        }

        if (rule.client_id_filter && payload.client_id !== rule.client_id_filter) {
          continue;
        }

        const defaults = getDefaultEventTemplates(eventType);
        const variables = buildAutomationVariables(eventType, payload, oldPayload);

        const title = renderTemplate(
          sanitizeText(rule.title_template, defaults.title),
          variables
        );

        const message = renderTemplate(
          sanitizeText(rule.message_template, defaults.message),
          variables
        );

        const type = sanitizeText(rule.notification_type, defaults.type).slice(0, 40) || defaults.type;
        const url = sanitizeText(rule.url, defaults.url) || defaults.url;

        const targetUserIds = await resolveRuleTargetUserIds(
          supabase,
          rule,
          payload.client_id ?? null
        );

        if (targetUserIds.length === 0) {
          continue;
        }

        rulesTriggered += 1;
        totalTargets += targetUserIds.length;

        const dispatch = await dispatchNotifications(supabase, {
          userIds: targetUserIds,
          title,
          message,
          type,
          url,
          sendPush: rule.send_push,
          sendInApp: rule.send_in_app,
          actorUserId,
          source,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject,
        });

        totalInApp += dispatch.in_app_sent;
        totalPushSent += dispatch.push_sent;
        totalPushFailed += dispatch.push_failed;
        totalDisabledSubs += dispatch.subscriptions_disabled;
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "automation",
          summary: {
            rules_evaluated: (rules ?? []).length,
            rules_triggered: rulesTriggered,
            targets: totalTargets,
            in_app_sent: totalInApp,
            push_sent: totalPushSent,
            push_failed: totalPushFailed,
            subscriptions_disabled: totalDisabledSubs,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual campaign mode (super admin from settings)
    const targetRoles = normalizeTargetRoles(body.target_roles);

    let title = sanitizeText(body.title);
    let message = sanitizeText(body.message);
    let type = sanitizeText(body.type, "info").slice(0, 40) || "info";
    let url = sanitizeText(body.url ?? "");

    if (body.template_id) {
      const { data: template, error: templateError } = await supabase
        .from("notification_templates")
        .select("name, title, message, type, url, target_roles")
        .eq("id", body.template_id)
        .single();

      if (templateError || !template) {
        return new Response(
          JSON.stringify({ error: "Template not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      title = sanitizeText(template.title);
      message = sanitizeText(template.message);
      type = sanitizeText(template.type, "info").slice(0, 40) || "info";
      url = sanitizeText(template.url ?? "");
    }

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendPush = body.send_push !== false;
    const sendInApp = body.send_in_app !== false;
    const normalizedUrl = url || "/notifications";

    const targetUserIds = await resolveTargetUserIdsByRoles(supabase, targetRoles);

    const dispatch = await dispatchNotifications(supabase, {
      userIds: targetUserIds,
      title,
      message,
      type,
      url: normalizedUrl,
      sendPush,
      sendInApp,
      actorUserId,
      source: "manual_campaign",
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject,
    });

    let templateId: string | null = null;
    if (body.save_template) {
      const templateName = sanitizeText(body.template_name, title).slice(0, 120) || `Template ${new Date().toISOString()}`;
      const { data: template, error: templateError } = await supabase
        .from("notification_templates")
        .insert({
          name: templateName,
          title,
          message,
          type,
          url: normalizedUrl,
          target_roles: targetRoles,
          created_by: actorUserId,
        })
        .select("id")
        .single();

      if (templateError) {
        console.error("Template save error:", templateError);
      } else {
        templateId = template.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "manual",
        summary: {
          targets: targetUserIds.length,
          in_app_sent: dispatch.in_app_sent,
          push_sent: dispatch.push_sent,
          push_failed: dispatch.push_failed,
          subscriptions_disabled: dispatch.subscriptions_disabled,
        },
        template_id: templateId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-push-notification error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
