import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const base=()=>Deno.env.get('EQUITY_JENGA_ENVIRONMENT')==='production'?'https://api.finserve.africa':'https://uat.finserve.africa';
async function token(){
 const apiKey=Deno.env.get('EQUITY_JENGA_API_KEY'), merchantCode=Deno.env.get('EQUITY_JENGA_MERCHANT_CODE'), consumerSecret=Deno.env.get('EQUITY_JENGA_CONSUMER_SECRET');
 if(!apiKey||!merchantCode||!consumerSecret) throw new Error('Equity/Jenga credentials are not configured');
 const r=await fetch(`${base()}/authentication/api/v3/authenticate/merchant`,{method:'POST',headers:{'Content-Type':'application/json','Api-Key':apiKey},body:JSON.stringify({merchantCode,consumerSecret})});
 const d=await r.json(); if(!r.ok||!d.accessToken) throw new Error(d.message||'Equity authentication failed'); return d.accessToken as string;
}
async function sign(text:string){
 const pem=Deno.env.get('EQUITY_JENGA_PRIVATE_KEY'); if(!pem) throw new Error('Equity/Jenga private key is not configured');
 const clean=pem.replace(/\\n/g,'\n');
 const b64=clean.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\s/g,'');
 const raw=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',raw,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(text));
 return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization'); if(!auth) return json({error:'Unauthorized'},401);
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userErr}=await supabase.auth.getUser(); if(userErr||!user) return json({error:'Unauthorized'},401);
  const {payment_id}=await req.json();
  const {data:payment,error:pErr}=await supabase.from('payments').select('*,profiles:user_id(full_name)').eq('id',payment_id).eq('user_id',user.id).maybeSingle();
  if(pErr||!payment) return json({error:pErr?.message||'Payment not found'},404);
  if(payment.payment_method!=='equity') return json({error:'Payment method is not Equity'},400);
  if(payment.status!=='pending'||payment.verified) return json({error:'Payment is no longer pending'},400);
  const {data:profile}=await supabase.from('profiles').select('full_name,phone').eq('id',user.id).maybeSingle();
  const name=(profile?.full_name||user.email||'HighPark Tenant').trim().split(/\s+/); const firstName=name.shift()||'Tenant'; const lastName=name.join(' ')||'Customer';
  const externalRef=`HP-${payment.id.replaceAll('-','').slice(0,20).toUpperCase()}`;
  const expiry=new Date(Date.now()+48*60*60*1000).toISOString().slice(0,10); const saleDate=new Date().toISOString().slice(0,10); const amount=Number(payment.amount); const amountText=amount.toFixed(2); const amountOption='RESTRICTED';
  const payload={customers:[{firstName,lastName,email:user.email||'payments@highparkconsult.co.ke',phoneNumber:profile?.phone||undefined,countryCode:'KE'}],paymentLink:{expiryDate:expiry,saleDate,paymentLinkType:'SINGLE',saleType:'SERVICE',name:`HighPark ${payment.payment_type==='rent'?'Rent':'Security Deposit'} Payment`,description:`HighPark Consult ${payment.payment_type} payment`,externalRef,amountOption,amount:amount,currency:'KES'},notifications:[...(user.email?['EMAIL']:[]),...(profile?.phone?['SMS']:[])]};
  const signature=await sign(`${expiry}${amountText}KES${amountOption}${externalRef}`); const access=await token();
  const r=await fetch(`${base()}/api-checkout/api/v1/create/payment-link`,{method:'POST',headers:{'Authorization':`Bearer ${access}`,'Content-Type':'application/json','signature':signature},body:JSON.stringify(payload)}); const d=await r.json();
  if(!r.ok||!d?.status) return json({error:d?.message||'Equity payment link could not be created',provider_response:d},400);
  const linkRef=d.data?.paymentLinkRef||null;
  await supabase.from('payments').update({equity_payment_link_ref:linkRef,equity_external_ref:externalRef,equity_status_code:d.data?.status?.code||'PEND',equity_status_name:d.data?.status?.name||'Pending',equity_response:d,equity_initiated_at:new Date().toISOString(),provider_reference:linkRef}).eq('id',payment.id);
  return json({success:true,payment_link_ref:linkRef,external_ref:externalRef,status:d.data?.status?.name||'Pending',message:'Your Equity payment link has been created. Follow the payment instructions sent to your registered contact.'});
 }catch(e){return json({error:e instanceof Error?e.message:'Equity payment error'},500)}
});
