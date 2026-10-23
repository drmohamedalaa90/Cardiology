import {supabaseClient} from './supabase-client.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readNote(c,q){try{return localStorage.getItem(`acl:quiz-note:${c.userId}:${c.attemptId}:${q.id}`)||'';}catch{return '';}}
function exportNotes(c,notes){
  const canvas=document.createElement('canvas');canvas.width=1200;const ctx=canvas.getContext('2d');ctx.font='26px sans-serif';
  const lines=[];for(const text of [c.title,'Quiz notes',...notes.flatMap(n=>[`Question ${n.number}: ${n.question.stem}`,n.text,''])]){
    for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>1050&&line){lines.push(line);line=word;}else line=next;}lines.push(line);}
  }
  for(let start=0;start<lines.length;start+=36){const page=lines.slice(start,start+36);canvas.height=Math.max(400,150+page.length*40);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#072b49';ctx.font='26px sans-serif';page.forEach((line,i)=>ctx.fillText(line,70,80+i*40));const a=document.createElement('a');a.download=`quiz-notes-${c.attemptId}-${1+start/36}.png`;a.href=canvas.toDataURL('image/png');a.click();}
}
export async function showBasicQuizResults(c){
  window.dispatchEvent(new CustomEvent('acl:quiz-results'));
  const host=document.getElementById('quizArea'),answers=new Map(c.answers.map(a=>[String(a.questionId),a]));
  const correct=c.questions.filter(q=>answers.get(String(q.id))?.correct===true).length;
  for(const id of ['submitAnswer','nextQuestion']){const el=document.getElementById(id);if(el)el.hidden=true;}
  const feedback=document.getElementById('answerFeedbackHost');if(feedback)feedback.innerHTML='';
  const count=document.getElementById('questionCount');if(count)count.textContent=`${c.questions.length} questions completed`;
  const fill=document.getElementById('progressFill');if(fill)fill.style.width='100%';
  host.innerHTML=`<section class="basic-quiz-result"><span class="basic-result-kicker">QUIZ COMPLETED</span><h2>${correct} / ${c.questions.length} correct</h2><button class="primary-btn" data-br="all">Review answers</button><div class="basic-result-actions">${!c.challengeId?'<button class="secondary-btn" data-br="same">Retry the same quiz</button><button class="secondary-btn" data-br="different">Retry a different quiz</button>':'<a class="secondary-btn" href="basic-challenges.html?edition=basic">View challenge</a>'}<button class="secondary-btn" data-br="wrong">Review my wrong and starred questions</button><button class="secondary-btn" data-br="notes">Review notes taken</button><a class="secondary-btn" href="basic-flashcards.html?edition=basic&module=${encodeURIComponent(c.moduleId)}">Go to flashcards</a><a class="secondary-btn" data-lecture aria-disabled="true">Review the lecture on YouTube</a></div><section id="basicQuizReviewDetail" aria-live="polite"></section></section>`;
  const detail=host.querySelector('#basicQuizReviewDetail');
  function review(onlyWrong){const selected=c.questions.map((q,i)=>({q,i})).filter(({q})=>!onlyWrong||answers.get(String(q.id))?.correct!==true||c.starred.has(String(q.id)));
    detail.innerHTML=`<h2>${onlyWrong?'Wrong and starred questions in this quiz':'All quiz answers'}</h2>`+(selected.length?selected.map(({q,i})=>{const a=answers.get(String(q.id));const options=(q.options||[]);const chosen=new Set((a?.selectedIds||[]).map(String)),correctIds=new Set((a?.correctOptionIds||[]).map(String));return `<article class="basic-answer-review"><span>Question ${i+1}${c.starred.has(String(q.id))?' · ★ Starred':''}</span><h3>${esc(q.stem)}</h3>${q.clinical_scenario?`<p>${esc(q.clinical_scenario)}</p>`:''}${q.image_url?`<img src="${esc(q.image_url)}" alt="${esc(q.image_alt||'Question image')}">`:''}<ul>${options.map(o=>`<li class="${correctIds.has(String(o.id))?'is-correct':''}">${esc(o.key||o.option_key||'')} ${esc(o.text||o.option_text||'')}${chosen.has(String(o.id))?' — Your answer':''}${correctIds.has(String(o.id))?' ✓':''}</li>`).join('')}</ul><h4>Explanation</h4><p>${esc(a?.explanation||q.explanation||'No explanation has been added.').replace(/\n/g,'<br>')}</p>${a?.referenceText?`<small>${esc(a.referenceText)}</small>`:''}</article>`;}).join(''):'<p>No wrong or starred questions in this quiz.</p>');detail.scrollIntoView({behavior:'smooth',block:'start'});}
  host.querySelector('[data-br="all"]').onclick=()=>review(false);
  host.querySelector('[data-br="wrong"]').onclick=()=>review(true);
  host.querySelector('[data-br="same"]')?.addEventListener('click',()=>c.retrySame());
  host.querySelector('[data-br="different"]')?.addEventListener('click',()=>c.retryDifferent());
  host.querySelector('[data-br="notes"]').onclick=()=>{const notes=c.questions.map((q,i)=>({question:q,number:i+1,text:readNote(c,q)})).filter(n=>n.text.trim());detail.innerHTML='<h2>Notes from this quiz</h2>'+(notes.length?'<button type="button" class="secondary-btn" data-export-notes>Export notes as image</button>'+notes.map(n=>`<article class="basic-answer-review"><h3>Question ${n.number}: ${esc(n.question.stem)}</h3><p>${esc(n.text).replace(/\n/g,'<br>')}</p></article>`).join(''):'<p>No notes were taken during this quiz.</p>');detail.querySelector('[data-export-notes]')?.addEventListener('click',()=>exportNotes(c,notes));detail.scrollIntoView({behavior:'smooth',block:'start'});};
  host.scrollIntoView({behavior:'smooth',block:'start'});
  const {data,error}=await supabaseClient.from('videos').select('youtube_url').eq('module_id',c.moduleId).eq('is_active',true).order('created_at').limit(1);
  const link=host.querySelector('[data-lecture]');if(!link)return;let url;try{url=new URL(data?.[0]?.youtube_url);}catch{}
  if(!error&&url&&['https:','http:'].includes(url.protocol)){link.href=url.href;link.target='_blank';link.rel='noopener';link.removeAttribute('aria-disabled');}else{link.textContent='Review the lecture on YouTube · Coming soon';}
}
