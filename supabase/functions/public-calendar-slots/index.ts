import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PublicSlotsPayload {
  share_token: string;
  date_key: string;
  booking_type_id: string;
  timezone_offset_minutes?: number;
}

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
}

interface SlotLockRow {
  scheduled_at: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

function normalizeOffsetMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < -840) return -840;
  if (parsed > 840) return 840;
  return Math.round(parsed);
}

function parseTimeParts(timeValue: string): { hours: number; minutes: number } {
  const [hoursRaw = "0", minutesRaw = "0"] = String(timeValue).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

function dateTimeToUtc(dateKey: string, timeValue: string, timezoneOffsetMinutes: number): Date {
  const parsedDate = parseDateKey(dateKey);
  if (!parsedDate) return new Date(NaN);
  const { hours, minutes } = parseTimeParts(timeValue);
  const utcMs = Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    hours,
    minutes,
    0,
    0,
  ) + timezoneOffsetMinutes * 60_000;
  return new Date(utcMs);
}

function getDayOfWeek(dateKey: string): number {
  const parsedDate = parseDateKey(dateKey);
  if (!parsedDate) return -1;
  return new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Server configuration is missing." }, 500);
    }

    const payload: PublicSlotsPayload = await req.json();
    const shareToken = safeString(payload.share_token, 80);
    const bookingTypeId = safeString(payload.booking_type_id, 80);
    const dateKey = safeString(payload.date_key, 10);
    const timezoneOffsetMinutes = normalizeOffsetMinutes(payload.timezone_offset_minutes);

    if (!shareToken || !bookingTypeId || !dateKey) {
      return jsonResponse({ success: false, error: "Missing required fields." }, 400);
    }

    if (!parseDateKey(dateKey)) {
      return jsonResponse({ success: false, error: "Invalid date format." }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await supabase
      .from("calendar_configs")
      .select("id, client_id, buffer_minutes")
      .eq("share_token", shareToken)
      .eq("is_public", true)
      .single();

    if (configError || !config) {
      return jsonResponse({ success: false, error: "Calendar not found or unpublished." }, 404);
    }

    const { data: bookingType, error: bookingTypeError } = await supabase
      .from("booking_types")
      .select("id, duration_minutes, is_active")
      .eq("id", bookingTypeId)
      .eq("calendar_config_id", config.id)
      .eq("is_active", true)
      .single();

    if (bookingTypeError || !bookingType) {
      return jsonResponse({ success: false, error: "Booking type not found." }, 400);
    }

    const durationMinutes = Math.max(5, Math.min(240, Number(bookingType.duration_minutes) || 30));
    const bufferMinutes = Math.max(0, Math.min(240, Number(config.buffer_minutes) || 15));

    const { data: availability, error: availabilityError } = await supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time, is_available, specific_date")
      .eq("calendar_config_id", config.id);

    if (availabilityError) {
      console.error("Availability query error:", availabilityError);
      return jsonResponse({ success: false, error: "Failed to load availability." }, 500);
    }

    const dayStart = dateTimeToUtc(dateKey, "00:00", timezoneOffsetMinutes);
    const dayEnd = dateTimeToUtc(dateKey, "23:59", timezoneOffsetMinutes);
    const searchStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    const searchEnd = new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000);

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_minutes")
      .eq("client_id", config.client_id)
      .neq("status", "cancelled")
      .gte("scheduled_at", searchStart.toISOString())
      .lte("scheduled_at", searchEnd.toISOString());

    if (appointmentsError) {
      console.error("Appointments query error:", appointmentsError);
      return jsonResponse({ success: false, error: "Failed to load booked slots." }, 500);
    }

    const { data: locks, error: locksError } = await supabase
      .from("booking_slot_locks")
      .select("scheduled_at")
      .eq("calendar_config_id", config.id)
      .gte("expires_at", new Date().toISOString());

    if (locksError) {
      console.error("Locks query error:", locksError);
      return jsonResponse({ success: false, error: "Failed to load slot locks." }, 500);
    }

    const dayOfWeek = getDayOfWeek(dateKey);
    const specificRules = (availability || []).filter(
      (rule: AvailabilityRuleRow) => String(rule.specific_date || "") === dateKey,
    );
    const dayRules = (
      specificRules.length > 0
        ? specificRules.filter((rule: AvailabilityRuleRow) => rule.is_available)
        : (availability || []).filter(
          (rule: AvailabilityRuleRow) =>
            !rule.specific_date &&
            rule.is_available &&
            Number(rule.day_of_week) === dayOfWeek,
        )
    ).sort((a: AvailabilityRuleRow, b: AvailabilityRuleRow) => {
      const aStart = parseTimeParts(a.start_time);
      const bStart = parseTimeParts(b.start_time);
      return aStart.hours * 60 + aStart.minutes - (bStart.hours * 60 + bStart.minutes);
    });

    const now = Date.now();
    const slots: { start_at: string; end_at: string }[] = [];
    const seen = new Set<number>();

    for (const rule of dayRules) {
      let slotStart = dateTimeToUtc(dateKey, rule.start_time, timezoneOffsetMinutes);
      const slotBoundary = dateTimeToUtc(dateKey, rule.end_time, timezoneOffsetMinutes);

      while (slotStart < slotBoundary) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
        if (slotEnd <= slotBoundary) {
          const isTaken = (appointments || []).some((appointment: AppointmentRow) => {
            const appointmentStart = new Date(appointment.scheduled_at);
            const appointmentDuration = Number(appointment.duration_minutes || durationMinutes);
            const appointmentEnd = new Date(
              appointmentStart.getTime() + (appointmentDuration + bufferMinutes) * 60_000,
            );
            return slotStart < appointmentEnd && slotEnd > appointmentStart;
          });

          const isLocked = (locks || []).some((lock: SlotLockRow) => {
            const lockStart = new Date(lock.scheduled_at);
            return lockStart.getTime() === slotStart.getTime();
          });

          const slotTimestamp = slotStart.getTime();
          if (!isTaken && !isLocked && slotTimestamp > now && !seen.has(slotTimestamp)) {
            seen.add(slotTimestamp);
            slots.push({
              start_at: new Date(slotTimestamp).toISOString(),
              end_at: new Date(slotEnd.getTime()).toISOString(),
            });
          }
        }

        slotStart = new Date(slotStart.getTime() + durationMinutes * 60_000);
      }
    }

    slots.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    return jsonResponse({ success: true, slots });
  } catch (error) {
    console.error("public-calendar-slots error:", error);
    return jsonResponse({ success: false, error: "Unexpected server error." }, 500);
  }
});
