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
  const auth=req.headers.get("Authorization")||"";
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return respond({error:"Sign in required"},401);
  const requestId=String((await req.json()).request_id||"");if(!/^[0-9a-f-]{36}$/i.test(requestId))return respond({error:"Invalid request"},400);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:help,error:helpError}=await admin.from("special_course_help_requests").select("id,module_id,session_id,user_id,request_type,question,created_at,push_sent_at").eq("id",requestId).single();
  if(helpError||!help||help.user_id!==user.id)return respond({error:"Request unavailable"},403);
  if(help.push_sent_at)return respond({success:true,sent:0,duplicate:true});
  if(Date.now()-Date.parse(help.created_at)>10*60*1000)return respond({error:"Request expired"},409);
  const [{data:room},{data:profile},{data:seat},{data:admins}]=await Promise.all([
   admin.from("special_course_sessions").select("session_number,title").eq("id",help.session_id).single(),
   admin.from("profiles").select("display_name,full_name,username").eq("id",user.id).single(),
   admin.from("special_course_seats").select("seat_number").eq("module_id",help.module_id).eq("user_id",user.id).single(),
   admin.from("profiles").select("id").in("role",["admin","administrator"])
  ]);
  const adminIds=(admins||[]).map((x:any)=>x.id);if(!adminIds.length)return respond({success:true,sent:0,message:"No administrator profile found"});
  const {data:subs}=await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id",adminIds).eq("is_active",true);
  const name=profile?.display_name||profile?.full_name||profile?.username||"ACL member",seatNo=String(seat?.seat_number||"").padStart(3,"0"),roomNo=room?.session_number||"";
  const title=help.request_type==="repeat"?`Room ${roomNo} · Please repeat`:`Room ${roomNo} · New question`;
  const body=help.request_type==="repeat"?`${name} · Seat ${seatNo} asks you to repeat the explanation.`:`${name} · Seat ${seatNo}: ${String(help.question||"").slice(0,220)}`;
  const action=`/Cardiology/basic-special-course.html?edition=basic&course=${encodeURIComponent(help.module_id)}`;
  const jwk=privateJwk(pub,priv),results=await Promise.all((subs||[]).map(async(s:any)=>{try{const built=await buildPushHTTPRequest({privateJWK:jwk,subscription:{endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},message:{payload:{title,body,icon:"/Cardiology/assets/images/acl-icon-192.png",badge:"/Cardiology/assets/images/acl-icon-192.png",tag:`course-help-${help.id}`,type:"course_help",url:action,requireInteraction:true,data:{url:action}},adminContact:subject,options:{ttl:3600,urgency:"high"}}});const response=await fetch(built.endpoint,{method:"POST",headers:built.headers,body:built.body});if([404,410].includes(response.status))await admin.from("push_subscriptions").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",s.id);return response.ok}catch{return false}}));
  await admin.from("special_course_help_requests").update({push_sent_at:new Date().toISOString()}).eq("id",help.id);
  return respond({success:true,total:results.length,sent:results.filter(Boolean).length});
 }catch(error){return respond({error:error instanceof Error?error.message:String(error)},500)}
});
