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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const consumerKey = Deno.env.get('DARAJA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('DARAJA_CONSUMER_SECRET')
    const passkey = Deno.env.get('DARAJA_PASSKEY')
    const shortcode = Deno.env.get('DARAJA_SHORTCODE')
    const callbackUrl = Deno.env.get('DARAJA_CALLBACK_URL')
    const environment = (Deno.env.get('DARAJA_ENVIRONMENT') || 'sandbox').toLowerCase()

    if (!supabaseUrl || !anonKey || !serviceRole || !consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
      return json({ error: 'M-Pesa integration is not fully configured. Set the Daraja secrets and callback URL.', setupRequired: true }, 503)
    }
    if (!['sandbox', 'production'].includes(environment)) return json({ error: 'DARAJA_ENVIRONMENT must be sandbox or production.' }, 500)
    if (passkey.trim().toUpperCase() === 'N/A') return json({ error: 'DARAJA_PASSKEY is not configured. Use the passkey issued by Safaricom Daraja.' }, 500)

    const authorization = req.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Authentication required' }, 401)

    const body = await req.json().catch(() => ({})) as { payment_id?: unknown; phone?: unknown }
    console.log('M-Pesa STK request', { paymentId: String(body.payment_id || ''), hasPhone: Boolean(body.phone) })
    if (!body.payment_id || !body.phone) return json({ error: 'payment_id and phone are required' }, 400)

    let phone: string
    try { phone = normalizePhone(String(body.phone)) }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid phone number' }, 400) }

    const admin = createClient(supabaseUrl, serviceRole)
    const { data: payment, error: paymentError } = await admin.from('payments').select('*').eq('id', String(body.payment_id)).maybeSingle()
    if (paymentError) {
      console.error('Payment lookup database error.', { code: paymentError.code, message: paymentError.message, details: paymentError.details, hint: paymentError.hint })
      return json({ error: 'Could not read the payment record.', diagnostic: { payment_id: String(body.payment_id), code: paymentError.code } }, 500)
    }
    if (!payment) return json({ error: 'Payment record not found for this request.', diagnostic: { payment_id: String(body.payment_id) } }, 404)
    if (payment.user_id !== user.id) return json({ error: 'This payment does not belong to the signed-in user.' }, 403)
    if (payment.payment_method !== 'mpesa') return json({ error: 'This payment is not configured for M-Pesa.' }, 400)
    if (payment.status !== 'pending' || payment.verified) return json({ error: 'This payment is no longer awaiting M-Pesa confirmation.' }, 409)

    const amount = Math.round(Number(payment.amount))
    if (!Number.isFinite(amount) || amount < 1) return json({ error: 'The payment amount is invalid.' }, 400)

    let accountReference = payment.receipt_number || `HP-${String(payment.id).slice(0, 8).toUpperCase()}`
    if (payment.unit_id) {
      const [{ data: unit }, { data: settings }] = await Promise.all([
        admin.from('property_units').select('unit_number').eq('id', payment.unit_id).maybeSingle(),
        admin.from('system_settings').select('mpesa_account_prefix').eq('id', 1).maybeSingle(),
      ])
      const prefix = String(settings?.mpesa_account_prefix || '382000').trim()
      const house = String(unit?.unit_number || '').trim()
      if (house) accountReference = `${prefix}#${house}`
    }

    const authBase = environment === 'sandbox' ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke'
    const basic = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenRes = await fetch(`${authBase}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } })
    const tokenJson = await tokenRes.json().catch(() => ({})) as { access_token?: string; errorMessage?: string; errorCode?: string }
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('Daraja OAuth failed.', { status: tokenRes.status, message: tokenJson.errorMessage, code: tokenJson.errorCode })
      return json({ error: 'Could not authenticate with Safaricom Daraja.', providerStatus: tokenRes.status, providerMessage: tokenJson.errorMessage || 'OAuth request failed.' }, 502)
    }

    const time = timestamp()
    const password = btoa(`${shortcode}${passkey}${time}`)
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
        AccountReference: accountReference,
        TransactionDesc: `HighPark Consult ${payment.payment_type}`,
      }),
    })
    const stk = await stkRes.json().catch(() => ({})) as Record<string, unknown>
    if (!stkRes.ok || String(stk.ResponseCode || '') !== '0') {
      console.error('Daraja STK rejected.', { status: stkRes.status, responseCode: stk.ResponseCode, message: stk.errorMessage || stk.ResponseDescription })
      return json({ error: String(stk.errorMessage || stk.ResponseDescription || 'Safaricom rejected the STK request.'), providerStatus: stkRes.status, providerMessage: String(stk.errorMessage || stk.ResponseDescription || '') }, 502)
    }

    const { error: updateError } = await admin.from('payments').update({
      payer_phone: phone,
      merchant_request_id: String(stk.MerchantRequestID || '') || null,
      checkout_request_id: String(stk.CheckoutRequestID || '') || null,
      provider_response: stk,
      initiated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id).eq('status', 'pending')
    if (updateError) {
      console.error('STK tracking save failed.', { code: updateError.code, message: updateError.message })
      return json({ error: 'STK request was accepted but payment tracking could not be saved.' }, 500)
    }

    return json({ accepted: true, payment_id: payment.id, checkout_request_id: stk.CheckoutRequestID, customer_message: String(stk.CustomerMessage || 'Enter your M-Pesa PIN on your phone.') })
  } catch (error) {
    console.error('Unexpected M-Pesa STK error.', error instanceof Error ? error.message : String(error))
    return json({ error: 'The M-Pesa payment request could not be started. Please try again.' }, 500)
  }
})
