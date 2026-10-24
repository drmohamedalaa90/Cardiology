import {supabaseClient} from "./supabase-client.js";
const $=id=>document.getElementById(id);
const cleanName=value=>String(value||"").trim().replace(/^dr\.?\s*,?\s*/i,"").replace(/\s+/g," ");
const {data:{session}}=await supabaseClient.auth.getSession();
if(!session?.user){
  location.replace("acl-access.html?build=20261023-clean");
}else if(!session.user.email_confirmed_at){
  await supabaseClient.auth.signOut();
  location.replace("acl-access.html?build=20261023-clean&confirmation=required");
}else{
  const user=session.user;
  const {data:profile}=await supabaseClient.from("profiles").select("full_name,display_name").eq("id",user.id).maybeSingle();
  const name=cleanName(profile?.full_name||profile?.display_name||user.user_metadata?.full_name||user.email?.split("@")[0])||"colleague";
  $("welcomeName").textContent="Dear "+name+",";
  $("welcomeContinue").href="basic-home.html?edition=basic";
  $("welcomeContinue").addEventListener("click",()=>{try{sessionStorage.setItem("aclBasicWelcomed:"+user.id,"1");sessionStorage.setItem("aclEditionEntryGranted","basic");sessionStorage.setItem("aclSelectedEdition","basic");localStorage.setItem("aclSelectedEdition","basic");}catch{}});
}
