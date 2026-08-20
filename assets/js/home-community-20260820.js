import { supabaseClient } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const edition=(()=>{const q=new URLSearchParams(location.search).get('edition');let s='';try{s=localStorage.getItem('aclSelectedEdition')||''}catch{}return String(q||s||'expert').toLowerCase()==='basic'?'basic':'expert'})();
let me=null,myProfile=null;

async function rpc(name,args={}){const {data,error}=await supabaseClient.rpc(name,args);if(error)throw error;return data||[]}
function initials(n='ACL Member'){return n.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}

async function loadFriends(){
  const host=$('#friendsList'); if(!host)return;
  try{
    const [friends,requests]=await Promise.all([rpc('acl_home_friends'),rpc('acl_friend_requests')]);
    const reqHtml=(requests||[]).slice(0,2).map(r=>`<div class="friend-request"><span class="friend-avatar">${initials(r.display_name)}</span><div><b>${esc(r.display_name)}</b><small>sent you a friend request</small></div><button data-accept="${r.friendship_id}">Accept</button><button class="ghost" data-decline="${r.friendship_id}">Decline</button></div>`).join('');
    const friendHtml=(friends||[]).slice(0,5).map(f=>`<div class="friend-live"><span class="friend-avatar">${f.avatar_url?`<img src="${esc(f.avatar_url)}" alt="">`:initials(f.display_name)}</span><div class="friend-copy"><b>${esc(f.display_name)}</b><small>${f.current_module?esc(f.current_module):'No active module'} · ${Number(f.weekly_questions||0)} questions this week</small></div><span class="friend-stat">${Number(f.weekly_accuracy||0)}%</span><a href="challenge.html?edition=${edition}&opponent=${f.friend_id}">Challenge</a></div>`).join('');
    host.innerHTML=reqHtml+friendHtml || '<div class="empty-state rich-empty"><strong>No connected friends yet</strong><span>Find colleagues by name or username and connect with them.</span></div>';
    host.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{await rpc('acl_respond_friend_request',{friendship:b.dataset.accept,response:'accepted'});loadFriends()});
    host.querySelectorAll('[data-decline]').forEach(b=>b.onclick=async()=>{await rpc('acl_respond_friend_request',{friendship:b.dataset.decline,response:'declined'});loadFriends()});
  }catch(e){console.warn('Friends unavailable',e)}
}

async function searchPeople(term=''){
  const host=$('#friendSearchResults'); if(!host)return;
  host.innerHTML='<div class="home-mini-loading">Searching…</div>';
  try{
    const rows=await rpc('acl_search_people',{search_text:term,result_limit:12});
    host.innerHTML=rows.length?rows.map(p=>`<div class="people-result"><span class="friend-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:initials(p.display_name)}</span><div><b>${esc(p.display_name)}</b><small>${p.username?'@'+esc(p.username):''}${p.institution?' · '+esc(p.institution):''}</small></div>${p.friendship_status==='accepted'?'<span class="connected-pill">Connected</span>':p.friendship_status==='pending'?'<span class="connected-pill pending">Pending</span>':`<button data-add="${p.id}">Add friend</button>`}</div>`).join(''):'<div class="empty-state">No matching ACL members.</div>';
    host.querySelectorAll('[data-add]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Sent';try{await rpc('acl_send_friend_request',{target_user:b.dataset.add})}catch(e){console.warn(e)}});
  }catch(e){host.innerHTML='<div class="empty-state">Could not search members right now.</div>'}
}

function wireFriendFinder(){
  const open=$('#findFriendsBtn'),modal=$('#friendFinder'),close=$('#friendFinderClose'),input=$('#friendSearchInput');
  if(!open||!modal)return;
  open.onclick=()=>{modal.hidden=false;searchPeople('')}; close.onclick=()=>modal.hidden=true;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
  let timer; input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>searchPeople(input.value.trim()),250)});
}

async function loadAnnouncements(){
  const host=$('#announcementList'); if(!host)return;
  try{
    const rows=await rpc('acl_home_announcements',{requested_edition:edition,result_limit:4});
    host.innerHTML=rows.length?rows.map(a=>`<a class="announcement announcement-${esc(a.kind)}" href="${a.link_url?esc(a.link_url):'notifications.html?edition='+edition}"><i>${a.is_pinned?'PIN':'ACL'}</i><div><strong>${esc(a.title)}</strong><span>${esc(a.body)}</span><small>${new Date(a.published_at).toLocaleDateString()}</small></div></a>`).join(''):'<div class="empty-state">No current announcements.</div>';
  }catch(e){console.warn('Announcements unavailable',e)}
}

async function maybeEnableAdminPost(){
  const btn=$('#adminAnnouncementBtn'); if(!btn||!myProfile)return;
  const role=String(myProfile.role||'').toLowerCase();
  if(!['admin','owner','administrator'].includes(role))return;
  btn.hidden=false;
  btn.onclick=async()=>{
    const title=prompt('Announcement title'); if(!title)return;
    const body=prompt('Announcement message'); if(!body)return;
    const {error}=await supabaseClient.from('acl_announcements').insert({title,body,edition:null,created_by:me.id,is_pinned:false});
    if(error){alert(error.message);return} loadAnnouncements();
  };
}

function youtubeEmbed(url=''){
  const m=String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);return m?`https://www.youtube.com/embed/${m[1]}?autoplay=1`:url;
}
async function loadIntroVideo(){
  const card=$('#introVideoCard'),play=$('#introPlay'); if(!card||!play)return;
  try{
    const {data}=await supabaseClient.from('videos').select('title,youtube_url,description').eq('video_key','acl_home_intro').eq('is_active',true).maybeSingle();
    if(!data?.youtube_url)return;
    $('#introVideoTitle').textContent=data.title||'Introduction to ACL Platform';
    $('#introVideoDescription').textContent=data.description||'Learn how to use ACL.';
    play.onclick=()=>{const visual=$('#introVideoVisual');visual.innerHTML=`<iframe src="${esc(youtubeEmbed(data.youtube_url))}" title="ACL introduction" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;markIntroWatched()};
  }catch(e){console.warn('Intro video unavailable',e)}
}
async function markIntroWatched(){
  if(!me)return;try{const {data}=await supabaseClient.from('user_settings').select('settings').eq('user_id',me.id).maybeSingle();const settings={...(data?.settings||{}),home_intro_watched:true,home_intro_watched_at:new Date().toISOString()};await supabaseClient.from('user_settings').upsert({user_id:me.id,settings},{onConflict:'user_id'});$('#introVideoCard')?.classList.add('is-watched')}catch{}
}

async function wireWeeklyGoal(){
  if(!me)return;
  let settings={};try{const {data}=await supabaseClient.from('user_settings').select('settings').eq('user_id',me.id).maybeSingle();settings=data?.settings||{};if(settings.weekly_question_goal){localStorage.setItem('acl_weekly_goal',String(settings.weekly_question_goal));document.querySelector('#goalTarget').textContent=settings.weekly_question_goal}if(settings.home_intro_watched)$('#introVideoCard')?.classList.add('is-watched')}catch{}
  const edit=$('#editGoal');if(edit)edit.onclick=async()=>{const current=Number(settings.weekly_question_goal||localStorage.getItem('acl_weekly_goal')||100);const v=Number(prompt('Weekly question goal',String(current)));if(!v||v<1)return;settings={...settings,weekly_question_goal:v};await supabaseClient.from('user_settings').upsert({user_id:me.id,settings},{onConflict:'user_id'});localStorage.setItem('acl_weekly_goal',String(v));location.reload()};
}

async function renderRecommendations(){
  const host=$('#recommendedList');if(!host)return;
  try{
    const {data:attempts}=await supabaseClient.from('quiz_attempts').select('module_title,status,answers,updated_at,accuracy_percent').eq('user_id',me.id).order('updated_at',{ascending:false}).limit(20);
    const active=(attempts||[]).find(a=>a.status==='in_progress');
    const completed=(attempts||[]).filter(a=>a.status==='completed');
    const weakest=completed.sort((a,b)=>Number(a.accuracy_percent||101)-Number(b.accuracy_percent||101))[0];
    const items=[];
    if(active)items.push({title:`Continue ${active.module_title||'your active module'}`,desc:'Resume the unfinished session while it is still fresh.',href:`modules.html?edition=${edition}`});
    if(weakest&&Number(weakest.accuracy_percent)<80)items.push({title:`Review ${weakest.module_title||'your weakest topic'}`,desc:`Recent accuracy ${Math.round(Number(weakest.accuracy_percent||0))}%. A focused review is recommended.`,href:'progress.html'});
    items.push({title:'Challenge a colleague',desc:'Test recall against a connected ACL friend.',href:`challenge.html?edition=${edition}`});
    host.innerHTML=items.slice(0,3).map((x,i)=>`<a href="${x.href}"><span>0${i+1}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.desc)}</small></div><b>→</b></a>`).join('');
  }catch(e){console.warn('Recommendations unavailable',e)}
}

async function init(){
  const {data:{session}}=await supabaseClient.auth.getSession(); if(!session?.user)return; me=session.user;
  try{const {data}=await supabaseClient.from('profiles').select('*').eq('id',me.id).maybeSingle();myProfile=data}catch{}
  wireFriendFinder(); await Promise.allSettled([loadFriends(),loadAnnouncements(),loadIntroVideo(),wireWeeklyGoal(),renderRecommendations()]); maybeEnableAdminPost();
}
init();
