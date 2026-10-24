import {api,session,esc,date,stateOf,countdown,remaining,playerUrl} from './official-api.js?v=1';
const host=document.getElementById('officialCompetitionsList'),banner=document.getElementById('basicLaunchCountdown');
let competitions=[],offset=0;
function now(){return Date.now()+offset;}
function card(c){return `<article class="oc-competition" data-oc-card="${esc(c.id)}"><span class="oc-pill" data-oc-state></span><h3>${esc(c.title)}</h3><p>${c.question_count} questions · ${c.question_seconds}s per question<br>${esc(date(c.opens_at))}</p><div class="oc-countdown" data-oc-countdown></div><a class="oc-btn primary" data-oc-link href="${playerUrl(c.id)}">View competition</a></article>`;}
function update(){
 if(host)for(const card of host.querySelectorAll('[data-oc-card]')){const c=competitions.find(c=>c.id===card.dataset.ocCard);if(!c)continue;const state=stateOf(c,now());card.querySelector('[data-oc-state]').textContent=state==='upcoming'?'Upcoming':state==='live'?'Live now':state==='draft'?'Draft':'Closed';card.querySelector('[data-oc-state]').className='oc-pill '+state;card.querySelector('[data-oc-countdown]').textContent=state==='upcoming'?'Starts in '+countdown(Date.parse(c.opens_at)-now()):state==='live'?'Closes in '+countdown(Date.parse(c.closes_at)-now()):'';card.querySelector('[data-oc-link]').textContent=c.attempt_status&&c.attempt_status!=='active'?'My result':state==='live'?'Enter competition':'View competition';}
 if(!banner)return;
 const published=competitions.filter(c=>c.status!=='draft');
 const c=published.find(c=>stateOf(c,now())==='live')||published.find(c=>stateOf(c,now())==='upcoming')||published.at(-1);if(!c)return;
 window.aclOfficialBannerActive=true;
 const state=stateOf(c,now()),target=state==='upcoming'?c.opens_at:c.closes_at,r=remaining(Date.parse(target)-now());
 banner.querySelector('.basic-launch-kicker').textContent=state==='live'?'OFFICIAL ACL COMPETITION · LIVE NOW':state==='upcoming'?'OFFICIAL ACL COMPETITION · STARTS IN':'OFFICIAL ACL COMPETITION · CLOSED';
 document.getElementById('basicLaunchTitle').textContent=c.title;
 const time=banner.querySelector('time');time.dateTime=c.opens_at;time.textContent=date(c.opens_at);
 document.getElementById('basicLaunchUnits').hidden=state==='closed';
 for(const key of ['days','hours','minutes','seconds']){const el=document.getElementById('basicLaunch'+key[0].toUpperCase()+key.slice(1));if(el)el.textContent=String(r[key]).padStart(2,'0');}
 let link=document.getElementById('officialBannerLink');if(!link){link=document.createElement('a');link.id='officialBannerLink';link.className='oc-banner-link';time.after(document.createElement('br'),link);}
 link.href=playerUrl(c.id);link.textContent=state==='live'?'Competition is live · Enter now':state==='upcoming'?'View competition':'View competition results';
}
async function load(){try{const data=await api('list');offset=Date.parse(data.server_now)-Date.now();competitions=(data.competitions||[]).sort((a,b)=>Date.parse(a.opens_at)-Date.parse(b.opens_at));if(host){const create=document.getElementById('officialCreateCompetition');if(create)create.hidden=!data.admin;host.innerHTML=competitions.length?competitions.map(card).join(''):'<div class="oc-empty">No official competitions scheduled.</div>';}update();}catch(error){if(host)host.innerHTML='<div class="oc-empty">Could not load competitions. Please refresh.</div>';console.warn('Official competitions:',error.message);}}
if(host||banner){if(await session()){await load();setInterval(update,1000);setInterval(load,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});}}
