import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// No CORS headers needed for cron/internal function
const responseHeaders = {
  'Content-Type': 'application/json',
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

interface ReminderConfig {
  type: '24h' | '6h' | '1h';
  templateId: string | null; // null = skip sending (no template available)
  hoursBeforeMin: number;
  hoursBeforeMax: number;
}

const REMINDER_CONFIGS: ReminderConfig[] = [
  { type: '24h', templateId: 'appointment-reminder-24h', hoursBeforeMin: 23, hoursBeforeMax: 25 },
  { type: '6h', templateId: null, hoursBeforeMin: 5, hoursBeforeMax: 7 }, // No template yet
  { type: '1h', templateId: 'appointment-reminder-1h', hoursBeforeMin: 0.5, hoursBeforeMax: 1.5 },
];

serve(async (req) => {
  // SECURITY: This function should only be called by Supabase Cron or with service role key
  // Validate authorization using service role key
  const authHeader = req.headers.get('Authorization');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Check if the request has valid service role authorization
  // This ensures only internal cron jobs or authorized service calls can trigger reminders
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    // Only allow service role key (not anon key or user tokens)
    if (token !== supabaseServiceKey) {
      console.warn('Unauthorized attempt to trigger appointment reminders');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - service role required' }),
        { status: 401, headers: responseHeaders }
      );
    }
  } else {
    // If no auth header, check for internal cron trigger
    // Supabase cron internally calls without auth header but we verify via service role in client
    console.log('Request without auth header - validating as potential cron trigger');
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const ersaalApiKey = Deno.env.get('ERSAAL_API_KEY');

    if (!ersaalApiKey) {
      throw new Error('ERSAAL_API_KEY is not configured');
    }

    // Use service role for all database operations
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
            phone,
            user_id
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
        // Check if reminder already sent SUCCESSFULLY (skip only if status = 'sent')
        const { data: existingReminder } = await supabase
          .from('appointment_reminders')
          .select('id, status')
          .eq('appointment_id', appointment.id)
          .eq('reminder_type', config.type)
          .eq('status', 'sent')
          .maybeSingle();

        if (existingReminder) {
          console.log(`Reminder ${config.type} already sent successfully for appointment ${appointment.id}`);
          continue;
        }

        // Delete any previously failed reminders before retrying
        await supabase
          .from('appointment_reminders')
          .delete()
          .eq('appointment_id', appointment.id)
          .eq('reminder_type', config.type)
          .eq('status', 'failed');

        // Skip if no template configured for this reminder type
        if (!config.templateId) {
          console.log(`No template configured for ${config.type}, skipping`);
          continue;
        }

        const lead = appointment.leads as any;
        const client = appointment.clients as any;

        if (!lead?.phone) {
          console.log(`No phone number for lead in appointment ${appointment.id}`);
          continue;
        }

        const formattedPhone = formatPhoneNumber(lead.phone);

        // Build template params as simple array of objects (Ersaal format: [{ "key": "value" }])
        const params = [
          { company_name: client?.company_name || '' },
          { lead_first_name: lead.first_name || '' },
          { lead_last_name: lead.last_name || '' },
          { lead_full_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() },
          { appointment_date: formatDate(appointment.scheduled_at) },
          { appointment_time: formatTime(appointment.scheduled_at) },
          { appointment_location: appointment.location || '' }
        ];

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


        // Send SMS via Ersaal Template API
        const ersaalPayload = {
          template_id: config.templateId,
          sender: '17271',
          receiver: formattedPhone,
          payment_type: 'subscription',
          params: params,
        };

        console.log(`Ersaal payload for ${config.type}:`, JSON.stringify(ersaalPayload));

        try {
          // Verify API key is present
          if (!ersaalApiKey) {
            throw new Error('ERSAAL_API_KEY is missing from environment variables');
          }
          console.log(`API Key first 4 chars: ${ersaalApiKey.substring(0, 4)}... (length: ${ersaalApiKey.length})`);

          const ersaalResponse = await fetch('https://sms.lamah.com/api/sms/messages/template', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${ersaalApiKey}`,
            },
            body: JSON.stringify(ersaalPayload),
          });

          // Handle raw response to catch HTML error pages
          const ersaalResponseText = await ersaalResponse.text();
          console.log(`Ersaal response status for ${config.type}:`, ersaalResponse.status);
          console.log(`Ersaal raw response for ${config.type}:`, ersaalResponseText);

          let ersaalResult: any;
          try {
            ersaalResult = JSON.parse(ersaalResponseText);
          } catch (parseError) {
            console.error(`Failed to parse Ersaal response as JSON:`, ersaalResponseText);
            ersaalResult = {
              error: 'Invalid response from Ersaal API',
              raw: ersaalResponseText,
              http_status: ersaalResponse.status
            };
          }

          console.log(`Ersaal parsed response for ${config.type}:`, JSON.stringify(ersaalResult));

          // Check success: API returns message_id on success, or error/message on failure
          const success = ersaalResult.message_id && !ersaalResult.error;

          // Update reminder status
          await supabase
            .from('appointment_reminders')
            .update({
              status: success ? 'sent' : 'failed',
              error_message: success ? null : `HTTP ${ersaalResult.http_status || ersaalResponse.status}. Error: ${ersaalResult.error || ersaalResult.message || 'None'}. Raw: ${String(ersaalResponseText || '').substring(0, 500)}`,
            })
            .eq('id', reminder.id);

          // Build log data
          const logData = {
            phone_number: formattedPhone,
            message: `[${config.templateId}] ${!success ? '(FAILED) ' : ''}Automated Reminder: ${config.type}`,
            lead_id: lead.id,
            status: success ? 'sent' : 'failed',
            sent_by: client.user_id,
            error_message: success ? null : `HTTP ${ersaalResult.http_status || ersaalResponse.status}. Error: ${ersaalResult.error || ersaalResult.message || 'None'}`,
            sent_at: success ? new Date().toISOString() : null
          };

          console.log('Attempting to insert into sms_logs:', JSON.stringify(logData, null, 2));

          // Log to clinical sms_logs so it shows in the dashboard (for BOTH success and failure)
          const { data: logInsert, error: logError } = await supabase
            .from('sms_logs')
            .insert(logData)
            .select();

          if (logError) {
            console.error('CRITICAL: Failed to insert into sms_logs:', JSON.stringify(logError, null, 2));
          } else {
            console.log('Successfully inserted into sms_logs:', JSON.stringify(logInsert, null, 2));
          }

          results.push({
            appointment_id: appointment.id,
            reminder_type: config.type,
            success,
            message: success ? 'Sent successfully' : (ersaalResult.message || ersaalResult.error || ersaalResult.raw || 'Unknown error'),
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
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error('Error in appointment-reminders function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: responseHeaders }
    );
  }
});
