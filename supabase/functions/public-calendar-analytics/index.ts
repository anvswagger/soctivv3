import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PublicCalendarAnalyticsPayload {
  share_token: string;
  event_type: string;
  event_name?: string | null;
  booking_type_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Server configuration is missing." }, 500);
    }

    const payload: PublicCalendarAnalyticsPayload = await req.json();
    const shareToken = safeString(payload.share_token, 80);
    const eventType = safeString(payload.event_type, 80);
    const eventName = safeString(payload.event_name, 120) || null;
    const bookingTypeId = safeString(payload.booking_type_id, 80) || null;
    const metadata = sanitizeMetadata(payload.metadata);

    if (!shareToken || !eventType) {
      return jsonResponse({ success: false, error: "Missing required fields." }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await supabase
      .from("calendar_configs")
      .select("id, client_id")
      .eq("share_token", shareToken)
      .eq("is_public", true)
      .single();

    if (configError || !config?.client_id) {
      return jsonResponse({ success: false, error: "Calendar not found or unpublished." }, 404);
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, user_id")
      .eq("id", config.client_id)
      .single();

    if (clientError || !client?.user_id) {
      return jsonResponse({ success: false, error: "Client context not found." }, 404);
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
      console.error("Analytics insert error:", insertError);
      return jsonResponse({ success: false, error: "Failed to persist analytics event." }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("public-calendar-analytics error:", error);
    return jsonResponse({ success: false, error: "Unexpected server error." }, 500);
  }
});
