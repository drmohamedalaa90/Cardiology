import { supabaseClient } from './supabase-client.js';
import { protectAndRender } from './session-ui.js';
const list=document.getElementById('trackList'),status=document.getElementById('pathStatus');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(t,k=''){status.textContent=t;status.className=`status-box ${k}`.trim();status.hidden=!t;}
async function init(){const p=await protectAndRender('login.html');if(!p)return;msg('Loading your pathway…');
try{const {data:tracks,error:e1}=await supabaseClient.from('learning_tracks').select('*').eq('status','published').order('display_order');if(e1)throw e1;
const {data:links,error:e2}=await supabaseClient.from('track_modules').select('track_id,module_id,step_order,is_required,modules(*)').order('step_order');if(e2)throw e2;
const cards=[];for(const t of tracks||[]){const steps=[];for(const l of (links||[]).filter(x=>x.track_id===t.id)){const {data:a,error}=await supabaseClient.rpc('acl_module_access',{p_module_id:l.module_id});if(error)throw error;const d=Array.isArray(a)?a[0]:a;const m=l.modules||{};steps.push(`<article class="module-card ${d?.allowed?'open':'locked'}"><div class="module-card-body"><div class="module-card-heading"><h2>${l.step_order}. ${esc(m.title||l.module_id)}</h2><span class="difficulty-pill ${esc(m.difficulty||'foundation')}">${d?.allowed?'Unlocked':'Locked'}</span></div><p>${esc(m.short_description||'')}</p><p class="module-lock-reason">${esc(d?.reason||'')}</p>${d?.allowed&&m.launch_path?`<a class="module-action" href="${esc(m.launch_path)}">Open module</a>`:''}</div></article>`)}
cards.push(`<section class="card"><h2>${esc(t.title)}</h2><p class="muted">${esc(t.description||'')}</p><div class="module-grid">${steps.join('')}</div></section>`)}
list.innerHTML=cards.join('')||'<div class="empty-state">No published learning tracks yet.</div>';msg('');}catch(e){console.error(e);msg(e.message||'Could not load learning path.','error')}}init();
