import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Safaricom callback endpoint foundation. Payment verification must happen
// server-side; the browser never calls this endpoint to claim success.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return new Response('Server configuration is incomplete', { status: 500 })

  const payload = await req.json().catch(() => null)
  if (!payload) return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  // TODO after Daraja onboarding: map CheckoutRequestID/receipt to the
  // pending payment, validate amount/account/merchant details, and update
  // status + verified using the service-role client in one controlled path.
  const admin = createClient(supabaseUrl, serviceRole)
  void admin // keeps the server-side client ready for the verified callback flow

  console.log('Received M-Pesa callback', JSON.stringify(payload))
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { 'Content-Type': 'application/json' } })
})
