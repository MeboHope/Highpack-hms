import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const payload=await req.json(); const t=payload?.transaction||{}; const b=payload?.bank||{}; const c=payload?.customer||{};
  if(payload?.callbackType!=='ALT') return json({code:0,message:'Ignored callback'});
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ref=String(t.reference||b.reference||c.reference||'').trim(); const amount=Number(t.amount||t.orderAmount||0); const status=String(t.status||'').toUpperCase();
  if(!ref||!amount) return json({code:0,message:'No actionable transaction'});
  const {data:payments}=await supabase.from('payments').select('id,user_id,amount,status,verified,equity_external_ref,equity_payment_link_ref,invoice_id').eq('payment_method','equity').or(`equity_external_ref.eq.${ref},equity_payment_link_ref.eq.${ref},transaction_ref.eq.${ref},provider_reference.eq.${ref}`).limit(5);
  const match=(payments||[]).find(p=>Math.abs(Number(p.amount)-amount)<0.01 && !p.verified);
  if(!match) return json({code:0,message:'Callback received; no matching pending payment'});
  if(status!=='SUCCESS') return json({code:0,message:'Non-success Equity callback recorded'});
  const {data:verified,error}=await supabase.rpc('review_payment_by_admin',{p_payment_id:match.id,p_action:'verify',p_rejection_reason:null});
  if(error) return json({code:500,message:error.message},500);
  await supabase.from('payments').update({transaction_ref:ref,equity_status_code:'SUCCESS',equity_status_name:'Successful',equity_completed_at:new Date().toISOString(),equity_response:payload}).eq('id',match.id);
  return json({code:0,message:'Payment reconciled',payment_id:verified?.id||match.id});
 }catch(e){return json({code:500,message:e instanceof Error?e.message:'Callback error'},500)}
});
