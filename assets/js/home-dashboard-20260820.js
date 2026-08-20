import { supabaseClient } from './supabase-client.js';
import { listAttempts } from './cloud-progress.js?v=5.3.0';

const $=s=>document.querySelector(s),num=v=>Number(v||0),esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const answers=a=>Array.isArray(a?.answers)?a.answers:[];
const meta=a=>a?.acl_metadata||{};
const answered=a=>{const aa=answers(a);if(aa.length)return aa.length;for(const v of [meta(a).answeredCount,meta(a).answered_count,a?.answered_count,a?.current_index!=null?num(a.current_index)+1:null]){const n=num(v);if(Number.isFinite(n)&&n>0)return n}return 0};
const correct=a=>{const aa=answers(a);if(aa.length)return aa.filter(x=>x?.correct===true).length;for(const v of [a?.correct_count,meta(a).correctCount,meta(a).correct_count]){const n=num(v);if(Number.isFinite(n)&&n>=0)return n}return 0};
const bank=a=>Math.max(answered(a),num(a?.question_count)||num(meta(a).questionCount)||num(meta(a).question_count)||0);
const pct=(a,b)=>b?Math.round(a/b*100):0;
const dateOf=a=>new Date(a?.completed_at||a?.updated_at||a?.started_at||0);
const edition=(()=>{const q=new URLSearchParams(location.search).get('edition');let s='';try{s=localStorage.getItem('aclSelectedEdition')||''}catch{}return String(q||s||'expert').toLowerCase()==='basic'?'basic':'expert'})();
try{localStorage.setItem('aclSelectedEdition',edition)}catch{}

function xp(rows){let n=0;rows.filter(a=>a?.status==='completed').forEach(a=>{const aa=answers(a);n+=25;if(aa.length)n+=aa.reduce((s,x)=>s+(x?.correct?10:0),0);else n+=Math.max(0,correct(a))*10});return Math.max(0,n)}
function moduleGroups(rows){const map=new Map();rows.forEach(a=>{const key=String(a?.module_id||a?.module_title||'module');if(!map.has(key))map.set(key,{id:a?.module_id,title:a?.module_title||'ACL Module',rows:[]});map.get(key).rows.push(a)});return[...map.values()]}
function renderContinue(rows){const host=$('#continueList');if(!host)return;let active=rows.filter(a=>a?.status==='in_progress').sort((a,b)=>dateOf(b)-dateOf(a));if(!active.length){active=rows.filter(a=>answered(a)>0).sort((a,b)=>dateOf(b)-dateOf(a))}active=active.slice(0,2);if(!active.length){host.innerHTML='<div class="empty-state rich-empty"><strong>No active module yet</strong><span>Open the module catalogue and start your next learning session.</span></div>';return}host.innerHTML=active.map(a=>{const done=answered(a),total=bank(a)||350,href=a.launch_path||`modules.html?edition=${edition}`;return `<div class="continue-item"><b>${esc(a.module_title||'ACL Module')}</b><span>${done} / ${total} · ${pct(done,total)}%</span><a href="${esc(href)}">Continue</a></div>`}).join('')}
function renderFriends(){let stored=[];try{stored=JSON.parse(localStorage.getItem('acl_friends')||'[]')}catch{}if(!Array.isArray(stored)||!stored.length)return;const f=$('#friendsList');if(f)f.innerHTML=stored.slice(0,4).map((x,i)=>`<div class="friend"><i>${i+1}</i><b>${esc(x.name||'Friend')}</b><small>${num(x.xp).toLocaleString()} XP</small></div>`).join('')}
function displayName(profile,user){return profile?.display_name||profile?.full_name||profile?.name||user?.user_metadata?.display_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Doctor'}
function set(sel,value){const el=$(sel);if(el)el.textContent=value}
function wireHeader(name){
  set('#aclHeaderUserName',name);
  set('#aclHeaderEdition',edition==='basic'?'THE BASIC EDITION':'THE EXPERT EDITION');
  const brand=$('#homeHeaderBrand');if(brand)brand.href=`modules.html?edition=${edition}`;
  const notifications=$('#homeHeaderNotifications');if(notifications)notifications.href=`notifications.html?edition=${edition}`;
  const settings=$('#homeHeaderSettings');if(settings)settings.href=`settings.html?edition=${edition}`;
}

async function init(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user){location.replace('login.html');return}
  let profile=null;try{const r=await supabaseClient.from('profiles').select('*').eq('id',session.user.id).maybeSingle();profile=r.data}catch{}
  const name=displayName(profile,session.user);
  set('#welcomeName',name);set('#heroEdition',edition==='basic'?'Basic':'Expert');wireHeader(name);

  const attempts=await listAttempts({edition,includeUnmatched:true});
  const completed=attempts.filter(a=>a?.status==='completed');
  const groups=moduleGroups(attempts),completedGroups=groups.filter(g=>g.rows.some(a=>a?.status==='completed')),activeGroups=groups.filter(g=>g.rows.some(a=>a?.status==='in_progress'));
  const totalAnswered=completed.reduce((s,a)=>s+answered(a),0),totalCorrect=completed.reduce((s,a)=>s+correct(a),0),accuracy=totalAnswered?pct(totalCorrect,totalAnswered):0,totalXp=xp(attempts);

  set('#heroXp',totalXp.toLocaleString());set('#heroQuestions',totalAnswered.toLocaleString());set('#heroAccuracy',totalAnswered?accuracy+'%':'—');
  set('#progressXp',totalXp.toLocaleString());set('#questionsAnswered',totalAnswered.toLocaleString());set('#masteryValue',totalAnswered?accuracy+'%':'—');set('#modulesActive',activeGroups.length);set('#modulesCompleted',completedGroups.length);
  const ring=$('#masteryRing');if(ring)ring.style.background=`conic-gradient(var(--blue) ${accuracy}%,#e8edf5 0)`;
  renderContinue(attempts);renderFriends();

  const goal=Math.max(1,num(localStorage.getItem('acl_weekly_goal'))||100),weekAgo=Date.now()-7*86400000;
  const weeklyRows=attempts.filter(a=>dateOf(a).getTime()>=weekAgo),weekly=weeklyRows.reduce((s,a)=>s+answered(a),0),weeklyXp=xp(weeklyRows),goalPct=Math.min(100,pct(weekly,goal));
  set('#goalTarget',goal);set('#goalDone',weekly);set('#goalPercent',goalPct+'%');set('#weeklyXp','+'+weeklyXp.toLocaleString()+' XP');
  const gr=$('#goalPercent')?.parentElement;if(gr)gr.style.background=`conic-gradient(var(--mint) ${goalPct}%,#eaf1f5 0)`;
  const edit=$('#editGoal');if(edit)edit.onclick=()=>{const v=prompt('Weekly question goal',String(goal));if(v&&num(v)>0){localStorage.setItem('acl_weekly_goal',String(num(v)));location.reload()}};
  const play=$('#introPlay');if(play)play.onclick=()=>alert('The introduction video slot is ready. Add the final video URL when available.');
}

init().catch(error=>{console.error('ACL home load error',error)});