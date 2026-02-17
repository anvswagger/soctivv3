// @ts-nocheck - Deno edge function (uses Deno runtime, not Node/Vite)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers - allow all origins for Edge Function access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSmsRequest {
  phone_number: string;
  lead_id?: string;
  template_id?: string;
  sender?: string;
  payment_type?: 'wallet' | 'subscription';
  appointment_id?: string;
  params?: Record<string, string>[] | Record<string, string>;
}

// Robust phone number formatting from appointment-reminders
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/[\s\-()]/g, '');

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

// Get Arabic day name
function getArabicDayName(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[date.getDay()];
}

async function userCanAccessClient(supabaseClient: any, userId: string, clientId: string): Promise<boolean> {
  const { data: rolesRows, error: rolesError } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (rolesError) return false;

  const roles = new Set((rolesRows ?? []).map((r: any) => r.role));
  if (roles.has('super_admin')) return true;

  if (roles.has('admin')) {
    const { data: assignment } = await supabaseClient
      .from('admin_clients')
      .select('id')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .maybeSingle();
    return !!assignment;
  }

  const { data: ownedClient } = await supabaseClient
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!ownedClient;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ersaalApiKey = Deno.env.get('ERSAAL_API_KEY');

    if (!ersaalApiKey) throw new Error('ERSAAL_API_KEY missing');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Auth Header');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error('Unauthorized');

    const { phone_number, template_id, lead_id, appointment_id, sender, payment_type, params: requestParams }: SendSmsRequest = await req.json();

    if (!phone_number) throw new Error('Phone number missing');
    if (!template_id) throw new Error('Template ID missing'); // Added this check as the new logic is template-specific

    const formattedPhone = formatPhoneNumber(phone_number);
    const senderName = sender || '17271';
    const paymentType = payment_type || 'subscription';

    // Fetch data for params
    let leadData: any = null;
    let clientData: any = null;
    let appointmentData: any = null;

    if (lead_id) {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
      leadData = lead;
      if (lead?.client_id) {
        const canAccess = await userCanAccessClient(supabase, user.id, lead.client_id);
        if (!canAccess) throw new Error('Forbidden');
        const { data: client } = await supabase.from('clients').select('*').eq('id', lead.client_id).single();
        clientData = client;
      }
    }

    if (appointment_id) {
      const { data: apt } = await supabase.from('appointments').select('*').eq('id', appointment_id).single();
      appointmentData = apt;
      if (apt?.client_id && !clientData) { // Fetch client data if not already fetched via lead
        const canAccess = await userCanAccessClient(supabase, user.id, apt.client_id);
        if (!canAccess) throw new Error('Forbidden');
        const { data: client } = await supabase.from('clients').select('*').eq('id', apt.client_id).single();
        clientData = client;
      }
    }

    // Create log - don't pass template_id as FK (it's the Ersaal template name, not a UUID)
    const { data: smsLog, error: logInsertError } = await supabase
      .from('sms_logs')
      .insert({
        phone_number: formattedPhone,
        message: template_id ? `[template: ${template_id}]` : 'Direct SMS',
        lead_id: lead_id || null,
        sent_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (logInsertError) {
      console.error('Failed to insert sms_log:', JSON.stringify(logInsertError));
    }

    // Pass through the caller's params directly - each caller knows what their template needs
    // This matches how appointment-reminders works (builds its own params, sends directly to Ersaal)
    let params: Record<string, string>[];
    if (requestParams) {
      if (Array.isArray(requestParams)) {
        params = requestParams as Record<string, string>[];
      } else {
        // Convert flat object to Ersaal format: [{ key: value }]
        params = Object.entries(requestParams as Record<string, string>).map(([key, value]) => ({
          [key]: String(value)
        }));
      }
    } else {
      // Fallback: build basic params from fetched data if caller didn't provide any
      const companyName = (clientData?.company_name || '').substring(0, 10);
      params = [
        { company_name: companyName || 'الشركة' },
        { lead_first_name: leadData?.first_name || 'العميل' },
        { lead_full_name: `${leadData?.first_name || ''} ${leadData?.last_name || ''}`.trim() || 'العميل' },
      ];
    }

    const payload = {
      template_id,
      sender: senderName,
      receiver: formattedPhone,
      payment_type: paymentType,
      params,
    };

    console.log('Sending to Ersaal:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://sms.lamah.com/api/sms/messages/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ersaalApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    let result: any;
    try {
      result = JSON.parse(bodyText);
    } catch {
      result = { raw: bodyText };
    }

    const success = response.ok && result.message_id;

    if (smsLog) {
      await supabase
        .from('sms_logs')
        .update({
          status: success ? 'sent' : 'failed',
          sent_at: success ? new Date().toISOString() : null,
          error_message: success ? null : `HTTP ${response.status}. Error: ${result.message || result.error || bodyText}. Request: ${JSON.stringify(payload)}`.substring(0, 1000)
        })
        .eq('id', smsLog.id);
    }

    return new Response(JSON.stringify({ success, log_id: smsLog?.id, api_response: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('send-sms error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
