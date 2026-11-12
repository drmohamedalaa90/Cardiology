/* ACL ECG Lab admin draft autosave. Does not publish ECGs. */
(()=>{"use strict";
const API="https://acl-neon-api.drmohamedalaa90.workers.dev/learning/ecg-lab";
const KEY="acl-ecg-question-builder-v1";
const course=new URLSearchParams(location.search).get("course")||"basic-special-3d7c42c2-fb4e-44ab-bc7d-09c59992660c";
const nativeSet=Storage.prototype.setItem;
let enabled=false,dirty=false,busy=false,timer=null,remoteHasCases=false;
const status=s=>{const el=document.getElementById("draftNotice");if(el)el.textContent=s;};
const token=()=>sessionStorage.getItem("aclLegacyToken")||localStorage.getItem("aclLegacyToken");
async function api(method,body){
 const t=token();if(!t)throw Error("Sign in again to enable Neon saving");
 const r=await fetch(API+"?course="+encodeURIComponent(course),{method,headers:{Authorization:"Bearer "+t,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"HTTP "+r.status);return data;
}
async function flush(){
 if(!enabled||busy||!dirty)return;
 busy=true;dirty=false;status("🟠 Saving to Neon…");
 try{
  const d=JSON.parse(localStorage.getItem(KEY)||"null");
  if(!Array.isArray(d?.questions)||!Array.isArray(d?.keys)||d.keys.length!==10)throw Error("Invalid local draft");
  for(let i=0;i<10;i++)await api("POST",{action:"save_case",case_number:i+1,published:false,content:{questions:d.questions,answer_key:d.keys[i]||{}}});
  status("🟢 Saved to Neon · "+new Date().toLocaleTimeString());
 }catch(e){dirty=true;status("🔴 Neon save failed: "+e.message+" · Browser copy retained");}
 finally{busy=false;if(dirty&&!timer)timer=setTimeout(()=>{timer=null;void flush()},15000);}
}
function schedule(){if(!enabled)return;dirty=true;status("🟠 Unsaved changes · browser backup retained");clearTimeout(timer);timer=setTimeout(()=>{timer=null;void flush()},1200);}
Storage.prototype.setItem=function(k,v){const r=nativeSet.call(this,k,v);if(this===localStorage&&k===KEY)schedule();return r;};
async function init(){
 if(window.aclEcgIsAdmin!==true||enabled)return;
 try{
  const data=await api("GET");if(data.admin!==true)throw Error("Admin permission required");
  const cases=data.cases||[];remoteHasCases=cases.length>0;
  const local=localStorage.getItem(KEY);
  if(!local&&remoteHasCases){
   const first=cases.find(c=>Array.isArray(c.questions));
   if(first){
    const keys=Array.from({length:10},(_,i)=>cases.find(c=>c.case_number===i+1)?.answer_key||{});
    nativeSet.call(localStorage,KEY,JSON.stringify({questions:first.questions,keys}));
    status("🟢 Neon draft restored to browser. Refresh once to load it.");
   }
  }else if(local&&remoteHasCases){
   status("⚠️ Browser and Neon drafts both exist. Export JSON before syncing; Save Now will overwrite Neon draft.");
  }else status("🟢 Neon connected · edits will save automatically");
  enabled=true;
  // Initial migration: when Neon has no ECG cases, preserve and upload the existing browser draft.
  if(local&&!remoteHasCases)schedule();
 }catch(e){status("🔴 Neon unavailable: "+e.message+" · Browser draft retained");}
}
window.aclEcgSaveNow=()=>{if(!enabled){status("🔴 Neon is not connected");return Promise.resolve();}dirty=true;clearTimeout(timer);timer=null;return flush();};
window.addEventListener("acl-ecg-access-ready",()=>void init());
if(window.aclEcgIsAdmin===true)void init();
})();