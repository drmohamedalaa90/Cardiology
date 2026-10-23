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
  const usage=Array.isArray(c.lifelines?.usage)?c.lifelines.usage:[];
  const lifeNames={filter:'50:50',swap:'Swap question',time:'Extra time',expert:'Dr. Corazón',vault:'Knowledge Vault',flashcard:'Flashcard'};
  const action=(id,icon,label)=>`<button class="basic-result-action" data-br="${id}"><span class="basic-action-icon" aria-hidden="true">${icon}</span><span>${label}</span><b aria-hidden="true">›</b></button>`;
  host.innerHTML=`<section class="basic-quiz-result"><div class="basic-result-intro"><div><span class="basic-result-kicker">QUIZ COMPLETED</span><h2>${correct} / ${c.questions.length} correct</h2><button class="basic-result-review" data-br="all">Review answers →</button></div><figure class="basic-result-corazon"><img src="${esc(c.mascot||'assets/images/dr-corazon-good-job.webp')}" alt="Dr. Corazón"><figcaption><strong>Dr. Corazón</strong><span>${correct===c.questions.length?'Excellent work!':'Keep practising.'}</span></figcaption></figure></div>
  <div class="basic-result-boxes"><article class="basic-correct-box"><span>✓ Correct answers</span><strong>${correct}<small> / ${c.questions.length}</small></strong><p>${c.questions.length?Math.round(correct/c.questions.length*100):0}% correct · ${c.questions.length-correct} incorrect</p></article><article class="basic-lifelines-box"><span>✦ Lifelines used</span><strong>${usage.length}</strong><p>${usage.length?usage.map(u=>esc(lifeNames[u.type||u.lifeline]||u.type||'Life Saver')+(u.questionNumber?' · Q'+Number(u.questionNumber):'')).join('<br>'):'No lifelines used'}</p></article></div>
  <div class="basic-result-actions">${!c.challengeId?action('same','↻','Retry the same quiz')+action('different','⇄','Retry a different quiz'):'<a class="basic-result-action" href="basic-challenges.html?edition=basic"><span class="basic-action-icon">⚔</span><span>View challenge</span><b>›</b></a>'}${action('wrong','★','Review my wrong and starred questions')}${action('notes','✎','Review notes taken')}<a class="basic-result-action" href="basic-flashcards.html?edition=basic&module=${encodeURIComponent(c.moduleId)}"><span class="basic-action-icon" aria-hidden="true">▤</span><span>Go to flashcards</span><b aria-hidden="true">›</b></a><a class="basic-result-action" data-lecture aria-disabled="true"><span class="basic-action-icon" aria-hidden="true">▶</span><span data-lecture-label>Review the lecture on YouTube</span><b aria-hidden="true">›</b></a></div><section id="basicQuizReviewDetail" aria-live="polite"></section></section>`;
  const detail=host.querySelector('#basicQuizReviewDetail');
  function practiceReview(){
    const selected=c.questions.map((q,i)=>({q,i})).filter(({q})=>answers.get(String(q.id))?.correct!==true||c.starred.has(String(q.id)));
    const records=new Map(selected.map(({q})=>{const a=answers.get(String(q.id));const ids=new Set((a?.correctOptionIds||[]).map(String));return [String(q.id),{options:(q.options||[]).map(o=>({...o,is_correct:ids.has(String(o.id))})),explanation:a?.explanation||q.explanation,reference:a?.referenceText}];}));
    detail.innerHTML='<h2>Wrong and starred questions in this quiz</h2>'+(selected.length?selected.map(({q,i})=>`<article class="basic-answer-review"><span>Question ${i+1}${c.starred.has(String(q.id))?' · ★ Starred':''}</span><h3>${esc(q.stem)}</h3>${q.clinical_scenario?`<p>${esc(q.clinical_scenario)}</p>`:''}${q.image_url?`<img src="${esc(q.image_url)}" alt="Question image">`:''}${practiceMarkup(q.id,records.get(String(q.id)).options)}</article>`).join(''):'<p>No wrong or starred questions in this quiz.</p>');
    bindPractice(detail,key=>records.get(key));detail.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function review(onlyWrong){const selected=c.questions.map((q,i)=>({q,i})).filter(({q})=>!onlyWrong||answers.get(String(q.id))?.correct!==true||c.starred.has(String(q.id)));
    detail.innerHTML=`<h2>${onlyWrong?'Wrong and starred questions in this quiz':'All quiz answers'}</h2>`+(selected.length?selected.map(({q,i})=>{const a=answers.get(String(q.id));const options=(q.options||[]);const chosen=new Set((a?.selectedIds||[]).map(String)),correctIds=new Set((a?.correctOptionIds||[]).map(String));return `<article class="basic-answer-review"><span>Question ${i+1}${c.starred.has(String(q.id))?' · ★ Starred':''}</span><h3>${esc(q.stem)}</h3>${q.clinical_scenario?`<p>${esc(q.clinical_scenario)}</p>`:''}${q.image_url?`<img src="${esc(q.image_url)}" alt="${esc(q.image_alt||'Question image')}">`:''}<ul>${options.map(o=>`<li class="${correctIds.has(String(o.id))?'is-correct':''}">${esc(o.key||o.option_key||'')} ${esc(o.text||o.option_text||'')}${chosen.has(String(o.id))?' — Your answer':''}${correctIds.has(String(o.id))?' ✓':''}</li>`).join('')}</ul><h4>Explanation</h4><p>${esc(a?.explanation||q.explanation||'No explanation has been added.').replace(/\n/g,'<br>')}</p>${a?.referenceText?`<small>${esc(a.referenceText)}</small>`:''}</article>`;}).join(''):'<p>No wrong or starred questions in this quiz.</p>');detail.scrollIntoView({behavior:'smooth',block:'start'});}
  host.querySelector('[data-br="all"]').onclick=()=>review(false);
  host.querySelector('[data-br="wrong"]').onclick=practiceReview;
  host.querySelector('[data-br="same"]')?.addEventListener('click',()=>c.retrySame());
  host.querySelector('[data-br="different"]')?.addEventListener('click',()=>c.retryDifferent());
  host.querySelector('[data-br="notes"]').onclick=()=>{const notes=c.questions.map((q,i)=>({question:q,number:i+1,text:readNote(c,q)})).filter(n=>n.text.trim());detail.innerHTML='<h2>Notes from this quiz</h2>'+(notes.length?'<button type="button" class="secondary-btn" data-export-notes>Export notes as image</button>'+notes.map(n=>`<article class="basic-answer-review"><h3>Question ${n.number}: ${esc(n.question.stem)}</h3><p>${esc(n.text).replace(/\n/g,'<br>')}</p></article>`).join(''):'<p>No notes were taken during this quiz.</p>');detail.querySelector('[data-export-notes]')?.addEventListener('click',()=>exportNotes(c,notes));detail.scrollIntoView({behavior:'smooth',block:'start'});};
  host.scrollIntoView({behavior:'smooth',block:'start'});
  const {data,error}=await supabaseClient.from('videos').select('youtube_url').eq('module_id',c.moduleId).eq('is_active',true).order('created_at').limit(1);
  const link=host.querySelector('[data-lecture]');if(!link)return;let url;try{url=new URL(data?.[0]?.youtube_url);}catch{}
  if(!error&&url&&['https:','http:'].includes(url.protocol)){link.href=url.href;link.target='_blank';link.rel='noopener';link.removeAttribute('aria-disabled');}else{link.querySelector('[data-lecture-label]').textContent='Lecture on YouTube · Coming soon';}
}


// Untimed practice never changes the scored quiz attempt.
export function practiceMarkup(key,options){
 const multi=options.filter(o=>o.is_correct).length>1;
 return `<div data-practice="${esc(key)}"><p>Answer again · No timer or lifelines${multi?' · Select all correct answers':''}</p><div style="display:grid;gap:10px">${options.map(o=>`<label style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #d8e2ed;border-radius:14px;cursor:pointer;background:#fff"><input type="${multi?'checkbox':'radio'}" name="practice-${esc(key)}" value="${esc(o.id)}"><span>${esc(o.key||o.option_key||'')} ${esc(o.text||o.option_text||'')}</span></label>`).join('')}</div><button type="button" class="primary-btn" data-practice-check style="margin-top:14px">Check answer</button><div data-practice-feedback aria-live="polite"></div></div>`;
}
export function bindPractice(root,getQuestion){
 root.querySelectorAll('[data-practice]').forEach(card=>{
  const check=card.querySelector('[data-practice-check]'),feedback=card.querySelector('[data-practice-feedback]');
  check.onclick=()=>{
   const chosen=[...card.querySelectorAll('input:checked')].map(x=>String(x.value));
   if(!chosen.length){feedback.textContent='Choose your answer first.';return;}
   const q=getQuestion(card.dataset.practice),correct=q.options.filter(o=>o.is_correct).map(o=>String(o.id));
   const right=chosen.length===correct.length&&chosen.every(id=>correct.includes(id));
   card.querySelectorAll('input').forEach(input=>{input.disabled=true;if(correct.includes(input.value)){input.closest('label').style.background='#e7f7ee';input.closest('label').style.borderColor='#55a877';}});
   feedback.innerHTML=`<p><strong>${right?'Correct!':'Not quite. The correct answer is highlighted.'}</strong></p><h4>Explanation</h4><p>${esc(q.explanation||'No explanation has been added.').replace(/\n/g,'<br>')}</p>${q.reference?`<small>${esc(q.reference)}</small>`:''}<p><button type="button" class="secondary-btn" data-practice-retry>Try again</button></p>`;
   check.hidden=true;
   feedback.querySelector('[data-practice-retry]').onclick=()=>{card.querySelectorAll('input').forEach(input=>{input.disabled=false;input.checked=false;input.closest('label').style.background='#fff';input.closest('label').style.borderColor='#d8e2ed';});feedback.innerHTML='';check.hidden=false;};
  };
 });
}
