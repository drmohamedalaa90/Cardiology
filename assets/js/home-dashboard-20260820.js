import { supabaseClient } from './supabase-client.js';
import { listAttempts } from './cloud-progress.js?v=5.3.0';

const $=s=>document.querySelector(s),num=v=>Number(v||0),esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const answers=a=>Array.isArray(a?.answers)?a.answers:[];
const answered=a=>answers(a).length||num(a?.question_count);
const correct=a=>answers(a).length?answers(a).filter(x=>x?.correct===true).length:num(a?.correct_count??a?.score);
const pct=(a,b)=>b?Math.round(a/b*100):0;
const edition=(()=>{const q=new URLSearchParams(location.search).get('edition');let s='';try{s=localStorage.getItem('aclSelectedEdition')||''}catch{}return String(q||s||'expert').toLowerCase()==='basic'?'basic':'expert'})();
try{localStorage.setItem('aclSelectedEdition',edition)}catch{}

function xp(rows){let n=0;rows.filter(a=>a?.status==='completed').forEach(a=>{const aa=answers(a);n+=25; n+=aa.length?aa.reduce((s,x)=>s+(x?.correct?10:0),0):Math.max(0,correct(a))*10});return Math.max(0,n)}
function moduleGroups(rows){const map=new Map();rows.forEach(a=>{const key=String(a?.module_id||a?.module_title||'module');if(!map.has(key))map.set(key,{id:a?.module_id,title:a?.module_title||'ACL Module',rows:[]});map.get(key).rows.push(a)});return[...map.values()]}
function renderContinue(rows){const host=$('#continueList');if(!host)return;const active=rows.filter(a=>a?.status==='in_progress').sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0)).slice(0,3);if(!active.length){host.innerHTML='<div class="empty-state">No unfinished modules. Open Modules to start your next topic.</div>';return}host.innerHTML=active.map(a=>{const done=answered(a),total=Math.max(done,num(a.question_count)||350),href=a.launch_path||`modules.html?edition=${edition}`;return `<div class="continue-item"><b>${esc(a.module_title||'ACL Module')}</b><span>${done} / ${total} · ${pct(done,total)}%</span><a href="${esc(href)}">Continue</a></div>`}).join('')}
function renderFriends(){let stored=[];try{stored=JSON.parse(localStorage.getItem('acl_friends')||'[]')}catch{}if(!Array.isArray(stored)||!stored.length)return;const f=$('#friendsList'),a=$('#activityList');if(f)f.innerHTML=stored.slice(0,4).map((x,i)=>`<div class="friend"><i>${i+1}</i><b>${esc(x.name||'Friend')}</b><small>${num(x.xp).toLocaleString()} XP</small></div>`).join('');if(a)a.innerHTML=stored.slice(0,4).map(x=>`<div class="activity"><b>${esc(x.name||'Friend')}</b> is progressing through ACL <span>Recently</span></div>`).join('')}

async function init(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user){location.replace('login.html');return}
  let profile=null;try{const r=await supabaseClient.from('profiles').select('*').eq('id',session.user.id).maybeSingle();profile=r.data}catch{}
  const attempts=await listAttempts({edition,includeUnmatched:true});
  const completed=attempts.filter(a=>a?.status==='completed'),groups=moduleGroups(attempts),completedGroups=groups.filter(g=>g.rows.some(a=>a?.status==='completed')),activeGroups=groups.filter(g=>g.rows.some(a=>a?.status==='in_progress'));
  const totalAnswered=completed.reduce((s,a)=>s+answered(a),0),totalCorrect=completed.reduce((s,a)=>s+correct(a),0),accuracy=totalAnswered?pct(totalCorrect,totalAnswered):0,totalXp=xp(attempts);
  const perModule=completedGroups.map(g=>{const c=g.rows.filter(a=>a?.status==='completed').sort((a,b)=>new Date(b.completed_at||b.updated_at||0)-new Date(a.completed_at||a.updated_at||0))[0];return c&&answered(c)?pct(correct(c),answered(c)):0});
  const mastery=perModule.length?Math.round(perModule.reduce((s,v)=>s+v,0)/perModule.length):0;
  const set=(sel,v)=>{const el=$(sel);if(el)el.textContent=v};
  set('#progressXp',totalXp.toLocaleString());set('#questionsAnswered',totalAnswered.toLocaleString());set('#accuracyValue',totalAnswered?accuracy+'%':'—');set('#masteryValue',perModule.length?mastery+'%':'—');set('#modulesActive',activeGroups.length);set('#modulesCompleted',completedGroups.length);
  const ring=$('#masteryRing');if(ring)ring.style.background=`conic-gradient(var(--blue) ${mastery}%,#e9e8fb 0)`;
  renderContinue(attempts);renderFriends();

  const goal=Math.max(1,num(localStorage.getItem('acl_weekly_goal'))||100),weekAgo=Date.now()-7*86400000,weeklyRows=attempts.filter(a=>new Date(a?.updated_at||a?.completed_at||0).getTime()>=weekAgo),weekly=weeklyRows.reduce((s,a)=>s+answered(a),0),weeklyXp=xp(weeklyRows),goalPct=Math.min(100,pct(weekly,goal));
  set('#goalTarget',goal);set('#goalDone',weekly);set('#goalPercent',goalPct+'%');set('#weeklyXp','+'+weeklyXp.toLocaleString()+' XP');const gr=$('#goalPercent')?.parentElement;if(gr)gr.style.background=`conic-gradient(var(--mint) ${goalPct}%,#edf2f6 0)`;
  const edit=$('#editGoal');if(edit)edit.onclick=()=>{const v=prompt('Weekly question goal',String(goal));if(v&&num(v)>0){localStorage.setItem('acl_weekly_goal',String(num(v)));location.reload()}};
  const play=$('#introPlay');if(play)play.onclick=()=>alert('Introduction video can be connected here when the final video URL is ready.');
}

init().catch(error=>{console.error('ACL home load error',error)});
