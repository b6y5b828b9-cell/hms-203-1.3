import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'A valid doctor session is required.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, { error: 'Doctor API is not configured.' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonResponse(401, { error: 'The doctor session is invalid or expired.' });

  const url = new URL(request.url);
  const isSaveRoute = url.pathname.endsWith('/save-emr');
  const isPendingResultsRoute = url.pathname.endsWith('/pending-results');

  if (request.method === 'POST' && isSaveRoute) {
    let body: {
      clinicId?: string;
      tokenId?: string;
      doctorOrders?: Record<string, unknown>;
      lineItems?: unknown[];
    };
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: 'Request body must be valid JSON.' });
    }
    if (!body.clinicId || !body.tokenId || !body.doctorOrders || !Array.isArray(body.lineItems)) {
      return jsonResponse(400, { error: 'clinicId, tokenId, doctorOrders, and lineItems are required.' });
    }

    const { data, error } = await supabase.rpc('save_doctor_visit_emr', {
      p_clinic_id: body.clinicId,
      p_token_id: body.tokenId,
      p_doctor_orders: body.doctorOrders,
      p_line_items: body.lineItems,
    });
    if (error) {
      const status = /assigned doctor|doctor membership/i.test(error.message) ? 403 : 422;
      return jsonResponse(status, { error: error.message });
    }
    return jsonResponse(200, data);
  }

  if (request.method === 'GET' && isPendingResultsRoute) {
    const clinicId = url.searchParams.get('clinicId');
    if (!clinicId) return jsonResponse(400, { error: 'clinicId query parameter is required.' });
    const { data, error } = await supabase.rpc('get_doctor_pending_results', {
      p_clinic_id: clinicId,
    });
    if (error) {
      const status = /doctor membership/i.test(error.message) ? 403 : 422;
      return jsonResponse(status, { error: error.message });
    }
    return jsonResponse(200, data || []);
  }

  return jsonResponse(404, { error: 'Doctor API route not found.' });
});
