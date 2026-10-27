/* Runs before page content and independently of authentication/network modules. */
(()=>{const p=new URLSearchParams(location.search),page=location.pathname.split('/').pop()||'';let saved='';try{saved=localStorage.getItem('aclSelectedEdition')||''}catch{}
if((p.get('edition')||saved)!=='basic'&&!page.startsWith('basic-'))return;
const ensureHead=(tag,attrs)=>{if(document.head.querySelector(attrs.rel?`${tag}[rel="${attrs.rel}"]`: `${tag}[name="${attrs.name}"]`))return;const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);document.head.append(el)};
ensureHead('meta',{name:'application-name',content:'Cardiology League'});
ensureHead('meta',{name:'mobile-web-app-capable',content:'yes'});
ensureHead('meta',{name:'apple-mobile-web-app-capable',content:'yes'});
ensureHead('meta',{name:'apple-mobile-web-app-status-bar-style',content:'default'});
ensureHead('meta',{name:'apple-mobile-web-app-title',content:'Cardiology League'});
ensureHead('meta',{name:'msapplication-TileColor',content:'#082f57'});
ensureHead('meta',{name:'msapplication-TileImage',content:'assets/images/acl-icon-192.png?v=3'});
ensureHead('link',{rel:'manifest',href:'manifest.webmanifest?v=3'});
ensureHead('link',{rel:'icon',type:'image/png',sizes:'192x192',href:'assets/images/acl-icon-192.png?v=3'});
ensureHead('link',{rel:'apple-touch-icon',sizes:'180x180',href:'assets/images/acl-apple-touch-icon.png?v=3'});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js?v=8.1.0',{scope:'/Cardiology/',updateViaCache:'none'}).catch(()=>{}),{once:true});
if(document.getElementById('aclFixedNavigation'))return;
const links=[['basic-home.html','⌂','Home'],['basic-modules.html','▦','Modules'],['basic-challenges.html','⚔','Challenges'],['basic-progress.html','▤','Progress'],['basic-notifications.html','♢','Notifications']];
const section=page.includes('official')||page==='challenge.html'?'basic-challenges.html':page==='progress.html'?'basic-progress.html':page==='notifications.html'?'basic-notifications.html':page;
const nav=document.createElement('nav');nav.id='aclFixedNavigation';nav.className='basic-bottom-nav basic-universal-bottom acl-fixed-navigation';nav.setAttribute('aria-label','Basic Edition navigation');
nav.innerHTML=links.map(([file,icon,label])=>'<a'+(section===file?' class="is-active" aria-current="page"':'')+' href="'+file+'?edition=basic"><span aria-hidden="true">'+icon+'</span><strong>'+label+'</strong>'+(label==='Notifications'?'<em class="basic-nav-badge" id="'+(page==='basic-home.html'||page==='basic-modules.html'?'basicHomeNotificationBadge':'basicNotificationBadge')+'" hidden>0</em>':'')+'</a>').join('');
document.body.append(nav);
async function checkPendingAttendanceChecker(){
  if(page==='basic-special-course.html'&&p.get('checker')==='1')return;
  try{
    const {supabaseClient}=await import('./supabase-client.js');
    const {data:{session}}=await supabaseClient.auth.getSession();if(!session?.user)return;
    const {data,error}=await supabaseClient.rpc('acl_pending_attendance_checker');if(error)return;if(!data?.session_id){const {data:alert}=await supabaseClient.rpc('acl_pending_suspension_reply');if(!alert?.module_id)return;const overlay=document.createElement('div');overlay.className='acl-checker-gate is-yellow';overlay.innerHTML='<section role="alertdialog" aria-modal="true"><span>SUSPENSION REVIEW UPDATE</span><h2>The administrator reviewed your request</h2><p class="result"></p><div class="gate-actions"><a href="basic-modules.html?edition=basic">Back to modules</a><button type="button">Close</button></div></section>';overlay.querySelector('.result').textContent=alert.reply;overlay.querySelector('button').onclick=async()=>{await supabaseClient.rpc('acl_course_suspension_review',{p_action:'ack',p_module_id:alert.module_id,p_args:{}});overlay.remove()};document.body.append(overlay);return}
    const target='basic-special-course.html?edition=basic&course='+encodeURIComponent(data.module_id)+'&room='+encodeURIComponent(data.session_id)+'&attendance=1&checker=1';
    const overlay=document.createElement('div');overlay.className='acl-checker-gate';overlay.innerHTML='<section role="alertdialog" aria-modal="true"><span>ATTENDANCE REVIEW RESULT</span><h2>Your fast attendance checker is ready</h2><p class="result"></p><div class="room"></div><p>You will now be taken to the five-question checker. You need 4/5 or 5/5 to change this attendance to green.</p><a href="'+target+'">Take the checker now →</a><small>Redirecting in <b>4</b> seconds…</small></section>';
    overlay.querySelector('.result').textContent=data.review_result;overlay.querySelector('.room').textContent='Room '+String(data.session_number).padStart(2,'0')+' · '+data.session_title;document.body.append(overlay);
    let left=4;const timer=setInterval(()=>{left-=1;const b=overlay.querySelector('small b');if(b)b.textContent=left;if(left<=0){clearInterval(timer);location.assign(target)}},1000);
  }catch(error){console.warn('Attendance checker gate unavailable',error)}
}
window.addEventListener('load',()=>setTimeout(checkPendingAttendanceChecker,350),{once:true});
})();
