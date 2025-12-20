import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  phone_number: string;
  message: string;
  lead_id?: string;
  template_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ersaalApiKey = Deno.env.get('ERSAAL_API_KEY');

    if (!ersaalApiKey) {
      console.error('ERSAAL_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone_number, message, lead_id, template_id }: SendSmsRequest = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending SMS to ${phone_number}: ${message.substring(0, 50)}...`);

    // Create SMS log entry with pending status
    const { data: smsLog, error: logError } = await supabaseClient
      .from('sms_logs')
      .insert({
        phone_number,
        message,
        lead_id: lead_id || null,
        template_id: template_id || null,
        sent_by: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating SMS log:', logError);
      return new Response(
        JSON.stringify({ error: 'Failed to create SMS log' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Ersaal API
    let smsStatus: 'sent' | 'failed' = 'failed';
    let apiResponse: any = null;

    try {
      const ersaalResponse = await fetch('https://api.ersaal.com/v1/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ersaalApiKey}`,
        },
        body: JSON.stringify({
          to: phone_number,
          message: message,
        }),
      });

      apiResponse = await ersaalResponse.json();
      console.log('Ersaal API response:', apiResponse);

      if (ersaalResponse.ok) {
        smsStatus = 'sent';
      } else {
        console.error('Ersaal API error:', apiResponse);
      }
    } catch (apiError) {
      console.error('Error calling Ersaal API:', apiError);
    }

    // Update SMS log with result
    const { error: updateError } = await supabaseClient
      .from('sms_logs')
      .update({
        status: smsStatus,
        sent_at: smsStatus === 'sent' ? new Date().toISOString() : null
      })
      .eq('id', smsLog.id);

    if (updateError) {
      console.error('Error updating SMS log:', updateError);
    }

    // Create notification for the sender
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: user.id,
        title: smsStatus === 'sent' ? 'تم إرسال الرسالة' : 'فشل إرسال الرسالة',
        message: smsStatus === 'sent' 
          ? `تم إرسال الرسالة إلى ${phone_number} بنجاح`
          : `فشل إرسال الرسالة إلى ${phone_number}`,
        type: smsStatus === 'sent' ? 'success' : 'error',
        data: { sms_log_id: smsLog.id }
      });

    return new Response(
      JSON.stringify({ 
        success: smsStatus === 'sent',
        sms_log_id: smsLog.id,
        status: smsStatus,
        api_response: apiResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-sms function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
