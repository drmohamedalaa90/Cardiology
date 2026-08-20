import { supabaseClient } from './supabase-client.js';

const DRAWER_VERSION = '5';
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
applyBrand(document);

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
function openDrawer(){
  const backdrop=document.getElementById('aclDrawerBackdrop');
  document.body.classList.remove('drawer-collapsed');
  document.body.classList.add('drawer-open');
  if(backdrop) backdrop.hidden=false;
  document.getElementById('aclDrawerToggle')?.setAttribute('aria-expanded','true');
}
function closeDrawer(){
  const backdrop=document.getElementById('aclDrawerBackdrop');
  document.body.classList.remove('drawer-open');
  if(backdrop) backdrop.hidden=true;
  document.getElementById('aclDrawerToggle')?.setAttribute('aria-expanded','false');
}

function bindControls(){
  const toggle=document.getElementById('aclDrawerToggle');
  if(toggle && toggle.dataset.drawerV4!=='1'){
    toggle.dataset.drawerV4='1';
    toggle.addEventListener('click',(event)=>{
      if(!isMobile()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(document.body.classList.contains('drawer-open')) closeDrawer(); else openDrawer();
    },true);
  }
  const mobileButton=document.getElementById('aclMobileModulesButton');
  if(mobileButton && mobileButton.dataset.drawerV4!=='1'){
    mobileButton.dataset.drawerV4='1';
    mobileButton.addEventListener('click',(event)=>{event.preventDefault();event.stopImmediatePropagation();openDrawer()},true);
  }
  const backdrop=document.getElementById('aclDrawerBackdrop');
  if(backdrop && backdrop.dataset.drawerV4!=='1'){
    backdrop.dataset.drawerV4='1';
    backdrop.addEventListener('click',(event)=>{event.preventDefault();closeDrawer()},true);
  }
}

function fixBottomNav(){
  document.querySelectorAll('.acl-mobile-bottom-nav a').forEach(a=>{
    const label=(a.querySelector('small')?.textContent||'').trim().toLowerCase();
    if(label==='home'){
      a.href=url('home.html');
      a.classList.toggle('is-active',page==='home.html');
    }
    if(label==='modules') a.classList.toggle('is-active',page==='modules.html');
  });
}

async function streakFromCloud(){
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user)return null;
    const {data,error}=await supabaseClient.from('quiz_attempts').select('completed_at,updated_at,status').eq('user_id',session.user.id).eq('status','completed').order('completed_at',{ascending:false}).limit(90);
    if(error||!Array.isArray(data)||!data.length)return null;
    const days=[...new Set(data.map(r=>{const d=new Date(r.completed_at||r.updated_at||0);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10)}).filter(Boolean))].sort().reverse();
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
function ensureLogout(){
  const btn=document.getElementById('aclHeaderLogout');
  if(btn){
    btn.setAttribute('aria-label','Log out');btn.title='Log out';
    if(btn.dataset.universalLogout!=='4'){
      btn.dataset.universalLogout='4';
      btn.addEventListener('click',(event)=>{event.preventDefault();event.stopImmediatePropagation();logout()},true);
    }
  }
}

let streakLoaded=false;
function apply(){
  applyBrand(document);
  const created=renderDrawer();
  bindControls();
  ensureLogout();
  fixBottomNav();
  if((created||!streakLoaded)&&document.getElementById('aclUniversalStreak')){streakLoaded=true;fillStreak()}
}

apply();
const observer=new MutationObserver(mutations=>{mutations.forEach(m=>{if(m.type==='characterData')applyBrand(m.target);m.addedNodes.forEach(node=>applyBrand(node))});apply()});
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('DOMContentLoaded',apply,{once:true});
window.addEventListener('load',apply,{once:true});
window.addEventListener('resize',()=>{if(!isMobile())closeDrawer()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer()});
