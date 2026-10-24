import { supabaseClient } from "./supabase-client.js";
const $=id=>document.getElementById(id);
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeHref=(value="")=>{
  const raw=String(value||"").trim();
  if(!raw)return "";
  try{
    const url=new URL(raw,location.href);
    if(!["http:","https:"].includes(url.protocol))return "";
    return url.origin===location.origin
      ? url.pathname+url.search+url.hash
      : url.toString();
  }catch{
    return "";
  }
};
const ACL_DESTINATIONS=[['basic-home.html?edition=basic','Home'],['basic-modules.html?edition=basic','Modules'],['basic-progress.html?edition=basic','My progress'],['basic-profile.html?edition=basic','Friends & profile'],['basic-challenges.html?edition=basic','Challenges'],['basic-challenges.html?edition=basic#officialCompetitionsTitle','Official ACL competitions'],['basic-starred.html?edition=basic','Starred questions'],['basic-notifications.html?edition=basic','Notifications']];
function aclDestinationLabel(value){try{const u=new URL(value,location.href);return u.searchParams.get('acl_link_label')||ACL_DESTINATIONS.find(([p])=>new URL(p,location.href).pathname===u.pathname)?.[1]||(u.pathname.endsWith('basic-official-competition.html')?'competition':u.pathname.endsWith('basic-module.html')?'module':'announcement');}catch{return 'announcement';}}

let notificationAdmin=false;
let notificationControls=[];
async function manageNotifications(action,args={}){const {data,error}=await supabaseClient.rpc("acl_notification_manage",{p_action:action,p_args:args});if(error)throw error;notificationControls=data.controls||[];return data;}
function applyNotificationControls(){const hidden=new Set(notificationControls.filter(c=>c.hidden).map(c=>c.key));const cutoff=Math.max(0,...notificationControls.map(c=>Date.parse(c.cutoff)||0));const order=new Map(notificationControls.filter(c=>c.position!=null).map(c=>[c.key,c.position]));items=items.filter(i=>!hidden.has(i.key)&&(Date.parse(i.event_at)||0)>cutoff);items.sort((a,b)=>(order.get(a.key)??2147483647)-(order.get(b.key)??2147483647)||Date.parse(b.event_at)-Date.parse(a.event_at));}
let items=[];
let filter="all";
const expandedKeys=new Set();

const paths={
 competition:'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4',
 friend_request:'M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m11-4v6m-3-3h6',
 friend_accept:'M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8 0 2 2 4-5',
 challenge:'m4 3 16 16m0-16L4 19m0-5 6 6m4-16 6 6M3 21l3-3m12 0 3 3',
 admin_message:'M3 5h18v14H3V5Zm0 1 9 7 9-7',
 announcement:'m3 10 14-6v16L3 14v-4Zm14 0h4v4h-4M5 15l2 6h4l-3-5',
 module_update:'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4Zm8 2v15',
 app_update:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2'
};
const kindFor=item=>paths[item.kind]?item.kind:'announcement';
const iconFor=kind=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[kind]||paths.announcement}"/></svg>`;
const detailUrl=item=>'basic-notifications.html?edition=basic&notification='+encodeURIComponent(item.key);
const destination=item=>safeHref(item.link_url)||(item.kind==='friend_request'||item.kind==='friend_accept'?'basic-profile.html?edition=basic':item.kind==='challenge'?'basic-challenges.html?edition=basic':'');
let localReadKey='acl-notification-reads-v1';
function localReads(){try{return JSON.parse(localStorage.getItem(localReadKey)||'[]');}catch{return [];}}
function markLocal(key){try{localStorage.setItem(localReadKey,JSON.stringify([...new Set([...localReads(),key])].slice(-1000)));}catch{}}
const groupFor=kind=>{
  if(kind==="friend_request"||kind==="friend_accept") return "friends";
  if(kind==="competition") return "competition";
  if(kind==="challenge") return "challenges";
  if(kind==="module_update"||kind==="app_update"||kind==="admin_message"||kind==="announcement") return "updates";
  return "updates";
};

const when=value=>{
  if(!value)return "";
  const ms=Date.now()-new Date(value).getTime();
  if(!Number.isFinite(ms))return "";
  const min=Math.max(0,Math.floor(ms/60000));
  if(min<1)return "Just now";
  if(min<60)return min+" min ago";
  const hr=Math.floor(min/60);
  if(hr<24)return hr+" h ago";
  const d=Math.floor(hr/24);
  if(d<7)return d+" d ago";
  return new Date(value).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
};

function visibleItems(){
  return filter==="all" ? items : items.filter(item=>groupFor(item.kind)===filter);
}

function render(){
  const host=$("bnList");
  const rows=visibleItems();
  $("bnUnreadCount").textContent=String(items.filter(x=>x.is_unread).length);

  host.innerHTML=rows.length?rows.map(item=>{
    const href=destination(item),expanded=expandedKeys.has(String(item.key));
    const label='Go to '+(item.link_url?aclDestinationLabel(item.link_url):item.kind==='competition'?'competitions':item.kind==='friend_request'||item.kind==='friend_accept'?'friends':item.kind==='challenge'?'challenges':'announcement');
    return `<details class="basic-notification-card bn-expandable ${item.is_unread?'is-unread':''}" data-key="${esc(item.key)}" ${expanded?'open':''}>
      <summary><div class="basic-notification-icon ${kindFor(item)}">${iconFor(kindFor(item))}</div><div class="basic-notification-copy"><div class="basic-notification-title-row"><strong>${esc(item.title||'ACL notification')}</strong><span>${esc(when(item.event_at))}</span></div></div>${item.is_unread?'<span class="basic-unread-dot" aria-label="Unread"></span>':''}<button type="button" class="bn-remove" data-dismiss="${esc(item.key)}" aria-label="Remove notification" title="Remove notification">×</button><span class="bn-chevron" aria-hidden="true">⌄</span></summary>
      <div class="bn-expanded-content"><p>${esc(item.body||'')}</p>${href?`<a class="bn-destination" href="${esc(href)}">${esc(label)} →</a>`:''}${notificationAdmin&&String(item.key).startsWith('announcement:')?` <a class="bn-edit-destination" href="basic-home.html?edition=basic&edit_update=${encodeURIComponent(String(item.key).slice(13))}">Edit destination</a>`:''}${notificationAdmin?'<div class="bn-admin-controls"><button type="button" data-move="-1">↑ Move up</button><button type="button" data-move="1">↓ Move down</button><button type="button" data-global-remove>Remove for everyone</button></div>':''}</div>
    </details>`;
  }).join(''):'<div class="basic-empty-state">No notifications in this category yet.</div>';
  for(const button of host.querySelectorAll('[data-dismiss],[data-global-remove],[data-move]'))button.addEventListener('click',async event=>{
 event.preventDefault();event.stopPropagation();const key=button.closest('[data-key]').dataset.key;button.disabled=true;
 try{
 if(button.hasAttribute('data-move')){const keys=items.map(i=>i.key),index=keys.indexOf(key),next=index+Number(button.dataset.move);if(next<0||next>=keys.length)return;[keys[index],keys[next]]=[keys[next],keys[index]];await manageNotifications('admin_reorder',{keys});}
 else{const global=button.hasAttribute('data-global-remove');if(global&&!confirm('Remove this notification for everyone?'))return;await manageNotifications(global?'admin_remove':'dismiss',{key});}
 applyNotificationControls();render();
 }catch(e){alert(e.message||'Could not update notifications.');}finally{button.disabled=false;}
 });
 $('bnAdminClear').hidden=!notificationAdmin;
  for(const card of host.querySelectorAll('details[data-key]'))card.addEventListener('toggle',()=>{
    const item=items.find(i=>String(i.key)===card.dataset.key);if(!item)return;
    if(!card.open){expandedKeys.delete(String(item.key));return;}
    expandedKeys.add(String(item.key));
    if(!item.is_unread)return;
    markLocal(item.key);item.is_unread=false;card.classList.remove('is-unread');card.querySelector('.basic-unread-dot')?.remove();
    $('bnUnreadCount').textContent=String(items.filter(i=>i.is_unread).length);
    if(!item.local_only)void supabaseClient.rpc('acl_mark_notification_read',{p_notification_key:item.key});
  });

}

async function load(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user){location.replace("acl-access.html?build=20261023-clean");return}
  localReadKey='acl-notification-reads-v1:'+session.user.id;
  const {data,error}=await supabaseClient.rpc("acl_basic_notifications");
  if(error)throw error;
  items=Array.isArray(data?.items)?data.items:[];
 const extra=await Promise.allSettled([
 supabaseClient.rpc('acl_official_api',{p_action:'list',p_args:{}}),
 supabaseClient.rpc('acl_basic_challenge_api',{p_action:'history',p_args:{}})
 ]);
 const official=extra[0].status==='fulfilled'?extra[0].value.data:null;
 notificationAdmin=official?.admin===true;
 for(const c of official?.competitions||[])if(c.status!=='draft')items.push({key:'official:'+c.id,kind:'competition',title:c.title,body:'Official ACL competition · '+new Date(c.opens_at).toLocaleString('en-GB',{timeZone:'Africa/Cairo'})+' (Cairo)',event_at:c.created_at||c.opens_at,link_url:'basic-official-competition.html?edition=basic&id='+encodeURIComponent(c.id),is_unread:true,local_only:true});
 const history=extra[1].status==='fulfilled'?extra[1].value.data:null;
 for(const c of Array.isArray(history)?history:[])if(c.creator_id!==session.user.id)items.push({key:'challenge:'+c.id,kind:'challenge',title:(c.opponent_name||'A friend')+' challenged you',body:c.module_title+' · '+Number(c.play_config?.question_count||0)+' questions',event_at:c.created_at,link_url:'basic-challenges.html?edition=basic#basicChallengeHistory',is_unread:true,local_only:true});
 const read=new Set(localReads());items.forEach(i=>{if(i.local_only&&read.has(i.key))i.is_unread=false;});
 const preferences=await manageNotifications('state');notificationAdmin=preferences.admin===true;applyNotificationControls();
 $('bnUnreadCount').textContent=String(items.filter(i=>i.is_unread).length);
 const selected=new URLSearchParams(location.search).get('notification');
 if(selected){const item=items.find(i=>i.key===selected);if(item){markLocal(item.key);$('bnList').innerHTML=`<article class="bn-detail"><a href="basic-notifications.html?edition=basic">← All notifications</a><div class="basic-notification-icon ${kindFor(item)}">${iconFor(kindFor(item))}</div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p></article>`;return;}}
 render();
}

document.querySelectorAll("[data-filter]").forEach(button=>{
  button.addEventListener("click",()=>{
    filter=button.dataset.filter||"all";
    document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("is-active",x===button));
    render();
  });
});

$("bnMarkAll")?.addEventListener("click",async()=>{
  const button=$("bnMarkAll");
  button.disabled=true;
  const {error}=await supabaseClient.rpc("acl_mark_all_basic_notifications_read");
  button.disabled=false;
  if(error)return;
  items.forEach(item=>{item.is_unread=false;if(item.local_only)markLocal(item.key);});
  render();
});

load().catch(error=>{
  console.error("BASIC NOTIFICATIONS:",error);
  $("bnList").innerHTML='<div class="basic-empty-state">Could not load notifications.</div>';
});

for(const [id,action] of [['bnClearAll','clear'],['bnAdminClear','admin_clear']])$(id)?.addEventListener('click',async()=>{
 if(!confirm(action==='admin_clear'?'Remove all current notifications for everyone?':'Clear all your current notifications?'))return;
 const button=$(id);button.disabled=true;try{await manageNotifications(action);applyNotificationControls();render();}catch(e){alert(e.message||'Could not clear notifications.');}finally{button.disabled=false;}
});
