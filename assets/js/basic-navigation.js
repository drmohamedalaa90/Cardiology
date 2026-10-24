/* Runs before page content and independently of authentication/network modules. */
(()=>{const p=new URLSearchParams(location.search),page=location.pathname.split('/').pop()||'';let saved='';try{saved=localStorage.getItem('aclSelectedEdition')||''}catch{}
if((p.get('edition')||saved)!=='basic'&&!page.startsWith('basic-'))return;
if(document.getElementById('aclFixedNavigation'))return;
const links=[['basic-home.html','⌂','Home'],['basic-modules.html','▦','Modules'],['basic-challenges.html','⚔','Challenges'],['basic-progress.html','▤','Progress'],['basic-notifications.html','♢','Notifications']];
const section=page.includes('official')||page==='challenge.html'?'basic-challenges.html':page==='progress.html'?'basic-progress.html':page==='notifications.html'?'basic-notifications.html':page;
const nav=document.createElement('nav');nav.id='aclFixedNavigation';nav.className='basic-bottom-nav basic-universal-bottom acl-fixed-navigation';nav.setAttribute('aria-label','Basic Edition navigation');
nav.innerHTML=links.map(([file,icon,label])=>'<a'+(section===file?' class="is-active" aria-current="page"':'')+' href="'+file+'?edition=basic"><span aria-hidden="true">'+icon+'</span><strong>'+label+'</strong>'+(label==='Notifications'?'<em class="basic-nav-badge" id="'+(page==='basic-home.html'||page==='basic-modules.html'?'basicHomeNotificationBadge':'basicNotificationBadge')+'" hidden>0</em>':'')+'</a>').join('');
document.body.append(nav);
})();