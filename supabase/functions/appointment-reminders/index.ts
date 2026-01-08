import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Format date for Arabic display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-LY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format time for Arabic display
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ar-LY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

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

  // Appointment variables (using existing formatters)
  if (appointmentData?.scheduled_at) {
    result = result.replace(/\{\{appointment_date\}\}/g, formatDate(appointmentData.scheduled_at));
    result = result.replace(/\{\{appointment_time\}\}/g, formatTime(appointmentData.scheduled_at));
    result = result.replace(/\{\{appointment_location\}\}/g, appointmentData?.location || '');
  }

  return result;
}

interface ReminderConfig {
  type: '24h' | '6h' | '1h';
  templateId: string;
  hoursBeforeMin: number;
  hoursBeforeMax: number;
}

const REMINDER_CONFIGS: ReminderConfig[] = [
  { type: '24h', templateId: 'appointment-reminder-24h', hoursBeforeMin: 23, hoursBeforeMax: 25 },
  { type: '6h', templateId: 'appointment-reminder-6h', hoursBeforeMin: 5, hoursBeforeMax: 7 },
  { type: '1h', templateId: 'appointment-reminder-1h', hoursBeforeMin: 0.5, hoursBeforeMax: 1.5 },
];

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
      throw new Error('ERSAAL_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const results: any[] = [];

    console.log(`Running appointment reminders check at ${now.toISOString()}`);

    for (const config of REMINDER_CONFIGS) {
      // Calculate time range for this reminder type
      const minTime = new Date(now.getTime() + config.hoursBeforeMin * 60 * 60 * 1000);
      const maxTime = new Date(now.getTime() + config.hoursBeforeMax * 60 * 60 * 1000);

      console.log(`Checking ${config.type} reminders between ${minTime.toISOString()} and ${maxTime.toISOString()}`);

      // Get appointments in this time range
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          scheduled_at,
          location,
          status,
          lead_id,
          client_id,
          leads!inner (
            id,
            first_name,
            last_name,
            phone
          ),
          clients!inner (
            id,
            company_name,
            phone
          )
        `)
        .eq('status', 'scheduled')
        .gte('scheduled_at', minTime.toISOString())
        .lte('scheduled_at', maxTime.toISOString());

      if (appointmentsError) {
        console.error(`Error fetching appointments for ${config.type}:`, appointmentsError);
        continue;
      }

      console.log(`Found ${appointments?.length || 0} appointments for ${config.type} reminder`);

      for (const appointment of appointments || []) {
        // Check if reminder already sent
        const { data: existingReminder } = await supabase
          .from('appointment_reminders')
          .select('id')
          .eq('appointment_id', appointment.id)
          .eq('reminder_type', config.type)
          .maybeSingle();

        if (existingReminder) {
          console.log(`Reminder ${config.type} already sent for appointment ${appointment.id}`);
          continue;
        }

        const lead = appointment.leads as any;
        const client = appointment.clients as any;

        if (!lead?.phone) {
          console.log(`No phone number for lead in appointment ${appointment.id}`);
          continue;
        }

        const formattedPhone = formatPhoneNumber(lead.phone);

        // Build template params
        const params = {
          lead_first_name: lead.first_name || '',
          lead_last_name: lead.last_name || '',
          lead_full_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          company_name: client?.company_name || '',
          c_phone: client?.phone || '',
          appointment_date: formatDate(appointment.scheduled_at),
          appointment_time: formatTime(appointment.scheduled_at),
          appointment_location: appointment.location || '',
        };

        console.log(`Sending ${config.type} reminder to ${formattedPhone} for appointment ${appointment.id}`);

        // Create reminder record
        const { data: reminder, error: reminderError } = await supabase
          .from('appointment_reminders')
          .insert({
            appointment_id: appointment.id,
            reminder_type: config.type,
            status: 'pending',
          })
          .select()
          .single();

        if (reminderError) {
          console.error(`Error creating reminder record:`, reminderError);
          continue;
        }

        // Log the SMS
        const { data: smsLog, error: smsLogError } = await supabase
          .from('sms_logs')
          .insert({
            phone_number: formattedPhone,
            message: `[Template: ${config.templateId}] تذكير ${config.type} للموعد`,
            status: 'pending',
            lead_id: lead.id,
            sent_by: '00000000-0000-0000-0000-000000000000', // System user
          })
          .select()
          .single();

        // Send SMS via Ersaal Template API
        const ersaalPayload = {
          api_key: ersaalApiKey,
          to: formattedPhone,
          sender_id: '17271',
          template_id: config.templateId,
          params: params,
          payment_type: 'subscription',
        };

        try {
          const ersaalResponse = await fetch('https://sms.lamah.com/api/sms/messages/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ersaalPayload),
          });

          const ersaalResult = await ersaalResponse.json();
          console.log(`Ersaal response for ${config.type}:`, JSON.stringify(ersaalResult));

          const success = ersaalResult.error_code === 0;

          // Update reminder status
          await supabase
            .from('appointment_reminders')
            .update({
              status: success ? 'sent' : 'failed',
              sms_log_id: smsLog?.id,
              error_message: success ? null : ersaalResult.error_message,
            })
            .eq('id', reminder.id);

          // Update SMS log
          if (smsLog) {
            await supabase
              .from('sms_logs')
              .update({
                status: success ? 'sent' : 'failed',
                sent_at: success ? new Date().toISOString() : null,
              })
              .eq('id', smsLog.id);
          }

          results.push({
            appointment_id: appointment.id,
            reminder_type: config.type,
            success,
            message: ersaalResult.error_message || 'Sent successfully',
          });
        } catch (sendError: any) {
          console.error(`Error sending SMS for appointment ${appointment.id}:`, sendError);

          await supabase
            .from('appointment_reminders')
            .update({
              status: 'failed',
              error_message: sendError?.message || 'Unknown error',
            })
            .eq('id', reminder.id);

          results.push({
            appointment_id: appointment.id,
            reminder_type: config.type,
            success: false,
            message: sendError?.message || 'Unknown error',
          });
        }
      }
    }

    console.log(`Appointment reminders completed. Results:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        reminders_processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in appointment-reminders function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
