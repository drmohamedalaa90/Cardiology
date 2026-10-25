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
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js?v=8.0.0',{scope:'/Cardiology/',updateViaCache:'none'}).catch(()=>{}),{once:true});
if(document.getElementById('aclFixedNavigation'))return;
const links=[['basic-home.html','⌂','Home'],['basic-modules.html','▦','Modules'],['basic-challenges.html','⚔','Challenges'],['basic-progress.html','▤','Progress'],['basic-notifications.html','♢','Notifications']];
const section=page.includes('official')||page==='challenge.html'?'basic-challenges.html':page==='progress.html'?'basic-progress.html':page==='notifications.html'?'basic-notifications.html':page;
const nav=document.createElement('nav');nav.id='aclFixedNavigation';nav.className='basic-bottom-nav basic-universal-bottom acl-fixed-navigation';nav.setAttribute('aria-label','Basic Edition navigation');
nav.innerHTML=links.map(([file,icon,label])=>'<a'+(section===file?' class="is-active" aria-current="page"':'')+' href="'+file+'?edition=basic"><span aria-hidden="true">'+icon+'</span><strong>'+label+'</strong>'+(label==='Notifications'?'<em class="basic-nav-badge" id="'+(page==='basic-home.html'||page==='basic-modules.html'?'basicHomeNotificationBadge':'basicNotificationBadge')+'" hidden>0</em>':'')+'</a>').join('');
document.body.append(nav);
})();