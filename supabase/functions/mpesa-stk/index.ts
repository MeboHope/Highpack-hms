import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET')
  const passkey = Deno.env.get('DARAJA_PASSKEY')
  const shortcode = Deno.env.get('DARAJA_SHORTCODE') || '4080693'

  if (!supabaseUrl || !serviceRole) return json({ error: 'Server configuration is incomplete' }, 500)
  if (!consumerKey || !consumerSecret || !passkey) {
    return json({ error: 'M-Pesa Daraja credentials have not been configured yet', setupRequired: true }, 503)
  }

  void shortcode

  // This function is intentionally a production-safe integration shell until
  // HighPark receives live Daraja credentials and the approved callback URL.
  // Do not accept a browser-supplied success result here.
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Authentication required' }, 401)
  const body = await req.json().catch(() => ({}))
  if (!body.payment_id || !body.phone) return json({ error: 'payment_id and phone are required' }, 400)

  const admin = createClient(supabaseUrl, serviceRole)
  const { data: payment, error } = await admin.from('payments').select('*').eq('id', body.payment_id).eq('status', 'pending').single()
  if (error || !payment) return json({ error: 'Pending payment not found' }, 404)

  // TODO after Daraja onboarding: obtain OAuth token, call STK Push, save
  // CheckoutRequestID as provider_reference, then await the callback.
  return json({
    accepted: true,
    pending: true,
    payment_id: payment.id,
    message: 'Daraja credentials are present; complete the STK Push request and callback implementation before enabling live payments.',
  }, 202)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
