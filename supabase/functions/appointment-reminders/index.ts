// @ts-nocheck - Deno edge function (uses Deno runtime, not Node/Vite)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// No CORS headers needed for cron/internal function
const responseHeaders = {
  'Content-Type': 'application/json',
};

const APP_TIMEZONE = 'Africa/Tripoli';
const AR_LOCALE = 'ar-SA-u-nu-latn';

// Format phone number to international format
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
  try {
    // Format: YYYY/MM/DD
    const formatter = new Intl.DateTimeFormat(AR_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: APP_TIMEZONE
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${get('year')}/${get('month')}/${get('day')}`;
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}

// Format time to HH:MM
function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  try {
    return new Intl.DateTimeFormat(AR_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: APP_TIMEZONE
    }).format(date);
  } catch (e) {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }
}

// Get Arabic day name
function getArabicDayName(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  try {
    return new Intl.DateTimeFormat(AR_LOCALE, {
      weekday: 'long',
      timeZone: APP_TIMEZONE
    }).format(date);
  } catch (e) {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getUTCDay()];
  }
}

interface ReminderConfig {
  type: '24h' | '6h' | '1h';
  templateId: string | null; // null = skip sending (no template available)
  hoursBeforeMin: number;
  hoursBeforeMax: number;
}

function getReminderConfigs(): ReminderConfig[] {
  const template24h = (Deno.env.get('REMINDER_TEMPLATE_ID_24H') || 'appointment-reminder-24h').trim();
  const template1h = (Deno.env.get('REMINDER_TEMPLATE_ID_1H') || 'appointment-reminder-1h').trim();

  // Keep 6h disabled by default unless explicitly configured.
  const template6hRaw = Deno.env.get('REMINDER_TEMPLATE_ID_6H');
  const template6h = template6hRaw && template6hRaw.trim() !== '' ? template6hRaw.trim() : null;

  return [
    { type: '24h', templateId: template24h, hoursBeforeMin: 23, hoursBeforeMax: 25 },
    { type: '6h', templateId: template6h, hoursBeforeMin: 5, hoursBeforeMax: 7 },
    { type: '1h', templateId: template1h, hoursBeforeMin: 0.5, hoursBeforeMax: 1.5 },
  ];
}

serve(async (req) => {
  // SECURITY: This function requires authorization via service role key OR anon key
  // Only Supabase Cron (pg_cron/pg_net) or authorized service calls can trigger reminders
  const authHeader = req.headers.get('Authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

  // ALWAYS require authorization header - no exceptions
  if (!bearerMatch) {
    console.error('Missing authorization header - rejecting request');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Authorization header required' }),
      { status: 401, headers: responseHeaders }
    );
  }

  const token = bearerMatch[1].trim();
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseServiceKey && !supabaseAnonKey) {
    console.error('No server auth keys configured in function environment');
    return new Response(
      JSON.stringify({ error: 'Server is not configured correctly' }),
      { status: 500, headers: responseHeaders }
    );
  }

  // Allow service role key or anon key (for pg_cron internal calls)
  if (token !== supabaseServiceKey && token !== supabaseAnonKey) {
    console.warn('Unauthorized attempt to trigger appointment reminders - invalid credentials');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - invalid credentials' }),
      { status: 401, headers: responseHeaders }
    );
  }

  console.log('Authorization validated - proceeding with appointment reminders');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const ersaalApiKey = Deno.env.get('ERSAAL_API_KEY');
    const reminderConfigs = getReminderConfigs();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    }

    if (!ersaalApiKey) {
      throw new Error('ERSAAL_API_KEY is not configured');
    }

    // Check for specific appointment_id in request body (for immediate trigger)
    let specificAppointmentId: string | null = null;
    try {
      const body = await req.json();
      if (body && body.appointment_id) {
        specificAppointmentId = body.appointment_id;
        console.log(`Received request for specific appointment: ${specificAppointmentId}`);
      }
    } catch {
      // Body parsing failed or empty - assume cron run
    }

    // Use service role for all database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notifySuperAdmins = async (title: string, message: string, data?: Record<string, unknown>) => {
      try {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');

        if (!adminRoles || adminRoles.length === 0) return;
        const rows = adminRoles.map((row: { user_id: string }) => ({
          user_id: row.user_id,
          title,
          message,
          type: 'system',
          data: data ?? {},
        }));
        await supabase.from('notifications').insert(rows);
      } catch {
        // ignore notification failures
      }
    };

    const logDeadLetter = async (payload: Record<string, unknown>, errorMessage: string) => {
      try {
        await supabase.from('job_dead_letters').insert({
          source: 'appointment-reminders',
          job_name: 'appointment-reminders',
          payload,
          error_message: errorMessage,
        });
      } catch {
        // ignore logging failures
      }
    };

    const { data: jobRun, error: jobRunError } = await supabase
      .from('job_runs')
      .insert({
        job_name: 'appointment-reminders',
        job_type: specificAppointmentId ? 'trigger' : 'cron',
        status: 'running',
        details: {
          started_at: new Date().toISOString(),
          trigger_type: specificAppointmentId ? 'specific_appointment' : 'scheduled_cron',
          specific_appointment_id: specificAppointmentId
        },
      })
      .select('id')
      .single();

    const jobRunId = jobRun?.id || null;

    const now = new Date();
    // Use Africa/Tripoli timezone (UTC+2) for all time calculations
    const nowTripoliMs = now.getTime() + (2 * 60 * 60 * 1000);
    const results: any[] = [];

    console.log(`Running appointment reminders check at ${now.toISOString()} (UTC)`);
    console.log(`Using Tripoli time for window calculations`);

    for (const config of reminderConfigs) {
      // Calculate time range for this reminder type using Tripoli-adjusted time
      const minTime = new Date(nowTripoliMs + config.hoursBeforeMin * 60 * 60 * 1000);
      const maxTime = new Date(nowTripoliMs + config.hoursBeforeMax * 60 * 60 * 1000);

      console.log(`Checking ${config.type} reminders between ${minTime.toISOString()} and ${maxTime.toISOString()} (Tripoli time)`);

      // Build the query
      let query = supabase
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
        .eq('status', 'scheduled');

      // If checking a specific appointment, filter by ID
      // We still respect the time window to validity of the reminder type
      if (specificAppointmentId) {
        query = query.eq('id', specificAppointmentId);
      }

      // Apply time window constraints (for both cron and specific check)
      query = query.gte('scheduled_at', minTime.toISOString())
        .lte('scheduled_at', maxTime.toISOString());

      const { data: appointments, error: appointmentsError } = await query;

      if (appointmentsError) {
        console.error(`Error fetching appointments for ${config.type}:`, appointmentsError);
        await logDeadLetter({ reminder_type: config.type }, appointmentsError.message || 'appointments query failed');
        continue;
      }

      console.log(`Found ${appointments?.length || 0} appointments for ${config.type} reminder`);

      if (specificAppointmentId && (!appointments || appointments.length === 0)) {
        console.warn(`Specific appointment ${specificAppointmentId} was not found or is outside the ${config.type} time window (${minTime.toISOString()} - ${maxTime.toISOString()}).`);
      }

      for (const appointment of appointments || []) {
        // Skip if no template configured for this reminder type.
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

        // Check existing reminder record to avoid unique-index conflicts.
        const { data: existingReminder, error: existingReminderError } = await supabase
          .from('appointment_reminders')
          .select('id, status')
          .eq('appointment_id', appointment.id)
          .eq('reminder_type', config.type)
          .maybeSingle();

        if (existingReminderError) {
          console.error(`Error checking existing reminder ${config.type} for appointment ${appointment.id}:`, existingReminderError);
          await logDeadLetter(
            { appointment_id: appointment.id, reminder_type: config.type },
            existingReminderError.message || 'existing reminder lookup failed'
          );
          continue;
        }

        // Skip if already sent OR if there's a pending attempt (to prevent duplicates across cron runs)
        if (existingReminder?.status === 'sent' || existingReminder?.status === 'pending') {
          console.log(`Reminder ${config.type} already ${existingReminder.status} for appointment ${appointment.id}, skipping`);
          continue;
        }

        let reminderId: string | null = existingReminder?.id ?? null;

        // Reuse pending/failed row so retries never fail on unique index.
        if (existingReminder) {
          const { data: refreshedReminder, error: refreshReminderError } = await supabase
            .from('appointment_reminders')
            .update({
              status: 'pending',
              error_message: null,
              sent_at: new Date().toISOString(),
            })
            .eq('id', existingReminder.id)
            .select('id')
            .single();

          if (refreshReminderError) {
            console.error(`Error refreshing reminder record ${existingReminder.id}:`, refreshReminderError);
            await logDeadLetter(
              { appointment_id: appointment.id, reminder_type: config.type },
              refreshReminderError.message || 'refresh reminder failed'
            );
            continue;
          }

          reminderId = refreshedReminder.id;
        } else {
          const { data: reminder, error: reminderError } = await supabase
            .from('appointment_reminders')
            .insert({
              appointment_id: appointment.id,
              reminder_type: config.type,
              status: 'pending',
            })
            .select('id')
            .single();

          if (reminderError) {
            console.error(`Error creating reminder record:`, reminderError);
            await logDeadLetter(
              { appointment_id: appointment.id, reminder_type: config.type },
              reminderError.message || 'create reminder failed'
            );
            continue;
          }

          reminderId = reminder.id;
        }

        // Build template params as simple array of objects (Ersaal format: [{ "key": "value" }])
        // Truncate company_name to 10 chars as per Ersaal limits
        // Use a default phone number if client phone is not available
        const companyName = (client?.company_name || '').substring(0, 10);
        const clientPhone = client?.phone || '17271'; // Default to company number if client has no phone

        const params = [
          { company_name: companyName || 'الشركة' },
          { lead_first_name: lead.first_name || 'العميل' },
          { lead_last_name: lead.last_name || '' },
          { lead_full_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'العميل' },
          { appointment_date: formatDate(appointment.scheduled_at) },
          { appointment_time: formatTime(appointment.scheduled_at) },
          { appointment_hour: formatTime(appointment.scheduled_at) },
          { appointment_day: getArabicDayName(appointment.scheduled_at) },
          { appointment_location: appointment.location || 'سيتم تحديده لاحقاً' },
          { c_number: clientPhone },
          { c_phone: clientPhone }
        ];

        console.log(`Sending ${config.type} reminder to ${formattedPhone} for appointment ${appointment.id}`);

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
            .eq('id', reminderId);

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

          if (!success) {
            await logDeadLetter(
              { appointment_id: appointment.id, reminder_type: config.type, http_status: ersaalResponse.status },
              ersaalResult.error || ersaalResult.message || 'Ersaal failed'
            );
            await notifySuperAdmins(
              'Appointment reminder failed',
              `Reminder ${config.type} failed for appointment ${appointment.id}.`,
              { appointment_id: appointment.id, reminder_type: config.type }
            );
          }
        } catch (sendError: any) {
          console.error(`Error sending SMS for appointment ${appointment.id}:`, sendError);

          await supabase
            .from('appointment_reminders')
            .update({
              status: 'failed',
              error_message: sendError?.message || 'Unknown error',
            })
            .eq('id', reminderId);

          results.push({
            appointment_id: appointment.id,
            reminder_type: config.type,
            success: false,
            message: sendError?.message || 'Unknown error',
          });

          await logDeadLetter(
            { appointment_id: appointment.id, reminder_type: config.type },
            sendError?.message || 'SMS send failed'
          );
          await notifySuperAdmins(
            'Appointment reminder failed',
            `Reminder ${config.type} failed for appointment ${appointment.id}.`,
            { appointment_id: appointment.id, reminder_type: config.type }
          );
        }
      }
    }

    console.log(`Appointment reminders completed. Results:`, JSON.stringify(results));

    if (jobRunId) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - now.getTime();
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: finishedAt.toISOString(),
          duration_ms: durationMs,
          details: { reminders_processed: results.length },
        })
        .eq('id', jobRunId);
    }

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
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('job_runs').insert({
          job_name: 'appointment-reminders',
          job_type: 'cron',
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: error?.message || 'Unknown error',
        });
        await supabase.from('job_dead_letters').insert({
          source: 'appointment-reminders',
          job_name: 'appointment-reminders',
          payload: {},
          error_message: error?.message || 'Unknown error',
        });
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');
        if (adminRoles?.length) {
          await supabase.from('notifications').insert(
            adminRoles.map((row: { user_id: string }) => ({
              user_id: row.user_id,
              title: 'Appointment reminders failed',
              message: 'Appointment reminders job failed. Check logs and dead letters.',
              type: 'system',
            }))
          );
        }
      }
    } catch {
      // swallow logging errors
    }
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: responseHeaders }
    );
  }
});
