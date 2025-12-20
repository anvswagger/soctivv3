import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FacebookLeadPayload {
  client_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload: FacebookLeadPayload = await req.json();
    console.log('Received payload:', JSON.stringify(payload));

    // Validate required fields
    if (!payload.client_code) {
      console.log('Missing client_code');
      return new Response(
        JSON.stringify({ error: 'client_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.first_name || !payload.last_name) {
      console.log('Missing name fields');
      return new Response(
        JSON.stringify({ error: 'first_name and last_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by webhook_code
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id, company_name')
      .eq('webhook_code', payload.client_code)
      .single();

    if (clientError || !client) {
      console.log('Client not found for code:', payload.client_code, clientError);
      return new Response(
        JSON.stringify({ error: 'Invalid client_code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found client:', client.company_name);

    // Insert the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        client_id: client.id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email || null,
        phone: payload.phone || null,
        source: payload.source || 'Facebook Lead Ads',
        notes: payload.notes || null,
        status: 'new'
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error inserting lead:', leadError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lead', details: leadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead created successfully:', lead.id);

    // Create notification for the client owner
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: client.user_id,
        title: 'عميل محتمل جديد من Facebook',
        message: `تم استلام عميل محتمل جديد: ${payload.first_name} ${payload.last_name}`,
        type: 'lead',
        data: { lead_id: lead.id, source: 'facebook' }
      });

    if (notifError) {
      console.warn('Failed to create notification:', notifError);
      // Don't fail the request for notification errors
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        message: 'Lead created successfully' 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
