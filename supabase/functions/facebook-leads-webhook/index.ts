// @ts-nocheck - Deno edge function (uses Deno runtime, not Node/Vite)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Rate limiter ──────────────────────────────────────────────────────────
//
// In-process token bucket per client IP. Edge functions can scale across
// instances (so a determined attacker can spread across them), but this
// stops the common case of a single bot hammering one warm instance and
// flooding the leads table — which is what would otherwise generate a
// runaway notification + dead-letter storm in the dashboard.
//
// Tunables:
//   RATE_LIMIT_WINDOW_MS — sliding window length
//   RATE_LIMIT_MAX       — max submissions per IP within the window
//
// 5 submissions per minute per IP is generous enough for an honest user
// clicking through "Submit" repeatedly (network retries) while blocking
// scripted floods (hundreds of submissions/sec).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

interface Bucket { count: number; resetAt: number; }
const rateLimitBuckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  // x-forwarded-for is the first hop when behind Supabase's edge proxy.
  // Fall back to a stable "unknown" string — better than throwing and
  // returning 500 to a real user with a stripped header.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// Periodic cleanup of expired buckets so the map doesn't grow unbounded
// if the function stays warm for hours and many distinct IPs hit it.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of rateLimitBuckets) {
    if (now >= b.resetAt) rateLimitBuckets.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref?.();

// AI transliteration function using OpenRouter (free models)
async function transliterateName(name: string): Promise<string> {
  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY || !name.trim()) return name;

    // Check if already Arabic
    if (/[\u0600-\u06FF]/.test(name)) return name;

    console.log(`Transliterating: ${name}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://soctivcrm.com",
        "X-Title": "SoctivCRM"
      },
      body: JSON.stringify({
        model: "qwen/qwen3-coder-next",
        messages: [
          {
            role: "system",
            content: "You are a name transliterator. Output ONLY the Arabic transliteration of the given name. No explanations, no formatting, no markdown, no extra text. Just the Arabic name."
          },
          { role: "user", content: name }
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      console.warn(`Transliteration API error: ${response.status}`);
      return name;
    }

    const data = await response.json();
    let arabicName = data.choices?.[0]?.message?.content?.trim() || name;

    // Clean up any markdown or extra formatting
    arabicName = arabicName.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();

    // Extract only Arabic characters if mixed with English
    const arabicMatch = arabicName.match(/[\u0600-\u06FF\s]+/);
    if (arabicMatch) {
      arabicName = arabicMatch[0].trim();
    }

    console.log(`Transliterated: ${name} -> ${arabicName}`);
    return arabicName;
  } catch (error) {
    console.warn(`Transliteration failed for ${name}:`, error);
    return name;
  }
}

// Input validation schema with length limits
const OrderPayloadSchema = z.object({
  client_code: z.string().min(1).max(100),
  full_name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  quantity: z.number().int().min(1).max(9999).optional().nullable(),
  product_code: z.string().max(100).optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

type FacebookOrderPayload = z.infer<typeof OrderPayloadSchema>;

// Sanitize string input - remove potentially dangerous characters
function sanitizeString(input: string, maxLength: number): string {
  return input
    .replace(/[<>"']/g, '') // Remove XSS-relevant characters
    .trim()
    .substring(0, maxLength);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ─── Rate limit per client IP
  // Catches the common case of a bot looping POST / on one warm instance.
  // Not perfect across scaled-out instances, but cheap and immediate.
  const ip = clientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    console.warn('Rate limit exceeded for', ip, '— retry in', rl.retryAfterSec, 's');
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSec),
        },
      }
    );
  }

  try {
    // Parse and validate payload
    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      console.log('Invalid JSON payload');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate with Zod schema
    const validationResult = OrderPayloadSchema.safeParse(rawPayload);
    if (!validationResult.success) {
      console.log('Validation failed:', validationResult.error.issues);
      return new Response(
        JSON.stringify({
          error: 'Invalid input data',
          details: validationResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: FacebookOrderPayload = validationResult.data;
    console.log('Received validated payload:', JSON.stringify({
      client_code: payload.client_code.substring(0, 10) + '...',
      full_name: payload.full_name.substring(0, 20) + '...',
      has_phone: !!payload.phone,
      quantity: payload.quantity,
      has_product_code: !!payload.product_code
    }));

    // Sanitize the full_name before processing
    const sanitizedName = sanitizeString(payload.full_name, 200);

    // Split sanitized full_name into first_name and last_name
    const nameParts = sanitizedName.split(' ').filter(part => part.length > 0);
    const rawFirstName = sanitizeString(nameParts[0] || '', 100);
    const rawLastName = nameParts.length > 1
      ? sanitizeString(nameParts.slice(1).join(' '), 100)
      : '';

    // Transliterate names to Arabic
    const [firstName, lastName] = await Promise.all([
      transliterateName(rawFirstName),
      transliterateName(rawLastName)
    ]);

    console.log('Transliterated names:', { firstName: firstName.substring(0, 20), lastName: lastName.substring(0, 20) });

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notifySuperAdmins = async (title: string, message: string, data?: Record<string, unknown>) => {
      try {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');

        if (!adminRoles || adminRoles.length === 0) return;
        const rows = adminRoles.map((row: { user_id: string }) => ({
          user_id: row.user_id,
          title,
          message,
          type: 'system',
          data: data ?? {},
        }));
        await supabase.from('notifications').insert(rows);
      } catch {
        // ignore notification failures
      }
    };

    const logDeadLetter = async (payload: Record<string, unknown>, errorMessage: string) => {
      try {
        await supabase.from('job_dead_letters').insert({
          source: 'facebook-orders-webhook',
          job_name: 'facebook-orders-webhook',
          payload,
          error_message: errorMessage,
        });
      } catch {
        // ignore logging failures
      }
    };

    const logWebhookEvent = async (status: 'received' | 'processed' | 'failed', data: {
      client_id?: string | null;
      lead_id?: string | null;
      payload?: Record<string, unknown>;
      error_message?: string | null;
    }) => {
      try {
        await supabase.from('webhook_events').insert({
          provider: 'facebook_orders',
          status,
          client_id: data.client_id ?? null,
          lead_id: data.lead_id ?? null,
          payload: data.payload ?? null,
          error_message: data.error_message ?? null,
        });
      } catch {
        // ignore logging failures
      }
    };

    // Find client by webhook_code (sanitize input)
    const sanitizedClientCode = sanitizeString(payload.client_code, 100);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id, company_name')
      .eq('webhook_code', sanitizedClientCode)
      .single();

    if (clientError || !client) {
      console.log('Client not found for code:', sanitizedClientCode.substring(0, 10));
      await logWebhookEvent('failed', {
        client_id: null,
        payload: validationResult.data as unknown as Record<string, unknown>,
        error_message: 'Invalid client_code',
      });
      await logDeadLetter({ client_code: sanitizedClientCode }, 'Invalid client_code');
      await notifySuperAdmins(
        'Webhook failed: invalid client',
        'Facebook orders webhook received an invalid client_code.',
        { client_code: sanitizedClientCode }
      );
      return new Response(
        JSON.stringify({ error: 'Invalid client_code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found client:', client.company_name);

    // Sanitize optional fields
    const sanitizedPhone = payload.phone ? sanitizeString(payload.phone, 50) : null;
    // Honor `payload.source` when provided (e.g. landing-page runtime sends
    // 'Landing Page'). Preserve the legacy 'Facebook Orders' default for
    // existing Facebook callers that don't set the field.
    const sanitizedSource = sanitizeString(payload.source || 'Facebook Orders', 200);
    const sanitizedQuantity = (typeof payload.quantity === 'number' && payload.quantity > 0) ? payload.quantity : 1;
    const sanitizedNotes = payload.notes ? sanitizeString(payload.notes, 2000) : null;
    const sanitizedAddress = payload.address ? sanitizeString(payload.address, 500) : null;

    // Resolve product_code to product_id
    let productId: string | null = null;
    const sanitizedProductCode = payload.product_code ? sanitizeString(payload.product_code, 100) : null;
    if (sanitizedProductCode) {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('client_id', client.id)
        .eq('code', sanitizedProductCode)
        .eq('is_active', true)
        .single();
      if (product) {
        productId = product.id;
      } else {
        console.warn('Product not found for code:', sanitizedProductCode);
      }
    }

    // Insert the lead/order with sanitized fields
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        client_id: client.id,
        first_name: firstName,
        last_name: lastName,
        phone: sanitizedPhone,
        source: sanitizedSource,
        product_id: productId,
        quantity: sanitizedQuantity,
        notes: sanitizedNotes,
        address: sanitizedAddress,
        status: 'new'
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error inserting lead:', leadError);
      await logWebhookEvent('failed', {
        client_id: client.id,
        payload: validationResult.data as unknown as Record<string, unknown>,
        error_message: leadError.message || 'Failed to create lead',
      });
      await logDeadLetter(
        { client_id: client.id, full_name: sanitizedName },
        leadError.message || 'Failed to create lead'
      );
      await notifySuperAdmins(
        'Webhook failed: lead insert',
        `Failed to create lead for client ${client.company_name}.`,
        { client_id: client.id }
      );
      return new Response(
        JSON.stringify({ error: 'Failed to create lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order created successfully:', lead.id);
    await logWebhookEvent('processed', {
      client_id: client.id,
      lead_id: lead.id,
      payload: validationResult.data as unknown as Record<string, unknown>,
    });

    // Create notification for the client owner — branch copy on the lead's
    // source so landing-page leads don't get mis-attributed as Facebook.
    const isLandingPage = sanitizedSource === 'Landing Page';
    const notifTitle = isLandingPage ? 'طلب جديد من صفحة الهبوط' : 'طلب جديد من Facebook';
    const notifMessage = isLandingPage
      ? `تم استلام طلب جديد من صفحة الهبوط: ${sanitizedName.substring(0, 50)}`
      : `تم استلام طلب جديد: ${sanitizedName.substring(0, 50)}`;
    const sourceTag = isLandingPage ? 'landing_page' : 'facebook';
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: client.user_id,
        title: notifTitle,
        message: notifMessage,
        type: 'lead',
        data: { lead_id: lead.id, source: sourceTag, quantity: sanitizedQuantity, product_id: productId }
      });

    if (notifError) {
      console.warn('Failed to create notification:', notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        message: 'Order created successfully'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('webhook_events').insert({
          provider: 'facebook_orders',
          status: 'failed',
          error_message: (error as any)?.message || 'Internal server error',
        });
        await supabase.from('job_dead_letters').insert({
          source: 'facebook-orders-webhook',
          job_name: 'facebook-orders-webhook',
          payload: {},
          error_message: (error as any)?.message || 'Internal server error',
        });
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');
        if (adminRoles?.length) {
          await supabase.from('notifications').insert(
            adminRoles.map((row: { user_id: string }) => ({
              user_id: row.user_id,
              title: 'Webhook failed',
              message: 'Facebook orders webhook failed. Check logs and dead letters.',
              type: 'system',
            }))
          );
        }
      }
    } catch {
      // ignore logging errors
    }
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});