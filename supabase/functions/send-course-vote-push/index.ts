import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.5";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Content-Type":"application/json"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const b64bytes=(value:string)=>{const n=value.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(n+"=".repeat((4-n.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
const b64url=(bytes:Uint8Array)=>{let raw="";for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
const privateJwk=(pub:string,priv:string)=>{const b=b64bytes(pub);if(b.length!==65||b[0]!==4)throw new Error("Invalid VAPID public key");return {kty:"EC",crv:"P-256",x:b64url(b.slice(1,33)),y:b64url(b.slice(33,65)),d:priv,ext:true,key_ops:["sign"]}};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,pub=Deno.env.get("VAPID_PUBLIC_KEY")!,priv=Deno.env.get("VAPID_PRIVATE_KEY")!,subject=Deno.env.get("VAPID_SUBJECT")!;
  if(!url||!anon||!service||!pub||!priv||!subject)throw new Error("Push configuration is incomplete");
  const auth=req.headers.get("Authorization")||"",userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}}),{data:{user}}=await userClient.auth.getUser();
  if(!user)return respond({error:"Sign in required"},401);
  const voteId=String((await req.json()).vote_id||"");if(!/^[0-9a-f-]{36}$/i.test(voteId))return respond({error:"Invalid vote"},400);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const [{data:profile},{data:vote}]=await Promise.all([admin.from("profiles").select("role").eq("id",user.id).maybeSingle(),admin.from("special_course_votes").select("id,module_id,session_id,question,created_by,created_at,push_sent_at").eq("id",voteId).single()]);
  const allowed=user.email?.toLowerCase()==="drmohamedalaa90@gmail.com"||["admin","administrator"].includes(String(profile?.role||"").toLowerCase());
  if(!allowed||!vote||vote.created_by!==user.id)return respond({error:"Admin access required"},403);
  if(vote.push_sent_at)return respond({success:true,sent:0,duplicate:true});
  const [{data:room},{data:course},{data:seats}]=await Promise.all([admin.from("special_course_sessions").select("session_number,title").eq("id",vote.session_id).single(),admin.from("modules").select("title").eq("id",vote.module_id).single(),admin.from("special_course_seats").select("user_id").eq("module_id",vote.module_id)]);
  const userIds=[...new Set((seats||[]).map((x:any)=>x.user_id).filter(Boolean))];if(!userIds.length){await admin.from("special_course_votes").update({push_sent_at:new Date().toISOString()}).eq("id",vote.id);return respond({success:true,sent:0})}
  const {data:subs}=await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id",userIds).eq("is_active",true);
  const title=`Live vote · Room ${room?.session_number||""}`,body=String(vote.question||"A new ACL vote has started.").slice(0,220),action=`/Cardiology/basic-special-course.html?edition=basic&course=${encodeURIComponent(vote.module_id)}&room=${encodeURIComponent(vote.session_id)}&vote=${encodeURIComponent(vote.id)}`;
  const jwk=privateJwk(pub,priv),results=await Promise.all((subs||[]).map(async(s:any)=>{try{const built=await buildPushHTTPRequest({privateJWK:jwk,subscription:{endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},message:{payload:{title,body,icon:"/Cardiology/assets/images/acl-icon-192.png",badge:"/Cardiology/assets/images/acl-icon-192.png",tag:`course-vote-${vote.id}`,type:"course_vote",url:action,requireInteraction:true,data:{url:action}},adminContact:subject,options:{ttl:1800,urgency:"high"}}});const response=await fetch(built.endpoint,{method:"POST",headers:built.headers,body:built.body});if([404,410].includes(response.status))await admin.from("push_subscriptions").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",s.id);return response.ok}catch{return false}}));
  await admin.from("special_course_votes").update({push_sent_at:new Date().toISOString()}).eq("id",vote.id);
  return respond({success:true,total:results.length,sent:results.filter(Boolean).length,course:course?.title||"Special course"});
 }catch(error){return respond({error:error instanceof Error?error.message:String(error)},500)}
});
