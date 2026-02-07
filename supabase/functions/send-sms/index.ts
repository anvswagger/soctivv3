import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - allow all origins for Edge Function access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  phone_number: string;
  message?: string;
  lead_id?: string;
  template_id?: string;
  sender?: string;
  payment_type?: 'wallet' | 'subscription';
  appointment_id?: string;
  params?: Record<string, string>[] | Record<string, string>;
}

// تحويل رقم الهاتف للصيغة الدولية
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('09')) {
    return '00218' + cleaned.substring(1);
  }
  if (cleaned.startsWith('+218')) {
    return '00218' + cleaned.substring(4);
  }
  if (cleaned.startsWith('218')) {
    return '00' + cleaned;
  }
  if (cleaned.startsWith('+')) {
    return '00' + cleaned.substring(1);
  }

  return cleaned;
}

// تنسيق التاريخ
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

// تنسيق الوقت
function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// استبدال المتغيرات في الرسالة
function replaceVariables(
  message: string,
  leadData: any,
  clientData: any,
  appointmentData: any
): string {
  let result = message;

  // Lead variables
  result = result.replace(/\{\{lead_first_name\}\}/g, leadData?.first_name || '');
  result = result.replace(/\{\{lead_last_name\}\}/g, leadData?.last_name || '');
  result = result.replace(/\{\{lead_full_name\}\}/g,
    `${leadData?.first_name || ''} ${leadData?.last_name || ''}`.trim()
  );

  // Client/Company variables
  result = result.replace(/\{\{company_name\}\}/g, clientData?.company_name || '');
  result = result.replace(/\{\{c_phone\}\}/g, clientData?.phone || '');

  // Appointment variables
  result = result.replace(/\{\{appointment_date\}\}/g, formatDate(appointmentData?.scheduled_at));
  result = result.replace(/\{\{appointment_time\}\}/g, formatTime(appointmentData?.scheduled_at));
  result = result.replace(/\{\{appointment_location\}\}/g, appointmentData?.location || '');

  return result;
}

async function userCanAccessClient(supabaseClient: any, userId: string, clientId: string): Promise<boolean> {
  const { data: rolesRows, error: rolesError } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (rolesError) {
    console.error('Failed to load user roles:', rolesError);
    return false;
  }

  const roles = new Set((rolesRows ?? []).map((r: any) => r.role));
  if (roles.has('super_admin')) return true;

  if (roles.has('admin')) {
    const { data: assignment, error: assignmentError } = await supabaseClient
      .from('admin_clients')
      .select('id')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (assignmentError) {
      console.error('Failed to load admin assignment:', assignmentError);
      return false;
    }

    return !!assignment;
  }

  const { data: ownedClient, error: clientError } = await supabaseClient
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  if (clientError) {
    console.error('Failed to verify client ownership:', clientError);
    return false;
  }

  return !!ownedClient;
}

Deno.serve(async (req) => {
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone_number, message, lead_id, template_id, sender, payment_type, appointment_id, params: requestParams }: SendSmsRequest = await req.json();

    // When using template_id, message is optional (the template provides the message)
    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message && !template_id) {
      return new Response(
        JSON.stringify({ error: 'Either message or template_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lead data for variable replacement
    let leadData = null;
    let clientData = null;
    let appointmentData = null;

    if (lead_id) {
      const { data: lead } = await supabaseClient
        .from('leads')
        .select('first_name, last_name, client_id')
        .eq('id', lead_id)
        .single();

      if (!lead?.client_id) {
        return new Response(
          JSON.stringify({ error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hasClientAccess = await userCanAccessClient(supabaseClient, user.id, lead.client_id);
      if (!hasClientAccess) {
        return new Response(
          JSON.stringify({ error: 'Forbidden for this lead' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      leadData = lead;

      // Fetch client data if lead has client_id
      if (lead?.client_id) {
        const { data: client } = await supabaseClient
          .from('clients')
          .select('company_name, phone')
          .eq('id', lead.client_id)
          .single();

        clientData = client;
      }
    }

    // Fetch appointment data if provided
    if (appointment_id) {
      const { data: appointment } = await supabaseClient
        .from('appointments')
        .select('scheduled_at, location, notes, client_id')
        .eq('id', appointment_id)
        .single();

      if (!appointment?.client_id) {
        return new Response(
          JSON.stringify({ error: 'Appointment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hasClientAccess = await userCanAccessClient(supabaseClient, user.id, appointment.client_id);
      if (!hasClientAccess) {
        return new Response(
          JSON.stringify({ error: 'Forbidden for this appointment' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      appointmentData = appointment;
    }

    // Replace variables in message (only if message is provided)
    const finalMessage = message ? replaceVariables(message, leadData, clientData, appointmentData) : '';

    const formattedPhone = formatPhoneNumber(phone_number);
    const senderName = sender || '17271';
    const paymentType = payment_type || 'subscription';

    console.log(`Sending SMS to ${formattedPhone} (original: ${phone_number})`);
    console.log(`Mode: ${template_id ? 'template (' + template_id + ')' : 'direct message'}`);
    if (message) console.log(`Message: ${message.substring(0, 50)}...`);
    console.log(`Sender: ${senderName}`);

    // Create SMS log entry with the final message
    const { data: smsLog, error: logError } = await supabaseClient
      .from('sms_logs')
      .insert({
        phone_number: formattedPhone,
        message: template_id ? `[template: ${template_id}]` : finalMessage,
        lead_id: lead_id || null,
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
    let debugEgressIp: string | null = null;

    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      debugEgressIp = ipData.ip;
      console.log('Current server egress IP:', debugEgressIp);
    } catch (ipError) {
      console.error('Failed to fetch egress IP:', ipError);
    }

    try {
      let requestBody: any;
      let endpoint: string;

      if (template_id) {
        endpoint = 'https://sms.lamah.com/api/sms/messages/template';

        // Build params: use requestParams from caller if provided, otherwise auto-build
        let params: Record<string, string>[] = [];

        if (requestParams) {
          // If requestParams is already an array of objects, use as-is
          if (Array.isArray(requestParams)) {
            params = requestParams;
          } else {
            // If it's a flat object { key: value }, convert to array format [{ key: value }]
            params = Object.entries(requestParams).map(([key, value]) => ({ [key]: value }));
          }
        } else {
          // Auto-build params from fetched data according to user requirements:
          // lead_first_name, phone, c_number, company_name, appointment_hour, appointment_day
          if (leadData?.first_name) {
            params.push({ lead_first_name: leadData.first_name });
          }

          if (phone_number) {
            params.push({ phone: phone_number });
          }

          if (clientData?.phone) {
            params.push({ c_number: clientData.phone });
          }

          if (clientData?.company_name) {
            params.push({ company_name: clientData.company_name });
          }

          if (appointmentData?.scheduled_at) {
            const scheduledDate = new Date(appointmentData.scheduled_at);
            params.push({ appointment_hour: formatTime(appointmentData.scheduled_at) });
            const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            params.push({ appointment_day: days[scheduledDate.getDay()] });
          }

          if (appointmentData?.location) params.push({ appointment_location: appointmentData.location });
        }

        requestBody = {
          template_id: template_id,
          sender: senderName,
          payment_type: paymentType,
          receiver: formattedPhone,
          params: params
        };
      } else {
        endpoint = 'https://sms.lamah.com/api/sms/messages';
        requestBody = {
          message: finalMessage,
          sender: senderName,
          payment_type: paymentType,
          receiver: formattedPhone,
        };
      }

      console.log(`Calling Ersaal API: ${endpoint}`);
      console.log('Request body:', JSON.stringify(requestBody));

      const ersaalResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ersaalApiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const ersaalResponseText = await ersaalResponse.text();
      console.log('Ersaal response status:', ersaalResponse.status);
      console.log('Ersaal raw response:', ersaalResponseText);

      try {
        apiResponse = JSON.parse(ersaalResponseText);
      } catch (parseError) {
        console.error('Failed to parse Ersaal response as JSON:', ersaalResponseText);
        apiResponse = {
          error: 'Invalid response from Ersaal API',
          raw: ersaalResponseText,
          status: ersaalResponse.status
        };
      }

      if (ersaalResponse.ok && apiResponse.message_id) {
        smsStatus = 'sent';
        console.log('SMS sent successfully, message_id:', apiResponse.message_id, 'cost:', apiResponse.cost);
      } else {
        const errorText = apiResponse?.error || apiResponse?.message || 'Unknown error';
        await supabaseClient.from('sms_logs').update({
          error_message: `HTTP ${ersaalResponse.status}. Error: ${errorText}`
        }).eq('id', smsLog.id);

        if (ersaalResponse.status === 401) {
          console.error('Ersaal API 401 error (unauthorized/IP issue):', apiResponse);
        } else if (ersaalResponse.status === 400) {
          console.error('Ersaal API 400 error (invalid request/phone):', apiResponse);
        } else {
          console.error('Ersaal API error:', apiResponse);
        }
      }
    } catch (apiError) {
      console.error('Error calling Ersaal API:', apiError);
    }

    // Final update for status and timestamp
    const { error: updateError } = await supabaseClient
      .from('sms_logs')
      .update({
        status: smsStatus,
        sent_at: smsStatus === 'sent' ? new Date().toISOString() : null,
        api_message_id: apiResponse?.message_id || null,
        cost: apiResponse?.cost || null
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

    const isIpIssue = apiResponse?.message?.toLowerCase().includes('unauthorized ip');
    const whitelistHint = isIpIssue && debugEgressIp
      ? `أضف هذا الـ IP إلى whitelist في لوحة تحكم Lamah: ${debugEgressIp}`
      : null;

    return new Response(
      JSON.stringify({
        success: smsStatus === 'sent',
        sms_log_id: smsLog.id,
        status: smsStatus,
        message_id: apiResponse?.message_id || null,
        cost: apiResponse?.cost || null,
        api_response: apiResponse,
        debug_egress_ip: debugEgressIp,
        whitelist_hint: whitelistHint
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
