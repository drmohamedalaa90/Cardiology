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
 el.innerHTML='<label>Number<input data-f="number" value="'+esc(q.number)+'"></label><label>Title<input data-f="title" value="'+esc(q.title)+'"></label><label>Question<textarea data-f="text">'+esc(q.text)+'</textarea></label><label>Type<select data-f="type"><option value="choice" '+(q.type==="choice"?"selected":"")+'>Choices / Yes-No</option><option value="number" '+(q.type==="number"?"selected":"")+'>Number with range</option></select></label><label>Choices (one per line)<textarea data-f="options">'+esc(q.options.join("\n"))+'</textarea></label><label>Show as subquestion after<select data-f="parent"><option value="">Always show</option>'+questions.filter(x=>x.id!==q.id).map(x=>'<option value="'+esc(x.id)+'" '+(q.parent===x.id?"selected":"")+'>'+esc(x.number+" "+x.title)+'</option>').join("")+'</select></label><label>Only when answer equals<input data-f="trigger" value="'+esc(q.trigger)+'" placeholder="e.g. Yes or No"></label><div class="ecg-builder-actions"><button class="btn" data-save>Save</button><button class="btn secondary" data-child>+ Subquestion</button><button class="btn secondary" data-remove>Delete</button><button class="btn secondary" data-cancel>Cancel</button></div><p data-error class="muted small"></p>';
 const get=f=>el.querySelector('[data-f="'+f+'"]').value.trim();
 el.querySelector("[data-save]").onclick=()=>{
 const type=get("type"),opts=get("options").split("\n").map(s=>s.trim()).filter(Boolean),parent=get("parent");
 if(!get("number")||!get("text")||(type==="choice"&&(opts.length<2||new Set(opts).size!==opts.length))||(parent&&!get("trigger"))){el.querySelector("[data-error]").textContent="Provide a number, question, at least two unique choices, and a trigger for subquestions.";return}
 let p=parent,seen=new Set([q.id]);while(p){if(seen.has(p)){el.querySelector("[data-error]").textContent="Circular dependencies are not allowed.";return}seen.add(p);p=questions.find(x=>x.id===p)?.parent||""}
 questions[i]={...q,number:get("number"),title:get("title"),text:get("text"),type,options:type==="choice"?opts:[],parent,trigger:get("trigger")};save();restart();render();build();
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
function tick(){const t=seconds();$("clock").textContent=String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")}
function start(){if(!started){started=Date.now();stepEnteredAt=started;timer=setInterval(tick,1000);tick()}}
function recordStep(q,isCorrect){if(!q||stepRecorded.has(q.id))return;const now=Date.now();stepTiming[q.id]={number:q.number,title:q.title,seconds:Math.max(0,Math.round((now-(stepEnteredAt||started||now))/1000)),correct:isCorrect,answer:answers[q.id]??""};stepRecorded.add(q.id);stepEnteredAt=now;}
function restart(){failedAttempt=false;elapsedAtFailure=null;submitting=false;wrongCount=0;if($("ecgPeekModal")){$("ecgPeekModal").classList.add("hidden");document.body.classList.remove("ecg-peek-open")}clearInterval(timer);timer=null;started=0;index=0;selected="";checked=false;answers={};stepTiming={};stepRecorded=new Set();stepEnteredAt=0;tick()}
function correct(q,value){const k=keys[slot][q.id];if(q.type==="number"){const n=Number(value),min=Number(k?.min),max=Number(k?.max);return value!==""&&k?.min!==undefined&&k?.max!==undefined&&k.min!==""&&k.max!==""&&Number.isFinite(n)&&Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&n>=min&&n<=max}return !!k&&value===k}
const attemptApi="https://acl-neon-api.drmohamedalaa90.workers.dev/learning/ecg-lab";const attemptCourse=new URLSearchParams(location.search).get("course")||"basic-special-3d7c42c2-fb4e-44ab-bc7d-09c59992660c";let ecgAttemptOpened=false;let unlockedEcg=[1],attemptHistory=[],wrongCount=0,submitting=false;const attemptToken=()=>sessionStorage.getItem("aclLegacyToken")||localStorage.getItem("aclLegacyToken");async function attemptRequest(method,body){const t=attemptToken();if(!t)throw Error("Sign in required");const response=await fetch(attemptApi+"?course="+encodeURIComponent(attemptCourse),{method,headers:{Authorization:"Bearer "+t,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||"HTTP "+response.status);return data;}async function refreshAttemptProgress(){try{const data=await attemptRequest("GET");unlockedEcg=Array.isArray(data.unlocked)?data.unlocked:[1];attemptHistory=data.attempts||[];slots();}catch(error){console.warn("ECG progress unavailable",error);unlockedEcg=[1];slots();}}window.addEventListener("acl-ecg-access-ready",()=>void refreshAttemptProgress());void refreshAttemptProgress();
async function restoreEcgImages(){try{const data=await attemptRequest("GET");for(const c of data.cases||[]){const n=Number(c.case_number)-1;if(n>=0&&n<10&&typeof c.image_data==="string"&&c.image_data.startsWith("data:image/")&&!images[n])images[n]=c.image_data;}if(images[slot])render();else slots();}catch(e){console.warn("ECG images could not be restored",e)}}window.addEventListener("acl-ecg-access-ready",()=>void restoreEcgImages());void restoreEcgImages();
async function encodeEcgImage(file){const source=await createImageBitmap(file);try{const maxWidth=2200,maxHeight=1500,ratio=Math.min(1,maxWidth/source.width,maxHeight/source.height),canvas=document.createElement("canvas");canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);let data=canvas.toDataURL("image/jpeg",.9);if(data.length>2400000)data=canvas.toDataURL("image/jpeg",.77);if(data.length>2400000)throw Error("ECG image is too large to save. Please reduce its resolution.");return data;}finally{source.close?.()}}
function slots(){
 $("slots").innerHTML=images.map((x,i)=>{const locked=!unlockedEcg.includes(i+1),done=attemptHistory.some(a=>Number(a.case_number)===i+1&&a.score===a.total&&a.total>0);
 const preview=x?'<img class="ecg-tile-preview" src="'+x+'" alt="ECG '+(i+1)+' recording" loading="lazy">':'<span class="ecg-tile-empty" aria-hidden="true">ECG not uploaded</span>';
 return '<button type="button" class="slot '+(slot===i?"current ":"")+(locked?"ecg-locked ":"")+(x?"ecg-has-image":"")+'" data-slot="'+i+'" aria-label="ECG '+(i+1)+(locked?", locked":"")+'"><span class="ecg-tile-art">'+preview+(locked?'<span class="ecg-tile-lock">🔒</span>':x?'<span class="ecg-tile-saved">✓ Saved</span>':'')+'</span><span class="ecg-tile-title">ECG '+String(i+1).padStart(2,"0")+(done?" ✓":"")+'</span></button>'}).join("");
 document.querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>{const chosen=+b.dataset.slot;if(!unlockedEcg.includes(chosen+1)){alert("Complete ECG "+String(chosen).padStart(2,"0")+" with all answers correct to unlock this ECG.");return;}slot=chosen;document.getElementById("ecgCaseStage").hidden=false;if(!(ecgAttemptOpened&&started))restart();render();build();document.getElementById("ecgCaseStage").scrollIntoView({behavior:"smooth",block:"start"})})
}
function render(){
 $("questionPanel").classList.toggle("hidden",!ecgAttemptOpened);
 if(!ecgAttemptOpened){$("complete").classList.add("hidden");return;}
 slots();$("imageArea").innerHTML=images[slot]?'<img alt="Uploaded ECG" src="'+images[slot]+'">':'<span class="muted">Upload an ECG image to begin.</span>';
 const ready=!!images[slot]&&questions.length>0;$("questionPanel").classList.toggle("hidden",!ready);$("complete").classList.add("hidden");if(!ready)return;
 const qs=path(),q=qs[index];if(!q){finish();return}
 const peekThumb=$("peekEcg");if(peekThumb){const realImage=images[slot];peekThumb.querySelector(".ecg-mini-real")?.remove();peekThumb.querySelectorAll("svg:not(.eye-icon)").forEach(el=>el.style.display=realImage?"none":"");if(realImage){const thumb=document.createElement("img");thumb.className="ecg-mini-real";thumb.alt="ECG thumbnail";thumb.src=realImage;peekThumb.prepend(thumb)}}
 $("stepLabel").textContent="STEP "+q.number;$("stepTitle").textContent=q.title;$("question").textContent=q.text;$("hint").textContent=mode==="practice"?"Interpret the ECG and select your answer.":"Answer without immediate feedback.";$("count").textContent=Object.keys(answers).length+" answered";
 $("progress").innerHTML=qs.map((x,i)=>'<i class="'+(i<index?"done":i===index?"now":"")+'"></i>').join("");
 if(q.type==="number"){$("choices").innerHTML='<label>Heart rate (bpm) <input id="numericAnswer" type="number" inputmode="decimal" step="any" placeholder="Enter rate" value="'+esc(selected)+'"></label>';$("numericAnswer").oninput=e=>{selected=e.target.value;start();$("next").disabled=!selected};$("numericAnswer").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submitAnswer()}}}
 else{$("choices").innerHTML=q.options.map(o=>'<button class="btn answer '+(selected===o?"selected":"")+'" data-answer="'+esc(o)+'">'+esc(o)+'</button>').join("");document.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{if(checked)return;selected=b.dataset.answer;start();submitAnswer()})}
 $("feedback").className="hidden";$("back").disabled=index===0;$("next").classList.toggle("hidden",q.type!=="number");$("next").disabled=!selected;$("next").textContent="Submit rate";
}
$("upload").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/")||f.size>12e6)return alert("Please upload an image smaller than 12 MB.");if(!admin())return alert("Only an administrator can upload ECG recordings.");const target=slot,notice=$("ecgImageSaveStatus");notice.textContent="🟠 Preparing ECG image…";try{const data=await encodeEcgImage(f);images[target]=data;restart();render();notice.textContent="🟠 Saving ECG image to Neon…";await attemptRequest("POST",{action:"save_image",case_number:target+1,image_data:data});notice.textContent="🟢 ECG image saved to Neon · "+new Date().toLocaleTimeString();}catch(err){notice.textContent="🔴 ECG image not saved: "+err.message+" · Keep this page open and retry upload.";console.error(err)}};
for(const m of ["practice","test"])$(m).onclick=()=>{ecgAttemptOpened=false;mode=m;$("practice").className=m==="practice"?"btn active":"btn secondary";$("test").className=m==="test"?"btn active":"btn secondary";restart();render()};
$("reset").onclick=$("again").onclick=()=>{restart();render()};
$("back").onclick=()=>{if(index>0){index--;selected=answers[path()[index]?.id]||"";checked=false;render()}};
function showAnswerFeedback(isCorrect){const panel=$("questionPanel");panel.classList.remove("ecg-result-correct","ecg-result-wrong");void panel.offsetWidth;panel.classList.add(isCorrect?"ecg-result-correct":"ecg-result-wrong");document.querySelectorAll("#choices [data-answer]").forEach(button=>{if(button.dataset.answer===selected){button.classList.add("selected",isCorrect?"ecg-choice-correct":"ecg-choice-wrong");button.setAttribute("aria-label",button.textContent+(isCorrect?" — correct":" — incorrect"));}});$("feedback").className="feedback ecg-answer-animated "+(isCorrect?"good":"bad");$("feedback").innerHTML=isCorrect?'<span class="ecg-feedback-icon">✓</span><strong>Correct!</strong>':'<span class="ecg-feedback-icon">✕</span><strong>Incorrect!</strong><small>Attempt ended. Start a new attempt to try again.</small>';document.querySelectorAll("[data-answer]").forEach(button=>button.disabled=true);$("next").disabled=true;}
let failedAttempt=false,elapsedAtFailure=null;
function submitAnswer(){
 const q=path()[index];if(!q||selected===""||checked||submitting||failedAttempt)return;
 const value=selected,k=keys[slot][q.id];
 if(k===undefined||k===""||(q.type==="number"&&(!k||k.min===""||k.max===""||k.min===undefined||k.max===undefined))){
  $("feedback").className="feedback bad";$("feedback").textContent="Answer key unavailable. Ask the administrator to configure this ECG.";return;
 }
 checked=true;answers[q.id]=value;
 const isCorrect=correct(q,value);recordStep(q,isCorrect);showAnswerFeedback(isCorrect);
 if(!isCorrect){
  wrongCount++;failedAttempt=true;elapsedAtFailure=seconds();clearInterval(timer);timer=null;
  setTimeout(()=>{finish()},1150);
  return;
 }
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
 clearInterval(timer);$("questionPanel").classList.add("hidden");$("complete").classList.remove("hidden");
 const duration=elapsedAtFailure??seconds();
 const completedSteps=Object.values(stepTiming);const scoreLocal=completedSteps.filter(x=>x.correct).length;const report={case_number:slot+1,mode,created_at:new Date().toISOString(),duration_seconds:duration,score:scoreLocal,total:completedSteps.length,steps:completedSteps};
 try{const history=JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]");history.unshift(report);localStorage.setItem("acl-ecg-step-reports-v1",JSON.stringify(history.slice(0,200)));}catch(e){console.warn("Could not persist local ECG report",e)}
 $("summary").textContent="ECG "+(slot+1)+" · "+mode.toUpperCase()+" · "+Math.floor(duration/60)+"m "+duration%60+"s";
 $("result").textContent=failedAttempt?"Incorrect answer — saving failed attempt…":"Saving your attempt securely…";renderAttemptReport(report);
 try{
  const saved=await attemptRequest("POST",{action:"submit_attempt",case_number:slot+1,mode,answers,duration_seconds:duration,mistakes:wrongCount});
  const passed=!failedAttempt&&saved.passed;
  if(passed&&saved.unlocked_next&&!unlockedEcg.includes(saved.unlocked_next))unlockedEcg.push(saved.unlocked_next);
  attemptHistory.unshift({case_number:slot+1,score:saved.score,total:saved.total});
  slots();
  $("summary").textContent+=" · Score "+saved.score+"/"+saved.total;
  $("result").textContent=passed?"✓ Attempt saved to Neon. Next ECG unlocked.":failedAttempt?"✕ Incorrect answer. Attempt closed and saved to Neon. Start a new attempt to retry.":"Attempt saved to Neon. Complete all questions correctly to unlock the next ECG.";
 }catch(error){$("result").textContent="⚠ Attempt not saved: "+error.message+". Progress remains locked. Retry when connected.";}
}
function fmtDuration(sec){sec=Number(sec)||0;return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")}
function renderAttemptReport(report){
 let history=[];try{history=JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]")}catch{}
 const panel=$("ecgAttemptReport")||document.createElement("section");panel.id="ecgAttemptReport";panel.style.cssText="margin-top:20px;overflow-x:auto";if(!panel.isConnected)$("complete").append(panel);
 const rows=report.steps.map((x,i)=>'<tr><td>'+esc(x.number)+'</td><td>'+esc(x.title)+'</td><td>'+fmtDuration(x.seconds)+'</td><td>'+(x.correct?'✅ Correct':'❌ Missed')+'</td></tr>').join("");
 const compare=history.map((a,i)=>'<tr><td>'+(i+1)+'</td><td>ECG '+esc(a.case_number)+'</td><td>'+esc(a.mode)+'</td><td>'+esc(new Date(a.created_at).toLocaleString())+'</td><td>'+fmtDuration(a.duration_seconds)+'</td><td>'+esc(a.score)+'/'+esc(a.total)+'</td></tr>').join("");
 panel.innerHTML='<h3>Step-by-step performance report</h3><p>ECG '+report.case_number+' · '+fmtDuration(report.duration_seconds)+' total · '+report.score+'/'+report.total+' correct</p><table class="ecg-report-table"><thead><tr><th>Step</th><th>Assessment</th><th>Time</th><th>Outcome</th></tr></thead><tbody>'+rows+'</tbody></table><h3 style="margin-top:22px">Compare your ECG attempts</h3><p class="muted small">All locally recorded attempts, including ECG 1, 2, 3 and later cases. Detailed timings are saved in this browser.</p><table class="ecg-report-table"><thead><tr><th>Attempt</th><th>ECG</th><th>Mode</th><th>Date</th><th>Total time</th><th>Correct steps</th></tr></thead><tbody>'+compare+'</tbody></table>';
}
window.addEventListener("acl-ecg-access-ready",build);render();build();

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
if(ecgStartButton)ecgStartButton.onclick=()=>{
 const next=Array.from({length:10},(_,i)=>i+1).find(n=>unlockedEcg.includes(n)&&!attemptHistory.some(a=>Number(a.case_number)===n&&Number(a.score)===Number(a.total)&&Number(a.total)>0))||Math.max(1,...unlockedEcg);
 const preview=images[next-1];
 if(!preview){alert("This ECG recording is not available yet.");return;}
 readyReturnFocus=ecgStartButton;restart();start();ecgReadyImage.src=preview;ecgReadyImage.alt="ECG "+String(next).padStart(2,"0")+" recording";ecgReadyOverlay.hidden=false;document.body.style.overflow="hidden";ecgReadyBegin.focus();
};
if(ecgReadyBegin)ecgReadyBegin.addEventListener("click",()=>{
 ecgReadyOverlay.hidden=true;document.body.style.overflow="";
 ecgAttemptOpened=true;
 const next=Array.from({length:10},(_,i)=>i+1).find(n=>unlockedEcg.includes(n)&&!attemptHistory.some(a=>Number(a.case_number)===n&&Number(a.score)===Number(a.total)&&Number(a.total)>0))||Math.max(1,...unlockedEcg);
 const button=document.querySelector('[data-slot="'+(next-1)+'"]');
 if(button){button.click();document.getElementById("questionPanel")?.scrollIntoView({behavior:"smooth",block:"start"});}
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
