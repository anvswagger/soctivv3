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

interface PublicCalendarAnalyticsPayload {
  share_token: string;
  event_type: string;
  event_name?: string | null;
  booking_type_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

const publicAnalyticsPayloadSchema = z.object({
  share_token: z.string().trim().min(1).max(80),
  event_type: z.string().trim().min(1).max(80),
  event_name: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
  booking_type_id: z.union([z.string().trim().max(80), z.literal(""), z.null()]).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

function safeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const entries = Object.entries(input).slice(0, 20);

  for (const [key, raw] of entries) {
    if (!key) continue;
    const safeKey = key.slice(0, 50);

    if (typeof raw === "string") {
      output[safeKey] = raw.slice(0, 300);
      continue;
    }

    if (typeof raw === "number" || typeof raw === "boolean" || raw === null) {
      output[safeKey] = raw;
      continue;
    }

    if (Array.isArray(raw)) {
      output[safeKey] = raw.slice(0, 15).map((item) => (typeof item === "string" ? item.slice(0, 120) : item));
      continue;
    }

    output[safeKey] = "[object]";
  }

  return Object.keys(output).length > 0 ? output : null;
}

serve(async (req) => {
  const context = createRequestContext(req);
  const originError = ensureOriginAllowed(context);
  if (originError) return originError;

  if (req.method === "OPTIONS") {
    return preflightResponse(context);
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, context, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Server configuration is missing." }, context, 500);
    }

    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid request payload." }, context, 400);
    }

    const parsedPayload = publicAnalyticsPayloadSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      return jsonResponse({ success: false, error: formatZodError(parsedPayload.error) }, context, 400);
    }

    const payload: PublicCalendarAnalyticsPayload = parsedPayload.data;
    const shareToken = safeString(payload.share_token, 80);
    const eventType = safeString(payload.event_type, 80);
    const eventName = safeString(payload.event_name, 120) || null;
    const bookingTypeId = safeString(payload.booking_type_id, 80) || null;
    const metadata = sanitizeMetadata(payload.metadata);

    if (!shareToken || !eventType) {
      return jsonResponse({ success: false, error: "Missing required fields." }, context, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestIp = getRequestIp(req);
    const isRateAllowed = await consumeDurableRateLimit({
      supabase,
      bucketKey: `public-calendar-analytics:${shareToken}:${requestIp}`,
      limit: 120,
      windowSeconds: 60,
    });
    if (!isRateAllowed) {
      return jsonResponse({ success: false, error: "Too many analytics events." }, context, 429);
    }

    const { data: config, error: configError } = await supabase
      .from("calendar_configs")
      .select("id, client_id")
      .eq("share_token", shareToken)
      .eq("is_public", true)
      .single();

    if (configError || !config?.client_id) {
      return jsonResponse({ success: false, error: "Calendar not found or unpublished." }, context, 404);
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, user_id")
      .eq("id", config.client_id)
      .single();

    if (clientError || !client?.user_id) {
      return jsonResponse({ success: false, error: "Client context not found." }, context, 404);
    }

    const mergedMetadata: Record<string, unknown> = {
      source: "public_calendar",
      ...(metadata || {}),
    };
    if (bookingTypeId) {
      mergedMetadata.booking_type_id = bookingTypeId;
    }

    const { error: insertError } = await supabase
      .from("analytics_events")
      .insert({
        user_id: client.user_id,
        client_id: client.id,
        event_type: eventType,
        event_name: eventName,
        metadata: mergedMetadata,
      });

    if (insertError) {
      logWithContext("error", context, "Analytics insert error", insertError);
      return jsonResponse({ success: false, error: "Failed to persist analytics event." }, context, 500);
    }

    return jsonResponse({ success: true }, context);
  } catch (error) {
    logWithContext("error", context, "public-calendar-analytics error", error);
    return jsonResponse({ success: false, error: "Unexpected server error." }, context, 500);
  }
});
