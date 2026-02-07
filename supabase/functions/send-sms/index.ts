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

// Robust phone number formatting from appointment-reminders
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

// Format date to YYYY/MM/DD
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

// Format time to HH:MM
function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone_number);
    const senderName = sender || '17271';
    const paymentType = payment_type || 'subscription';

    // Fetch context data
    let leadData = null;
    let clientData = null;
    let appointmentData = null;

    if (lead_id) {
      const { data: lead } = await supabaseClient
        .from('leads')
        .select('id, first_name, last_name, client_id, phone')
        .eq('id', lead_id)
        .single();

      if (lead) {
        leadData = lead;
        if (lead.client_id) {
          const hasClientAccess = await userCanAccessClient(supabaseClient, user.id, lead.client_id);
          if (!hasClientAccess) {
            return new Response(
              JSON.stringify({ error: 'Forbidden for this lead' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const { data: client } = await supabaseClient
            .from('clients')
            .select('company_name, phone')
            .eq('id', lead.client_id)
            .single();
          clientData = client;
        }
      }
    }

    if (appointment_id) {
      const { data: appointment } = await supabaseClient
        .from('appointments')
        .select('scheduled_at, location, client_id')
        .eq('id', appointment_id)
        .single();

      if (appointment) {
        appointmentData = appointment;
        if (appointment.client_id) {
          const hasClientAccess = await userCanAccessClient(supabaseClient, user.id, appointment.client_id);
          if (hasClientAccess) {
            const { data: client } = await supabaseClient
              .from('clients')
              .select('company_name, phone')
              .eq('id', appointment.client_id)
              .single();
            clientData = client;
          }
        }
      }
    }

    // Prepare initial log
    const { data: smsLog, error: logError } = await supabaseClient
      .from('sms_logs')
      .insert({
        phone_number: formattedPhone,
        message: template_id ? `[template: ${template_id}]` : (message || ''),
        lead_id: lead_id || null,
        sent_by: user.id,
        status: 'pending',
        template_id: template_id || null
      })
      .select()
      .single();

    if (logError) throw logError;

    let requestBody: any;
    let endpoint: string;

    if (template_id) {
      endpoint = 'https://sms.lamah.com/api/sms/messages/template';

      let params: Record<string, string>[] = [];

      if (requestParams) {
        if (Array.isArray(requestParams)) {
          params = requestParams;
        } else {
          params = Object.entries(requestParams).map(([key, value]) => ({ [key]: value }));
        }
      } else {
        // Build defaults inspired by appointment-reminders
        const companyName = (clientData?.company_name || '').substring(0, 10);

        params.push({ lead_first_name: leadData?.first_name || 'العميل' });
        params.push({ phone: phone_number });
        params.push({ c_number: clientData?.phone || '' });
        params.push({ company_name: companyName || 'الشركة' });

        if (appointmentData?.scheduled_at) {
          const scheduledDate = new Date(appointmentData.scheduled_at);
          params.push({ appointment_hour: formatTime(appointmentData.scheduled_at) });
          const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          params.push({ appointment_day: days[scheduledDate.getDay()] });
          params.push({ appointment_date: formatDate(appointmentData.scheduled_at) });
        } else {
          params.push({ appointment_hour: '' });
          params.push({ appointment_day: '' });
          params.push({ appointment_date: '' });
        }

        params.push({ appointment_location: appointmentData?.location || 'سيتم تحديده لاحقاً' });
        params.push({ lead_full_name: `${leadData?.first_name || ''} ${leadData?.last_name || ''}`.trim() || 'العميل' });
      }

      requestBody = {
        template_id,
        sender: senderName,
        payment_type: paymentType,
        receiver: formattedPhone,
        params
      };
    } else {
      endpoint = 'https://sms.lamah.com/api/sms/messages';
      requestBody = {
        message,
        sender: senderName,
        payment_type: paymentType,
        receiver: formattedPhone,
      };
    }

    console.log(`Calling Lamah API: ${endpoint}`);
    const ersaalResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ersaalApiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await ersaalResponse.text();
    let apiResponse: any;
    try {
      apiResponse = JSON.parse(responseText);
    } catch {
      apiResponse = { raw: responseText };
    }

    const success = ersaalResponse.ok && apiResponse.message_id;

    await supabaseClient
      .from('sms_logs')
      .update({
        status: success ? 'sent' : 'failed',
        sent_at: success ? new Date().toISOString() : null,
        api_message_id: apiResponse?.message_id || null,
        cost: apiResponse?.cost || null,
        error_message: success ? null : `HTTP ${ersaalResponse.status}. Error: ${apiResponse.message || apiResponse.error || responseText}. Request: ${JSON.stringify(requestBody)}`.substring(0, 1000)
      })
      .eq('id', smsLog.id);

    return new Response(
      JSON.stringify({
        success,
        sms_log_id: smsLog.id,
        api_response: apiResponse
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-sms:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
