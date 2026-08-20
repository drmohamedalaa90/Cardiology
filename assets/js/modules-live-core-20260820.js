import { supabaseClient } from './supabase-client.js';

const $ = id => document.getElementById(id);
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const params = new URLSearchParams(location.search);
let edition = String(params.get('edition') || '').toLowerCase();
if (!['basic','expert'].includes(edition)) {
  try { edition = String(localStorage.getItem('aclSelectedEdition') || 'expert').toLowerCase(); } catch { edition = 'expert'; }
}
if (!['basic','expert'].includes(edition)) edition = 'expert';
try { localStorage.setItem('aclSelectedEdition', edition); } catch {}

const grid=$('modules'), status=$('modulesStatus'), summary=$('catalogueSummary'), search=$('moduleSearchInputCompact'), availability=$('moduleAvailabilityCompact'), progressFilter=$('moduleProgressCompact'), searchSummary=$('moduleSearchSummary'), clear=$('clearModuleFiltersCompact');
let modules=[], attempts=[];

function show(msg='', kind='') {
  if (!status) return;
  status.textContent = msg;
  status.className = `status-box ${kind}`.trim();
  status.hidden = !msg;
}
function launch(m){
  if(!m.launch_path) return '';
  try {
    const u=new URL(m.launch_path,location.href);
    u.searchParams.set('edition',edition);
    return u.origin===location.origin?`${u.pathname}${u.search}${u.hash}`:u.toString();
  } catch { return ''; }
}
function latestAttempt(id){return attempts.find(a=>String(a.module_id)===String(id))||null}
function decision(m){
  const st=String(m.status||'').toLowerCase();
  if(st==='draft'||st==='coming_soon'||!m.launch_path) return {state:'coming',label:'Coming soon'};
  return {state:'open',label:'Open module'};
}
function theme(m){
  const t=[m.title,m.category,m.slug].filter(Boolean).join(' ').toLowerCase();
  if(/ecg|rhythm|arrhythm/.test(t)) return ['module-ecg','Electrocardiography'];
  if(/echo|imaging|ct|mri|cmr/.test(t)) return ['module-imaging','Imaging'];
  if(/pci|tavi|intervention|mitral|tricuspid|cto|left main/.test(t)) return ['module-intervention','Interventional Cardiology'];
  return ['module-general','General Cardiology'];
}
function card(m){
  const d=decision(m), a=latestAttempt(m.id), href=d.state==='open'?launch(m):'', t=theme(m);
  const completed=a?.status==='completed', inProgress=a?.status==='in_progress';
  const action=inProgress?'Continue module':completed?'Review / retry':d.label;
  return `<article class="module-card ${t[0]} ${d.state}" data-module-id="${esc(m.id)}"><div class="module-cover"><span class="module-category">${esc(t[1])}</span></div><div class="module-card-body"><div class="module-card-heading"><h2>${esc(m.title||'ACL module')}</h2>${m.difficulty?`<span class="difficulty-pill">${esc(m.difficulty)}</span>`:''}</div><p>${esc(m.short_description||m.description||'ACL educational module')}</p><div class="module-meta"><span>⏱ ${Number(m.estimated_minutes||0)} min</span><span>❓ ${Number(m.question_count||0)} questions</span></div>${a?`<div class="module-progress-line"><span>${inProgress?'In progress':completed?'Completed':esc(a.status||'Attempted')}</span><strong>${Number(a.score||0)} pts</strong></div>`:''}<div class="module-card-actions"><a class="module-action ${href?'':'disabled'}" href="${href?esc(href):'#'}" ${href?'':'aria-disabled="true" tabindex="-1"'}>${esc(action)}</a></div></div></article>`;
}
function renderContinue(source=modules){
  const host=$('aclContinueLearning'); if(!host) return;
  const preferred=source.map(m=>({m,a:latestAttempt(m.id)})).filter(x=>x.a?.status==='in_progress').slice(0,3);
  const rows=preferred.length?preferred:source.filter(m=>decision(m).state==='open').slice(0,3).map(m=>({m,a:latestAttempt(m.id)}));
  host.innerHTML=rows.length?rows.map(({m,a})=>{const href=launch(m),pct=a?.status==='completed'?100:a?.status==='in_progress'?55:0;return `<article class="acl-continue-card"><div class="acl-continue-card-top"><div class="acl-continue-icon">♡</div><div class="acl-continue-copy"><h3>${esc(m.title)}</h3><small>${a?.status==='in_progress'?'In progress':a?.status==='completed'?'Completed':'Not started'}</small></div><strong class="acl-continue-percent">${pct}%</strong></div><div class="acl-continue-progress"><span style="width:${pct}%"></span></div><a href="${esc(href)}">›</a></article>`}).join(''):'<div class="card muted">No open modules yet.</div>';
}
function filterModules(){
  const term=String(search?.value||'').trim().toLowerCase(), av=availability?.value||'all', pf=progressFilter?.value||'all';
  const rows=modules.filter(m=>{
    const d=decision(m), a=latestAttempt(m.id), text=[m.title,m.short_description,m.description,m.category,m.slug].filter(Boolean).join(' ').toLowerCase();
    const mt=!term||text.includes(term);
    const ma=av==='all'||(av==='open'?d.state==='open':av==='locked'?d.state!=='open':true);
    const state=a?.status||'not-started';
    const mp=pf==='all'||(pf==='not-started'?!a:pf==='started'?state==='in_progress':pf==='completed'?state==='completed':true);
    return mt&&ma&&mp;
  });
  if(grid) grid.innerHTML=rows.length?rows.map(card).join(''):'<div class="module-filter-empty"><strong>No matching modules found</strong><p>Try changing the search or filters.</p></div>';
  if(searchSummary) searchSummary.textContent=`${rows.length} of ${modules.length} modules shown`;
  if(summary) summary.textContent=`${modules.length} modules`;
  renderContinue(rows);
}
function timeout(promise,ms,label){return Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`${label} timed out`)),ms))]);}

async function loadCore(){
  show('Loading your ACL catalogue…');
  try {
    const core=await timeout(supabaseClient.from('modules').select('*').eq('edition',edition).order('display_order',{ascending:true}).order('title',{ascending:true}),8000,'Module catalogue');
    if(core.error) throw core.error;
    modules=Array.isArray(core.data)?core.data:[];
    if(grid) grid.innerHTML=modules.length?modules.map(card).join(''):'<div class="empty-state">No modules are currently available in this edition.</div>';
    if(summary) summary.textContent=`${modules.length} modules`;
    if(searchSummary) searchSummary.textContent=`${modules.length} modules available`;
    renderContinue(modules);
    show('');
    enhanceLater();
  } catch(e) {
    console.error('ACL MODULE CORE LOAD ERROR',e);
    if(grid) grid.innerHTML=`<div class="empty-state"><strong>Could not load modules.</strong><p>${esc(e.message||'Please try again.')}</p></div>`;
    if(summary) summary.textContent='Catalogue unavailable';
    if(searchSummary) searchSummary.textContent='Unable to load modules';
    show(e.message||'Could not load modules.','error');
  }
}
async function enhanceLater(){
  try {
    const sessionResult=await timeout(supabaseClient.auth.getSession(),5000,'Session');
    const user=sessionResult?.data?.session?.user;
    if(!user) return;
    const attemptResult=await timeout(supabaseClient.from('quiz_attempts').select('module_id,status,score,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false}),6000,'Progress');
    if(!attemptResult.error&&Array.isArray(attemptResult.data)) attempts=attemptResult.data;
    filterModules();
    try {
      const dash=await timeout(supabaseClient.rpc('acl_get_my_learning_dashboard_v2',{p_edition:edition}),6000,'Learning dashboard');
      if(!dash.error&&dash.data){
        const d=dash.data;
        if($('aclStatInProgress')) $('aclStatInProgress').textContent=Number(d.open_attempts||d.modules_in_progress||0);
        if($('aclStatCompleted')) $('aclStatCompleted').textContent=Number(d.completed_attempts||0);
        if($('aclStatOverall')) $('aclStatOverall').textContent=`${Number(d.mastery_percent||0)}%`;
      }
    } catch(e){console.warn('ACL dashboard enhancement skipped',e)}
  } catch(e){console.warn('ACL optional enhancement skipped',e)}
}

search?.addEventListener('input',filterModules);
availability?.addEventListener('change',filterModules);
progressFilter?.addEventListener('change',filterModules);
clear?.addEventListener('click',()=>{if(search)search.value='';if(availability)availability.value='all';if(progressFilter)progressFilter.value='all';filterModules();});
$('moduleFilterToggle')?.addEventListener('click',()=>{const box=$('moduleCompactFilters');if(!box)return;box.hidden=!box.hidden;$('moduleFilterToggle').setAttribute('aria-expanded',String(!box.hidden));});

loadCore();