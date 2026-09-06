import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`
  if (digits.startsWith('1') && digits.length === 9) return `254${digits}`
  throw new Error('Enter a valid Kenyan M-Pesa number, e.g. 0712345678')
}

function timestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((p) => p.type === type)?.value || '00'
  return `${value('year')}${value('month')}${value('day')}${value('hour')}${value('minute')}${value('second')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET')
  const passkey = Deno.env.get('DARAJA_PASSKEY')
  const shortcode = Deno.env.get('DARAJA_SHORTCODE') || '4080693'
  const callbackUrl = Deno.env.get('DARAJA_CALLBACK_URL')
  const environment = (Deno.env.get('DARAJA_ENVIRONMENT') || 'production').toLowerCase()

  if (!supabaseUrl || !serviceRole || !consumerKey || !consumerSecret || !passkey || !callbackUrl) {
    return json({ error: 'M-Pesa integration is not fully configured. Set Daraja secrets and DARAJA_CALLBACK_URL.', setupRequired: true }, 503)
  }

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Authentication required' }, 401)
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Authentication required' }, 401)

  const body = await req.json().catch(() => ({}))
  if (!body.payment_id || !body.phone) return json({ error: 'payment_id and phone are required' }, 400)

  let phone: string
  try { phone = normalizePhone(String(body.phone)) } catch (e) { return json({ error: e instanceof Error ? e.message : 'Invalid phone number' }, 400) }

  const admin = createClient(supabaseUrl, serviceRole)
  const { data: payment, error } = await admin.from('payments').select('*').eq('id', body.payment_id).eq('user_id', user.id).eq('payment_method', 'mpesa').eq('status', 'pending').single()
  if (error || !payment) return json({ error: 'Pending M-Pesa payment not found' }, 404)

  const authBase = environment === 'sandbox' ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke'
  const basic = btoa(`${consumerKey}:${consumerSecret}`)
  const tokenRes = await fetch(`${authBase}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } })
  const tokenJson = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokenJson.access_token) return json({ error: 'Could not authenticate with Safaricom Daraja', provider: tokenJson }, 502)

  const time = timestamp()
  const password = btoa(`${shortcode}${passkey}${time}`)
  const amount = Math.max(1, Math.round(Number(payment.amount)))
  const stkRes = await fetch(`${authBase}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: time,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: payment.receipt_number || `HP-${String(payment.id).slice(0, 8).toUpperCase()}`,
      TransactionDesc: `HighPark Consult ${payment.payment_type}`,
    }),
  })
  const stk = await stkRes.json().catch(() => ({}))
  if (!stkRes.ok || !stk.ResponseCode || stk.ResponseCode !== '0') return json({ error: stk.errorMessage || stk.ResponseDescription || 'Safaricom rejected the STK request', provider: stk }, 502)

  const { error: updateError } = await admin.from('payments').update({
    payer_phone: phone,
    merchant_request_id: stk.MerchantRequestID || null,
    checkout_request_id: stk.CheckoutRequestID || null,
    provider_response: stk,
    initiated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', payment.id).eq('status', 'pending')
  if (updateError) return json({ error: 'STK request was accepted but payment tracking could not be saved', provider: stk }, 500)

  return json({ accepted: true, payment_id: payment.id, checkout_request_id: stk.CheckoutRequestID, customer_message: stk.CustomerMessage || 'Enter your M-Pesa PIN on your phone.' })
})
