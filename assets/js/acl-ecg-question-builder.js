"use strict";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const binary=(id,title,text,parent="",trigger="")=>({id,number:id,title,text,type:"choice",options:["Yes","No"],parent,trigger});
const defaults=[binary("1a","Calibration","Is the ECG correctly calibrated in terms of voltage and time?"),binary("1b","Electrode placement","Are electrodes correctly placed?"),binary("1c","Recording quality","Is recording quality good, without significant interference?"),binary("2a","Rhythm","Is the ECG regular?"),{id:"2b",number:"2b",title:"Heart rate",text:"What is the heart rate (bpm)?",type:"number",options:[],parent:"",trigger:""},{id:"3",number:"3",title:"QRS axis",text:"What is the QRS axis?",type:"choice",options:["NAD","LAD","RAD","EAD"],parent:"",trigger:""},binary("4a","P wave","Is a P wave present?"),binary("4b","P wave morphology","Is the P wave normal?","4a","Yes")];
const ECG_LEADS=["I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6"];
const store="acl-ecg-question-builder-v1";let questions=structuredClone(defaults),keys=Array.from({length:10},()=>({})),images=Array(10).fill(null),slot=0,mode="practice",index=0,selected="",checked=false,started=0,timer=null,answers={},stepTiming={},stepEnteredAt=0,stepRecorded=new Set();
try{const d=JSON.parse(localStorage.getItem(store)||"null");if(Array.isArray(d?.questions)&&d.questions.length<=100&&Array.isArray(d?.keys)&&d.keys.length===10){questions=d.questions;keys=d.keys}}catch{}
function save(){localStorage.setItem(store,JSON.stringify({questions,keys}));$("draftNotice").textContent="Saved locally in this browser · "+new Date().toLocaleTimeString()}
function admin(){return window.aclEcgIsAdmin===true}
function build(){
 $("builder").hidden=!admin();if(!admin())return;
 const heading=document.getElementById("ecgKeyHeading");if(heading)heading.textContent="Correct answers · ECG "+String(slot+1).padStart(2,"0");
 $("questionRows").innerHTML=questions.map((q,i)=>'<div class="ecg-build-row"><b>'+esc(q.number)+'</b><span><strong>'+esc(q.title)+(q.parent?" ↳":"")+'</strong><small style="display:block;color:#60778b;margin-top:3px">'+esc(q.text||"")+(q.adminSubtitle?'<br><em>Admin note: '+esc(q.adminSubtitle)+'</em>':'')+'</small></span><button class="btn secondary" data-edit="'+i+'">Edit</button><button class="btn secondary" data-up="'+i+'">↑</button><button class="btn secondary" data-down="'+i+'">↓</button></div><div id="edit-'+i+'"></div>').join("");
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(+b.dataset.edit));
 document.querySelectorAll("[data-up],[data-down]").forEach(b=>b.onclick=()=>{const i=+(b.dataset.up??b.dataset.down),j=i+(b.hasAttribute("data-up")?-1:1);if(j<0||j>=questions.length)return;[questions[i],questions[j]]=[questions[j],questions[i]];save();restart();render();build()});
 $("keyRows").innerHTML=questions.map(q=>'<label class="ecg-key-row"><div class="ecg-key-question"><b>'+esc(q.number)+' · '+esc(q.title)+'</b><div style="font-size:13px;font-weight:400;color:#49657d;margin:4px 0 8px">'+esc(q.text||"")+(q.adminSubtitle?'<br><small style="color:#846b42">Admin: '+esc(q.adminSubtitle)+'</small>':'')+'</div></div> '+(q.type==="number"?'<span>Minimum <input type="number" data-min="'+esc(q.id)+'" value="'+esc(keys[slot][q.id]?.min??"")+'"></span><span>Maximum <input type="number" data-max="'+esc(q.id)+'" value="'+esc(keys[slot][q.id]?.max??"")+'"></span>':(q.multi?'<div class="ecg-multi-keys" data-multi-key="'+esc(q.id)+'"><small>Tick all correct leads — leave every box empty if none apply</small>'+q.options.map(o=>'<label style="display:inline-flex;align-items:center;gap:5px;margin:5px 12px 5px 0"><input type="checkbox" value="'+esc(o)+'" '+(Array.isArray(keys[slot][q.id])&&keys[slot][q.id].includes(o)?"checked":"")+'>'+esc(o)+'</label>').join("")+'</div>':'<select data-key="'+esc(q.id)+'"><option value="">Choose correct answer</option>'+q.options.map(o=>'<option value="'+esc(o)+'" '+(keys[slot][q.id]===o?"selected":"")+'>'+esc(o)+'</option>').join("")+'</select>'))+'</label>').join("");
 document.querySelectorAll("[data-multi-key] input").forEach(e=>e.onchange=()=>{const wrap=e.closest("[data-multi-key]");keys[slot][wrap.dataset.multiKey]=Array.from(wrap.querySelectorAll("input:checked")).map(x=>x.value);save();restart();render()});
 document.querySelectorAll("[data-key]").forEach(e=>e.onchange=()=>{keys[slot][e.dataset.key]=e.value;save();restart();render()});
 document.querySelectorAll("[data-min],[data-max]").forEach(e=>e.onchange=()=>{const id=e.dataset.min||e.dataset.max;keys[slot][id]={min:$('keyRows').querySelector('[data-min="'+id+'"]').value,max:$('keyRows').querySelector('[data-max="'+id+'"]').value};save();restart();render()});
}
function edit(i){
 const q=questions[i],el=$("edit-"+i);
 el.className="ecg-build-editor";
 el.innerHTML='<label>Number<input data-f="number" value="'+esc(q.number)+'"></label><label>Title<input data-f="title" value="'+esc(q.title)+'"></label><label>Admin-only subtitle (hidden from candidates)<input data-f="adminSubtitle" value="'+esc(q.adminSubtitle||"")+'" placeholder="e.g. Parent question / QRS morphology"></label><label>Question<textarea data-f="text">'+esc(q.text)+'</textarea></label><label>Type<select data-f="type"><option value="choice" '+(q.type==="choice"?"selected":"")+'>Choices / Yes-No</option><option value="leads" '+(q.type==="leads"?"selected":"")+'>ECG leads (12)</option><option value="number" '+(q.type==="number"?"selected":"")+'>Number with range</option></select></label><label><input type="checkbox" data-f="multi" '+(q.multi?"checked":"")+'> Allow multiple correct answers (checkbox selection)</label><label>Numeric answer unit (e.g. bpm, ms, small squares, mmHg)<input list="ecgUnitOptions" data-f="unit" value="'+esc(q.unit|| (q.id==="2b"?"bpm":""))+'" placeholder="Choose or type unit"></label><datalist id="ecgUnitOptions"><option value="bpm"><option value="ms"><option value="small squares"><option value="mmHg"><option value="mm"><option value="mV"><option value="seconds"><option value="cm"></datalist><label>Numeric input label<input data-f="inputLabel" value="'+esc(q.inputLabel||"")+'" placeholder="e.g. PR interval"></label><label>Numeric placeholder<input data-f="placeholder" value="'+esc(q.placeholder||"")+'" placeholder="e.g. Enter duration"></label><label>Choices (one per line)<textarea data-f="options">'+esc(q.options.join("\n"))+'</textarea></label><div class="ecg-choice-comment-editor" data-choice-comments><strong>📝 ECG commentary for each answer</strong><p class="small muted">Write the exact phrase added to the candidate’s ECG interpretation when this answer is selected. Leave empty to use the automatic wording. Write short phrases to combine answers without repetition.</p><div data-comment-rows></div></div><label>Numeric answer commentary (optional)<input data-f="numberComment" value="'+esc(q.numberComment||"")+'" placeholder="e.g. Heart rate: {value} bpm"></label><label>Show as subquestion after<select data-f="parent"><option value="">Always show</option>'+questions.filter(x=>x.id!==q.id).map(x=>'<option value="'+esc(x.id)+'" '+(q.parent===x.id?"selected":"")+'>'+esc("Step "+x.number+" · "+(x.adminSubtitle?x.adminSubtitle+" — ":"")+(x.text||x.title||"New question").replace(/\\s+/g," ").slice(0,115))+'</option>').join("")+'</select></label><label>Subquestion appears<select data-f="triggerMode"><option value="specific" '+(q.trigger?"selected":"") +'>Only for a specific answer</option><option value="any" '+(!q.trigger?"selected":"") +'>Whatever the parent answer</option></select></label><label data-trigger-condition>Trigger on one or more parent answers (select multiple, or leave blank for any)<select data-f="triggerChoices" multiple size="4"></select><small class="muted">Use Ctrl/⌘ + click to select multiple answers.</small><input data-f="trigger" value="'+esc(q.trigger||"")+'" placeholder="Alternative: Yes|No"></label><div class="ecg-builder-actions"><button class="btn" data-save>Save</button><button class="btn secondary" data-child>+ Subquestion</button><button class="btn secondary" data-remove>Delete</button><button class="btn secondary" data-cancel>Cancel</button></div><p data-error class="muted small"></p>';
 const get=f=>el.querySelector('[data-f="'+f+'"]').value.trim();
 const commentDraft={...(q.choiceComments||{})};
 const renderCommentRows=()=>{const wrap=el.querySelector("[data-choice-comments]"),rows=el.querySelector("[data-comment-rows]");const choices=get("options").split("\n").map(x=>x.trim()).filter(Boolean);wrap.hidden=get("type")==="number";rows.innerHTML=choices.map((choice,i)=>'<label style="display:block;margin:9px 0"><span>'+esc(choice)+'</span><input type="text" data-comment-choice="'+i+'" value="'+esc(commentDraft[choice]||"")+'" placeholder="ECG interpretation when '+esc(choice)+' is selected"></label>').join("");rows.querySelectorAll("[data-comment-choice]").forEach(input=>input.addEventListener("input",()=>{commentDraft[choices[+input.dataset.commentChoice]]=input.value;}));};
 el.querySelector('[data-f="options"]').addEventListener("input",renderCommentRows);
 el.querySelector('[data-f="type"]').addEventListener("change",renderCommentRows);
 renderCommentRows();
 const syncTrigger=()=>{const parent=questions.find(x=>x.id===get("parent"));const sel=el.querySelector('[data-f="triggerChoices"]');const selected=get("trigger").split("|");sel.innerHTML=(parent?.options||[]).map(o=>'<option value="'+esc(o)+'" '+(selected.includes(o)?"selected":"")+'>'+esc(o)+'</option>').join("");el.querySelector("[data-trigger-condition]").hidden=!get("parent")||get("triggerMode")==="any";};el.querySelector('[data-f="parent"]').addEventListener("change",syncTrigger);el.querySelector('[data-f="triggerMode"]').addEventListener("change",syncTrigger);syncTrigger();
 el.querySelector("[data-save]").onclick=()=>{
 const chosenTriggers=Array.from(el.querySelector('[data-f="triggerChoices"]').selectedOptions).map(o=>o.value);const triggerValue=chosenTriggers.length?chosenTriggers.join("|"):get("trigger");
 const type=get("type"),opts=type==="leads"?ECG_LEADS:get("options").split("\n").map(s=>s.trim()).filter(Boolean),parent=get("parent"),multi=el.querySelector('[data-f="multi"]').checked;
 if(!get("number")||!get("text")||(type!=="number"&&(opts.length<2||new Set(opts).size!==opts.length))||(parent&&get("triggerMode")==="specific"&&!triggerValue)){el.querySelector("[data-error]").textContent=!get("number")?"Enter a step number.":!get("text")?"Enter the question text.":parent&&!triggerValue?"Enter the parent-answer trigger (e.g. Yes).":"Provide at least two unique choices.";return}
 let p=parent,seen=new Set([q.id]);while(p){if(seen.has(p)){el.querySelector("[data-error]").textContent="Circular dependencies are not allowed.";return}seen.add(p);p=questions.find(x=>x.id===p)?.parent||""}
 if(type!=="number"&&new Set(opts).size!==opts.length){el.querySelector("[data-error]").textContent="Choices must be unique.";return}
 questions[i]={...q,number:get("number"),title:get("title"),adminSubtitle:get("adminSubtitle"),text:get("text"),type,multi:multi&&type!=="number",options:type!=="number"?opts:[],unit:get("unit").trim(),inputLabel:get("inputLabel"),placeholder:get("placeholder"),choiceComments:Object.fromEntries(Object.entries(commentDraft).filter(([choice,phrase])=>opts.includes(choice)&&phrase.trim()).map(([choice,phrase])=>[choice,phrase.trim()])),numberComment:get("numberComment"),parent,trigger:get("triggerMode")==="any"?"":triggerValue};save();restart();render();build();
 };
 el.querySelector('[data-f="type"]').onchange=()=>{const leads=el.querySelector('[data-f="type"]').value==="leads";if(leads){el.querySelector('[data-f="options"]').value=ECG_LEADS.join("\n");renderCommentRows();}};
 el.querySelector("[data-child]").onclick=()=>{const c=binary("q"+Date.now(),"New subquestion","Enter question",q.id,q.options[0]||"Yes");c.number=q.number+".1";questions.splice(i+1,0,c);save();restart();render();build();edit(i+1)};
 el.querySelector("[data-remove]").onclick=()=>{if(!confirm("Delete this question?"))return;questions.splice(i,1);questions.forEach(x=>{if(x.parent===q.id){x.parent="";x.trigger=""}});keys.forEach(k=>delete k[q.id]);save();restart();render();build()};
 el.querySelector("[data-cancel]").onclick=()=>build();
}
$("addQuestion").onclick=()=>{questions.push(binary("q"+Date.now(),"New question","Enter question"));questions.at(-1).number=String(questions.length);save();build();edit(questions.length-1)};
$("restoreQuestions").onclick=()=>{if(!confirm("Reset all questions and keys for 10 ECGs?"))return;questions=structuredClone(defaults);keys=Array.from({length:10},()=>({}));save();restart();render();build()};
$("exportQuestions").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({questions,keys},null,2)],{type:"application/json"}));a.download="acl-ecg-draft.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$("importQuestions").onchange=async e=>{const f=e.target.files?.[0];if(!f||f.size>1e6)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.questions)||d.questions.length>100||!Array.isArray(d.keys)||d.keys.length!==10||!d.questions.every(q=>q&&typeof q.id==="string"&&typeof q.text==="string"&&["choice","number","leads"].includes(q.type)&&Array.isArray(q.options)))throw Error("Invalid question file");questions=d.questions;keys=d.keys;save();restart();render();build()}catch(err){alert(err.message)}e.target.value=""};
function path(){const result=[],done=new Set(),byId=new Map(questions.map(q=>[q.id,q]));function walk(q){if(done.has(q.id))return;done.add(q.id);result.push(q);if(answers[q.id]!==undefined&&stepTiming[q.id]?.correct===true)questions.filter(c=>c.parent===q.id&&(!c.trigger||(Array.isArray(answers[q.id])?answers[q.id].some(v=>c.trigger.split("|").includes(v)):c.trigger.split("|").includes(String(answers[q.id]))))).forEach(walk)}questions.filter(q=>!q.parent||!byId.has(q.parent)).forEach(walk);return result}
function seconds(){return started?Math.floor((Date.now()-started)/1000):0}
function tick(){const t=seconds();const time=String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");$("clock").textContent=time;const previewClock=$("ecgReadyClock");if(previewClock)previewClock.textContent="⏱ "+time;}
function start(){if(!started){started=Date.now();stepEnteredAt=started;timer=setInterval(tick,1000);tick()}}
function recordStep(q,isCorrect){if(!q||stepRecorded.has(q.id))return;const now=Date.now();stepTiming[q.id]={id:q.id,number:q.number,title:q.title,seconds:Math.max(0,Math.round((now-(stepEnteredAt||started||now))/1000)),correct:isCorrect,answer:answers[q.id]??""};stepRecorded.add(q.id);stepEnteredAt=now;}
let ecgStepReview=null;
function restart(){ecgStepReview=null;failedAttempt=false;elapsedAtFailure=null;submitting=false;wrongCount=0;if($("ecgPeekModal")){$("ecgPeekModal").classList.add("hidden");document.body.classList.remove("ecg-peek-open")}clearInterval(timer);timer=null;started=0;index=0;selected="";checked=false;answers={};stepTiming={};stepRecorded=new Set();stepEnteredAt=0;tick()}
function correct(q,value){const k=keys[slot][q.id];if(q.type==="number"){const n=Number(value),min=Number(k?.min),max=Number(k?.max);return value!==""&&k?.min!==undefined&&k?.max!==undefined&&k.min!==""&&k.max!==""&&Number.isFinite(n)&&Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&n>=min&&n<=max}if(q.multi)return Array.isArray(k)&&Array.isArray(value)&&value.length===k.length&&value.every(x=>k.includes(x));return !!k&&value===k}
const attemptApi="https://acl-neon-api.drmohamedalaa90.workers.dev/learning/ecg-lab";const attemptCourse=new URLSearchParams(location.search).get("course")||"basic-special-3d7c42c2-fb4e-44ab-bc7d-09c59992660c";let ecgAttemptOpened=false;let unlockedEcg=[1],attemptHistory=[],wrongCount=0,submitting=false;const attemptToken=()=>sessionStorage.getItem("aclLegacyToken")||localStorage.getItem("aclLegacyToken");async function attemptRequest(method,body){const t=attemptToken();if(!t)throw Error("Sign in required");const response=await fetch(attemptApi+"?course="+encodeURIComponent(attemptCourse),{method,headers:{Authorization:"Bearer "+t,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok){const detail=[data.error,data.message,data.detail].filter(Boolean).join(" · ");throw Error((detail||"HTTP "+response.status)+" (HTTP "+response.status+")")}return data;}async function refreshAttemptProgress(){try{const data=await attemptRequest("GET");unlockedEcg=Array.isArray(data.unlocked)?data.unlocked:[1];attemptHistory=data.attempts||[];slots();}catch(error){console.warn("ECG progress unavailable",error);unlockedEcg=[1];slots();}}window.addEventListener("acl-ecg-access-ready",()=>void refreshAttemptProgress());void refreshAttemptProgress();
let ecgImagesLoading=null;
async function restoreEcgImages(){try{const data=await attemptRequest("GET");for(const c of data.cases||[]){const n=Number(c.case_number)-1;if(n>=0&&n<10&&typeof c.image_data==="string"&&c.image_data.startsWith("data:image/")&&!images[n])images[n]=c.image_data;}if(images[slot])render();else slots();}catch(e){console.warn("ECG images could not be restored",e)}}window.addEventListener("acl-ecg-access-ready",()=>{ecgImagesLoading=restoreEcgImages()});ecgImagesLoading=restoreEcgImages();
async function encodeEcgImage(file){const source=await createImageBitmap(file);try{const maxWidth=2200,maxHeight=1500,ratio=Math.min(1,maxWidth/source.width,maxHeight/source.height),canvas=document.createElement("canvas");canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);let data=canvas.toDataURL("image/jpeg",.9);if(data.length>2400000)data=canvas.toDataURL("image/jpeg",.77);if(data.length>2400000)throw Error("ECG image is too large to save. Please reduce its resolution.");return data;}finally{source.close?.()}}
function isEcgCompleted(n){return !admin()&&attemptHistory.some(a=>Number(a.case_number)===n&&Number(a.score)===Number(a.total)&&Number(a.total)>0)}
function nextAvailableEcg(){return Array.from({length:10},(_,i)=>i+1).find(n=>unlockedEcg.includes(n)&&!isEcgCompleted(n))||null}

function previousEcgReports(){try{return JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]").filter(x=>x&&Array.isArray(x.steps))}catch{return []}}
function cleanEcgComment(value){return String(value||"").replace(/^\\s*(?:Step\\s+\\d+[a-z]?|\\d{1,2})\\s*[.)-]?\\s*/i,"").trim()}
function ensureEcgHistoryLayout(){
 if(document.getElementById("ecgHistoryLayoutFix"))return;
 const style=document.createElement("style");style.id="ecgHistoryLayoutFix";
 style.textContent=`
 #ecgPreviousResults{width:100%;max-width:1100px;margin:20px auto;min-width:0}
 #ecgPreviousResults .ecg-history-card{display:block;max-width:100%;min-width:0;overflow:hidden;background:#fff;border:1px solid #c7deed;border-radius:16px;margin:14px 0;box-shadow:0 8px 24px #113c5c0d}
 #ecgPreviousResults .ecg-history-summary{display:flex;align-items:center;gap:16px;padding:16px;min-width:0}
 #ecgPreviousResults .ecg-history-summary>img{display:block!important;flex:0 0 150px!important;width:150px!important;max-width:150px!important;height:105px!important;max-height:105px!important;object-fit:contain!important;border-radius:10px}
 #ecgPreviousResults .ecg-history-summary>div{flex:1;min-width:0}
 #ecgPreviousResults .ecg-history-summary strong{font-size:18px;color:#0b426b}
 #ecgPreviousResults .ecg-history-summary p{font-weight:750;color:#08794d;margin:8px 0}
 #ecgPreviousResults .ecg-history-summary small{color:#58758a}
 #ecgPreviousResults .ecg-history-card details{display:block;border-top:1px solid #e0eaf2}
 #ecgPreviousResults .ecg-history-card summary{display:list-item;cursor:pointer;background:#edf7ff;padding:14px 18px;font-weight:750;color:#07679d}
 #ecgPreviousResults .ecg-history-expanded{padding:18px;min-width:0;overflow:hidden}
 #ecgPreviousResults .ecg-history-full{display:block!important;width:auto!important;max-width:100%!important;height:auto!important;max-height:65vh!important;object-fit:contain!important;margin:0 auto 18px}
 #ecgPreviousResults .ecg-history-comments{max-width:100%;overflow-wrap:anywhere}
 @media(max-width:540px){#ecgPreviousResults .ecg-history-summary>img{flex-basis:95px!important;width:95px!important;max-width:95px!important;height:80px!important}#ecgPreviousResults .ecg-history-summary strong{font-size:15px}}
 `;document.head.appendChild(style);
}
function renderPreviousEcgResults(){
 ensureEcgHistoryLayout();
 const intro=document.getElementById("ecgIntro");if(!intro)return;
 let area=document.getElementById("ecgPreviousResults");if(!area){area=document.createElement("section");area.id="ecgPreviousResults";intro.insertAdjacentElement("afterend",area)}
 const byCase=new Map();for(const r of previousEcgReports()){const n=Number(r.case_number);if(!byCase.has(n))byCase.set(n,r)}
 const completed=[...byCase.values()].filter(r=>Number(r.score)===Number(r.total)&&Number(r.total)>0).sort((a,b)=>a.case_number-b.case_number);
 area.hidden=!completed.length;if(!completed.length){area.innerHTML="";return}
 area.innerHTML='<h3 class="ecg-history-heading">🏆 Your previous ECG results</h3><p class="ecg-history-sub">Review your completed ECGs and interpretations.</p>'+completed.map(r=>{
 const n=Number(r.case_number),img=images[n-1];
 const lines=(r.commentary||[]).map((comment,i)=>{
  const raw=String(comment||"");
  const match=raw.match(/^\s*(?:Step\s+)?(\d+[a-z]?)\s*(?:\s+|[.)-]\s*)/i);
  const number=match&&/^(?:1[a-c]|2[a-b]|3|4[a-b]|5(?:[a-z])?|\d+[a-z]?)$/i.test(match[1])?match[1]:null;
  const fallback=['1a','1b','1c','2a','2b','3','4a','4b','5','5'][i]||String(i+1);
  const stepNumber=number||fallback;
  const step=(r.steps||[]).find(s=>String(s.number)===stepNumber)||(r.steps||[])[i];
  const cleaned=raw.replace(/^\s*(?:Step\s+\d+[a-z]?\s*)?(?:\d{2}(?=[A-Za-z])|\d{2}\s+(?=[A-Za-z]))/i,'').replace(/^\s*Step\s+\d+[a-z]?\s*/i,'').trim();
  return '<div class="ecg-history-comment-row"><span><strong class="ecg-history-step-label">Step '+esc(stepNumber)+'</strong> '+esc(cleaned)+'</span><b class="'+(step?.correct===false?'ecg-history-wrong':'')+'">'+(step?.correct===false?'✕ Incorrect':'✓ Correct')+'</b><time>⏱ '+fmtDuration(step?.seconds||0)+'</time></div>'
 }).join("");
 return '<article class="ecg-history-card"><div class="ecg-history-summary">'+(img?'<img src="'+img+'" alt="ECG '+n+'">':'<span>ECG '+n+'</span>')+'<div><strong>ECG '+String(n).padStart(2,"0")+' · Completed</strong><p>🏆 You interpreted this ECG with 100% accuracy</p><small>⏱ '+fmtDuration(r.duration_seconds)+'</small></div></div><details><summary>View full ECG, commentary and detailed timings</summary><div class="ecg-history-expanded">'+(img?'<img class="ecg-history-full" src="'+img+'" alt="Full ECG '+n+'">':'')+'<h4>Your ECG commentary</h4><div class="ecg-history-comments">'+lines+'</div></div></details></article>'
 }).join("");
 if(!document.getElementById("ecgHistoryCommentCSS")){const css=document.createElement("style");css.id="ecgHistoryCommentCSS";css.textContent='.ecg-history-comment-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 80px;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid #e1eaf2;color:#183e5a}.ecg-history-comment-row b{color:#087b49;font-size:13px}.ecg-history-comment-row b.ecg-history-wrong{color:#c52649}.ecg-history-comment-row time{font-size:13px;color:#45647d}@media(max-width:540px){.ecg-history-comment-row{grid-template-columns:1fr auto}.ecg-history-comment-row time{grid-column:2}}';document.head.append(css)}
}

function slots(){
 $("slots").innerHTML=images.map((x,i)=>{const locked=!admin()&&!unlockedEcg.includes(i+1),done=attemptHistory.some(a=>Number(a.case_number)===i+1&&Number(a.score)===Number(a.total)&&Number(a.total)>0);
 const preview=x?'<img class="ecg-tile-preview" src="'+x+'" alt="ECG '+(i+1)+' recording" loading="lazy">':'<span class="ecg-tile-empty" aria-hidden="true">ECG not uploaded</span>';
 return '<button type="button" class="slot '+(slot===i?"current ":"")+(locked?"ecg-locked ":"")+(x?"ecg-has-image":"")+'" data-slot="'+i+'" aria-label="ECG '+(i+1)+(locked?", locked":"")+'"><span class="ecg-tile-art">'+preview+(locked?'<span class="ecg-tile-lock">🔒</span>':x?'<span class="ecg-tile-saved">✓ Saved</span>':'')+'</span><span class="ecg-tile-title">ECG '+String(i+1).padStart(2,"0")+(done?" ✓":"")+'</span></button>'}).join("");
 document.querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>{const chosen=+b.dataset.slot;if(!admin()&&isEcgCompleted(chosen+1)){alert("You have already completed ECG "+String(chosen+1).padStart(2,"0")+" with 100% accuracy. Please proceed to the next ECG.");return;}if(!admin()&&!unlockedEcg.includes(chosen+1)){alert("Complete ECG "+String(chosen).padStart(2,"0")+" with all answers correct to unlock this ECG.");return;}slot=chosen;document.getElementById("ecgCaseStage").hidden=false;if(!(ecgAttemptOpened&&started))restart();render();build();(admin()&&document.getElementById("ecgAdminOverlay")&&!document.getElementById("ecgAdminOverlay").hidden?document.getElementById("ecgCaseKeyTools"):document.getElementById("ecgCaseStage")).scrollIntoView({behavior:"smooth",block:"start"})})
}
function ecgReadableYesNo(v){const s=String(v??"");return /^ye$/i.test(s)?"Yes":s}
function ecgPrSummary(rows,answers){
 const fixed=rows.find(q=>/pr interval is|fixed|variable/i.test(String(q.text||""))&&q.type!=="number");
 const duration=rows.find(q=>q.type==="number"&&/pr interval|duration/i.test(String(q.text||"")+" "+String(q.title||"")));
 if(!fixed&&!duration)return null;
 const status=fixed?ecgReadableYesNo(answers[fixed.id]):null;
 const value=duration?Number(answers[duration.id]):NaN;
 const interval=Number.isFinite(value)?value+" small squares ("+(Math.round(value*40*100)/100)+" ms)":null;
 return "PR interval"+(status?" is "+String(status).toLowerCase():"")+(interval?(status?" and measures ":" measures ")+interval:"")+".";
}
function updateLiveComment(){
 const target=document.getElementById("ecgLiveComment");if(!target)return;
 const phrases={
 "1a":v=>v==="Yes"?"The ECG is well calibrated (25 mm/sec and 10 mm/mV).":"ECG calibration is abnormal or incorrect.",
 "1b":v=>v==="Yes"?"Electrodes are correctly placed.":"Possible incorrect electrode placement.",
 "1c":v=>v==="Yes"?"Recording quality is good, with no significant interference.":"Recording quality is suboptimal or interference is present.",
 "2a":v=>v==="Yes"?"The rhythm is regular.":"The rhythm is irregular.",
 "2b":v=>"Heart rate: "+v+" bpm.",
 "3":v=>"QRS axis: "+v+".",
 "4a":v=>v==="Yes"||/present/i.test(String(v))?"P waves present in normal location.":"P waves absent.",
 "4b":v=>v==="Yes"?"P-wave morphology is normal.":"Abnormal P-wave morphology."
 };
 const completed=questions.filter(q=>Object.prototype.hasOwnProperty.call(answers,q.id)).sort((a,b)=>{const na=String(a.number||""),nb=String(b.number||"");return na.localeCompare(nb,undefined,{numeric:true,sensitivity:"base"})});
 const groups=new Map();
 completed.forEach(q=>{
  const v=answers[q.id];
  const custom=Array.isArray(v)?v.map(x=>q.choiceComments?.[String(x)]||"").filter(Boolean).join(", "):q.choiceComments?.[String(v)];
  const numberCustom=q.type==="number"&&q.numberComment?q.numberComment.replaceAll("{value}",String(v)):"";
  const line=custom||numberCustom||(phrases[q.id]?phrases[q.id](v):q.title+": "+(Array.isArray(v)?v.join(", "):ecgReadableYesNo(v))+(q.type==="number"&&q.unit?" "+q.unit:"")+".");
  const group=String(q.number||"").match(/^\\d+/)?.[0]||String(q.number||"");
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push({line:line.replace(/[.\\s]+$/,""),wrong:stepTiming[q.id]?.correct===false});
 });
 const prRows=completed.filter(q=>String(q.number||"").match(/^\\d+/)?.[0]==="5");
 if(groups.has("5")&&prRows.length){const summary=ecgPrSummary(prRows,answers);if(summary)groups.set("5",[{line:summary.replace(/\\.$/,""),wrong:groups.get("5").some(item=>item.wrong)}]);}
 const statements=[...groups].map(([group,items])=>'<div class="ecg-comment-line '+(items.some(item=>item.wrong)?"ecg-comment-incorrect":"ecg-comment-correct")+'"><span class="ecg-comment-index">Step '+esc(group)+'</span><span>'+items.map(item=>esc(item.line)).join(", ")+'.</span></div>');
 target.innerHTML=statements.length?statements.join(""):'<p class="muted">Your ECG interpretation will appear here as you answer each step.</p>';
}
function ensureEcgCommentStyles(){
 if(document.getElementById("ecgCommentStatusStyles"))return;
 const style=document.createElement("style");style.id="ecgCommentStatusStyles";
 style.textContent="#progress i.ecg-progress-wrong{background:#d21f49!important;border-color:#d21f49!important}#ecgLiveComment .ecg-comment-line.ecg-comment-incorrect{background:#fff0f1!important;border-left:4px solid #cf2449!important;color:#9d1734!important;padding-left:10px;border-radius:7px}#ecgLiveComment .ecg-comment-line.ecg-comment-incorrect .ecg-comment-index{color:#bb1c40!important}#ecgLiveComment .ecg-comment-line.ecg-comment-correct{border-left:4px solid #138650!important;padding-left:10px;border-radius:7px}#stepTitle{display:none!important}#stepLabel.ecg-step-with-title{display:inline-flex;align-items:center;gap:9px;flex-wrap:wrap;max-width:100%;white-space:normal}#stepLabel .ecg-step-name{font-size:1em;font-weight:750;opacity:1}";
 style.textContent+="#ecgPreviousGroup{margin:0 0 18px;display:grid;gap:12px}#ecgPreviousGroup[hidden]{display:none!important}.ecg-previous-branch{border:1px solid #bcd5e7;background:#f1f8fd;border-radius:14px;padding:14px 18px}.ecg-previous-title{font-weight:800;color:#123d5b}.ecg-previous-locked{float:right;font-size:12px;color:#168350}.ecg-previous-question{margin:9px 0;font-size:18px;font-weight:650}.ecg-previous-answer{font-size:14px;color:#4d687d}";
 style.textContent+="#ecgPreviousGroup{width:100%;box-sizing:border-box;margin:10px 0 16px;grid-template-columns:minmax(0,1fr)}#ecgPreviousGroup .ecg-previous-branch{width:100%;box-sizing:border-box;background:linear-gradient(100deg,#f2f9ff,#f8fcff);border:1px solid #c9e0f0;border-left:5px solid #14865a;padding:14px 18px;border-radius:12px;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px;row-gap:5px}#ecgPreviousGroup .ecg-previous-title{grid-column:1;font-size:15px}#ecgPreviousGroup .ecg-previous-locked{grid-column:2;grid-row:1;float:none;white-space:nowrap;background:#dff5e9;padding:4px 9px;border-radius:20px}#ecgPreviousGroup .ecg-previous-question{grid-column:1/-1;font-size:18px;margin:4px 0 0}#ecgPreviousGroup .ecg-previous-answer{grid-column:1/-1;font-size:15px}#questionPanel .ecg-question-head{width:100%;box-sizing:border-box}#questionPanel .ecg-answer-entry{width:100%;box-sizing:border-box}#questionPanel .ecg-answer-entry .choices{min-width:0}#questionPanel .ecg-answer-entry .choices .answer{white-space:normal;overflow-wrap:break-word;min-width:0}@media(max-width:640px){#ecgPreviousGroup .ecg-previous-branch{padding:12px}#ecgPreviousGroup .ecg-previous-locked{font-size:11px}#ecgPreviousGroup .ecg-previous-question{font-size:16px}}";
 document.head.appendChild(style);
}
// Candidate-controlled ECG reference: sticky above the question or available on demand.
let ecgReferenceMode=localStorage.getItem("acl-ecg-reference-mode")==="demand"?"demand":"fixed";
function syncEcgReference(){
 const panel=document.getElementById("questionPanel");
 if(!panel)return;
 let reference=document.getElementById("ecgQuestionReference");
 if(!reference){
  reference=document.createElement("section");reference.id="ecgQuestionReference";
  reference.setAttribute("aria-label","ECG recording reference");
  reference.innerHTML='<div class="ecg-ref-toolbar"><strong>🫀 ECG reference</strong><div class="ecg-ref-actions"><span class="ecg-ref-mode-label" id="ecgReferenceModeLabel"></span><button type="button" id="ecgReferenceView">👁 View ECG</button></div></div><div id="ecgReferenceBody"><img id="ecgReferenceImage" alt="Current ECG recording"></div>';
  panel.parentElement.insertBefore(reference,panel);
  const style=document.createElement("style");style.textContent=`
#ecgQuestionReference{margin:0 0 16px;border:1px solid #bdd8e9;border-radius:16px;background:#f8fcff;overflow:visible;box-shadow:0 6px 20px #123b5a0d}
#ecgQuestionReference.ecg-ref-fixed{position:sticky;top:0;z-index:15;max-height:min(29vh,245px);overflow:hidden}
.ecg-ref-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;flex-wrap:wrap;color:#103554}
.ecg-ref-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ecg-ref-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px}
.ecg-ref-toggle input{width:18px;height:18px;accent-color:#0872ba}
#ecgReferenceView{background:#e2f2fd;border:1px solid #b2d7f0;border-radius:10px;padding:9px 13px;color:#064b79;font-weight:700;cursor:pointer}
#ecgReferenceBody{display:flex;justify-content:center;padding:0 10px 10px}
#ecgReferenceImage{display:block;max-width:100%;width:auto;max-height:min(20vh,180px);object-fit:contain;border-radius:8px;cursor:zoom-in}
#ecgQuestionReference.ecg-ref-demand #ecgReferenceBody{display:none}\n#ecgQuestionReference.ecg-ref-demand{position:static}
@media(max-width:650px){#ecgQuestionReference.ecg-ref-fixed{top:0;max-height:22vh}#ecgReferenceImage{max-height:15vh}.ecg-ref-toolbar{font-size:13px}.ecg-ref-toggle{font-size:12px}}
`;document.head.appendChild(style);
  reference.querySelector("#ecgReferenceView").addEventListener("click",()=>openEcgPeek());
  reference.querySelector("#ecgReferenceImage").addEventListener("click",()=>openEcgPeek());
 }
 reference.hidden=!ecgAttemptOpened||!images[slot]||panel.classList.contains("hidden")||ecgReferenceMode==="demand";
 reference.classList.toggle("ecg-ref-fixed",ecgReferenceMode==="fixed");
 reference.classList.toggle("ecg-ref-demand",ecgReferenceMode==="demand");
 reference.querySelector("#ecgReferenceModeLabel").textContent="";
 reference.querySelector("#ecgReferenceView").hidden=ecgReferenceMode==="fixed";
 const peek=document.getElementById("peekEcg");if(peek){peek.hidden=ecgReferenceMode==="fixed";peek.style.setProperty("display",ecgReferenceMode==="fixed"?"none":"","important");}
 if(images[slot]&&reference.querySelector("#ecgReferenceImage").getAttribute("src")!==images[slot])reference.querySelector("#ecgReferenceImage").src=images[slot];
}
function render(){
 ensureEcgCommentStyles();
 renderPreviousEcgResults();
 document.getElementById("ecgIntro").hidden=ecgAttemptOpened;
 document.getElementById("ecgSelector").hidden=ecgAttemptOpened;
 $("questionPanel").classList.toggle("hidden",!ecgAttemptOpened);
 if(!ecgAttemptOpened){$("complete").classList.add("hidden");syncEcgReference();return;}
 slots();$("imageArea").innerHTML=images[slot]?'<img alt="Uploaded ECG" src="'+images[slot]+'">':'<span class="muted">Upload an ECG image to begin.</span>';
 const ready=!!images[slot]&&questions.length>0;$("questionPanel").classList.toggle("hidden",!ready);$("complete").classList.add("hidden");if(!ready){syncEcgReference();return;}
 syncEcgReference();
 const qs=path(),q=qs[index];
 const reviewBox=document.getElementById("ecgStepReviewBox");if(reviewBox)reviewBox.hidden=!ecgStepReview;
 if(ecgStepReview){renderEcgStepReview();return;}
 if(!q){finish();return}
 const peekThumb=$("peekEcg");if(peekThumb){peekThumb.hidden=ecgReferenceMode==="fixed";const realImage=images[slot];peekThumb.querySelector(".ecg-mini-real")?.remove();peekThumb.querySelectorAll("svg:not(.eye-icon)").forEach(el=>el.style.display=realImage?"none":"");if(realImage){const thumb=document.createElement("img");thumb.className="ecg-mini-real";thumb.alt="ECG thumbnail";thumb.src=realImage;peekThumb.prepend(thumb)}}
 let previousGroup=document.getElementById("ecgPreviousGroup");
 if(!previousGroup){previousGroup=document.createElement("div");previousGroup.id="ecgPreviousGroup";$("question").parentElement.parentElement.insertBefore(previousGroup,$("question").parentElement);}
 const groupId=String(q.number||"").match(/^\\d+/)?.[0]||String(q.number||"");
 const earlier=qs.slice(0,index).filter(item=>(String(item.number||"").match(/^\\d+/)?.[0]||String(item.number||""))===groupId);
 previousGroup.innerHTML=earlier.map(item=>{
  const value=answers[item.id],display=Array.isArray(value)?value.join(", "):String(value??"");
  return '<div class="ecg-previous-branch"><div class="ecg-previous-title">Step '+esc(item.number)+' · '+esc(item.title)+' <span class="ecg-previous-locked">✓ Submitted · locked</span></div><div class="ecg-previous-question">'+esc(item.text)+'</div><div class="ecg-previous-answer">Your answer: '+esc(display)+'</div></div>';
 }).join("");
 previousGroup.hidden=!earlier.length;
 $("stepLabel").classList.add("ecg-step-with-title");$("stepLabel").innerHTML="<span>STEP "+esc(q.number)+"</span><span class=\"ecg-step-name\">"+esc(q.title)+"</span>";$("stepLabel").dataset.stepGroup=Number.parseInt(q.number,10)<=3?"red":Number.parseInt(q.number,10)<=5?"green":Number.parseInt(q.number,10)<=7?"blue":"orange";$("stepTitle").textContent=q.title;$("question").textContent=q.text;let multiHint=document.getElementById("ecgMultiChoiceHint");if(!multiHint){multiHint=document.createElement("div");multiHint.id="ecgMultiChoiceHint";multiHint.style.cssText="font-size:13px;color:#637d91;margin:5px 0 14px;font-weight:500";$("question").insertAdjacentElement("afterend",multiHint)}multiHint.textContent=q.multi?"More than one choice is allowed.":"";multiHint.hidden=!q.multi;$("hint").textContent=mode==="practice"?"Interpret the ECG and select your answer.":"Answer without immediate feedback.";$("count").textContent=Object.keys(answers).length+" answered";
 const groupKey=x=>String(x.number||"").match(/^\\d+/)?.[0]||String(x.number||"");
 const groupNames=[...new Set(qs.map(groupKey))];
 const currentGroup=groupKey(q);
 $("progress").innerHTML=groupNames.map(g=>{
  const members=qs.filter(x=>groupKey(x)===g),answered=members.filter(x=>stepTiming[x.id]);
  const anyWrong=answered.some(x=>stepTiming[x.id].correct===false);
  const complete=answered.length===members.length;
  const state=anyWrong?"ecg-progress-wrong":complete?"done":g===currentGroup?"now":answered.length?"now":"";
  return '<i class="'+state+'" title="Step '+esc(g)+' ('+answered.length+'/'+members.length+' answered)"></i>';
 }).join("");
 if(q.multi&&q.type!=="number"){
  if(!document.getElementById("ecgLeadTileStyles")){
   const s=document.createElement("style");s.id="ecgLeadTileStyles";s.textContent=`
   #choices .ecg-lead-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))!important;gap:12px!important;width:100%}
   #choices .ecg-lead-option{position:relative;display:flex;align-items:center;justify-content:center;min-height:66px;padding:12px 16px;min-width:0;overflow-wrap:anywhere;text-align:center;line-height:1.3;border:2px solid #b9d2e5;border-radius:14px;background:#fff;color:#173d59;font-weight:750;font-size:18px;cursor:pointer;user-select:none;transition:background .16s,border-color .16s,box-shadow .16s,transform .16s}
   #choices .ecg-lead-option:hover{border-color:#1683c8;background:#eef8ff;transform:translateY(-1px)}
   #choices .ecg-lead-option:has(input:checked){background:linear-gradient(145deg,#0877bf,#07528c);border-color:#06578e;color:white;box-shadow:0 5px 15px #006ba32e}
   #choices .ecg-lead-option:has(input:focus-visible){outline:3px solid #f6b93b;outline-offset:3px}
   #choices .ecg-lead-option input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
   @media(max-width:650px){#choices .ecg-lead-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}#choices .ecg-lead-option{min-height:55px;font-size:16px}}
   `;document.head.appendChild(s);
  }
  $("choices").innerHTML='<div class="ecg-lead-grid">'+q.options.map(o=>'<label class="ecg-lead-option"><input type="checkbox" value="'+esc(o)+'" '+(Array.isArray(selected)&&selected.includes(o)?"checked":"")+'><span>'+esc(o)+'</span></label>').join("")+'</div>';
  $("choices").querySelectorAll('input').forEach(input=>input.onchange=()=>{selected=Array.from($("choices").querySelectorAll('input:checked')).map(x=>x.value);$("next").disabled=false;$("next").textContent=selected.length?"Submit answer":"Submit: None of the above";start()});
 }
 else if(q.type==="number"){$("choices").innerHTML='<label class="ecg-numeric-label">'+esc(q.inputLabel||q.title)+' <input id="numericAnswer" type="number" inputmode="decimal" step="any" placeholder="'+esc(q.placeholder||"Enter value")+'" value="'+esc(selected)+'"> <span class="ecg-numeric-unit">'+esc(q.unit||"")+'</span></label>';$("numericAnswer").oninput=e=>{selected=e.target.value;start();$("next").disabled=!selected};$("numericAnswer").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submitAnswer()}}}
 else{$("choices").innerHTML='<div class="'+(q.type==="leads"?"ecg-lead-grid":"")+'" style="'+(q.type==="leads"?"display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;width:100%":"display:contents")+'">'+q.options.map(o=>'<button class="btn answer '+(selected===o?"selected":"")+'" data-answer="'+esc(o)+'">'+esc(o)+'</button>').join("")+'</div>';document.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{if(checked)return;selected=b.dataset.answer;start();submitAnswer()})}
 updateLiveComment();
 $("feedback").className="hidden";$("next").classList.toggle("hidden",q.type!=="number"&&!q.multi);$("next").disabled=q.multi?false:!selected;$("next").textContent=q.multi&&(!Array.isArray(selected)||!selected.length)?"Submit: None of the above":"Submit answer";
}
$("upload").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/")||f.size>12e6)return alert("Please upload an image smaller than 12 MB.");if(!admin())return alert("Only an administrator can upload ECG recordings.");const target=slot,notice=$("ecgImageSaveStatus");notice.textContent="🟠 Preparing ECG image…";try{const data=await encodeEcgImage(f);images[target]=data;restart();render();notice.textContent="🟠 Saving ECG image to Neon…";await attemptRequest("POST",{action:"save_image",case_number:target+1,image_data:data});notice.textContent="🟢 ECG image saved to Neon · "+new Date().toLocaleTimeString();}catch(err){notice.textContent="🔴 ECG image not saved: "+err.message+" · Keep this page open and retry upload.";console.error(err)}};
for(const m of ["practice","test"])$(m).onclick=()=>{if(m==="test")return;ecgAttemptOpened=false;mode=m;$("practice").className=m==="practice"?"btn active":"btn secondary";$("test").className=m==="test"?"btn active":"btn secondary";restart();render()};
$("reset").onclick=$("again").onclick=()=>{if(!admin()&&isEcgCompleted(slot+1)){ecgAttemptOpened=false;restart();const n=nextAvailableEcg();if(n)slot=n-1;render();return}restart();render()};

function showAnswerFeedback(isCorrect){const panel=$("questionPanel");panel.classList.remove("ecg-result-correct","ecg-result-wrong");void panel.offsetWidth;panel.classList.add(isCorrect?"ecg-result-correct":"ecg-result-wrong");document.querySelectorAll("#choices [data-answer]").forEach(button=>{if(button.dataset.answer===selected){button.classList.add("selected",isCorrect?"ecg-choice-correct":"ecg-choice-wrong");button.setAttribute("aria-label",button.textContent+(isCorrect?" — correct":" — incorrect"));}});$("feedback").className="feedback ecg-answer-animated "+(isCorrect?"good":"bad");$("feedback").innerHTML=isCorrect?'<span class="ecg-feedback-icon">✓</span><strong>Correct!</strong>':'<span class="ecg-feedback-icon">✕</span><strong>Incorrect!</strong><small>Continue interpreting the remaining ECG steps. Your complete report will show all correct and incorrect answers.</small>';document.querySelectorAll("[data-answer]").forEach(button=>button.disabled=true);$("next").disabled=true;}
let failedAttempt=false,elapsedAtFailure=null;
function ecgGroupOf(q){return String(q.number||"").match(/^\\d+/)?.[0]||String(q.number||"")}
function scrollEcgToActiveQuestion(){
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const question=document.getElementById("question");
  const choices=document.getElementById("choices");
  const panel=document.getElementById("questionPanel");
  if(!question||!choices||!panel||panel.classList.contains("hidden"))return;
  const header=document.querySelector("header");
  const headerBottom=header&&getComputedStyle(header).position==="fixed"?header.getBoundingClientRect().bottom:0;
  const reference=document.getElementById("ecgQuestionReference");
  const refRect=reference?.getBoundingClientRect();
  const sticky=reference&&getComputedStyle(reference).position==="sticky"&&refRect.top>=0;
  const top=Math.max(12,headerBottom+12,sticky?refRect.bottom+12:0);
  const bottom=window.innerHeight-24;
  const qr=question.getBoundingClientRect(),cr=choices.getBoundingClientRect();
  // Prioritize the question and the answer controls; never the commentary.
  if(qr.top>=top&&cr.bottom<=bottom)return;
  const usable=bottom-top;
  const content=cr.bottom-qr.top;
  let delta=0;
  if(content<=usable)delta=qr.top-top;
  else if(qr.top<top||qr.top>bottom-100)delta=qr.top-top;
  else if(cr.top>bottom-70)delta=cr.top-(bottom-70);
  else return;
  if(Math.abs(delta)>8)window.scrollBy({top:delta,behavior:"smooth"});
 }));
}
function renderEcgStepReview(){
 const group=ecgStepReview?.group;if(!group)return;
 const panel=$("questionPanel");
 let box=document.getElementById("ecgStepReviewBox");
 if(!box){box=document.createElement("section");box.id="ecgStepReviewBox";panel.appendChild(box)}
 box.hidden=false;
 const rows=questions.filter(q=>ecgGroupOf(q)===group&&Object.prototype.hasOwnProperty.call(answers,q.id));
 const good=rows.filter(q=>stepTiming[q.id]?.correct===true).length;
 const allCorrect=rows.length>0&&good===rows.length;
 const label=rows[0]?.title||"ECG interpretation";
 const fmt=v=>Array.isArray(v)?(v.length?v.join(", "):"None"):typeof v==="object"&&v!==null?"From "+v.min+" to "+v.max:String(v??"None");
 const statement=q=>{
   const answer=answers[q.id], key=keys[slot]?.[q.id];
   const yes=String(answer).toLowerCase()==="yes";
   const title=String(q.title||"").toLowerCase(),prompt=String(q.text||"").toLowerCase();
   if(q.type==="number")return (q.title||q.text)+": "+fmt(answer)+(q.unit?" "+q.unit:"");
   if(q.type==="leads"||q.multi)return (q.title||q.text)+": "+ecgReadableYesNo(fmt(answer));
   // Classify each question by its own wording, not the shared step title.
   // A parent title can mention calibration for every Step 1 subquestion.
   const wording=prompt||title;
   if(/electrode|lead placement|leads correctly placed/.test(wording))return yes?"Electrodes are correctly placed":"Possible incorrect electrode placement";
   if(/recording quality|interference|baseline quality|signal quality/.test(wording))return yes?"Recording quality is good, with no significant interference":"Recording quality is suboptimal or interference is present";
   if(/calibrat|voltage and time|paper speed/.test(wording))return yes?"The ECG is well calibrated (25 mm/sec and 10 mm/mV)":"ECG calibration is abnormal or incorrect";
   return (q.title||q.text)+": "+fmt(answer);
 };
 const pWaveSummary=()=>{
  const presenceQuestion=rows.find(q=>/p[ -]?waves?\\s+present/i.test(String(q.text||"")) && !/axis|morphology|amplitude|duration|location/i.test(String(q.text||"")));
  const presenceValue=presenceQuestion?String(answers[presenceQuestion.id]??"").trim().toLowerCase():null;
  const normal=new Set(),abnormal=new Set();
  for(const q of rows){
   if(q===presenceQuestion)continue;
   const selected=Array.isArray(answers[q.id])?answers[q.id]:[answers[q.id]];
   for(const item of selected){
    const value=String(item??"").toLowerCase().trim();
    for(const feature of ["location","axis","morphology","amplitude","duration"]){
     if(value==="normal "+feature)normal.add(feature);
     if(value==="abnormal "+feature)abnormal.add(feature);
    }
   }
  }
  const features=["location","axis","morphology","amplitude","duration"].filter(v=>normal.has(v));
  const issues=["location","axis","morphology","amplitude","duration"].filter(v=>abnormal.has(v));
  // Preserve all recorded subquestion findings, even when the parent is No.
  // This prevents a completed three-part assessment being collapsed into
  // the misleading single sentence "P waves are absent".
  const details=[];
  if(features.length)details.push("normal "+features.join(", "));
  if(issues.length)details.push("abnormal "+issues.join(", "));
  if(presenceValue==="yes")return "P waves are present"+(details.length?" with "+details.join("; "):"")+".";
  if(presenceValue==="no")return details.length
    ?"P-wave presence was answered No; additional findings: "+details.join("; ")+"."
    :"P waves are absent.";
  if(details.length)return "P-wave assessment: "+details.join("; ")+".";
  return rows.map(q=>statement(q).replace(/[.,;\\s]+$/,"")).join(", ")+".";
 };
 const comment=String(group)==="5"?(ecgPrSummary(rows,answers)||rows.map(q=>statement(q)).join(", ")+"."):String(group)==="4"?(pWaveSummary()||rows.map(q=>statement(q).replace(/[.,;\\s]+$/,"")).join(", ")+"."):rows.map(q=>statement(q).replace(/[.,;\\s]+$/,"")).join(", ")+".";
 const mistakes=rows.filter(q=>stepTiming[q.id]?.correct!==true);
 box.innerHTML='<div class="ecg-review-heading"><span class="ecg-review-icon">'+(allCorrect?"✓":"!")+'</span><div><small>STEP '+esc(group)+' COMPLETED</small><h2>'+esc(label)+'</h2><p>'+good+'/'+rows.length+' correct · Review your interpretation before continuing.</p></div></div>'+
 '<article class="ecg-review-row '+(allCorrect?"ecg-review-ok":"ecg-review-bad")+'"><div class="ecg-review-row-head"><strong>Step '+esc(group)+'</strong><b>'+(allCorrect?"✓ Correct":"✕ "+mistakes.length+" incorrect")+'</b></div><div class="ecg-review-question">'+esc(comment)+'</div></article>'+
 (mistakes.length?'<div class="ecg-review-corrections"><strong>Corrections</strong>'+mistakes.map(q=>'<div class="ecg-review-correction"><b>'+esc(q.text)+'</b><br>Your answer: '+esc(fmt(answers[q.id]))+' · Correct answer: '+esc(fmt(keys[slot]?.[q.id]))+'</div>').join("")+'</div>':"")+
 '<button type="button" class="ecg-review-continue" id="ecgReviewContinue">Continue to '+(ecgStepReview.next?"Step "+esc(ecgGroupOf(ecgStepReview.next)):"final ECG results")+' →</button>';
 document.getElementById("ecgReviewContinue").onclick=()=>{ecgStepReview=null;box.hidden=true;stepEnteredAt=Date.now();render();scrollEcgToActiveQuestion()};
 $("choices").innerHTML="";$("question").textContent="";$("stepLabel").textContent="STEP "+group+" · Review";$("feedback").className="hidden";$("next").classList.add("hidden");$("progress").querySelectorAll("i").forEach(x=>{});
 box.scrollIntoView({behavior:"smooth",block:"center"});
}
(function addEcgStepReviewStyles(){
 if(document.getElementById("ecgStepReviewStyles"))return;
 const style=document.createElement("style");style.id="ecgStepReviewStyles";
 style.textContent='#ecgStepReviewBox{margin:20px 0;padding:22px;border-radius:22px;border:1px solid #b7d9ed;background:linear-gradient(145deg,#f0f9ff,#fff);box-shadow:0 12px 30px #0b467214}#ecgStepReviewBox[hidden]{display:none!important}.ecg-review-heading{display:flex;align-items:center;gap:16px;margin-bottom:20px;color:#123b5b}.ecg-review-icon{display:grid;place-items:center;width:58px;height:58px;flex-shrink:0;border-radius:18px;background:#0875b9;color:white;font-size:30px;font-weight:800}.ecg-review-heading small{letter-spacing:2px;font-weight:800;color:#0875b9}.ecg-review-heading h2{margin:5px 0;font-size:clamp(20px,3vw,28px)}.ecg-review-heading p{margin:0;color:#617b8c}.ecg-review-row{padding:15px 18px;border-radius:13px;margin:10px 0;background:#e9f8f1;border-left:5px solid #118b57;color:#183b53;line-height:1.55}.ecg-review-row.ecg-review-bad{background:#fff0f2;border-left-color:#cf2449}.ecg-review-row-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.ecg-review-row-head b{color:#128653}.ecg-review-bad .ecg-review-row-head b{color:#c32249}.ecg-review-question{font-weight:650;margin:5px 0}.ecg-review-correction{margin-top:8px;padding:9px 12px;border-radius:8px;background:#fff;color:#146044}.ecg-review-continue{display:block;margin:22px 0 0 auto;border:0;border-radius:12px;padding:15px 24px;background:#0874b8;color:#fff;font-weight:800;font-size:16px;cursor:pointer}@media(max-width:600px){#ecgStepReviewBox{padding:14px}.ecg-review-continue{width:100%}}';
 document.head.appendChild(style);
})();
function submitAnswer(){
 const q=path()[index];if(!q||(Array.isArray(selected)?selected.length===0:selected==="")||checked||submitting)return;
 const value=Array.isArray(selected)?[...selected]:selected,k=keys[slot][q.id];
 if(k===undefined||k===""||(q.multi&&(!Array.isArray(k)||!k.length))||(q.type==="number"&&(!k||k.min===""||k.max===""||k.min===undefined||k.max===undefined))){
  $("feedback").className="feedback bad";$("feedback").textContent="Answer key unavailable. Ask the administrator to configure this ECG.";return;
 }
 checked=true;answers[q.id]=value;
 const isCorrect=correct(q,value);recordStep(q,isCorrect);updateLiveComment();showAnswerFeedback(isCorrect);
 if(!isCorrect)wrongCount++;
 setTimeout(()=>{const finishedGroup=ecgGroupOf(q);index++;const nextQuestion=path()[index];selected="";checked=false;stepEnteredAt=Date.now();if(!nextQuestion||ecgGroupOf(nextQuestion)!==finishedGroup){ecgStepReview={group:finishedGroup,next:nextQuestion||null};}render();if(!ecgStepReview)scrollEcgToActiveQuestion();},750);
}
$("next").onclick=submitAnswer;
function openEcgPeek(){
 if(!images[slot])return;
 $("peekEcgImage").src=images[slot];$("peekEcgNumber").textContent=String(slot+1).padStart(2,"0");
 $("ecgPeekModal").classList.remove("hidden");document.body.classList.add("ecg-peek-open");$("backToQuestion").focus();
}
function closeEcgPeek(){
 $("ecgPeekModal").classList.add("hidden");document.body.classList.remove("ecg-peek-open");$("peekEcg").focus();
}
$("peekEcg").onclick=openEcgPeek;
$("backToQuestion").onclick=closeEcgPeek;
$("ecgPeekModal").addEventListener("click",e=>{if(e.target===$("ecgPeekModal")||e.target===$("ecgPeekModal").querySelector(".ecg-peek-image"))closeEcgPeek()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("ecgPeekModal").classList.contains("hidden"))closeEcgPeek()});
async function finish(){
 document.getElementById("ecgIntro").hidden=true;document.getElementById("ecgSelector").hidden=true;
 clearInterval(timer);$("questionPanel").classList.add("hidden");$("complete").classList.remove("hidden");syncEcgReference();
 const duration=elapsedAtFailure??seconds();
 const completedSteps=Object.values(stepTiming);const scoreLocal=completedSteps.filter(x=>x.correct).length;const report={case_number:slot+1,mode,created_at:new Date().toISOString(),duration_seconds:duration,score:scoreLocal,total:completedSteps.length,steps:completedSteps,commentary:Array.from(document.querySelectorAll("#ecgLiveComment .ecg-comment-line")).map(el=>el.textContent.trim())};
 try{const history=JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]");history.unshift(report);localStorage.setItem("acl-ecg-step-reports-v1",JSON.stringify(history.slice(0,200)));}catch(e){console.warn("Could not persist local ECG report",e)}
 $("summary").textContent="ECG "+(slot+1)+" · "+mode.toUpperCase()+" · "+Math.floor(duration/60)+"m "+duration%60+"s";
 $("result").textContent="Saving your complete ECG interpretation securely…";renderAttemptReport(report);showEcgCompletionHero(report,false);
 try{
  const saved=await attemptRequest("POST",{action:"submit_attempt",case_number:slot+1,mode,answers,duration_seconds:duration,mistakes:wrongCount,step_details:report.steps,commentary:report.commentary});
  const passed=wrongCount===0&&saved.passed;
  showEcgCompletionHero(report,passed);
  if(passed&&saved.unlocked_next&&!unlockedEcg.includes(saved.unlocked_next))unlockedEcg.push(saved.unlocked_next);
  attemptHistory.unshift({case_number:slot+1,score:saved.score,total:saved.total});
  slots();
  $("summary").textContent+=" · Score "+saved.score+"/"+saved.total;
  $("result").textContent=passed?"Wonderful work! Your perfect interpretation has been saved. Review your detailed report below, then continue to the next ECG.":wrongCount>0?"Your full interpretation has been saved. Review the incorrect steps and try again.":"Your attempt has been saved. Keep practising to achieve a perfect interpretation.";
 }catch(error){$("result").innerHTML="⚠ Attempt not saved to Neon: "+esc(error.message)+". Your step-by-step report remains available locally. <button type=\"button\" class=\"btn\" id=\"retryEcgSave\">↻ Retry saving</button>";$("retryEcgSave").onclick=()=>retrySaveAttempt(report);}
}

function showEcgCompletionHero(report,passed){
 const panel=$("complete");if(!panel)return;
 renderPreviousEcgResults();
 panel.classList.toggle("ecg-completion-passed",!!passed);
 let banner=document.getElementById("ecgCompletionBanner");if(!banner){banner=document.createElement("div");banner.id="ecgCompletionBanner";panel.prepend(banner)}
 const wrong=report.steps.find(x=>!x.correct);
 const mastered=!!passed;
 const message=mastered?"You interpreted this ECG with 100% accuracy!":wrong?"Keep practising — review "+wrong.title+" and try again.":"Your ECG interpretation is complete.";
 banner.innerHTML='<div class="ecg-hero-glow"></div><div class="ecg-hero-graphic" aria-hidden="true">'+(mastered?'🏆':'💪')+'</div><div class="ecg-completion-kicker">✦ '+(mastered?'ECG MASTERED':'KEEP LEARNING')+'</div><h2>'+message+'</h2><p>'+(mastered?'Perfect interpretation — every assessment was correct.':'Every attempt is progress. Review the highlighted step before your next attempt.')+'</p><div class="ecg-completion-meter" role="img" aria-label="'+report.score+' of '+report.total+' assessments correct"><div style="width:'+Math.max(0,Math.min(100,100*report.score/Math.max(1,report.total)))+'%"></div></div><div class="ecg-completion-metrics"><span>🫀 ECG '+report.case_number+'</span><span>✓ '+report.score+'/'+report.total+' correct</span><span>⏱ '+fmtDuration(report.duration_seconds)+'</span></div>';

 let next=document.getElementById("ecgCompletionNext");if(!next){next=document.createElement("button");next.id="ecgCompletionNext";next.className="btn";next.type="button";banner.after(next)}
 next.hidden=!passed;next.textContent="Continue to next ECG →";
 next.onclick=()=>{ecgAttemptOpened=false;restart();const n=nextAvailableEcg();if(n)slot=n-1;render();document.getElementById("ecgCaseStage")?.scrollIntoView({behavior:"smooth",block:"start"})};
 const again=$("again");if(again){again.hidden=!!passed&&!admin();again.textContent=passed&&admin()?"↻ Try this ECG again (admin)":"↻ Restart interpretation"}
 if(!document.getElementById("ecgCompletionCSS")){const css=document.createElement("style");css.id="ecgCompletionCSS";css.textContent=`
 #ecgCompletionBanner{position:relative;overflow:hidden;background:linear-gradient(125deg,#063957,#076ca8);border-radius:19px;color:white;padding:24px;margin-bottom:14px;box-shadow:0 12px 25px #0a4a7524}
 #ecgCompletionBanner{position:relative;overflow:hidden;background:linear-gradient(125deg,#083956,#087a9d 55%,#095078)}\n #complete.ecg-completion-passed #ecgCompletionBanner{background:linear-gradient(125deg,#064a48,#078363 60%,#0b5876)}\n .ecg-completion-art{font-size:clamp(32px,6vw,54px);letter-spacing:8px;animation:ecg-celebrate 1.6s ease-in-out infinite alternate}\n @keyframes ecg-celebrate{from{transform:translateY(0) scale(1)}to{transform:translateY(-5px) scale(1.04)}}\n .ecg-completion-meter{height:12px;border-radius:99px;background:#ffffff40;overflow:hidden;margin-top:18px}.ecg-completion-meter span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#7cebc5,#fff2a3);transition:width .5s ease}\n @media(prefers-reduced-motion:reduce){.ecg-completion-art{animation:none}}\n #ecgCompletionBanner .ecg-hero-glow{position:absolute;right:-60px;top:-90px;width:250px;height:250px;border-radius:50%;background:#ffffff13;pointer-events:none}
 #ecgCompletionBanner .ecg-hero-graphic{font-size:56px;animation:ecgHeroPop .65s ease-out;filter:drop-shadow(0 6px 10px #001e3255)}
 #ecgCompletionBanner .ecg-completion-meter{height:12px;border-radius:30px;background:#ffffff35;overflow:hidden;margin-top:20px}
 #ecgCompletionBanner .ecg-completion-meter div{height:100%;border-radius:30px;background:linear-gradient(90deg,#6be5c4,#f7dd6c);transition:width .8s ease}
 #complete:not(.ecg-completion-passed) #ecgCompletionBanner{background:linear-gradient(125deg,#4b294f,#a13a5a)}
 @keyframes ecgHeroPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
 @media(prefers-reduced-motion:reduce){#ecgCompletionBanner .ecg-hero-graphic{animation:none}}
 #ecgCompletionBanner h2{color:white;font-size:clamp(23px,3vw,34px);margin:9px 0}
 #ecgCompletionBanner p{color:#e2f5ff;margin:6px 0}
 .ecg-completion-kicker{font-size:12px;letter-spacing:2px;font-weight:850;color:#a9e9ff}
 .ecg-completion-metrics{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
 .ecg-completion-metrics span{background:#ffffff24;border:1px solid #ffffff55;border-radius:11px;padding:10px 14px;font-weight:750}
 #complete.ecg-completion-passed #again{display:none!important}
 #complete #summary{display:none}
 #ecgCompletionNext{margin:4px 0 14px;background:#087c53;color:#fff;font-weight:800}
 #complete.ecg-completion-passed #result{border:1px solid #b5e8c9;background:#e9faf0;color:#096439;border-radius:13px;padding:13px 16px}
 .ecg-history-heading{font-size:clamp(21px,2.5vw,28px);margin:25px 0 4px;color:#103e60}
 .ecg-history-sub{color:#617c91;margin:0 0 15px}
 .ecg-history-card{background:white;border:1px solid #c7deed;border-radius:16px;overflow:hidden;margin:12px 0;box-shadow:0 8px 24px #113c5c0d}
 .ecg-history-summary{display:flex;align-items:center;gap:16px;padding:14px}
 .ecg-history-summary img{width:165px;max-width:35%;height:110px;object-fit:contain;border-radius:10px;background:#f4f8fb}
 .ecg-history-summary strong{font-size:18px;color:#0b426b}
 .ecg-history-summary p{font-weight:750;color:#08794d;margin:8px 0}
 .ecg-history-summary small{color:#58758a}
 .ecg-history-card details{border-top:1px solid #e0eaf2}
 .ecg-history-card summary{cursor:pointer;background:#edf7ff;padding:13px 17px;font-weight:750;color:#07679d}
 .ecg-history-expanded{padding:18px}.ecg-history-full{display:block;max-width:100%;max-height:65vh;object-fit:contain;margin:0 auto}
 .ecg-history-expanded ol{line-height:1.8;color:#21455f}
 .ecg-history-step{display:grid;grid-template-columns:1fr 80px 90px;gap:8px;border-bottom:1px solid #e5edf4;padding:8px 2px;font-size:13px}
 .ecg-history-step b{color:#087b48;text-align:right}
 @media(max-width:550px){.ecg-history-summary img{width:100px;height:90px}.ecg-history-summary strong{font-size:15px}.ecg-history-summary{gap:10px;padding:10px}}
 `;document.head.appendChild(css)}
}
function fmtDuration(sec){sec=Number(sec)||0;return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")}
function renderAttemptReport(report){
 let history=[];try{history=JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]")}catch{}
 const panel=$("ecgAttemptReport")||document.createElement("section");panel.id="ecgAttemptReport";panel.style.cssText="margin-top:20px;overflow-x:auto";if(!panel.isConnected)$("complete").append(panel);
 const commentaryById={
 "1a":a=>a==="Yes"?"The ECG is well calibrated (25 mm/sec and 10 mm/mV).":"The ECG calibration is abnormal.",
 "1b":a=>a==="Yes"?"Electrodes are correctly placed.":"Possible incorrect electrode placement.",
 "1c":a=>a==="Yes"?"Recording quality is good, without significant interference.":"Recording quality is suboptimal.",
 "2a":a=>a==="Yes"?"The rhythm is regular.":"The rhythm is irregular.",
 "2b":a=>"Heart rate: "+a+" bpm.",
 "3":a=>"QRS axis: "+a+".",
 "4a":a=>a==="Yes"?"P waves are present.":"P waves are absent.",
 "4b":a=>a==="Yes"?"P-wave morphology is normal.":"P-wave morphology is abnormal."
 };
 const interpretation=(s)=>{const a=String(s.answer??"");if(s.id&&commentaryById[s.id])return commentaryById[s.id](a);const key=String(s.number??"");if(commentaryById[key])return commentaryById[key](a);return s.title+": "+a+(a&&!/[.!?]$/.test(a)?".":"")};
 const lines=report.steps.map((s,i)=>'<tr class="'+(s.correct?'':'ecg-step-wrong')+'"><td><strong>Step '+esc(s.number)+'</strong><small>'+esc(s.title)+'</small></td><td>'+esc(interpretation(s))+'</td><td><span class="'+(s.correct?'ecg-step-ok':'ecg-step-no')+'">'+(s.correct?'✓ Correct':'✕ Incorrect')+'</span><small>⏱ '+fmtDuration(s.seconds)+'</small></td></tr>').join("");
 if(!document.getElementById("ecgStepCommentStyle")){
  const style=document.createElement("style");style.id="ecgStepCommentStyle";style.textContent='.ecg-comment-table{width:100%;border-collapse:separate;border-spacing:0 8px;table-layout:fixed}.ecg-comment-table th{text-align:left;color:#45657e;font-size:13px;padding:8px}.ecg-comment-table td{padding:13px 10px;background:#f2f8fc;border-top:1px solid #dbe8f1;border-bottom:1px solid #dbe8f1;vertical-align:top;overflow-wrap:anywhere}.ecg-comment-table td:first-child{width:25%;border-left:4px solid #0879b9;border-radius:12px 0 0 12px}.ecg-comment-table td:nth-child(2){width:53%;line-height:1.5}.ecg-comment-table td:last-child{width:22%;border-right:1px solid #dbe8f1;border-radius:0 12px 12px 0}.ecg-comment-table small{display:block;color:#5c7587;font-size:12px;margin-top:5px}.ecg-step-ok{color:#087448;font-weight:750}.ecg-step-no{color:#bd2045;font-weight:750}.ecg-comment-table .ecg-step-wrong td{background:#fff0f2;border-color:#f1c9d1}.ecg-comment-table .ecg-step-wrong td:first-child{border-left-color:#c01c42}@media(max-width:540px){.ecg-comment-table th,.ecg-comment-table td{padding:9px 6px;font-size:12px}.ecg-comment-table td:nth-child(2){font-size:13px}.ecg-comment-table small{font-size:11px}}';
  document.head.appendChild(style);
 }
 panel.innerHTML='<h3>Step-by-step ECG interpretation</h3><p>ECG '+report.case_number+' · '+fmtDuration(report.duration_seconds)+' total · '+report.score+'/'+report.total+' correct</p><table class="ecg-comment-table"><thead><tr><th>Step</th><th>Your ECG comment</th><th>Result / Time</th></tr></thead><tbody>'+lines+'</tbody></table>';

 const shareActions=document.createElement("div");shareActions.className="ecg-report-actions";
 shareActions.innerHTML='<button type="button" class="btn" id="ecgExportResult">📷 Export as image</button>';
 panel.prepend(shareActions);
 const createResultImage=async()=>{
  const W=1100,pad=60,comments=report.commentary||[],lineH=43,ecg=images[report.case_number-1];
  const image=await new Promise(resolve=>{if(!ecg)return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=ecg});
  const imgH=image?Math.min(470,Math.round(image.height/image.width*(W-2*pad))):0;
  const height=340+imgH+comments.length*lineH+100;
  const canvas=document.createElement("canvas");canvas.width=W*2;canvas.height=height*2;const ctx=canvas.getContext("2d");ctx.scale(2,2);
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
  const txt=(v,x,y,size,color="#15344d",weight=500)=>{ctx.fillStyle=color;ctx.font=weight+" "+size+"px Arial,sans-serif";ctx.fillText(String(v),x,y)};
  rect(0,0,W,height,"#f0f6fb");rect(28,28,W-56,height-56,"#ffffff");rect(28,28,W-56,174,"#073c61");
  txt("CARDIOLOGY LEAGUE  |  ECG DEMYSTIFIED",pad,86,22,"#c7e8fa",700);
  txt("ECG "+report.case_number+" — INTERPRETATION RESULT",pad,139,32,"#ffffff",800);
  txt(Math.round(100*report.score/Math.max(1,report.total))+"% accuracy",pad,255,30,"#08754a",800);
  txt("Time: "+fmtDuration(report.duration_seconds),W-325,255,23,"#164461",700);
  let y=300;
  if(image){ctx.drawImage(image,pad,y,W-2*pad,imgH);y+=imgH+38}
  txt("YOUR ECG COMMENTARY",pad,y,23,"#073c61",800);y+=38;
  for(let i=0;i<comments.length;i++){const step=report.steps?.[i];txt(step?.correct===false?"✕":"✓",pad,y,20,step?.correct===false?"#c32648":"#08794c",800);txt(cleanEcgComment(comments[i]),pad+36,y,17,"#173a55",500);y+=lineH}
  txt("Mohamed Alaa  •  ACL ECG Interpretation Lab",pad,height-57,16,"#59758c",600);
  return new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
 };
 const exportFile=async()=>{const blob=await createResultImage();if(!blob)throw Error("Image export failed");return new File([blob],"ACL-ECG-"+report.case_number+"-result.png",{type:"image/png"})};
 shareActions.querySelector("#ecgExportResult").onclick=async()=>{try{const file=await exportFile(),url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(e){alert(e.message)}};
 if(admin()){
  const actions=document.createElement("div");actions.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0";
  const reset=document.createElement("button");reset.type="button";reset.className="btn secondary";reset.textContent="↺ Reset local attempt history (admin)";
  reset.onclick=()=>{if(!confirm("Clear all locally stored ECG attempt reports in THIS browser? This will NOT reset Neon progress or other members' records."))return;localStorage.removeItem("acl-ecg-step-reports-v1");renderAttemptReport(report)};
  actions.append(reset);panel.prepend(actions);
 }

}
async function retrySaveAttempt(report){const button=$("retryEcgSave");if(button){button.disabled=true;button.textContent="Saving…"}try{const saved=await attemptRequest("POST",{action:"submit_attempt",case_number:report.case_number,mode:report.mode,answers,duration_seconds:report.duration_seconds,mistakes:wrongCount,step_details:report.steps,commentary:report.commentary||[]});$("result").textContent="✓ Attempt saved to Neon · "+saved.score+"/"+saved.total+(saved.passed?" · ECG completed. Proceed to the next ECG.":"");await refreshAttemptProgress();if(saved.passed)showEcgCompletionHero(report,true)}catch(error){$("result").textContent="⚠ Still not saved: "+error.message+" · Your local report is preserved."}}

// Administrator-only Neon ECG attempt management; no access for candidates.
async function openEcgAdminAttempts(){
 if(!admin())return;
 let overlay=document.getElementById("ecgAdminAttemptsModal");
 if(!overlay){
  overlay=document.createElement("div");overlay.id="ecgAdminAttemptsModal";
  overlay.style.cssText="position:fixed;inset:0;z-index:99999;background:#061d35b8;display:grid;place-items:center;padding:12px";
  overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="ECG member attempts" style="background:white;border-radius:20px;width:min(1100px,98vw);max-height:92vh;overflow:auto;padding:22px;color:#153550"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2>🫀 ECG attempts — All members</h2><button class="btn secondary" id="ecgAdminClose">✕ Close</button></div><div id="ecgAdminData">Loading...</div><div style="margin-top:16px"><button class="btn secondary" id="ecgAdminResetAll">Reset ALL ECG trial attempts</button></div></section>';
  document.body.appendChild(overlay);
  overlay.querySelector("#ecgAdminClose").onclick=()=>overlay.remove();
  overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove()});
  overlay.querySelector("#ecgAdminResetAll").onclick=async()=>{if(prompt('Type RESET ECG TRIAL ATTEMPTS to erase all members\' ECG trial attempts and unlock progress again:')!=="RESET ECG TRIAL ATTEMPTS")return;try{await attemptRequest("POST",{action:"admin_reset_attempts",profile_id:"all",confirm:"RESET ECG TRIAL ATTEMPTS"});await refreshAttemptProgress();await openEcgAdminAttempts()}catch(e){alert("Reset failed: "+e.message)}};
 }
 const body=overlay.querySelector("#ecgAdminData");body.textContent="Loading all members’ ECG attempts from Neon…";
 try{
  const data=await attemptRequest("POST",{action:"admin_list_attempts"});
  const rows=data.attempts||[];
  body.innerHTML='<p>'+rows.length+' recorded attempts · Click Details to view timings, answers and commentary.</p><div style="overflow-x:auto"><table class="ecg-report-table" style="width:100%"><thead><tr><th>Member</th><th>ECG</th><th>Completed</th><th>Time</th><th>Score</th><th>Actions</th></tr></thead><tbody>'+rows.map((a,i)=>'<tr><td>'+esc(a.member_name||a.profile_id)+'</td><td>'+esc(a.case_number)+'</td><td>'+esc(new Date(a.completed_at).toLocaleString())+'</td><td>'+fmtDuration(a.duration_seconds)+'</td><td>'+esc(a.score)+'/'+esc(a.total)+'</td><td><button class="btn secondary" data-details="'+i+'">Details</button> <button class="btn secondary" data-member-reset="'+i+'">Reset member</button></td></tr>').join("")+'</tbody></table></div><div id="ecgAdminDetail" style="margin-top:20px"></div>';
  body.querySelectorAll("[data-details]").forEach(b=>b.onclick=()=>{const a=rows[Number(b.dataset.details)];const detail=body.querySelector("#ecgAdminDetail");detail.innerHTML='<h3>'+esc(a.member_name||a.profile_id)+' · ECG '+esc(a.case_number)+'</h3><h4>Step timings and outcomes</h4>'+((a.step_details||[]).map(x=>'<p>'+esc(x.number)+' · '+esc(x.title)+' · '+fmtDuration(x.seconds)+' · '+(x.correct?'✓ Correct':'✕ Incorrect')+'</p>').join("")||'<p>Legacy attempt: detailed timings unavailable.</p>')+'<h4>ECG commentary</h4>'+((a.commentary||[]).map(x=>'<p>'+esc(x)+'</p>').join("")||'<p>Commentary not recorded for this attempt.</p>')+'<h4>Answers</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(a.answers||{},null,2))+'</pre>';detail.scrollIntoView({behavior:"smooth",block:"nearest"})});
  body.querySelectorAll("[data-member-reset]").forEach(b=>b.onclick=async()=>{const a=rows[Number(b.dataset.memberReset)];if(prompt('Reset all ECG trial attempts for '+(a.member_name||a.profile_id)+'? Type RESET ECG TRIAL ATTEMPTS:')!=="RESET ECG TRIAL ATTEMPTS")return;try{await attemptRequest("POST",{action:"admin_reset_attempts",profile_id:a.profile_id,confirm:"RESET ECG TRIAL ATTEMPTS"});await refreshAttemptProgress();await openEcgAdminAttempts()}catch(e){alert("Reset failed: "+e.message)}});
 }catch(e){body.textContent="Unable to load Neon attempt history: "+e.message}
}
function mountEcgAdminAttempts(){
 if(!admin()||document.getElementById("ecgAdminAttemptsButton"))return;
 const button=document.createElement("button");button.id="ecgAdminAttemptsButton";button.type="button";button.className="btn secondary";button.textContent="📊 All members’ ECG attempts";button.onclick=openEcgAdminAttempts;
 const editor=document.getElementById("builder");if(editor)editor.parentElement.insertBefore(button,editor);
}

window.addEventListener("acl-ecg-access-ready",()=>{build();mountEcgAdminAttempts()});render();build();mountEcgAdminAttempts();

// The ECG held by the doctor is the sole visible case-launch control.
const ecgStartButton=document.getElementById("ecgStart");
const ecgReadyOverlay=document.getElementById("ecgReadyOverlay");
const ecgReadyImage=document.getElementById("ecgReadyImage");
const ecgReadyBegin=document.getElementById("ecgReadyBegin");
const ecgReadyClose=document.getElementById("ecgReadyClose");
let readyReturnFocus=null;
function closeReadyPreview(){if(!ecgReadyOverlay)return;restart();ecgReadyOverlay.hidden=true;document.body.style.overflow="";readyReturnFocus?.focus?.();}
if(ecgReadyClose)ecgReadyClose.addEventListener("click",closeReadyPreview);
if(ecgReadyOverlay)ecgReadyOverlay.addEventListener("click",e=>{if(e.target===ecgReadyOverlay)closeReadyPreview()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ecgReadyOverlay&&!ecgReadyOverlay.hidden){e.stopPropagation();closeReadyPreview()}});
// Ask for the preferred viewing layout before exposing the ECG or starting the clock.
let ecgModeChoiceOverlay=null;
// Choose the layout immediately, while the ECG is loading. Do not expose the recording
// or start the timer until both the choice and the image are ready.
let ecgLaunchPending=false;
let ecgLayoutChoice=null;
let ecgRecordingReady=false;
let ecgLaunchError=null;
let ecgLaunchSequence=0;
function nextEcgNumber(){return admin()?slot+1:nextAvailableEcg()}
function ecgPreparingUI(){
 const preparing=document.getElementById("ecgPreparingOverlay");
 if(!preparing)return null;
 const card=preparing.firstElementChild;
 if(!card)return preparing;
 if(!document.getElementById("ecgPreparingLayoutChoices")){
  const box=document.createElement("div");
  box.id="ecgPreparingLayoutChoices";
  box.innerHTML='<h3 style="font-size:clamp(17px,4vw,22px);margin:16px 0 6px;color:#103554">How would you like to view your ECG?</h3><p style="font-size:13px;color:#53718b;margin:0 0 10px">Choose now. Your layout cannot be changed during this attempt.</p><div style="display:grid;gap:10px"><button type="button" data-preparing-mode="fixed" style="border:2px solid #c3dced;border-radius:14px;background:#f4faff;color:#123955;padding:12px;text-align:left"><strong>📌 Fixed ECG</strong><br><small>Keep the ECG visible above the questions.</small></button><button type="button" data-preparing-mode="demand" style="border:2px solid #c3dced;border-radius:14px;background:#f4faff;color:#123955;padding:12px;text-align:left"><strong>👁 View on demand</strong><br><small>Open the ECG whenever needed.</small></button></div><p id="ecgPreparingChoiceStatus" role="status" style="margin:12px 0 0;font-size:13px;color:#426987">Select your preferred viewing mode while we prepare your ECG.</p>';
  card.appendChild(box);
  box.querySelectorAll("[data-preparing-mode]").forEach(button=>button.addEventListener("click",()=>{
   if(!ecgLaunchPending)return;
   ecgLayoutChoice=button.dataset.preparingMode;
   box.querySelectorAll("[data-preparing-mode]").forEach(el=>{
    const selected=el===button;
    el.style.borderColor=selected?"#078bc3":"#c3dced";
    el.style.background=selected?"#ddf5ff":"#f4faff";
    el.setAttribute("aria-pressed",String(selected));
   });
   const status=document.getElementById("ecgPreparingChoiceStatus");
   if(status)status.textContent=ecgRecordingReady?"✓ ECG ready. Opening your recording…":"✓ Preference saved. Please wait while your ECG recording loads…";
   maybeOpenPreparedRecording();
  }));
 }
 card.style.maxHeight="90dvh";card.style.overflowY="auto";
 return preparing;
}
function maybeOpenPreparedRecording(){
 if(!ecgLaunchPending||!ecgLayoutChoice||!ecgRecordingReady||ecgLaunchError)return;
 const preparing=document.getElementById("ecgPreparingOverlay");
 ecgReferenceMode=ecgLayoutChoice;
 try{localStorage.setItem("acl-ecg-reference-mode",ecgReferenceMode)}catch(e){}
 ecgLaunchPending=false;
 if(preparing)preparing.hidden=true;
 ecgReadyOverlay.hidden=false;
 document.body.style.overflow="hidden";
 start();
 ecgReadyBegin?.focus();
}
async function openPreparedEcg(){
 if(ecgLaunchPending)return;
 const seq=++ecgLaunchSequence;
 ecgLaunchPending=true;ecgLayoutChoice=null;ecgRecordingReady=false;ecgLaunchError=null;
 const preparing=ecgPreparingUI();
 const status=document.getElementById("ecgPreparingChoiceStatus");
 const message=document.getElementById("ecgPreparingMessage");
 if(status)status.textContent="Select your preferred viewing mode while we prepare your ECG.";
 if(message)message.textContent="Preparing your ECG recording and timer…";
 preparing?.querySelectorAll("[data-preparing-mode]").forEach(el=>{el.style.borderColor="#c3dced";el.style.background="#f4faff";el.setAttribute("aria-pressed","false")});
 if(preparing)preparing.hidden=false;
 document.body.style.overflow="hidden";
 try{
  await refreshAttemptProgress();
  const upcoming=nextEcgNumber();
  if(upcoming===null)throw Error("Congratulations! You have completed all available ECGs with 100% accuracy.");
  if(ecgImagesLoading)await ecgImagesLoading;
  if(!images[upcoming-1]){ecgImagesLoading=restoreEcgImages();await ecgImagesLoading}
  const next=nextEcgNumber(),preview=images[next-1];
  if(!preview)throw Error("ECG "+String(next).padStart(2,"0")+" is not uploaded yet. Please ask the administrator to upload it.");
  await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error("ECG image could not be loaded. Please check the connection and try again."));img.src=preview});
  if(seq!==ecgLaunchSequence)return;
  readyReturnFocus=ecgStartButton;restart();slot=next-1;
  ecgReadyImage.src=preview;ecgReadyImage.alt="ECG "+String(next).padStart(2,"0")+" recording";
  ecgRecordingReady=true;
  if(message)message.textContent="Your ECG recording is ready.";
  if(status)status.textContent=ecgLayoutChoice?"✓ Recording ready. Opening your ECG…":"✓ Recording ready. Choose a viewing mode to continue.";
  maybeOpenPreparedRecording();
 }catch(error){
  if(seq!==ecgLaunchSequence)return;
  ecgLaunchError=error;
  if(message)message.textContent=error.message;
  if(status)status.textContent="Unable to prepare this ECG. Please try again.";
  await new Promise(resolve=>setTimeout(resolve,2200));
  if(seq===ecgLaunchSequence){ecgLaunchPending=false;if(preparing)preparing.hidden=true;document.body.style.overflow="";}
 }
}
if(ecgStartButton)ecgStartButton.onclick=()=>void openPreparedEcg();
if(ecgReadyBegin)ecgReadyBegin.addEventListener("click",()=>{
 ecgReadyOverlay.hidden=true;document.body.style.overflow="";
 ecgAttemptOpened=true;
 const next=nextEcgNumber();
 const button=document.querySelector('[data-slot="'+(next-1)+'"]');
 if(button){button.click();document.getElementById("ecgQuestionReference")?.scrollIntoView({behavior:"smooth",block:"start"});}
});
(function enableEcgPullRefresh(){
 const indicator=document.getElementById("aclPullRefresh");if(!indicator)return;
 let startY=0,tracking=false,pull=0;
 const scrollTop=()=>Math.max(document.scrollingElement?.scrollTop||0,window.scrollY||0);
 document.addEventListener("touchstart",e=>{tracking=e.touches.length===1&&scrollTop()<3&&!document.body.classList.contains("ecg-peek-open");startY=e.touches[0]?.clientY||0;pull=0;},{passive:true});
 document.addEventListener("touchmove",e=>{if(!tracking)return;pull=Math.max(0,(e.touches[0]?.clientY||0)-startY);if(pull>25){indicator.classList.add("visible");indicator.textContent=pull>=95?"↻ Release to refresh":"↓ Pull to refresh";}else indicator.classList.remove("visible");},{passive:true});
 document.addEventListener("touchend",()=>{if(tracking&&pull>=95&&scrollTop()<3){indicator.textContent="↻ Refreshing…";window.location.reload();}else indicator.classList.remove("visible");tracking=false;pull=0;},{passive:true});
 document.addEventListener("touchcancel",()=>{tracking=false;pull=0;indicator.classList.remove("visible");},{passive:true});
})();


/* Independent general editor: questions live outside individual ECG management. */
(function(){
 const mount=document.getElementById("ecgGeneralEditorMount"),tools=document.getElementById("ecgGeneralQuestionTools"),builder=document.getElementById("builder"),keys=document.getElementById("ecgCaseKeyTools"),overlay=document.getElementById("ecgQuestionsOverlay"),open=document.getElementById("ecgQuestionsOpen"),close=document.getElementById("ecgQuestionsClose"),launch=document.getElementById("ecgAdminLaunch");
 if(!mount||!tools||!keys||!builder||!overlay||!open||!close)return;
 mount.appendChild(tools);const notice=document.getElementById("draftNotice");if(notice)mount.appendChild(notice);
 const description=document.getElementById("ecgGeneralDescription");if(description)description.hidden=true;
 document.getElementById("ecgBuilderHeading").textContent="Correct Answers for Selected ECG";
 const show=()=>{if(!admin())return;overlay.hidden=false;document.body.style.overflow="hidden";close.focus()};
 const hide=()=>{overlay.hidden=true;document.body.style.overflow="";open.focus()};
 open.addEventListener("click",show);close.addEventListener("click",hide);overlay.addEventListener("click",e=>{if(e.target===overlay)hide()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden){e.stopImmediatePropagation();hide()}},true);
 const sync=()=>{open.hidden=!admin();if(launch)launch.hidden=!admin()};sync();setInterval(sync,1600);
})();
