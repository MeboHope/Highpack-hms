import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type CallbackMetadataItem = { Name?: string; Value?: unknown }

function item(items: CallbackMetadataItem[], name: string) {
  return items.find((entry) => entry.Name === name)?.Value ?? null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return new Response('Server configuration is incomplete', { status: 500 })

  const payload = await req.json().catch(() => null)
  if (!payload) return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const callback = payload?.Body?.stkCallback
  if (!callback?.CheckoutRequestID) return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Missing CheckoutRequestID' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const admin = createClient(supabaseUrl, serviceRole)
  const { data: payment } = await admin.from('payments').select('id, amount, status').eq('checkout_request_id', callback.CheckoutRequestID).maybeSingle()
  if (!payment) {
    console.warn('Unknown M-Pesa CheckoutRequestID', callback.CheckoutRequestID)
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { 'Content-Type': 'application/json' } })
  }

  const metadata = callback.CallbackMetadata?.Item || []
  const resultAmount = item(metadata, 'Amount')
  const receipt = item(metadata, 'MpesaReceiptNumber')
  const phone = item(metadata, 'PhoneNumber')
  const result = await admin.rpc('finalize_mpesa_payment', {
    p_payment_id: payment.id,
    p_result_code: Number(callback.ResultCode ?? 1),
    p_result_description: String(callback.ResultDesc || ''),
    p_checkout_request_id: callback.CheckoutRequestID,
    p_merchant_request_id: callback.MerchantRequestID || null,
    p_mpesa_receipt_number: receipt ? String(receipt) : null,
    p_transaction_phone: phone ? String(phone) : null,
    p_result_amount: resultAmount == null ? null : Number(resultAmount),
    p_provider_response: payload,
  })
  if (result.error) console.error('Could not finalize M-Pesa payment', result.error)

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { 'Content-Type': 'application/json' } })
})
