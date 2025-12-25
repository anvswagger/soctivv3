import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'https://yplbixiwtxhaeohombcf.lovableproject.com',
  'https://yplbixiwtxhaeohombcf.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  
  // Check if origin is in allowed list
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  
  // For non-browser requests (like server-to-server), allow if no Origin header
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }
  
  // Reject unknown origins
  return {
    'Access-Control-Allow-Origin': 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface SendSmsRequest {
  phone_number: string;
  message: string;
  lead_id?: string;
  template_id?: string;
  sender?: string;
}

// تحويل رقم الهاتف للصيغة الدولية
function formatPhoneNumber(phone: string): string {
  // إزالة المسافات والرموز
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // إذا كان يبدأ بـ 09 (ليبيا)
  if (cleaned.startsWith('09')) {
    return '00218' + cleaned.substring(1);
  }
  
  // إذا كان يبدأ بـ +218
  if (cleaned.startsWith('+218')) {
    return '00218' + cleaned.substring(4);
  }
  
  // إذا كان يبدأ بـ 218
  if (cleaned.startsWith('218')) {
    return '00' + cleaned;
  }
  
  // إذا كان يبدأ بـ +
  if (cleaned.startsWith('+')) {
    return '00' + cleaned.substring(1);
  }
  
  return cleaned;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
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

    const { phone_number, message, lead_id, template_id, sender }: SendSmsRequest = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // تنسيق رقم الهاتف للصيغة الدولية
    const formattedPhone = formatPhoneNumber(phone_number);
    const senderName = sender || 'LeadCRM';

    console.log(`Sending SMS to ${formattedPhone} (original: ${phone_number})`);
    console.log(`Message: ${message.substring(0, 50)}...`);
    console.log(`Sender: ${senderName}`);

    // Create SMS log entry with pending status
    const { data: smsLog, error: logError } = await supabaseClient
      .from('sms_logs')
      .insert({
        phone_number: formattedPhone,
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

    // Send SMS via Ersaal API - Updated to correct endpoint
    let smsStatus: 'sent' | 'failed' = 'failed';
    let apiResponse: any = null;
    let debugEgressIp: string | null = null;

    try {
      const requestBody = {
        message: message,
        sender: senderName,
        payment_type: 'wallet',
        receiver: formattedPhone,
      };

      console.log('Ersaal API request:', JSON.stringify(requestBody));

      const ersaalResponse = await fetch('https://sms.lamah.com/api/sms/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ersaalApiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      apiResponse = await ersaalResponse.json();
      console.log('Ersaal API response status:', ersaalResponse.status);
      console.log('Ersaal API response:', JSON.stringify(apiResponse));

      if (ersaalResponse.ok && (apiResponse.success || ersaalResponse.status === 200 || ersaalResponse.status === 201)) {
        smsStatus = 'sent';
        console.log('SMS sent successfully');
      } else {
        console.error('Ersaal API error:', apiResponse);
        
        // If unauthorized IP, try to get the egress IP for debugging
        if (ersaalResponse.status === 401 && apiResponse?.message?.includes('Unauthorized IP')) {
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            debugEgressIp = ipData.ip;
            console.log('Server egress IP (add to whitelist):', debugEgressIp);
          } catch (ipError) {
            console.error('Failed to fetch egress IP:', ipError);
          }
        }
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
        api_response: apiResponse,
        debug_egress_ip: debugEgressIp,
        whitelist_hint: debugEgressIp ? `أضف هذا الـ IP إلى whitelist في Lamah: ${debugEgressIp}` : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-sms function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
