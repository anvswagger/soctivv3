import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Input validation ---
    const { name } = await req.json();
    
    if (!name || typeof name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit name length to prevent abuse
    const trimmedName = name.trim().substring(0, 100);
    if (trimmedName.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use service role to check and save cache (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const { data: cached } = await supabaseAdmin
      .from('name_translations')
      .select('arabic_name')
      .eq('english_name', trimmedName.toLowerCase())
      .single();

    if (cached?.arabic_name) {
      return new Response(
        JSON.stringify({ arabic_name: cached.arabic_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transliterating name: ${trimmedName}`);

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
          {
            role: "user",
            content: trimmedName
          }
        ],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let arabicName = data.choices?.[0]?.message?.content?.trim() || trimmedName;
    
    // Clean up any markdown or extra formatting
    arabicName = arabicName.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
    // Extract only Arabic characters if mixed with English
    const arabicMatch = arabicName.match(/[\u0600-\u06FF\s]+/);
    if (arabicMatch) {
      arabicName = arabicMatch[0].trim();
    }

    console.log(`Transliterated: ${trimmedName} -> ${arabicName}`);

    // Save to cache server-side (using service role, no client-side insert needed)
    if (arabicName && arabicName !== trimmedName) {
      await supabaseAdmin
        .from('name_translations')
        .upsert(
          { english_name: trimmedName.toLowerCase(), arabic_name: arabicName },
          { onConflict: 'english_name' }
        );
    }

    return new Response(
      JSON.stringify({ arabic_name: arabicName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Transliteration error:", error);
    return new Response(
      JSON.stringify({ error: "Transliteration failed" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
