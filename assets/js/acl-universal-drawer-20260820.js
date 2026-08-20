import { supabaseClient } from './supabase-client.js';

const edition = (() => {
  const q = new URLSearchParams(location.search).get('edition');
  let saved = '';
  try { saved = localStorage.getItem('aclSelectedEdition') || ''; } catch {}
  return String(q || saved || 'expert').toLowerCase() === 'basic' ? 'basic' : 'expert';
})();
const page = location.pathname.split('/').pop()?.toLowerCase() || 'home.html';
const nested = location.pathname.includes('/modules/');
const root = nested ? '../../' : '';
const url = (name, hash='') => `${root}${name}?edition=${edition}${hash}`;

const NAV = [
  ['home','Home',url('home.html'),['home.html']],
  ['modules','Modules',url('modules.html'),['modules.html']],
  ['progress','My Progress',url('progress.html'),['progress.html']],
  ['study','Mind Maps & Flashcards',url('study.html'),['study.html']],
  ['challenge','Challenges',url('challenge.html'),['challenge.html']],
  ['competitions','Competitions',url('competitions.html'),['competitions.html','competition-dashboard.html']],
  ['friends','Friends',url('challenge.html','#friends'),['friends.html']],
  ['notifications','Messages & Notifications',url('notifications.html'),['notifications.html']],
  ['settings','Settings',url('settings.html'),['settings.html']]
];

function icon(name) {
  return ({home:'⌂',modules:'▦',progress:'◔',study:'◇',challenge:'♙',competitions:'♛',friends:'♧',notifications:'✉',settings:'⚙'})[name] || '•';
}

function navMarkup(){
  return NAV.map(([key,label,href,matches])=>{
    const active = matches.includes(page) ? ' is-active' : '';
    return `<a class="acl-universal-link${active}" href="${href}"><span class="acl-universal-icon">${icon(key)}</span><span>${label}</span></a>`;
  }).join('');
}

function drawerMarkup(){
  return `<div class="acl-universal-scroll">
    <nav class="acl-universal-nav" aria-label="Main navigation">${navMarkup()}</nav>
    <section class="acl-universal-streak" aria-label="Daily streak">
      <small>DAILY STREAK</small>
      <div class="acl-universal-streak-value"><strong data-acl-streak-value>—</strong><span>days</span></div>
      <div class="acl-universal-streak-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i class="open"></i></div>
    </section>
  </div>`;
}

function allDrawerHosts(){
  return [...document.querySelectorAll('#aclCommandDrawer, aside.home-nav')];
}

function renderDrawer() {
  let changed = false;
  allDrawerHosts().forEach(drawer => {
    if (drawer.dataset.universalVersion === '2') return;
    drawer.dataset.universalVersion = '2';
    drawer.classList.add('acl-universal-drawer');
    drawer.innerHTML = drawerMarkup();
    changed = true;
  });
  return changed;
}

async function streakFromCloud() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) return null;
    const { data, error } = await supabaseClient.from('quiz_attempts')
      .select('completed_at,updated_at,status')
      .eq('user_id', session.user.id)
      .eq('status','completed')
      .order('completed_at',{ascending:false})
      .limit(90);
    if (error || !Array.isArray(data) || !data.length) return null;
    const days = [...new Set(data.map(r => {
      const d = new Date(r.completed_at || r.updated_at || 0);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
    }).filter(Boolean))].sort().reverse();
    if (!days.length) return 0;
    let count = 1;
    for (let i=1;i<days.length;i++) {
      if (Math.round((new Date(days[i-1]) - new Date(days[i])) / 86400000) === 1) count++;
      else break;
    }
    return count;
  } catch { return null; }
}

async function fillStreak() {
  let value = null;
  try {
    const local = Number(localStorage.getItem('acl_streak'));
    if (Number.isFinite(local) && local >= 0) value = local;
  } catch {}
  const cloud = await streakFromCloud();
  if (cloud !== null) value = cloud;
  document.querySelectorAll('[data-acl-streak-value]').forEach(el => {
    el.textContent = value === null ? '—' : String(value);
  });
}

let streakLoaded = false;
function apply() {
  const changed = renderDrawer();
  if ((changed || !streakLoaded) && allDrawerHosts().length) {
    streakLoaded = true;
    fillStreak();
  }
}

apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',apply,{once:true});
window.addEventListener('load',apply,{once:true});