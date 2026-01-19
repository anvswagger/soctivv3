import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI transliteration function
async function transliterateName(name: string): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY || !name.trim()) return name;

    // Check if already Arabic
    if (/[\u0600-\u06FF]/.test(name)) return name;

    console.log(`Transliterating: ${name}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a name transliterator. Output ONLY the Arabic transliteration of the given name. No explanations, no formatting, no markdown, no extra text. Just the Arabic name."
          },
          { role: "user", content: name }
        ],
        max_tokens: 20,
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
const LeadPayloadSchema = z.object({
  client_code: z.string().min(1).max(100),
  full_name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  worktype: z.string().max(100).optional().nullable(),
  stage: z.string().max(100).optional().nullable(),
  source: z.string().max(200).optional().nullable(),
});

type FacebookLeadPayload = z.infer<typeof LeadPayloadSchema>;

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
    const validationResult = LeadPayloadSchema.safeParse(rawPayload);
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

    const payload: FacebookLeadPayload = validationResult.data;
    console.log('Received validated payload:', JSON.stringify({
      client_code: payload.client_code.substring(0, 10) + '...',
      full_name: payload.full_name.substring(0, 20) + '...',
      has_phone: !!payload.phone
    }));

    // Sanitize the full_name before processing
    const sanitizedName = sanitizeString(payload.full_name, 200);
    
    // Split sanitized full_name into first_name and last_name
    const nameParts = sanitizedName.split(' ').filter(part => part.length > 0);
    const firstName = sanitizeString(nameParts[0] || '', 100);
    const lastName = nameParts.length > 1 
      ? sanitizeString(nameParts.slice(1).join(' '), 100) 
      : firstName;

    console.log('Parsed name:', { firstName: firstName.substring(0, 10), lastName: lastName.substring(0, 10) });

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by webhook_code (sanitize input)
    const sanitizedClientCode = sanitizeString(payload.client_code, 100);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id, company_name')
      .eq('webhook_code', sanitizedClientCode)
      .single();

    if (clientError || !client) {
      console.log('Client not found for code:', sanitizedClientCode.substring(0, 10));
      return new Response(
        JSON.stringify({ error: 'Invalid client_code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found client:', client.company_name);

    // Sanitize optional fields
    const sanitizedPhone = payload.phone ? sanitizeString(payload.phone, 50) : null;
    const sanitizedSource = payload.source ? sanitizeString(payload.source, 200) : 'Facebook Lead Ads';
    const sanitizedWorktype = payload.worktype ? sanitizeString(payload.worktype, 100) : null;
    const sanitizedStage = payload.stage ? sanitizeString(payload.stage, 100) : null;

    // Insert the lead with sanitized fields
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        client_id: client.id,
        first_name: firstName,
        last_name: lastName,
        phone: sanitizedPhone,
        source: sanitizedSource,
        worktype: sanitizedWorktype,
        stage: sanitizedStage,
        status: 'new'
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error inserting lead:', leadError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead created successfully:', lead.id);

    // Create notification for the client owner
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: client.user_id,
        title: 'عميل محتمل جديد من Facebook',
        message: `تم استلام عميل محتمل جديد: ${sanitizedName.substring(0, 50)}`,
        type: 'lead',
        data: { lead_id: lead.id, source: 'facebook', worktype: sanitizedWorktype, stage: sanitizedStage }
      });

    if (notifError) {
      console.warn('Failed to create notification:', notifError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        message: 'Lead created successfully' 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
