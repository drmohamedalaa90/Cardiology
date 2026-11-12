"use strict";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const binary=(id,title,text,parent="",trigger="")=>({id,number:id,title,text,type:"choice",options:["Yes","No"],parent,trigger});
const defaults=[binary("1a","Calibration","Is the ECG correctly calibrated in terms of voltage and time?"),binary("1b","Electrode placement","Are electrodes correctly placed?"),binary("1c","Recording quality","Is recording quality good, without significant interference?"),binary("2a","Rhythm","Is the ECG regular?"),{id:"2b",number:"2b",title:"Heart rate",text:"What is the heart rate (bpm)?",type:"number",options:[],parent:"",trigger:""},{id:"3",number:"3",title:"QRS axis",text:"What is the QRS axis?",type:"choice",options:["NAD","LAD","RAD","EAD"],parent:"",trigger:""},binary("4a","P wave","Is a P wave present?"),binary("4b","P wave morphology","Is the P wave normal?","4a","Yes")];
const store="acl-ecg-question-builder-v1";let questions=structuredClone(defaults),keys=Array.from({length:10},()=>({})),images=Array(10).fill(null),slot=0,mode="practice",index=0,selected="",checked=false,started=0,timer=null,answers={},stepTiming={},stepEnteredAt=0,stepRecorded=new Set();
try{const d=JSON.parse(localStorage.getItem(store)||"null");if(Array.isArray(d?.questions)&&d.questions.length<=100&&Array.isArray(d?.keys)&&d.keys.length===10){questions=d.questions;keys=d.keys}}catch{}
function save(){localStorage.setItem(store,JSON.stringify({questions,keys}));$("draftNotice").textContent="Saved locally in this browser · "+new Date().toLocaleTimeString()}
function admin(){return window.aclEcgIsAdmin===true}
function build(){
 $("builder").hidden=!admin();if(!admin())return;
 $("questionRows").innerHTML=questions.map((q,i)=>'<div class="ecg-build-row"><b>'+esc(q.number)+'</b><span>'+esc(q.title)+(q.parent?" ↳":"")+'</span><button class="btn secondary" data-edit="'+i+'">Edit</button><button class="btn secondary" data-up="'+i+'">↑</button><button class="btn secondary" data-down="'+i+'">↓</button></div><div id="edit-'+i+'"></div>').join("");
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(+b.dataset.edit));
 document.querySelectorAll("[data-up],[data-down]").forEach(b=>b.onclick=()=>{const i=+(b.dataset.up??b.dataset.down),j=i+(b.hasAttribute("data-up")?-1:1);if(j<0||j>=questions.length)return;[questions[i],questions[j]]=[questions[j],questions[i]];save();restart();render();build()});
 $("keyRows").innerHTML=questions.map(q=>'<label class="ecg-key-row"><b>'+esc(q.number)+' · '+esc(q.title)+'</b> '+(q.type==="number"?'<span>Minimum <input type="number" data-min="'+esc(q.id)+'" value="'+esc(keys[slot][q.id]?.min??"")+'"></span><span>Maximum <input type="number" data-max="'+esc(q.id)+'" value="'+esc(keys[slot][q.id]?.max??"")+'"></span>':'<select data-key="'+esc(q.id)+'"><option value="">Choose correct answer</option>'+q.options.map(o=>'<option '+(keys[slot][q.id]===o?"selected":"")+'>'+esc(o)+'</option>').join("")+'</select>')+'</label>').join("");
 document.querySelectorAll("[data-key]").forEach(e=>e.onchange=()=>{keys[slot][e.dataset.key]=e.value;save();restart();render()});
 document.querySelectorAll("[data-min],[data-max]").forEach(e=>e.onchange=()=>{const id=e.dataset.min||e.dataset.max;keys[slot][id]={min:$('keyRows').querySelector('[data-min="'+id+'"]').value,max:$('keyRows').querySelector('[data-max="'+id+'"]').value};save();restart();render()});
}
function edit(i){
 const q=questions[i],el=$("edit-"+i);
 el.className="ecg-build-editor";
 el.innerHTML='<label>Number<input data-f="number" value="'+esc(q.number)+'"></label><label>Title<input data-f="title" value="'+esc(q.title)+'"></label><label>Question<textarea data-f="text">'+esc(q.text)+'</textarea></label><label>Type<select data-f="type"><option value="choice" '+(q.type==="choice"?"selected":"")+'>Choices / Yes-No</option><option value="number" '+(q.type==="number"?"selected":"")+'>Number with range</option></select></label><label>Numeric answer unit (e.g. bpm, ms, small squares, mmHg)<input list="ecgUnitOptions" data-f="unit" value="'+esc(q.unit|| (q.id==="2b"?"bpm":""))+'" placeholder="Choose or type unit"></label><datalist id="ecgUnitOptions"><option value="bpm"><option value="ms"><option value="small squares"><option value="mmHg"><option value="mm"><option value="mV"><option value="seconds"><option value="cm"></datalist><label>Numeric input label<input data-f="inputLabel" value="'+esc(q.inputLabel||"")+'" placeholder="e.g. PR interval"></label><label>Numeric placeholder<input data-f="placeholder" value="'+esc(q.placeholder||"")+'" placeholder="e.g. Enter duration"></label><label>Choices (one per line)<textarea data-f="options">'+esc(q.options.join("\n"))+'</textarea></label><label>Show as subquestion after<select data-f="parent"><option value="">Always show</option>'+questions.filter(x=>x.id!==q.id).map(x=>'<option value="'+esc(x.id)+'" '+(q.parent===x.id?"selected":"")+'>'+esc(x.number+" "+x.title)+'</option>').join("")+'</select></label><label>Only when answer equals<input data-f="trigger" value="'+esc(q.trigger)+'" placeholder="e.g. Yes or No"></label><div class="ecg-builder-actions"><button class="btn" data-save>Save</button><button class="btn secondary" data-child>+ Subquestion</button><button class="btn secondary" data-remove>Delete</button><button class="btn secondary" data-cancel>Cancel</button></div><p data-error class="muted small"></p>';
 const get=f=>el.querySelector('[data-f="'+f+'"]').value.trim();
 el.querySelector("[data-save]").onclick=()=>{
 const type=get("type"),opts=get("options").split("\n").map(s=>s.trim()).filter(Boolean),parent=get("parent");
 if(!get("number")||!get("text")||(type==="choice"&&(opts.length<2||new Set(opts).size!==opts.length))||(parent&&!get("trigger"))){el.querySelector("[data-error]").textContent="Provide a number, question, at least two unique choices, and a trigger for subquestions.";return}
 let p=parent,seen=new Set([q.id]);while(p){if(seen.has(p)){el.querySelector("[data-error]").textContent="Circular dependencies are not allowed.";return}seen.add(p);p=questions.find(x=>x.id===p)?.parent||""}
 questions[i]={...q,number:get("number"),title:get("title"),text:get("text"),type,options:type==="choice"?opts:[],unit:get("unit").trim(),inputLabel:get("inputLabel"),placeholder:get("placeholder"),parent,trigger:get("trigger")};save();restart();render();build();
 };
 el.querySelector("[data-child]").onclick=()=>{const c=binary("q"+Date.now(),"New subquestion","Enter question",q.id,q.options[0]||"Yes");c.number=q.number+".1";questions.splice(i+1,0,c);save();restart();render();build();edit(i+1)};
 el.querySelector("[data-remove]").onclick=()=>{if(!confirm("Delete this question?"))return;questions.splice(i,1);questions.forEach(x=>{if(x.parent===q.id){x.parent="";x.trigger=""}});keys.forEach(k=>delete k[q.id]);save();restart();render();build()};
 el.querySelector("[data-cancel]").onclick=()=>build();
}
$("addQuestion").onclick=()=>{questions.push(binary("q"+Date.now(),"New question","Enter question"));questions.at(-1).number=String(questions.length);save();build();edit(questions.length-1)};
$("restoreQuestions").onclick=()=>{if(!confirm("Reset all questions and keys for 10 ECGs?"))return;questions=structuredClone(defaults);keys=Array.from({length:10},()=>({}));save();restart();render();build()};
$("exportQuestions").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({questions,keys},null,2)],{type:"application/json"}));a.download="acl-ecg-draft.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$("importQuestions").onchange=async e=>{const f=e.target.files?.[0];if(!f||f.size>1e6)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.questions)||d.questions.length>100||!Array.isArray(d.keys)||d.keys.length!==10||!d.questions.every(q=>q&&typeof q.id==="string"&&typeof q.text==="string"&&["choice","number"].includes(q.type)&&Array.isArray(q.options)))throw Error("Invalid question file");questions=d.questions;keys=d.keys;save();restart();render();build()}catch(err){alert(err.message)}e.target.value=""};
function path(){const result=[],done=new Set(),byId=new Map(questions.map(q=>[q.id,q]));function walk(q){if(done.has(q.id))return;done.add(q.id);result.push(q);if(answers[q.id]!==undefined)questions.filter(c=>c.parent===q.id&&c.trigger===answers[q.id]).forEach(walk)}questions.filter(q=>!q.parent||!byId.has(q.parent)).forEach(walk);return result}
function seconds(){return started?Math.floor((Date.now()-started)/1000):0}
function tick(){const t=seconds();const time=String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");$("clock").textContent=time;const previewClock=$("ecgReadyClock");if(previewClock)previewClock.textContent="⏱ "+time;}
function start(){if(!started){started=Date.now();stepEnteredAt=started;timer=setInterval(tick,1000);tick()}}
function recordStep(q,isCorrect){if(!q||stepRecorded.has(q.id))return;const now=Date.now();stepTiming[q.id]={id:q.id,number:q.number,title:q.title,seconds:Math.max(0,Math.round((now-(stepEnteredAt||started||now))/1000)),correct:isCorrect,answer:answers[q.id]??""};stepRecorded.add(q.id);stepEnteredAt=now;}
function restart(){failedAttempt=false;elapsedAtFailure=null;submitting=false;wrongCount=0;if($("ecgPeekModal")){$("ecgPeekModal").classList.add("hidden");document.body.classList.remove("ecg-peek-open")}clearInterval(timer);timer=null;started=0;index=0;selected="";checked=false;answers={};stepTiming={};stepRecorded=new Set();stepEnteredAt=0;tick()}
function correct(q,value){const k=keys[slot][q.id];if(q.type==="number"){const n=Number(value),min=Number(k?.min),max=Number(k?.max);return value!==""&&k?.min!==undefined&&k?.max!==undefined&&k.min!==""&&k.max!==""&&Number.isFinite(n)&&Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&n>=min&&n<=max}return !!k&&value===k}
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
 document.querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>{const chosen=+b.dataset.slot;if(!admin()&&isEcgCompleted(chosen+1)){alert("You have already completed ECG "+String(chosen+1).padStart(2,"0")+" with 100% accuracy. Please proceed to the next ECG.");return;}if(!admin()&&!unlockedEcg.includes(chosen+1)){alert("Complete ECG "+String(chosen).padStart(2,"0")+" with all answers correct to unlock this ECG.");return;}slot=chosen;document.getElementById("ecgCaseStage").hidden=false;if(!(ecgAttemptOpened&&started))restart();render();build();document.getElementById("ecgCaseStage").scrollIntoView({behavior:"smooth",block:"start"})})
}
function updateLiveComment(){
 const target=document.getElementById("ecgLiveComment");if(!target)return;
 const statements=[];
 const yes=(id,positive,negative)=>{if(answers[id]!==undefined)statements.push(answers[id]==="Yes"?positive:negative)};
 yes("1a","The ECG is well calibrated (25 mm/sec and 10 mm/mV).","ECG calibration is abnormal or incorrect.");
 yes("1b","Electrodes are correctly placed.","Possible incorrect electrode placement.");
 yes("1c","Recording quality is good, with no significant interference.","Recording quality is suboptimal or interference is present.");
 yes("2a","The rhythm is regular.","The rhythm is irregular.");
 if(answers["2b"]!==undefined)statements.push("Heart rate: "+answers["2b"]+" bpm.");
 if(answers["3"]!==undefined)statements.push("QRS axis: "+answers["3"]+".");
 yes("4a","P waves are present.","P waves are absent.");
 yes("4b","P-wave morphology is normal.","Abnormal P-wave morphology.");
 for(const q of questions){if(["1a","1b","1c","2a","2b","3","4a","4b"].includes(q.id))continue;if(answers[q.id]!==undefined)statements.push(q.title+": "+answers[q.id]+(q.type==="number"&&q.unit?" "+q.unit:"")+".")}
 target.innerHTML=statements.length?statements.map((line,i)=>'<div class="ecg-comment-line"><span class="ecg-comment-index">Step '+esc(questions.filter(q=>answers[q.id]!==undefined)[i]?.number??String(i+1))+'</span><span>'+esc(line)+'</span></div>').join(""):'<p class="muted">Your ECG interpretation will appear here as you answer each step.</p>';
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
 renderPreviousEcgResults();
 document.getElementById("ecgIntro").hidden=ecgAttemptOpened;
 document.getElementById("ecgSelector").hidden=ecgAttemptOpened;
 $("questionPanel").classList.toggle("hidden",!ecgAttemptOpened);
 if(!ecgAttemptOpened){$("complete").classList.add("hidden");syncEcgReference();return;}
 slots();$("imageArea").innerHTML=images[slot]?'<img alt="Uploaded ECG" src="'+images[slot]+'">':'<span class="muted">Upload an ECG image to begin.</span>';
 const ready=!!images[slot]&&questions.length>0;$("questionPanel").classList.toggle("hidden",!ready);$("complete").classList.add("hidden");if(!ready){syncEcgReference();return;}
 syncEcgReference();
 const qs=path(),q=qs[index];if(!q){finish();return}
 const peekThumb=$("peekEcg");if(peekThumb){peekThumb.hidden=ecgReferenceMode==="fixed";const realImage=images[slot];peekThumb.querySelector(".ecg-mini-real")?.remove();peekThumb.querySelectorAll("svg:not(.eye-icon)").forEach(el=>el.style.display=realImage?"none":"");if(realImage){const thumb=document.createElement("img");thumb.className="ecg-mini-real";thumb.alt="ECG thumbnail";thumb.src=realImage;peekThumb.prepend(thumb)}}
 $("stepLabel").textContent="STEP "+q.number;$("stepLabel").dataset.stepGroup=Number.parseInt(q.number,10)<=3?"red":Number.parseInt(q.number,10)<=5?"green":Number.parseInt(q.number,10)<=7?"blue":"orange";$("stepTitle").textContent=q.title;$("question").textContent=q.text;$("hint").textContent=mode==="practice"?"Interpret the ECG and select your answer.":"Answer without immediate feedback.";$("count").textContent=Object.keys(answers).length+" answered";
 $("progress").innerHTML=qs.map((x,i)=>'<i class="'+(i<index?"done":i===index?"now":"")+'"></i>').join("");
 if(q.type==="number"){$("choices").innerHTML='<label class="ecg-numeric-label">'+esc(q.inputLabel||q.title)+' <input id="numericAnswer" type="number" inputmode="decimal" step="any" placeholder="'+esc(q.placeholder||"Enter value")+'" value="'+esc(selected)+'"> <span class="ecg-numeric-unit">'+esc(q.unit||"")+'</span></label>';$("numericAnswer").oninput=e=>{selected=e.target.value;start();$("next").disabled=!selected};$("numericAnswer").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submitAnswer()}}}
 else{$("choices").innerHTML=q.options.map(o=>'<button class="btn answer '+(selected===o?"selected":"")+'" data-answer="'+esc(o)+'">'+esc(o)+'</button>').join("");document.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{if(checked)return;selected=b.dataset.answer;start();submitAnswer()})}
 updateLiveComment();
 $("feedback").className="hidden";$("next").classList.toggle("hidden",q.type!=="number");$("next").disabled=!selected;$("next").textContent="Submit answer";
}
$("upload").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/")||f.size>12e6)return alert("Please upload an image smaller than 12 MB.");if(!admin())return alert("Only an administrator can upload ECG recordings.");const target=slot,notice=$("ecgImageSaveStatus");notice.textContent="🟠 Preparing ECG image…";try{const data=await encodeEcgImage(f);images[target]=data;restart();render();notice.textContent="🟠 Saving ECG image to Neon…";await attemptRequest("POST",{action:"save_image",case_number:target+1,image_data:data});notice.textContent="🟢 ECG image saved to Neon · "+new Date().toLocaleTimeString();}catch(err){notice.textContent="🔴 ECG image not saved: "+err.message+" · Keep this page open and retry upload.";console.error(err)}};
for(const m of ["practice","test"])$(m).onclick=()=>{if(m==="test")return;ecgAttemptOpened=false;mode=m;$("practice").className=m==="practice"?"btn active":"btn secondary";$("test").className=m==="test"?"btn active":"btn secondary";restart();render()};
$("reset").onclick=$("again").onclick=()=>{if(!admin()&&isEcgCompleted(slot+1)){ecgAttemptOpened=false;restart();const n=nextAvailableEcg();if(n)slot=n-1;render();return}restart();render()};

function showAnswerFeedback(isCorrect){const panel=$("questionPanel");panel.classList.remove("ecg-result-correct","ecg-result-wrong");void panel.offsetWidth;panel.classList.add(isCorrect?"ecg-result-correct":"ecg-result-wrong");document.querySelectorAll("#choices [data-answer]").forEach(button=>{if(button.dataset.answer===selected){button.classList.add("selected",isCorrect?"ecg-choice-correct":"ecg-choice-wrong");button.setAttribute("aria-label",button.textContent+(isCorrect?" — correct":" — incorrect"));}});$("feedback").className="feedback ecg-answer-animated "+(isCorrect?"good":"bad");$("feedback").innerHTML=isCorrect?'<span class="ecg-feedback-icon">✓</span><strong>Correct!</strong>':'<span class="ecg-feedback-icon">✕</span><strong>Incorrect!</strong><small>Continue interpreting the remaining ECG steps. Your complete report will show all correct and incorrect answers.</small>';document.querySelectorAll("[data-answer]").forEach(button=>button.disabled=true);$("next").disabled=true;}
let failedAttempt=false,elapsedAtFailure=null;
function submitAnswer(){
 const q=path()[index];if(!q||selected===""||checked||submitting)return;
 const value=selected,k=keys[slot][q.id];
 if(k===undefined||k===""||(q.type==="number"&&(!k||k.min===""||k.max===""||k.min===undefined||k.max===undefined))){
  $("feedback").className="feedback bad";$("feedback").textContent="Answer key unavailable. Ask the administrator to configure this ECG.";return;
 }
 checked=true;answers[q.id]=value;updateLiveComment();
 const isCorrect=correct(q,value);recordStep(q,isCorrect);showAnswerFeedback(isCorrect);
 if(!isCorrect)wrongCount++;
 setTimeout(()=>{index++;selected="";checked=false;stepEnteredAt=Date.now();render()},750);
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
