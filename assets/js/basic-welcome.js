import {supabaseClient} from './supabase-client.js';
const $=id=>document.getElementById(id);
const {data:{session}}=await supabaseClient.auth.getSession();
if(session?.user){
 const user=session.user,name=user.user_metadata?.full_name||'colleague';
 $('welcomeName').textContent='Dear '+name+',';
 $('welcomeContinue').href='basic-home.html?edition=basic';
 $('welcomeContinue').addEventListener('click',()=>{try{sessionStorage.setItem('aclBasicWelcomed:'+user.id,'1');sessionStorage.setItem('aclEditionEntryGranted','basic');sessionStorage.setItem('aclSelectedEdition','basic');localStorage.setItem('aclSelectedEdition','basic');}catch{}});
}else if(new URLSearchParams(location.search).get('pending')==='1'){
 let name='colleague';try{name=sessionStorage.getItem('aclWelcomeName')||name;sessionStorage.removeItem('aclWelcomeName');}catch{}
 $('welcomeName').textContent='Dear '+name+',';$('welcomeConfirmation').hidden=false;
 $('welcomeContinue').textContent='Confirm your email, then sign in →';
}else location.replace('acl-access.html');
