import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  createRequestContext,
  ensureOriginAllowed,
  jsonResponse,
  logWithContext,
  preflightResponse,
} from "../_shared/observability.ts";
import { consumeDurableRateLimit, getRequestIp } from "../_shared/rateLimit.ts";
import { formatZodError } from "../_shared/validation.ts";

interface PublicBookingPayload {
  share_token: string;
  booking_type_id: string;
  scheduled_at: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

const publicBookingPayloadSchema = z.object({
  share_token: z.string().trim().min(1).max(80),
  booking_type_id: z.string().trim().min(1).max(80),
  scheduled_at: z.string().trim().min(1).max(80),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(1).max(30),
  email: z
    .union([
      z.string().trim().email().max(120),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  notes: z
    .union([
      z.string().trim().max(1000),
      z.literal(""),
      z.null(),
    ])
    .optional(),
});

interface AvailabilityRuleRow {
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_available: boolean;
  specific_date: string | null;
}

interface AppointmentRow {
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
}

interface ExistingLeadRow {
  id: string;
  source: string | null;
  notes: string | null;
  status: string | null;
}

const ARABIC_DAY_NAMES = ["ط§ظ„ط£ط­ط¯", "ط§ظ„ط¥ط«ظ†ظٹظ†", "ط§ظ„ط«ظ„ط§ط«ط§ط،", "ط§ظ„ط£ط±ط¨ط¹ط§ط،", "ط§ظ„ط®ظ…ظٹط³", "ط§ظ„ط¬ظ…ط¹ط©", "ط§ظ„ط³ط¨طھ"];
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function safeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)));
}

function formatPhoneNumber(phone: string): string {
  let formatted = normalizeDigits(phone).replace(/[\s\-()]/g, "");

  if (formatted.startsWith("+")) {
    formatted = "00" + formatted.slice(1);
  }

  if (formatted.startsWith("0") && !formatted.startsWith("00")) {
    formatted = "00218" + formatted.slice(1);
  }

  if (!formatted.startsWith("00")) {
    formatted = "00218" + formatted;
  }

  return formatted;
}

function isValidFormattedPhone(phone: string): boolean {
  return /^00\d{8,15}$/.test(phone);
}

function buildPhoneCandidates(phone: string): string[] {
  const raw = normalizeDigits(phone).replace(/[\s\-()]/g, "");
  if (!raw) return [];

  const formatted = formatPhoneNumber(raw);
  const candidates = new Set<string>([raw, formatted]);

  if (formatted.startsWith("00")) {
    candidates.add(`+${formatted.slice(2)}`);
  }

  if (formatted.startsWith("00218")) {
    candidates.add(`0${formatted.slice(5)}`);
    candidates.add(formatted.slice(2));
  }

  return Array.from(candidates).filter(Boolean);
}

function mergeNotes(existingNotes: string | null, incomingNotes: string | null, maxLength: number) {
  const oldText = safeString(existingNotes ?? "", maxLength);
  const newText = safeString(incomingNotes ?? "", maxLength);
  if (!newText) return oldText || null;
  if (!oldText) return newText;
  if (oldText.includes(newText)) return oldText;
  return `${oldText}\n${newText}`.slice(0, maxLength);
}

function toLocalParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";

  const weekday = WEEKDAY_INDEX[get("weekday")] ?? date.getUTCDay();
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");

  return {
    weekday,
    year,
    month,
    day,
    hour,
    minute,
    dateKey: `${year}-${month}-${day}`,
    dateYmd: `${year}/${month}/${day}`,
    timeHm: `${hour}:${minute}`,
  };
}

function timeToMinutes(value: string) {
  const [h = "0", m = "0"] = String(value).split(":");
  return Number(h) * 60 + Number(m);
}

async function findExistingLead(input: {
  supabase: ReturnType<typeof createClient>;
  clientId: string;
  phone: string;
  email: string | null;
}) {
  const { supabase, clientId, phone, email } = input;

  const phoneCandidates = buildPhoneCandidates(phone);
  if (phoneCandidates.length > 0) {
    const { data: byPhone, error: byPhoneError } = await supabase
      .from("leads")
      .select("id, source, notes, status")
      .eq("client_id", clientId)
      .in("phone", phoneCandidates)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (byPhoneError) {
      throw byPhoneError;
    }

    if (byPhone && byPhone.length > 0) {
      return byPhone[0] as ExistingLeadRow;
    }
  }

  if (!email) {
    return null;
  }

  const { data: byEmail, error: byEmailError } = await supabase
    .from("leads")
    .select("id, source, notes, status")
    .eq("client_id", clientId)
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (byEmailError) {
    throw byEmailError;
  }

  return byEmail && byEmail.length > 0 ? (byEmail[0] as ExistingLeadRow) : null;
}

async function sendConfirmationSms(input: {
  supabase: ReturnType<typeof createClient>;
  ersaalApiKey: string | undefined;
  phone: string;
  leadId: string;
  sentBy: string | null;
  companyName: string;
  leadFirstName: string;
  leadLastName: string;
  appointmentDate: Date;
  appointmentLocation: string;
  clientPhone: string;
  timezone: string;
}) {
  const {
    supabase,
    ersaalApiKey,
    phone,
    leadId,
    sentBy,
    companyName,
    leadFirstName,
    leadLastName,
    appointmentDate,
    appointmentLocation,
    clientPhone,
    timezone,
  } = input;

  if (!ersaalApiKey || !phone) {
    return { sent: false };
  }

  const localParts = toLocalParts(appointmentDate, timezone);
  const formattedPhone = formatPhoneNumber(phone);
  const leadFullName = `${leadFirstName} ${leadLastName}`.trim();

  const params = [
    { company_name: (companyName || "ط§ظ„ط´ط±ظƒط©").slice(0, 10) },
    { lead_first_name: leadFirstName || "ط§ظ„ط¹ظ…ظٹظ„" },
    { lead_last_name: leadLastName || "" },
    { lead_full_name: leadFullName || "ط§ظ„ط¹ظ…ظٹظ„" },
    { appointment_date: localParts.dateYmd },
    { appointment_time: localParts.timeHm },
    { appointment_day: ARABIC_DAY_NAMES[localParts.weekday] || "ط§ظ„ظ…ظˆط¹ط¯" },
    { appointment_hour: localParts.timeHm },
    { appointment_location: appointmentLocation || "ط³ظٹطھظ… طھط²ظˆظٹط¯ظƒ ط¨ط§ظ„ظ…ظˆظ‚ط¹ ظ„ط§ط­ظ‚ط§ظ‹" },
    { c_number: clientPhone || "" },
    { c_phone: clientPhone || "" },
  ];

  let smsLogId: string | null = null;
  if (sentBy) {
    const { data: smsLog } = await supabase
      .from("sms_logs")
      .insert({
        lead_id: leadId,
        sent_by: sentBy,
        phone_number: formattedPhone,
        message: "[template: appointment-confirmed][public_calendar]",
        status: "pending",
      })
      .select("id")
      .single();

    smsLogId = smsLog?.id || null;
  }

  const smsPayload = {
    template_id: "appointment-confirmed",
    sender: "17271",
    receiver: formattedPhone,
    payment_type: "subscription",
    params,
  };

  let responseBody: Record<string, unknown> = {};
  let responseStatus = 0;
  try {
    const smsResponse = await fetch("https://sms.lamah.com/api/sms/messages/template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${ersaalApiKey}`,
      },
      body: JSON.stringify(smsPayload),
    });

    responseStatus = smsResponse.status;
    const raw = await smsResponse.text();
    try {
      responseBody = JSON.parse(raw);
    } catch {
      responseBody = { raw };
    }
  } catch (error) {
    responseBody = { error: String(error) };
  }

  const sent = Boolean(responseBody.message_id);

  if (smsLogId) {
    await supabase
      .from("sms_logs")
      .update({
        status: sent ? "sent" : "failed",
        sent_at: sent ? new Date().toISOString() : null,
        error_message: sent
          ? null
          : `HTTP ${responseStatus || 500}: ${String(responseBody.error || responseBody.message || "failed")}`.slice(0, 1000),
      })
      .eq("id", smsLogId);
  }

  return { sent };
}

serve(async (req) => {
  const context = createRequestContext(req);
  const send = (body: Record<string, unknown>, status = 200) => jsonResponse(body, context, status);
  const originError = ensureOriginAllowed(context);
  if (originError) return originError;

  if (req.method === "OPTIONS") {
    return preflightResponse(context);
  }

  if (req.method !== "POST") {
    return send({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return send({ success: false, error: "ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط®ط§ط¯ظ… ط؛ظٹط± ظ…ظƒطھظ…ظ„ط©" }, 500);
    }

    const ersaalApiKey = Deno.env.get("ERSAAL_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      return send({ success: false, error: "Invalid request payload." }, 400);
    }

    const parsedPayload = publicBookingPayloadSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      return send({ success: false, error: formatZodError(parsedPayload.error) }, 400);
    }

    const payload: PublicBookingPayload = parsedPayload.data;

    const shareToken = safeString(payload.share_token, 80);
    const bookingTypeId = safeString(payload.booking_type_id, 80);
    const firstName = safeString(payload.first_name, 80);
    const lastName = safeString(payload.last_name, 80);
    const phone = safeString(payload.phone, 30);
    const email = safeString(payload.email ?? "", 120).toLowerCase() || null;
    const notes = safeString(payload.notes ?? "", 1000) || null;
    const normalizedPhone = formatPhoneNumber(phone);

    if (!shareToken || !bookingTypeId || !firstName || !lastName || !phone || !payload.scheduled_at) {
      return send({ success: false, error: "Missing required fields." }, 400);
    }

    const requestIp = getRequestIp(req);
    const isRateAllowed = await consumeDurableRateLimit({
      supabase,
      bucketKey: `public-calendar-booking:${shareToken}:${requestIp}`,
      limit: 8,
      windowSeconds: 60,
    });

    if (!isRateAllowed) {
      return send({ success: false, error: "Too many booking attempts. Please retry in a minute." }, 429);
    }

    if (!isValidFormattedPhone(normalizedPhone)) {
      return send({ success: false, error: "ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ ط؛ظٹط± طµط§ظ„ط­" }, 400);
    }

    const scheduledAt = new Date(payload.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      return send({ success: false, error: "ظˆظ‚طھ ط§ظ„ظ…ظˆط¹ط¯ ط؛ظٹط± طµط§ظ„ط­" }, 400);
    }

    if (scheduledAt.getTime() <= Date.now()) {
      return send({ success: false, error: "ظ„ط§ ظٹظ…ظƒظ† ط§ظ„ط­ط¬ط² ظپظٹ ظˆظ‚طھ ط³ط§ط¨ظ‚" }, 400);
    }

    const { data: config, error: configError } = await supabase
      .from("calendar_configs")
      .select(`
        id,
        client_id,
        timezone,
        buffer_minutes,
        custom_location,
        company_name,
        calendar_title,
        clients!inner (
          id,
          user_id,
          company_name,
          phone
        )
      `)
      .eq("share_token", shareToken)
      .eq("is_public", true)
      .single();

    if (configError || !config) {
      return send({ success: false, error: "ط±ط§ط¨ط· ط§ظ„ط­ط¬ط² ط؛ظٹط± طµط§ظ„ط­ ط£ظˆ ط؛ظٹط± ظ…طھط§ط­" }, 404);
    }

    const client = Array.isArray(config.clients) ? config.clients[0] : config.clients;
    if (!client?.id) {
      return send({ success: false, error: "طھط¹ط°ط± ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط³ط§ط¨" }, 404);
    }

    const { data: bookingType, error: bookingTypeError } = await supabase
      .from("booking_types")
      .select("id, calendar_config_id, duration_minutes, is_active")
      .eq("id", bookingTypeId)
      .eq("calendar_config_id", config.id)
      .eq("is_active", true)
      .single();

    if (bookingTypeError || !bookingType) {
      return send({ success: false, error: "ظ†ظˆط¹ ط§ظ„ظ…ظˆط¹ط¯ ط؛ظٹط± ظ…طھط§ط­" }, 400);
    }

    const timezone = config.timezone || "Africa/Tripoli";
    const durationMinutes = Number(bookingType.duration_minutes) > 0 ? Number(bookingType.duration_minutes) : 30;
    const bufferMinutes = Number(config.buffer_minutes) > 0 ? Number(config.buffer_minutes) : 15;
    const slotEndAt = new Date(scheduledAt.getTime() + durationMinutes * 60000);

    const { data: availabilityRules, error: availabilityError } = await supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, is_available, specific_date")
      .eq("calendar_config_id", config.id);

    if (availabilityError) {
      logWithContext("error", context, "Availability query error", availabilityError);
      return send({ success: false, error: "طھط¹ط°ط± ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط§ظ„طھظˆظپط± ط§ظ„ط¢ظ†" }, 500);
    }

    const startParts = toLocalParts(scheduledAt, timezone);
    const endParts = toLocalParts(slotEndAt, timezone);
    const startMinutes = Number(startParts.hour) * 60 + Number(startParts.minute);
    const endMinutes = Number(endParts.hour) * 60 + Number(endParts.minute);
    const sameLocalDate = startParts.dateKey === endParts.dateKey;
    const dateSpecificRules = (availabilityRules || []).filter(
      (rule: AvailabilityRuleRow) => String(rule.specific_date || "") === startParts.dateKey,
    );
    const effectiveRules = (
      dateSpecificRules.length > 0
        ? dateSpecificRules.filter((rule: AvailabilityRuleRow) => rule.is_available)
        : (availabilityRules || []).filter(
          (rule: AvailabilityRuleRow) =>
            !rule.specific_date && rule.is_available && Number(rule.day_of_week) === startParts.weekday,
        )
    );

    const hasAvailability = sameLocalDate && effectiveRules.some((rule: AvailabilityRuleRow) => {
      const ruleStart = timeToMinutes(rule.start_time);
      const ruleEnd = timeToMinutes(rule.end_time);
      return startMinutes >= ruleStart && endMinutes <= ruleEnd;
    });

    const isSlotOnGrid = sameLocalDate && effectiveRules.some((rule: AvailabilityRuleRow) => {
      const ruleStart = timeToMinutes(rule.start_time);
      const ruleEnd = timeToMinutes(rule.end_time);
      const insideRule = startMinutes >= ruleStart && endMinutes <= ruleEnd;
      if (!insideRule) return false;
      return (startMinutes - ruleStart) % durationMinutes === 0;
    });

    if (!hasAvailability) {
      return send({ success: false, error: "ظ‡ط°ط§ ط§ظ„ظˆظ‚طھ ط®ط§ط±ط¬ ط³ط§ط¹ط§طھ ط§ظ„ط­ط¬ط² ط§ظ„ظ…طھط§ط­ط©" }, 409);
    }

    if (!isSlotOnGrid) {
      return send({ success: false, error: "ظˆظ‚طھ ط§ظ„ظ…ظˆط¹ط¯ ط؛ظٹط± ظ…ط·ط§ط¨ظ‚ ظ„ظ„ظپطھط±ط§طھ ط§ظ„ظ…طھط§ط­ط©" }, 409);
    }

    const lockExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const { data: lock, error: lockError } = await supabase
      .from("booking_slot_locks")
      .insert({
        calendar_config_id: config.id,
        scheduled_at: scheduledAt.toISOString(),
        expires_at: lockExpiresAt.toISOString(),
      })
      .select("lock_token")
      .single();

    if (lockError || !lock?.lock_token) {
      return send({ success: false, error: "طھط¹ط°ط± طھط«ط¨ظٹطھ ط§ظ„ظ…ظˆط¹ط¯طŒ ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰" }, 409);
    }

    const lockToken = lock.lock_token;

    try {
      const { data: activeLocks } = await supabase
        .from("booking_slot_locks")
        .select("id")
        .eq("calendar_config_id", config.id)
        .eq("scheduled_at", scheduledAt.toISOString())
        .gte("expires_at", new Date().toISOString())
        .neq("lock_token", lockToken);

      if ((activeLocks || []).length > 0) {
        return send({ success: false, error: "ظ‡ط°ط§ ط§ظ„ظˆظ‚طھ طھظ… ط­ط¬ط²ظ‡ ط§ظ„ط¢ظ†طŒ ط§ط®طھط± ظˆظ‚طھط§ظ‹ ط¢ط®ط±" }, 409);
      }

      const searchStart = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
      const searchEnd = new Date(slotEndAt.getTime() + 24 * 60 * 60 * 1000);

      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("scheduled_at, duration_minutes, status")
        .eq("client_id", config.client_id)
        .neq("status", "cancelled")
        .gte("scheduled_at", searchStart.toISOString())
        .lte("scheduled_at", searchEnd.toISOString());

      if (appointmentsError) {
        logWithContext("error", context, "Appointments query error", appointmentsError);
        return send({ success: false, error: "طھط¹ط°ط± ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط§ظ„ظ…ظˆط§ط¹ظٹط¯ ط§ظ„ط¢ظ†" }, 500);
      }

      const hasConflict = (appointments || []).some((appointment: AppointmentRow) => {
        const appointmentStart = new Date(appointment.scheduled_at);
        const appointmentEnd = new Date(
          appointmentStart.getTime() + (Number(appointment.duration_minutes || 30) + bufferMinutes) * 60000,
        );
        return scheduledAt < appointmentEnd && slotEndAt > appointmentStart;
      });

      if (hasConflict) {
        return send({ success: false, error: "ظ‡ط°ط§ ط§ظ„ظˆظ‚طھ ظ„ظ… ظٹط¹ط¯ ظ…طھط§ط­ط§ظ‹طŒ ط§ط®طھط± ظˆظ‚طھط§ظ‹ ط¢ط®ط±" }, 409);
      }

      let existingLead: ExistingLeadRow | null = null;
      try {
        existingLead = await findExistingLead({
          supabase,
          clientId: config.client_id,
          phone: normalizedPhone,
          email,
        });
      } catch (leadLookupError) {
        logWithContext("error", context, "Lead lookup error", leadLookupError);
        return send({ success: false, error: "طھط¹ط°ط± ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظ…ظٹظ„" }, 500);
      }

      let leadId = existingLead?.id ?? null;
      let createdLeadId: string | null = null;

      if (!leadId) {
        const { data: createdLead, error: leadInsertError } = await supabase
          .from("leads")
          .insert({
            client_id: config.client_id,
            first_name: firstName,
            last_name: lastName,
            phone: normalizedPhone,
            email,
            status: "appointment_booked",
            notes,
            source: "public_calendar",
          })
          .select("id")
          .single();

        if (leadInsertError || !createdLead?.id) {
          logWithContext("error", context, "Lead insert error", leadInsertError);
          return send({ success: false, error: "طھط¹ط°ط± ط¥ظ†ط´ط§ط، ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط¬ط²" }, 500);
        }

        leadId = createdLead.id;
        createdLeadId = createdLead.id;
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          lead_id: leadId,
          client_id: config.client_id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: durationMinutes,
          status: "scheduled",
          notes,
          location: config.custom_location || null,
        })
        .select("id, scheduled_at")
        .single();

      if (appointmentError || !appointment?.id) {
        logWithContext("error", context, "Appointment insert error", appointmentError);

        if (createdLeadId) {
          await supabase.from("leads").delete().eq("id", createdLeadId);
        }

        return send({ success: false, error: "طھط¹ط°ط± طھط«ط¨ظٹطھ ط§ظ„ظ…ظˆط¹ط¯ ظپظٹ ط§ظ„ظ†ط¸ط§ظ…" }, 500);
      }

      if (existingLead?.id) {
        const mergedNotes = mergeNotes(existingLead.notes, notes, 1000);
        const leadUpdatePayload: Record<string, unknown> = {
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          status: existingLead.status === "sold" ? "sold" : "appointment_booked",
          source: existingLead.source || "public_calendar",
          notes: mergedNotes,
        };

        if (email) {
          leadUpdatePayload.email = email;
        }

        const { error: leadUpdateError } = await supabase
          .from("leads")
          .update(leadUpdatePayload)
          .eq("id", existingLead.id);

        if (leadUpdateError) {
          logWithContext("error", context, "Lead update after booking failed", leadUpdateError);
        }
      }

      const smsResult = await sendConfirmationSms({
        supabase,
        ersaalApiKey,
        phone: normalizedPhone,
        leadId,
        sentBy: client.user_id || null,
        companyName: config.company_name || client.company_name || "ط§ظ„ط´ط±ظƒط©",
        leadFirstName: firstName,
        leadLastName: lastName,
        appointmentDate: new Date(appointment.scheduled_at),
        appointmentLocation: config.custom_location || "",
        clientPhone: client.phone || "",
        timezone,
      });

      return send({
        success: true,
        lead_id: leadId,
        appointment_id: appointment.id,
        confirmation_number: `BK-${String(appointment.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        sms_sent: smsResult.sent,
      });
    } finally {
      await supabase
        .from("booking_slot_locks")
        .delete()
        .eq("calendar_config_id", config.id)
        .eq("lock_token", lockToken);
    }
  } catch (error: unknown) {
    logWithContext("error", context, "public-calendar-booking error", error);
    return send({ success: false, error: "ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹ ط£ط«ظ†ط§ط، ط¥طھظ…ط§ظ… ط§ظ„ط­ط¬ط²" }, 500);
  }
});


