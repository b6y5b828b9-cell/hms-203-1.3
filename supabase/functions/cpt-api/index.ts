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
    return jsonResponse(401, { error: 'An authenticated clinic staff session is required.' });
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse(405, { error: 'Only GET and POST are supported.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, { error: 'CPT search is not configured.' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonResponse(401, { error: 'The staff session is invalid or expired.' });

  const { data: membership, error: membershipError } = await supabase
    .from('clinic_memberships')
    .select('clinic_id')
    .eq('user_id', authData.user.id)
    .in('role', ['admin', 'doctor', 'cashier', 'medical-coder'])
    .limit(1)
    .maybeSingle();
  if (membershipError) return jsonResponse(500, { error: 'Unable to verify clinic membership.' });
  if (!membership) return jsonResponse(403, { error: 'Your role is not permitted to search CPT tariffs.' });

  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname.endsWith('/add')) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: 'Request body must be valid JSON.' });
    }
    if (
      typeof body !== 'object' || body === null ||
      !('clinicId' in body) || typeof body.clinicId !== 'string' ||
      !('tokenId' in body) || typeof body.tokenId !== 'string' ||
      !('cptCode' in body) || typeof body.cptCode !== 'string' ||
      !('quantity' in body) || typeof body.quantity !== 'number' ||
      !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 999 ||
      !('expectedUnitPrice' in body) || typeof body.expectedUnitPrice !== 'number' ||
      !Number.isFinite(body.expectedUnitPrice) || body.expectedUnitPrice < 0 ||
      !/^[0-9a-f-]{36}$/i.test(body.clinicId) ||
      !/^[a-zA-Z0-9 .-]{1,80}$/.test(body.tokenId) ||
      !/^[a-zA-Z0-9 .-]{1,20}$/.test(body.cptCode)
    ) {
      return jsonResponse(400, { error: 'clinicId, tokenId, cptCode, and a quantity from 1 to 999 are required.' });
    }

    const { data: addedItem, error: addError } = await supabase.rpc('add_cpt_tariff_to_visit', {
      p_clinic_id: body.clinicId,
      p_token_id: body.tokenId,
      p_cpt_code: body.cptCode,
      p_quantity: body.quantity,
      p_expected_unit_price: body.expectedUnitPrice,
    });
    if (addError) {
      const status = /assigned doctor|clinic membership/i.test(addError.message) ? 403 :
        /not found/i.test(addError.message) ? 404 : 422;
      return jsonResponse(status, { error: addError.message });
    }
    return jsonResponse(201, addedItem);
  }

  if (request.method !== 'GET' || !url.pathname.endsWith('/search')) {
    return jsonResponse(404, { error: 'CPT API route not found.' });
  }

  const query = url.searchParams.get('q')?.trim() || '';
  if (query.length < 2 || query.length > 80 || !/^[a-zA-Z0-9 .-]+$/.test(query)) {
    return jsonResponse(400, { error: 'Search must be 2–80 characters and contain only letters, numbers, spaces, dots, or hyphens.' });
  }

  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const { data, error } = await supabase
    .from('cpt_tariff_master')
    .select('cpt_code, description, category, standard_unit_price')
    .eq('is_active', true)
    .or(`cpt_code.ilike.${pattern},description.ilike.${pattern}`)
    .order('cpt_code')
    .limit(10);
  if (error) return jsonResponse(500, { error: 'CPT tariff search failed.' });

  return jsonResponse(200, data || []);
});
