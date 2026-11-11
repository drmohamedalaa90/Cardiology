/* ACL standard site header.
 * Use on every newly developed authenticated Basic Edition page:
 *   <link rel="stylesheet" href="assets/css/basic-universal-shell.css?v=20261023-simple">
 *   <link rel="stylesheet" href="assets/css/acl-standard-header.css?v=1">
 *   <script type="module" src="assets/js/acl-standard-header.js?v=1"><\/script>
 * This only adds the header, not quiz timers, integrity monitoring or bottom navigation.
 */
const HEADER_ID="aclStandardSiteHeader";
const escapeText=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
export function mountACLStandardHeader(){
 if(document.getElementById(HEADER_ID))return document.getElementById(HEADER_ID);
 if(document.querySelector(".basic-universal-topbar:not(.acl-standard-header)"))return null; // no duplicates
 const header=document.createElement("header");
 header.id=HEADER_ID;
 header.className="basic-universal-topbar acl-standard-header";
 header.setAttribute("aria-label","Alexandria Cardiology League");
 header.innerHTML=`
   <a class="basic-universal-brand" href="basic-home.html?edition=basic" aria-label="Cardiology League Basic Edition home">
     <img src="assets/images/acl-header-mark.svg" alt="ACL logo">
     <span class="basic-universal-brand-copy"><strong>Cardiology League</strong><small>Basic Edition</small></span>
   </a>
   <div class="basic-universal-actions">
     <button class="basic-expert-lock" type="button" data-acl-expert><span class="basic-lock-dot">◆</span><span>Expert Edition</span><small>Locked</small></button>
     <a class="basic-universal-user" href="basic-profile.html?edition=basic" aria-label="Open your profile" title="Open your profile">
       <span class="basic-universal-avatar" data-acl-avatar>ACL</span>
       <span class="acl-standard-user-copy"><strong data-acl-name>Member</strong><small data-acl-role>Basic learner</small></span>
     </a>
     <button class="basic-universal-refresh" data-acl-refresh type="button" aria-label="Refresh page" title="Refresh page"><span aria-hidden="true">↻</span></button>
     <a class="basic-universal-contact" href="mailto:drmohamedalaa90@gmail.com" aria-label="Email ACL" title="Email ACL"><span aria-hidden="true">✉</span></a>
     <button class="basic-universal-logout" data-acl-logout type="button">Log out</button>
   </div>`;
 const modal=document.createElement("div");
 modal.className="basic-level-modal acl-standard-expert-modal";
 modal.id="aclStandardExpertModal";
 modal.hidden=true;
 modal.innerHTML='<section class="basic-level-dialog" role="dialog" aria-modal="true" aria-labelledby="aclStdExpertTitle"><div class="basic-level-icon">◆</div><h2 id="aclStdExpertTitle">Expert Edition</h2><p>This edition is not available for your level.</p><button type="button" data-acl-close-expert>Continue Basic Edition</button></section>';
 document.body.insertBefore(header,document.body.firstChild);
 document.body.appendChild(modal);
 document.body.classList.add("acl-standard-header-active");
 const updateSpace=()=>document.documentElement.style.setProperty("--acl-standard-header-height",header.getBoundingClientRect().height+"px");
 updateSpace();
 if("ResizeObserver"in window){const observer=new ResizeObserver(updateSpace);observer.observe(header);}
 else window.addEventListener("resize",updateSpace);
 const close=()=>modal.hidden=true;
 header.querySelector("[data-acl-expert]")?.addEventListener("click",()=>modal.hidden=false);
 modal.querySelector("[data-acl-close-expert]")?.addEventListener("click",close);
 modal.addEventListener("click",event=>{if(event.target===modal)close();});
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!modal.hidden)close();});
 header.querySelector("[data-acl-refresh]")?.addEventListener("click",()=>location.reload());
 header.querySelector("[data-acl-logout]")?.addEventListener("click",async event=>{
   const button=event.currentTarget;button.disabled=true;
   try{const {supabaseClient}=await import("./supabase-client.js");await supabaseClient.auth.signOut();}
   catch(error){console.warn("ACL logout encountered an error",error);}
   location.replace("acl-access.html?build=20261023-clean");
 });
 void populateMember(header);
 return header;
}
async function populateMember(header){
 try{
   const {supabaseClient}=await import("./supabase-client.js");
   const {data}=await supabaseClient.auth.getSession();
   let u=data?.session?.user;
   if(!u||!header.isConnected)return;
   // Resolve the linked ACL identity from the authenticated API, not a
   // provider-specific role (which may be "authenticated" for administrators).
   let verifiedRole="";
   try {
     const token=sessionStorage.getItem("aclLegacyToken")||localStorage.getItem("aclLegacyToken")||data?.session?.access_token;
     if(token){
       const response=await fetch("https://acl-neon-api.drmohamedalaa90.workers.dev/auth/me",{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)});
       if(response.ok){
         const identity=await response.json();
         if(identity.authenticated&&identity.linked&&identity.profile?.id){
           verifiedRole=String(identity.profile.role||"").toLowerCase();
           u={...u,id:identity.profile.id,email:identity.profile.email||u.email};
         }
       }
     }
   }catch(error){console.warn("ACL header identity verification unavailable",error);}
   let profile=null;
   try{const r=await supabaseClient.from("profiles").select("display_name,full_name,avatar_url,role").eq("id",u.id).maybeSingle();profile=r.data;}catch(error){console.warn("ACL header profile",error);}
   const name=profile?.display_name||profile?.full_name||u.user_metadata?.display_name||u.user_metadata?.full_name||u.email?.split("@")[0]||"Member";
   const photo=profile?.avatar_url||u.user_metadata?.avatar_url||u.user_metadata?.picture||"";
   const nameNode=header.querySelector("[data-acl-name]"),roleNode=header.querySelector("[data-acl-role]"),avatar=header.querySelector("[data-acl-avatar]");
   if(nameNode)nameNode.textContent=name;
   if(roleNode)roleNode.textContent=(verifiedRole||profile?.role||u.role)==="admin"?"Administrator":"Basic learner";
   if(avatar){
     const fallback=()=>{avatar.textContent=String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL";};
     if(photo){
       const img=document.createElement("img");img.alt="";img.decoding="async";img.referrerPolicy="no-referrer";
       img.onerror=fallback;img.src=photo;avatar.replaceChildren(img);
     }else fallback();
   }
 }catch(error){console.warn("ACL header session",error);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>mountACLStandardHeader(),{once:true});
else mountACLStandardHeader();
