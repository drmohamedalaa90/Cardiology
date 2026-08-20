import { supabaseClient } from './supabase-client.js';

const DRAWER_VERSION = '7';
const OLD_BRAND='Alexandria Cardiology League';
const OLD_BRAND_UPPER='ALEXANDRIA CARDIOLOGY LEAGUE';
function brandText(value=''){return String(value).replaceAll(OLD_BRAND_UPPER,'CARDIOLOGY LEAGUE').replaceAll(OLD_BRAND,'Cardiology League')}
function applyBrand(scope=document){
  document.title=brandText(document.title);
  const rootNode=scope?.nodeType?scope:document;
  if(rootNode.nodeType===Node.TEXT_NODE){const next=brandText(rootNode.nodeValue);if(next!==rootNode.nodeValue)rootNode.nodeValue=next;return}
  if(rootNode.nodeType!==Node.ELEMENT_NODE&&rootNode!==document)return;
  const walker=document.createTreeWalker(rootNode,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){const next=brandText(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next}
  const elements=rootNode===document?document.querySelectorAll('*'):[rootNode,...rootNode.querySelectorAll('*')];
  elements.forEach(el=>['aria-label','alt','title','placeholder'].forEach(attr=>{if(!el.hasAttribute?.(attr))return;const current=el.getAttribute(attr),next=brandText(current);if(next!==current)el.setAttribute(attr,next)}));
}

const edition = (() => {
  const q = new URLSearchParams(location.search).get('edition');
  let saved = '';
  try { saved = localStorage.getItem('aclSelectedEdition') || ''; } catch {}
  return String(q || saved || 'expert').toLowerCase() === 'basic' ? 'basic' : 'expert';
})();
const page = location.pathname.split('/').pop()?.toLowerCase() || 'home.html';
const nested = location.pathname.includes('/modules/');
const root = nested ? '../../' : '';
const url = (name) => `${root}${name}?edition=${edition}`;

function ensureChrome(){
  if(page==='challenge.html'){
    document.querySelectorAll('body > header.topbar').forEach(el=>el.remove());
    let header=document.querySelector('body > .acl-command-header');
    if(!header){
      header=document.createElement('header');
      header.className='acl-command-header';
      header.innerHTML=`<div class="acl-command-header-left"><button id="aclDrawerToggle" class="acl-command-menu" type="button" aria-label="Open navigation" aria-controls="aclCommandDrawer" aria-expanded="false"><span></span><span></span><span></span></button><a class="acl-command-brand" href="${url('home.html')}"><img src="${root}assets/images/acl-header-mark.svg" alt="Cardiology League" class="acl-command-brand-logo"><span class="acl-command-brand-name">Cardiology League</span><span class="acl-command-brand-separator">•</span><strong id="aclHeaderEdition">${edition==='basic'?'THE BASIC EDITION':'THE EXPERT EDITION'}</strong></a></div><div class="acl-command-header-actions"><span id="aclHeaderUserName" class="acl-command-user-name">Member</span><a class="acl-command-icon-btn" href="${url('notifications.html')}" aria-label="Notifications">🔔</a><a class="acl-command-icon-btn" href="${url('settings.html')}" aria-label="Settings">⚙</a><button id="aclHeaderLogout" class="acl-command-icon-btn" type="button" aria-label="Log out">↪</button></div>`;
      document.body.insertBefore(header,document.body.firstChild);
    }
    if(!document.getElementById('aclDrawerBackdrop')){const b=document.createElement('div');b.id='aclDrawerBackdrop';b.className='acl-drawer-backdrop';b.hidden=true;header.after(b)}
    if(!document.getElementById('aclCommandDrawer')){const d=document.createElement('aside');d.id='aclCommandDrawer';d.className='acl-command-drawer';d.setAttribute('aria-label','ACL navigation');document.getElementById('aclDrawerBackdrop').after(d)}
    if(!document.querySelector('.acl-mobile-bottom-nav')){const nav=document.createElement('nav');nav.className='acl-mobile-bottom-nav';nav.setAttribute('aria-label','Mobile navigation');nav.innerHTML=`<a href="${url('home.html')}"><span>⌂</span><small>Home</small></a><button id="aclMobileModulesButton" type="button"><span>▦</span><small>Menu</small></button><a href="${url('progress.html')}"><span>▤</span><small>Progress</small></a><a href="${url('profile.html')}"><span>♙</span><small>Profile</small></a>`;document.body.appendChild(nav)}
    document.body.classList.add('acl-command-body','acl-shared-page');
    const main=document.querySelector('body > main.challenge-shell');if(main)main.classList.add('acl-command-main','acl-shared-main');
    document.body.style.paddingTop='0';
    const back=document.querySelector('.challenge-back-link');if(back)back.style.display='none';
  }
  if(page==='home.html'){
    const header=document.querySelector('body > .acl-command-header');
    if(header){header.classList.remove('home-app-header');const editionEl=header.querySelector('#aclHeaderEdition');if(editionEl)editionEl.textContent=edition==='basic'?'THE BASIC EDITION':'THE EXPERT EDITION';const brand=header.querySelector('.acl-command-brand');if(brand)brand.href=url('home.html')}
    document.body.classList.add('acl-command-body');
  }
}

function icon(name) {
  const icons = {home:'⌂',modules:'▦',progress:'◔',study:'◇',challenge:'♙',competitions:'♛',friends:'♧',notifications:'✉',settings:'⚙'};
  return icons[name] || '•';
}
function item(key,label,href,matches=[]){
  const active=matches.includes(page)?' is-active':'';
  return `<a class="acl-universal-link${active}" href="${href}"><span class="acl-universal-icon">${icon(key)}</span><span>${label}</span></a>`;
}

function renderDrawer(){
  const drawer=document.getElementById('aclCommandDrawer');
  if(!drawer) return false;
  if(drawer.dataset.universalVersion === DRAWER_VERSION) return false;
  drawer.dataset.universal='1';
  drawer.dataset.universalVersion=DRAWER_VERSION;
  drawer.classList.add('acl-universal-drawer');
  drawer.innerHTML=`<div class="acl-universal-scroll"><nav class="acl-universal-nav" aria-label="Main navigation">
    ${item('home','Home',url('home.html'),['home.html'])}
    ${item('modules','Modules',url('modules.html'),['modules.html'])}
    ${item('progress','My Progress',url('progress.html'),['progress.html'])}
    ${item('study','Mind Maps & Flashcards',url('study.html'),['study.html'])}
    ${item('challenge','Challenges',url('challenge.html'),['challenge.html'])}
    ${item('competitions','Competitions',url('competitions.html'),['competitions.html','competition-dashboard.html'])}
    ${item('friends','Friends',url('challenge.html#friends'),['friends.html'])}
    ${item('notifications','Messages & Notifications',url('notifications.html'),['notifications.html'])}
    ${item('settings','Settings',url('settings.html'),['settings.html'])}
  </nav><section class="acl-universal-streak" aria-label="Daily streak"><small>DAILY STREAK</small><div><strong id="aclUniversalStreak">—</strong><span>days</span></div><div class="acl-universal-streak-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i class="open"></i></div></section></div>`;
  return true;
}

function isMobile(){return window.matchMedia('(max-width:820px)').matches}
function openDrawer(){const backdrop=document.getElementById('aclDrawerBackdrop');document.body.classList.remove('drawer-collapsed');document.body.classList.add('drawer-open');if(backdrop)backdrop.hidden=false;document.getElementById('aclDrawerToggle')?.setAttribute('aria-expanded','true')}
function closeDrawer(){const backdrop=document.getElementById('aclDrawerBackdrop');document.body.classList.remove('drawer-open');if(backdrop)backdrop.hidden=true;document.getElementById('aclDrawerToggle')?.setAttribute('aria-expanded','false')}

function bindControls(){
  const toggle=document.getElementById('aclDrawerToggle');
  if(toggle && toggle.dataset.drawerV7!=='1'){
    toggle.dataset.drawerV7='1';
    toggle.addEventListener('click',(event)=>{if(!isMobile())return;event.preventDefault();event.stopPropagation();document.body.classList.contains('drawer-open')?closeDrawer():openDrawer()});
  }
  const mobileButton=document.getElementById('aclMobileModulesButton');
  if(mobileButton && mobileButton.dataset.drawerV7!=='1'){
    mobileButton.dataset.drawerV7='1';
    mobileButton.addEventListener('click',(event)=>{event.preventDefault();openDrawer()});
  }
  const backdrop=document.getElementById('aclDrawerBackdrop');
  if(backdrop && backdrop.dataset.drawerV7!=='1'){
    backdrop.dataset.drawerV7='1';
    backdrop.addEventListener('click',(event)=>{event.preventDefault();closeDrawer()});
  }
}

function fixBottomNav(){
  document.querySelectorAll('.acl-mobile-bottom-nav a').forEach(a=>{
    const label=(a.querySelector('small')?.textContent||'').trim().toLowerCase();
    if(label==='home'){a.href=url('home.html');a.classList.toggle('is-active',page==='home.html')}
    if(label==='modules')a.classList.toggle('is-active',page==='modules.html');
  });
}

async function streakFromCloud(){
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user)return null;
    const {data,error}=await supabaseClient.from('quiz_attempts').select('completed_at,updated_at,status').eq('user_id',session.user.id).eq('status','completed').order('completed_at',{ascending:false}).limit(90);
    if(error||!Array.isArray(data)||!data.length)return null;
    const days=[...new Set(data.map(r=>{const d=new Date(r.completed_at||r.updated_at||0);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10)}.filter(Boolean))].sort().reverse();
    if(!days.length)return 0;
    let count=1;for(let i=1;i<days.length;i++){if(Math.round((new Date(days[i-1])-new Date(days[i]))/86400000)===1)count++;else break}return count;
  }catch{return null}
}
async function fillStreak(){
  let value=null;
  try{const local=Number(localStorage.getItem('acl_streak'));if(Number.isFinite(local)&&local>=0)value=local}catch{}
  const cloud=await streakFromCloud();if(cloud!==null)value=cloud;
  const el=document.getElementById('aclUniversalStreak');if(el)el.textContent=value===null?'—':String(value);
}

async function logout(){try{await supabaseClient.auth.signOut()}catch(error){console.warn(error)}location.replace(root+'login.html')}
function ensureLogout(){const btn=document.getElementById('aclHeaderLogout');if(btn&&btn.dataset.universalLogout!=='7'){btn.dataset.universalLogout='7';btn.setAttribute('aria-label','Log out');btn.title='Log out';btn.addEventListener('click',(event)=>{event.preventDefault();logout()})}}

async function fillHeaderUser(){
  try{const {data:{session}}=await supabaseClient.auth.getSession();if(!session?.user)return;const {data}=await supabaseClient.from('profiles').select('display_name,full_name,name,username').eq('id',session.user.id).maybeSingle();const name=data?.display_name||data?.full_name||data?.name||data?.username||session.user.user_metadata?.display_name||session.user.user_metadata?.full_name||session.user.email?.split('@')[0]||'Member';const el=document.getElementById('aclHeaderUserName');if(el)el.textContent=name}catch{}
}

let initialized=false;
function initialize(){
  if(initialized)return;
  initialized=true;
  ensureChrome();
  applyBrand(document);
  renderDrawer();
  bindControls();
  ensureLogout();
  fixBottomNav();
  fillHeaderUser();
  if(document.getElementById('aclUniversalStreak'))fillStreak();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
window.addEventListener('resize',()=>{if(!isMobile())closeDrawer()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer()});