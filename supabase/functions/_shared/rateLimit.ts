import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type RateLimitParams = {
  supabase: SupabaseClient;
  bucketKey: string;
  limit: number;
  windowSeconds: number;
};

export function getRequestIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp.slice(0, 120);
    }
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim().slice(0, 120);
  }

  return "unknown";
}

export async function consumeDurableRateLimit(input: RateLimitParams): Promise<boolean> {
  const { supabase, bucketKey, limit, windowSeconds } = input;

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
