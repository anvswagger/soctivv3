import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SendTemplateSmsRequest {
  phone: string;
  template_id: string;
  params: Record<string, string>;
  lead_id?: string;
  appointment_id?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format phone number to international format
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/[\s\-\(\)]/g, '');

  if (formatted.startsWith('+')) {
    formatted = '00' + formatted.substring(1);
  }

  if (formatted.startsWith('0') && !formatted.startsWith('00')) {
    formatted = '00218' + formatted.substring(1);
  }

  if (!formatted.startsWith('00')) {
    formatted = '00218' + formatted;
  }

  return formatted;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const ersaalApiKey = Deno.env.get('ERSAAL_API_KEY');

    if (!ersaalApiKey) {
      throw new Error('ERSAAL_API_KEY is not configured');
    }

    // SECURITY: Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth context for validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate JWT and get user claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error('Auth validation failed:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - no user ID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${userId}`);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, template_id, params, lead_id, appointment_id }: SendTemplateSmsRequest = await req.json();

    if (!phone || !template_id) {
      throw new Error('Phone and template_id are required');
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Sending template SMS to ${formattedPhone} using template: ${template_id}`);

    // Build the message for logging
    const paramsStr = Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ');

    // Log the SMS request with authenticated user ID
    const smsLogData: any = {
      phone_number: formattedPhone,
      message: `[${template_id}] Params: ${paramsStr}`,
      status: 'pending',
      sent_by: userId,
    };

    if (lead_id) {
      smsLogData.lead_id = lead_id;
    }

    const { data: smsLog, error: logError } = await supabase
      .from('sms_logs')
      .insert(smsLogData)
      .select()
      .single();

    if (logError) {
      console.error('Error logging SMS:', logError);
    }

    // Convert params object to array of objects for Ersaal API (correct format: [{ "key": "value" }])
    const paramsArray = Object.entries(params).map(([key, value]) => ({
      [key]: String(value)
    }));

    // Send SMS via Ersaal Template API
    const ersaalPayload = {
      template_id: template_id,
      sender: '17271',
      receiver: formattedPhone,
      payment_type: 'subscription',
      params: paramsArray,
    };

    console.log('Sending to Ersaal Template API:', JSON.stringify(ersaalPayload, null, 2));
    if (ersaalApiKey) {
      console.log(`API Key check: ${ersaalApiKey.substring(0, 4)}... (length: ${ersaalApiKey.length})`);
    }

    const ersaalResponse = await fetch('https://sms.lamah.com/api/sms/messages/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ersaalApiKey}`,
      },
      body: JSON.stringify(ersaalPayload),
    });

    const ersaalResponseText = await ersaalResponse.text();
    console.log('Ersaal response status:', ersaalResponse.status);
    console.log('Ersaal raw response:', ersaalResponseText);

    let ersaalResult: any;
    try {
      ersaalResult = JSON.parse(ersaalResponseText);
    } catch (e) {
      console.error('Failed to parse Ersaal response as JSON:', ersaalResponseText);
      ersaalResult = { error: 'Invalid response format', raw: ersaalResponseText, status: ersaalResponse.status };
    }

    // Check success: new API returns message_id on success, or error/message on failure
    const isSuccess = ersaalResult.message_id && !ersaalResult.error;
    const newStatus = isSuccess ? 'sent' : 'failed';

    if (smsLog) {
      await supabase
        .from('sms_logs')
        .update({
          status: newStatus,
          error_message: isSuccess ? null : `HTTP ${ersaalResult.status || ersaalResponse.status}. Error: ${ersaalResult.error || ersaalResult.message}`,
          sent_at: isSuccess ? new Date().toISOString() : null,
        })
        .eq('id', smsLog.id);
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        message: isSuccess ? 'SMS sent successfully' : (ersaalResult.message || ersaalResult.error || 'Failed to send SMS'),
        sms_log_id: smsLog?.id,
        ersaal_response: ersaalResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isSuccess ? 200 : 400,
      }
    );
  } catch (error: any) {
    console.error('Error in send-template-sms function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
