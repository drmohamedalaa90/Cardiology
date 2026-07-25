import { supabaseClient } from './supabase-client.js';
import { protectAndRender } from './session-ui.js';
import { getOpenAttempt, createAttempt, saveAttempt, completeAttempt } from './cloud-progress.js';

const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const params=new URLSearchParams(location.search);
const quizSlug=params.get('quiz');
const moduleId=params.get('module');
let quiz, questions=[], index=0, answers=[], attempt, saving=false;

function status(text,error=false){$('saveStatus').textContent=text;$('saveStatus').classList.toggle('error',error)}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function state(){return {questionIds:questions.map(q=>q.id),currentIndex:index,answers,score:answers.reduce((s,a)=>s+Number(a.points||0),0)}}
async function persist(done=false){if(!attempt||saving)return;saving=true;status('Saving…');try{attempt=done?await completeAttempt(attempt.id,state()):await saveAttempt(attempt.id,state());status(done?'Completed and saved':'Saved to cloud')}catch(e){console.error(e);status('Save failed — check connection',true)}finally{saving=false}}
function currentAnswer(q){return answers.find(a=>a.questionId===q.id)}
function optionsFor(q){
  return q._options || (q._options = [...(q.options || [])].sort((a,b) => {
    const ao = Number(a.display_order ?? 999), bo = Number(b.display_order ?? 999);
    if (ao !== bo) return ao - bo;
    return String(a.key || '').localeCompare(String(b.key || ''));
  }));
}

function render(){
  const q=questions[index];
  $('progressFill').style.width=`${questions.length?Math.round((index/questions.length)*100):0}%`;
  $('questionCount').textContent=q?`Question ${index+1} of ${questions.length}`:`${questions.length} questions completed`;
  if(!q){finish();return}
  const ans=currentAnswer(q), multi=q.question_type==='multiple_response';
  $('quizArea').innerHTML=`
    ${q.topic?`<span class="learning-topic">${esc(q.topic)}</span>`:''}
    ${q.clinical_scenario?`<div class="clinical-scenario">${esc(q.clinical_scenario)}</div>`:''}
    <h2>${esc(q.stem)}</h2>
    ${q.image_url?`<img class="question-image" src="${esc(q.image_url)}" alt="${esc(q.image_alt||'Question image')}">`:''}
    <div class="learning-options">${optionsFor(q).map(o=>`<label class="learning-option ${ans?.selectedIds?.includes(o.id)?'selected':''} ${ans?.correctOptionIds?.includes(o.id)?'correct':''} ${ans&&!ans.correct&&ans.selectedIds?.includes(o.id)?'incorrect':''}">
      <input type="${multi?'checkbox':'radio'}" name="answer" value="${o.id}" ${ans?.selectedIds?.includes(o.id)?'checked':''} ${ans?'disabled':''}>
      <span class="option-key">${esc(o.key)}</span><span>${esc(o.text)}</span>
    </label>`).join('')}</div>
    ${multi&&!ans?'<p class="muted">Select all answers that apply.</p>':''}
    <div id="answerFeedback">${ans?feedbackHtml(ans):''}</div>`;
  $('submitAnswer').hidden=!!ans;$('nextQuestion').hidden=!ans;
}
function feedbackHtml(a){return `<div class="answer-feedback ${a.correct?'correct':'incorrect'}"><h3>${a.correct?'Correct':'Not quite'}</h3>${quiz.show_explanations&&a.explanation?`<p>${esc(a.explanation)}</p>`:''}${a.referenceText?`<p class="reference-note"><strong>Reference:</strong> ${esc(a.referenceText)}${a.referenceUrl?` · <a href="${esc(a.referenceUrl)}" target="_blank" rel="noopener">Open source</a>`:''}</p>`:''}</div>`}
async function submit(){
  const q=questions[index],selected=[...document.querySelectorAll('input[name=answer]:checked')].map(x=>x.value);
  if(!selected.length){$('answerFeedback').innerHTML='<div class="answer-feedback warning">Choose an answer first.</div>';return}
  $('submitAnswer').disabled=true;
  try{
    const {data,error}=await supabaseClient.rpc('acl_check_learning_answer',{p_quiz_id:quiz.id,p_question_id:q.id,p_option_ids:selected});if(error)throw error;
    answers.push({questionId:q.id,selectedIds:selected,correct:data.correct,points:Number(data.points||0),correctOptionIds:data.correct_option_ids||[],explanation:data.explanation||'',referenceText:data.reference_text||'',referenceUrl:data.reference_url||'',answeredAt:new Date().toISOString()});
    await persist(false);render();
  }catch(e){console.error(e);$('answerFeedback').innerHTML=`<div class="answer-feedback incorrect">${esc(e.message)}</div>`}finally{$('submitAnswer').disabled=false}
}
async function finish(){
  await persist(true);const s=state().score,max=questions.reduce((n,q)=>n+Number(q.points||1),0),pct=max?Math.round(s/max*100):0,passed=pct>=Number(quiz.passing_percentage||0);
  $('progressFill').style.width='100%';$('quizArea').innerHTML=`<div class="learning-result"><span class="result-icon">${passed?'✓':'↻'}</span><h2>${passed?'Module completed':'Learning attempt completed'}</h2><div class="result-score">${s} / ${max} points · ${pct}%</div><p>${passed?`You reached the ${quiz.passing_percentage}% pass mark.`:`The pass mark is ${quiz.passing_percentage}%. Review the explanations and try again.`}</p><div class="result-actions">${quiz.allow_review?'<button id="reviewAttempt" class="secondary-btn">Review answers</button>':''}<button id="retryAttempt" class="primary-btn">Start a new attempt</button><a class="secondary-btn" href="modules.html">Back to modules</a></div></div>`;
  $('submitAnswer').hidden=true;$('nextQuestion').hidden=true;
  $('reviewAttempt')?.addEventListener('click',()=>{index=0;render()});
  $('retryAttempt').addEventListener('click',async()=>{answers=[];index=0;attempt=null;const {data,error}=await supabaseClient.from('quiz_attempts').insert({user_id:(await supabaseClient.auth.getUser()).data.user.id,module_id:quiz.module_id,module_title:quiz.module_title,quiz_id:quiz.id,quiz_title:quiz.title,mode:quiz.mode,question_count:questions.length,question_ids:questions.map(q=>q.id),answers:[],score:0,status:'in_progress'}).select('*').single();if(error){status(error.message,true);return}attempt=data;render()});
}

$('submitAnswer').onclick=submit;$('nextQuestion').onclick=async()=>{index++;await persist(false);render()};

(async()=>{
  const profile=await protectAndRender('login.html');if(!profile)return;
  if(!quizSlug){$('quizArea').innerHTML='<p>No quiz was selected.</p>';return}
  try{
    status('Loading learning mode…');const {data,error}=await supabaseClient.rpc('acl_get_learning_quiz',{p_quiz_slug:quizSlug,p_module_id:moduleId||null});if(error)throw error;quiz=data;
    $('moduleTitle').textContent=quiz.module_title;$('quizTitle').textContent=quiz.title;$('quizDescription').textContent=quiz.description||'Immediate feedback and explanations after every answer.';
    let pool=quiz.questions||[];if(quiz.randomize_questions||quiz.selection_mode==='random')pool=shuffle(pool);questions=pool.slice(0,Math.min(Number(quiz.question_count||pool.length),pool.length));
    attempt=await getOpenAttempt(quiz.module_id,quiz.id);
    if(attempt){const map=new Map(questions.map(q=>[q.id,q]));questions=(attempt.question_ids||[]).map(id=>map.get(id)).filter(Boolean);index=Number(attempt.current_question_index||0);answers=attempt.answers||[];status('Unfinished learning attempt restored')}
    else{attempt=await createAttempt({moduleId:quiz.module_id,moduleTitle:quiz.module_title,quizId:quiz.id,quizTitle:quiz.title,mode:quiz.mode,questionIds:questions.map(q=>q.id)});status('New learning attempt saved')}
    render();
  }catch(e){console.error(e);status('Could not open learning mode',true);$('quizArea').innerHTML=`<div class="empty-state">${esc(e.message||'Quiz unavailable')}</div>`}
})();
