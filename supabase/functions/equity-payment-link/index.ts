import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const base = () => Deno.env.get('EQUITY_JENGA_ENVIRONMENT') === 'production' ? 'https://api.finserve.africa' : 'https://uat.finserve.africa';

async function token() {
  const apiKey = Deno.env.get('EQUITY_JENGA_API_KEY');
  const merchantCode = Deno.env.get('EQUITY_JENGA_MERCHANT_CODE');
  const consumerSecret = Deno.env.get('EQUITY_JENGA_CONSUMER_SECRET');
  if (!apiKey || !merchantCode || !consumerSecret) throw new Error('Equity/Jenga credentials are not configured in Supabase secrets.');
  const r = await fetch(`${base()}/authentication/api/v3/authenticate/merchant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
    body: JSON.stringify({ merchantCode, consumerSecret }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.accessToken) throw new Error(`Equity authentication failed (${r.status}): ${d.message || d.error || 'No access token returned'}`);
  return d.accessToken as string;
}

async function sign(text: string) {
  const pem = Deno.env.get('EQUITY_JENGA_PRIVATE_KEY');
  if (!pem) throw new Error('Equity/Jenga private key is not configured in Supabase secrets.');
  const clean = pem.replace(/\\n/g, '\n');
  const b64 = clean.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\s/g, '');
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', raw, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Fail gracefully when Equity/Jenga has not yet been configured.
    // The tenant UI should receive a useful setup status instead of a generic 500.
    const missingEquitySecrets = [
      ['EQUITY_JENGA_API_KEY', Deno.env.get('EQUITY_JENGA_API_KEY')],
      ['EQUITY_JENGA_MERCHANT_CODE', Deno.env.get('EQUITY_JENGA_MERCHANT_CODE')],
      ['EQUITY_JENGA_CONSUMER_SECRET', Deno.env.get('EQUITY_JENGA_CONSUMER_SECRET')],
      ['EQUITY_JENGA_PRIVATE_KEY', Deno.env.get('EQUITY_JENGA_PRIVATE_KEY')],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missingEquitySecrets.length) {
      return json({
        success: false,
        code: 'EQUITY_NOT_CONFIGURED',
        error: 'Equity payments are not configured yet. The administrator must add the Equity/Jenga gateway credentials in Supabase before this payment method can be used.',
        missing_configuration: missingEquitySecrets,
      }, 200);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); return keys.service_role || keys.secret || ''; } catch { return ''; } })();
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase server configuration is incomplete. The function cannot access its service role.' }, 500);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Unauthorized' }, 401);

    // Use the caller's JWT only for identity. Use service_role for all payment/profile
    // reads and writes because tenant RLS intentionally prevents direct client updates
    // to payment records.
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRole);
    const body = await req.json().catch(() => ({})) as { payment_id?: unknown };
    const paymentId = String(body.payment_id || '').trim();
    if (!paymentId) return json({ error: 'payment_id is required' }, 400);

    const { data: payment, error: pErr } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
    if (pErr) return json({ error: `Payment lookup failed: ${pErr.message}` }, 500);
    if (!payment) return json({ error: 'Payment not found' }, 404);
    if (payment.user_id !== user.id) return json({ error: 'This payment does not belong to the signed-in user.' }, 403);
    if (payment.payment_method !== 'equity') return json({ error: 'Payment method is not Equity.' }, 400);
    if (payment.status !== 'pending' || payment.verified) return json({ error: 'Payment is no longer pending.' }, 409);

    const { data: profile, error: profileErr } = await admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle();
    if (profileErr) return json({ error: `Tenant profile lookup failed: ${profileErr.message}` }, 500);

    const name = (profile?.full_name || user.email || 'HighPark Tenant').trim().split(/\s+/);
    const firstName = name.shift() || 'Tenant';
    const lastName = name.join(' ') || 'Customer';
    const externalRef = `HP-${payment.id.replaceAll('-', '').slice(0, 20).toUpperCase()}`;
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const saleDate = new Date().toISOString().slice(0, 10);
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Invalid Equity payment amount.' }, 400);
    const amountText = amount.toFixed(2);
    const amountOption = 'RESTRICTED';
    const email = user.email || 'payments@highparkconsult.co.ke';
    const notifications = [...(user.email ? ['EMAIL'] : []), ...(profile?.phone ? ['SMS'] : [])];

    const payload = {
      customers: [{ firstName, lastName, email, phoneNumber: profile?.phone || undefined, countryCode: 'KE' }],
      paymentLink: {
        expiryDate: expiry,
        saleDate,
        paymentLinkType: 'SINGLE',
        saleType: 'SERVICE',
        name: `HighPark ${payment.payment_type === 'rent' ? 'Rent' : 'Security Deposit'} Payment`,
        description: `HighPark Consult ${payment.payment_type} payment`,
        externalRef,
        amountOption,
        amount: amountText,
        currency: 'KES',
      },
      notifications,
    };

    // Jenga documents that the signature must match the request-body amount exactly.
    const signature = await sign(`${expiry}${amountText}KES${amountOption}${externalRef}`);
    const access = await token();
    const r = await fetch(`${base()}/api-checkout/api/v1/create/payment-link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', Signature: signature },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    const providerStatus = d?.data?.status || d?.status || {};
    const providerAccepted = r.ok && Boolean(d?.data?.paymentLinkRef || providerStatus?.code || providerStatus?.name);
    if (!providerAccepted) {
      console.error('Equity payment link rejected', { status: r.status, response: d });
      return json({
        success: false,
        error: d?.message || d?.status?.message || `Equity payment link request failed (${r.status}).`,
        provider_status: r.status,
        provider_code: d?.code ?? d?.data?.status?.code ?? null,
        provider_status_name: d?.status?.name ?? d?.data?.status?.name ?? null,
        provider_response: d,
      }, 200);
    }

    const linkRef = d.data?.paymentLinkRef || null;
    const { error: updateErr } = await admin.from('payments').update({
      equity_payment_link_ref: linkRef,
      equity_external_ref: externalRef,
      equity_status_code: providerStatus?.code || 'PEND',
      equity_status_name: providerStatus?.name || 'Pending',
      equity_response: d,
      equity_initiated_at: new Date().toISOString(),
      provider_reference: linkRef,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id);
    if (updateErr) return json({ error: `Equity request was accepted but payment tracking failed: ${updateErr.message}` }, 500);

    return json({ success: true, payment_link_ref: linkRef, external_ref: externalRef, status: providerStatus?.name || 'Pending', message: 'Your Equity payment request has been created. Follow the payment instructions sent to your registered contact.' });
  } catch (e) {
    console.error('Equity payment-link error', e);
    return json({ error: e instanceof Error ? e.message : 'Equity payment error' }, 500);
  }
});
