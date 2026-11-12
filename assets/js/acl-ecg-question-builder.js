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

/* ACL visual question-flow builder. Changes are staged until one global Save button is pressed. */
let flowDraft=null,flowKeys=null,flowEditing=null,flowDirty=false;
const flowClone=v=>structuredClone(v);
function flowInit(){if(!flowDraft){flowDraft=flowClone(questions);flowKeys=flowClone(keys)}}
function flowSetDirty(){flowDirty=true;const status=document.getElementById("flowSaveStatus");if(status)status.textContent="● Unsaved edits — click Save all changes";}
function flowCss(){
 if(document.getElementById("ecgFlowBuilderCss"))return;
 const style=document.createElement("style");style.id="ecgFlowBuilderCss";style.textContent=`
 #ecgGeneralEditorMount{padding:18px 22px 100px;overflow-y:auto;max-height:calc(100vh - 90px)}
 #ecgGeneralQuestionTools{max-width:1160px;margin:auto}
 #ecgGeneralQuestionTools>.tabs{background:#f3f8fc;border-radius:17px;padding:12px;margin:12px 0 18px!important}
 #ecgGeneralQuestionTools>.tabs #addQuestion{background:#077ebc}
 #ecgGeneralQuestionTools>.tabs #restoreQuestions{background:#fff0ee;color:#a12b30}
 .ecg-flow-shell{display:grid;grid-template-columns:minmax(300px,.95fr) minmax(360px,1.35fr);gap:18px;align-items:start}
 .ecg-flow-tree,.ecg-flow-detail{background:#f8fbfe;border:1px solid #d5e4ee;border-radius:18px;padding:17px;min-width:0}
 .ecg-flow-tree h3,.ecg-flow-detail h3{margin:0 0 6px;color:#143d60}
 .ecg-flow-description{font-size:13px;color:#5e7890;margin:0 0 15px}
 .ecg-flow-step{margin:15px 0;border:1px solid #d1e2ee;background:#fff;border-radius:15px;overflow:hidden}
 .ecg-flow-step-title{background:#e9f4fc;color:#126399;font-weight:800;padding:11px 14px;display:flex;justify-content:space-between}
 .ecg-flow-node-wrap{margin:8px 10px;position:relative}
 .ecg-flow-node-wrap.child{margin-left:29px;padding-left:18px;border-left:3px solid #8abbd9}
 .ecg-flow-node-wrap.child:before{content:"";width:16px;height:2px;background:#8abbd9;position:absolute;top:21px;left:0}
 .ecg-flow-node{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid #d7e3eb;background:white;border-radius:11px;padding:11px 10px;cursor:pointer;color:#21425a}
 .ecg-flow-node.active{background:#e4f4ff;border:2px solid #0879be}
 .ecg-flow-node .flow-num{flex:none;background:#116eaa;color:white;border-radius:9px;padding:6px 8px;font-size:12px;font-weight:800}
 .ecg-flow-node .flow-label{flex:1;min-width:0}
 .ecg-flow-node .flow-label strong{display:block;white-space:normal}
 .ecg-flow-node .flow-label small{display:block;font-size:12px;color:#6a8091;margin-top:3px;overflow-wrap:anywhere}
 .ecg-flow-condition{display:inline-block;background:#fff1dd;color:#945b0a;border-radius:7px;padding:3px 6px;font-size:11px;font-weight:700;margin-top:4px}
 .ecg-flow-controls{display:flex;gap:3px;flex:none}
 .ecg-flow-controls button{border:1px solid #cadbe7;background:#f5faff;color:#12547f;border-radius:7px;cursor:pointer;padding:7px;font-weight:800}
 .ecg-flow-field{display:block;font-size:13px;color:#2d516d;font-weight:750;margin:12px 0 4px}
 .ecg-flow-detail input:not([type=checkbox]),.ecg-flow-detail select,.ecg-flow-detail textarea{width:100%;min-width:0;padding:10px;border:1px solid #b9cfe0;border-radius:10px;background:white;color:#173c58;margin-top:5px;font-size:14px}
 .ecg-flow-detail textarea{min-height:70px;resize:vertical}
 .ecg-flow-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
 .ecg-flow-choice{background:white;border:1px solid #d7e6f0;border-radius:12px;margin:8px 0;padding:10px}
 .ecg-flow-choice strong{font-size:13px;color:#1b5377}
 .ecg-flow-key{background:#e9f8ef;padding:13px;border-radius:12px;margin:14px 0}
 .ecg-flow-key strong{display:block;margin-bottom:5px}
 .ecg-flow-step-title{gap:8px}
 .ecg-flow-step-toggle{border:0;background:transparent;color:inherit;font:inherit;font-weight:800;cursor:pointer;padding:3px 6px;border-radius:6px;text-align:left}
 .ecg-flow-step-title{padding:0!important}
 .ecg-flow-step-toggle{display:flex!important;align-items:center!important;gap:12px!important;width:100%!important;padding:14px 16px!important;min-height:52px!important;text-align:left!important}
 .ecg-flow-step-toggle .ecg-flow-step-count{margin-left:auto!important;font-size:12px!important}
 .ecg-flow-step-toggle .ecg-flow-chevron{font-size:21px!important;line-height:1!important}
 .ecg-flow-step[aria-expanded="false"]{min-height:52px}
 .ecg-flow-step-toggle:hover{background:#d6ebf9}
 .ecg-flow-step-toggle:focus-visible{outline:3px solid #0879be}
 .ecg-flow-step-count{font-size:12px;font-weight:700;white-space:nowrap}
 .ecg-flow-step-contents{padding-bottom:4px}
 .ecg-flow-drag-handle{cursor:grab;touch-action:pan-y;flex:none;color:#426b8b;font-size:23px;line-height:1;border-radius:6px;padding:7px 4px;user-select:none}
 .ecg-flow-drag-handle:active{cursor:grabbing}
 .ecg-flow-dragging{opacity:.45}
 .ecg-flow-drop-hint{outline:3px dashed #0b85bd!important;background:#d9f5ff!important}
 .ecg-flow-controls button{min-width:28px}
 /* Keep all parent/child questions readable at every nesting depth. */
 .ecg-flow-tree{min-width:0;overflow-x:hidden}
 .ecg-flow-step,.ecg-flow-step-contents{min-width:0}
 .ecg-flow-node-wrap,.ecg-flow-node-wrap.child{box-sizing:border-box;min-width:0;margin:7px 8px!important;padding-left:0!important;border-left:0!important}
 .ecg-flow-node-wrap.child{margin-left:calc(8px + min(var(--flow-depth),3)*13px)!important}
 .ecg-flow-node-wrap.child:before{content:"↳";left:-15px;top:10px;width:auto;height:auto;background:none;color:#2984b4;font-size:13px;font-weight:800}
 .ecg-flow-node{box-sizing:border-box;min-width:0;max-width:100%;flex-wrap:wrap;align-items:flex-start;gap:6px!important;padding:9px!important}
 .ecg-flow-node .flow-label{flex:1 1 145px;min-width:min(100%,125px)!important;overflow-wrap:normal;word-break:normal;white-space:normal}
 .ecg-flow-node .flow-label strong,.ecg-flow-node .flow-label small{overflow-wrap:break-word!important;word-break:normal!important;white-space:normal!important;hyphens:none}
 .ecg-flow-node .flow-label small{line-height:1.45}
 .ecg-flow-controls{flex:0 0 auto;display:flex;gap:3px;margin-left:auto;align-self:flex-end}
 .ecg-flow-controls button{font-size:13px;min-width:27px;padding:5px!important}
 .ecg-flow-controls [data-flow-edit]{color:#0a6dad;background:#eaf5ff}
 .ecg-flow-controls [data-flow-delete-card]{color:#af2540;background:#fff0f2;border-color:#efccd4}
 .ecg-flow-controls [data-flow-delete-card]:hover{background:#ffe0e7}
 #ecgFlowDetail{scroll-margin-top:110px}
 .ecg-flow-controls{flex-wrap:wrap;justify-content:flex-end}
 .ecg-flow-controls button{min-height:32px}

 .ecg-flow-drag-handle{padding:4px 2px!important}
 @media(max-width:650px){
  .ecg-flow-node-wrap.child{margin-left:calc(7px + min(var(--flow-depth),3)*9px)!important}
  .ecg-flow-node .flow-label{flex-basis:calc(100% - 78px)}
  .ecg-flow-controls{width:100%;justify-content:flex-end}
 }
 .ecg-flow-empty{text-align:center;padding:42px 16px;color:#627d93}
 .ecg-flow-savebar{position:sticky;bottom:0;z-index:12;background:#fff;border-top:1px solid #c7dce9;box-shadow:0 -8px 22px #123b5b16;padding:12px 16px;display:flex;justify-content:space-between;gap:12px;align-items:center;border-radius:12px;margin:12px 0}
 .ecg-flow-savebar .btn{min-width:180px;background:#0a8656}
 #flowSaveStatus{font-size:13px;color:#986024;font-weight:650}
 .ecg-flow-alert{background:#fff5de;border:1px solid #f0d28f;padding:10px 13px;border-radius:11px;font-size:13px;color:#8d5d12;margin:10px 0}
 @media(max-width:850px){.ecg-flow-shell{grid-template-columns:1fr}.ecg-flow-grid{grid-template-columns:1fr}#ecgGeneralEditorMount{padding:10px 12px 105px}.ecg-flow-savebar{position:sticky;bottom:0;flex-wrap:wrap}.ecg-flow-savebar .btn{width:100%}}
 `;document.head.appendChild(style)
}
function flowSelect(id){
 flowEditing=id;build();
 // The edit pane is below the question tree on mobile. Reveal its beginning
 // rather than leaving the administrator at the previously scrolled location.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const pane=document.getElementById("ecgFlowDetail");
  if(!pane)return;
  pane.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start",inline:"nearest"});
 }));
}
function flowMove(id,delta){
 flowInit();const i=flowDraft.findIndex(q=>q.id===id),q=flowDraft[i];if(!q)return;
 const peers=flowDraft.filter(x=>x.parent===q.parent),index=peers.findIndex(x=>x.id===id),other=peers[index+delta];if(!other)return;
 const j=flowDraft.findIndex(x=>x.id===other.id);
 [flowDraft[i],flowDraft[j]]=[flowDraft[j],flowDraft[i]];flowSetDirty();build();
}
function flowAdd(parent=""){
 flowInit();if(flowDraft.length>=100){alert("Maximum 100 questions");return}
 const parentQ=flowDraft.find(q=>q.id===parent),group=parentQ?String(parentQ.number).match(/^\d+/)?.[0]:String(Math.max(0,...flowDraft.map(q=>Number(String(q.number).match(/^\d+/)?.[0])||0))+1);
 const siblings=flowDraft.filter(q=>String(q.number).match(/^\d+/)?.[0]===group);
 const num=parentQ?group+String.fromCharCode(97+Math.min(siblings.length,25)):group;
 const id="q"+Date.now()+"_"+Math.random().toString(36).slice(2,6),q=binary(id,parentQ?"New child question":"New question","Enter question",parent,parentQ?(parentQ.options[0]||""):"");
 q.number=num;q.choiceComments={};const i=parentQ?flowDraft.findIndex(x=>x.id===parent)+1:flowDraft.length;
 flowDraft.splice(i,0,q);flowEditing=q.id;flowSetDirty();build()
}
function flowDelete(id){
 const q=flowDraft.find(x=>x.id===id);if(!q||!confirm("Delete this question? Its children will become top-level questions."))return;
 flowDraft=flowDraft.filter(x=>x.id!==id);flowDraft.forEach(x=>{if(x.parent===id){x.parent="";x.trigger=""}});
 flowKeys.forEach(k=>delete k[id]);flowEditing=flowDraft[0]?.id||null;flowSetDirty();build();
}

const flowCollapsedKey="acl-ecg-flow-collapsed-v1";
let flowCollapsed=new Set();
try{flowCollapsed=new Set(JSON.parse(localStorage.getItem(flowCollapsedKey)||"[]").map(String))}catch(_){}
function flowToggleStep(n){
 n=String(n);
 if(flowCollapsed.has(n))flowCollapsed.delete(n);else flowCollapsed.add(n);
 try{localStorage.setItem(flowCollapsedKey,JSON.stringify([...flowCollapsed]))}catch(_){}
 build();
}
function flowDescendants(id){
 const found=new Set([id]),out=[];
 function visit(parent){
  flowDraft.filter(q=>q.parent===parent&&!found.has(q.id)).forEach(q=>{found.add(q.id);out.push(q);visit(q.id)});
 }
 visit(id);return out;
}
function flowDuplicate(id){
 flowInit();
 const source=flowDraft.find(q=>q.id===id);if(!source)return;
 const subtree=[source,...flowDescendants(id)];
 if(flowDraft.length+subtree.length>100){alert("Too many questions to duplicate (limit: 100).");return}
 const replacement=new Map(subtree.map(q=>[q.id,"q"+Date.now()+"_"+Math.random().toString(36).slice(2,9)]));
 const copies=subtree.map(q=>{
  const c=flowClone(q);c.id=replacement.get(q.id);
  c.parent=replacement.get(q.parent)||q.parent||"";
  c.title=q.title+" (copy)";
  return c;
 });
 const last=Math.max(...subtree.map(q=>flowDraft.indexOf(q)));
 flowDraft.splice(last+1,0,...copies);
 for(let n=0;n<flowKeys.length;n++){
  for(const q of subtree)if(Object.prototype.hasOwnProperty.call(flowKeys[n],q.id)){
   flowKeys[n][replacement.get(q.id)]=flowClone(flowKeys[n][q.id]);
  }
 }
 flowEditing=copies[0].id;flowCollapsed.delete(String(source.number).match(/^\d+/)?.[0]||"");
 flowSetDirty();build();
}
let flowDragging=null;
function flowMoveBranch(id,targetId,mode="before"){
 flowInit();
 if(!id||!targetId||id===targetId)return;
 const moved=flowDraft.find(q=>q.id===id),target=flowDraft.find(q=>q.id===targetId);
 if(!moved||!target)return;
 const descendants=flowDescendants(id);
 if(descendants.some(q=>q.id===targetId))return;
 const branchIds=new Set([id,...descendants.map(q=>q.id)]);
 const block=flowDraft.filter(q=>branchIds.has(q.id)),remaining=flowDraft.filter(q=>!branchIds.has(q.id));
 if(mode==="child"){
  moved.parent=target.id;
  moved.trigger="";
  const step=String(target.number).match(/^\d+/)?.[0]||String(target.number);
  block.forEach(q=>q.number=step);
  const idx=remaining.findIndex(q=>q.id===target.id);
  remaining.splice(idx+1,0,...block);
 }else{
  moved.parent=target.parent||"";
  moved.trigger=target.parent?target.trigger||"":"";
  const step=String(target.number).match(/^\d+/)?.[0]||String(target.number);
  block.forEach(q=>q.number=step);
  const idx=remaining.findIndex(q=>q.id===target.id);
  remaining.splice(idx+(mode==="after"?1:0),0,...block);
 }
 flowDraft=remaining;flowCollapsed.delete(String(target.number).match(/^\d+/)?.[0]||"");
 flowSetDirty();build();
}
function flowDropToStep(id,n){
 flowInit();const q=flowDraft.find(x=>x.id===id);if(!q)return;
 const block=[q,...flowDescendants(id)],ids=new Set(block.map(x=>x.id));
 const rest=flowDraft.filter(x=>!ids.has(x.id));q.parent="";q.trigger="";
 block.forEach(x=>x.number=String(n));
 const last=rest.map((x,i)=>String(x.number).match(/^\d+/)?.[0]===String(n)?i:-1).filter(i=>i>=0).pop();
 rest.splice(last===undefined?rest.length:last+1,0,...block);
 flowDraft=rest;flowCollapsed.delete(String(n));flowSetDirty();build();
}
function flowWireDragDrop(){
 const root=document.getElementById("questionRows");if(!root)return;
 root.querySelectorAll("[data-flow-drag]").forEach(handle=>{
  handle.addEventListener("dragstart",e=>{
   flowDragging=handle.dataset.flowDrag;
   e.dataTransfer.effectAllowed="move";
   e.dataTransfer.setData("text/plain",flowDragging);
   handle.closest(".ecg-flow-node")?.classList.add("ecg-flow-dragging");
  });
  handle.addEventListener("dragend",()=>{
   flowDragging=null;
   root.querySelectorAll(".ecg-flow-drop-hint,.ecg-flow-dragging").forEach(x=>x.classList.remove("ecg-flow-drop-hint","ecg-flow-dragging"));
  });
 });
 root.querySelectorAll("[data-flow-select]").forEach(node=>{
  node.addEventListener("dragover",e=>{
   if(!flowDragging||flowDragging===node.dataset.flowSelect)return;
   e.preventDefault();e.dataTransfer.dropEffect="move";node.classList.add("ecg-flow-drop-hint");
  });
  node.addEventListener("dragleave",()=>node.classList.remove("ecg-flow-drop-hint"));
  node.addEventListener("drop",e=>{
   e.preventDefault();e.stopPropagation();node.classList.remove("ecg-flow-drop-hint");
   const id=flowDragging||e.dataTransfer.getData("text/plain");flowDragging=null;
   if(id&&id!==node.dataset.flowSelect)flowMoveBranch(id,node.dataset.flowSelect,e.shiftKey?"child":e.offsetY>node.offsetHeight/2?"after":"before");
  });
 });
 root.querySelectorAll("[data-flow-step-drop]").forEach(header=>{
  header.addEventListener("dragover",e=>{if(!flowDragging)return;e.preventDefault();e.dataTransfer.dropEffect="move";header.classList.add("ecg-flow-drop-hint")});
  header.addEventListener("dragleave",()=>header.classList.remove("ecg-flow-drop-hint"));
  header.addEventListener("drop",e=>{e.preventDefault();header.classList.remove("ecg-flow-drop-hint");const id=flowDragging||e.dataTransfer.getData("text/plain");flowDragging=null;if(id)flowDropToStep(id,header.dataset.flowStepDrop)});
 });
}


function flowQuestionTree(){
 const stepOf=q=>{
  const match=String(q?.number??"").trim().match(/^(\d+)/);
  return match?String(Number(match[1])):"Unnumbered";
 };
 const groups=new Map(),byId=new Map(flowDraft.map(q=>[q.id,q]));
 for(const q of flowDraft){
  const step=stepOf(q);
  if(!groups.has(step))groups.set(step,[]);
  groups.get(step).push(q);
 }
 const sorted=[...groups.entries()].sort(([a],[b])=>{
  if(a==="Unnumbered")return 1;
  if(b==="Unnumbered")return -1;
  return Number(a)-Number(b);
 });
 const numbers=sorted.map(([n])=>Number(n)).filter(Number.isFinite);
 const missing=[];
 if(numbers.length&&Math.max(...numbers)-Math.min(...numbers)<100){
  for(let n=Math.min(...numbers);n<=Math.max(...numbers);n++)if(!groups.has(String(n)))missing.push(n);
 }
 const warning=missing.length?'<div class="ecg-flow-alert">⚠️ Unconfigured steps: '+missing.join(", ")+'. Questions for these steps have not been added.</div>':"";
 const sectionHtml=sorted.map(([step,rows])=>{
  const closed=flowCollapsed.has(step),seen=new Set();
  const renderNode=(q,depth=0)=>{
   if(seen.has(q.id))return "";
   seen.add(q.id);
   const indent=Math.min(depth,3);
   const condition=q.parent&&q.trigger?'<span class="ecg-flow-condition">↳ If '+esc(q.trigger.replaceAll("|"," / "))+'</span>':q.parent?'<span class="ecg-flow-condition">↳ Any parent answer</span>':"";
   const parent=byId.get(q.parent);
   const crossStep=parent&&stepOf(parent)!==step?'<span class="ecg-flow-condition">Linked to Step '+esc(stepOf(parent))+'</span>':"";
   const row='<div class="ecg-flow-node-wrap '+(depth?"child":"")+'" style="--flow-depth:'+indent+'"><div class="ecg-flow-node '+(flowEditing===q.id?"active":"")+'" data-flow-select="'+esc(q.id)+'"><span class="ecg-flow-drag-handle" data-flow-drag="'+esc(q.id)+'" draggable="true" title="Drag to reorder" aria-label="Drag question">⠿</span><span class="flow-num">'+esc(q.number)+'</span><span class="flow-label"><strong>'+esc(q.title||q.text||"New question")+'</strong><small>'+esc(q.text||"")+'</small>'+condition+crossStep+'</span><span class="ecg-flow-controls"><button type="button" data-flow-edit="'+esc(q.id)+'" title="Edit this question" aria-label="Edit question '+esc(q.number)+'">✎</button><button type="button" data-flow-delete-card="'+esc(q.id)+'" title="Delete this question" aria-label="Delete question '+esc(q.number)+'">🗑</button><button type="button" data-flow-copy="'+esc(q.id)+'" title="Duplicate question and children">⧉</button><button type="button" data-flow-up="'+esc(q.id)+'" title="Move up">↑</button><button type="button" data-flow-down="'+esc(q.id)+'" title="Move down">↓</button><button type="button" data-flow-child="'+esc(q.id)+'" title="Add child">↳+</button></span></div></div>';
   return row+rows.filter(child=>child.parent===q.id).map(child=>renderNode(child,depth+1)).join("");
  };
  const roots=rows.filter(q=>{
   const parent=byId.get(q.parent);
   return !parent||stepOf(parent)!==step;
  });
  const content=closed?"":'<div class="ecg-flow-step-contents" id="ecg-flow-step-body-'+esc(step)+'">'+roots.map(q=>renderNode(q)).join("")+rows.filter(q=>!seen.has(q.id)).map(q=>renderNode(q)).join("")+'</div>';
  return '<section class="ecg-flow-step"><div class="ecg-flow-step-title" data-flow-step-drop="'+esc(step)+'"><button type="button" class="ecg-flow-step-toggle" data-flow-toggle="'+esc(step)+'" aria-expanded="'+(!closed)+'" aria-controls="ecg-flow-step-body-'+esc(step)+'"><span class="ecg-flow-chevron" aria-hidden="true">'+(closed?"▸":"▾")+'</span><span>STEP '+esc(step)+'</span><span class="ecg-flow-step-count">'+rows.length+' question'+(rows.length===1?"":"s")+'</span></button></div>'+content+'</section>';
 }).join("");
 return warning+sectionHtml;
}
function flowDetail(){
 const q=flowDraft.find(x=>x.id===flowEditing);if(!q)return '<div class="ecg-flow-empty">✎ Select a question on the left to edit it.</div>';
 const option=(value,label,selected)=>'<option value="'+esc(value)+'" '+(selected?"selected":"")+'>'+esc(label)+'</option>';
 const parent=flowDraft.find(x=>x.id===q.parent);
 const safeParents=flowDraft.filter(x=>x.id!==q.id&&!flowIsDescendant(x.id,q.id));
 const key=flowKeys[slot]?.[q.id];
 const choices=(q.options||[]).map((answer,i)=>'<div class="ecg-flow-choice"><strong>Choice '+(i+1)+': '+esc(answer)+'</strong><label class="ecg-flow-field">Commentary when selected<input data-flow-choice="'+esc(answer)+'" value="'+esc(q.choiceComments?.[answer]||"")+'" placeholder="Exact phrase for ECG comment"></label></div>').join("");
 const keyControl=q.type==="number"?'<div class="ecg-flow-grid"><label class="ecg-flow-field">Correct minimum<input type="number" data-flow-keymin value="'+esc(key?.min??"")+'"></label><label class="ecg-flow-field">Correct maximum<input type="number" data-flow-keymax value="'+esc(key?.max??"")+'"></label></div>':q.multi?'<div>'+q.options.map(o=>'<label style="display:inline-flex;align-items:center;margin:7px"><input type="checkbox" data-flow-keymulti="'+esc(o)+'" '+(Array.isArray(key)&&key.includes(o)?"checked":"")+'>'+esc(o)+'</label>').join("")+'</div>':'<select data-flow-key>'+option("","Select correct answer",!key)+q.options.map(o=>option(o,o,key===o)).join("")+'</select>';
 return '<h3>✏️ Edit question <span style="color:#147ab5">'+esc(q.number)+'</span></h3><p class="ecg-flow-description">All changes stay in the editor until you press the single green Save button.</p>'+
 '<div class="ecg-flow-grid"><label class="ecg-flow-field">Step / question number<input data-flow-field="number" value="'+esc(q.number)+'"></label><label class="ecg-flow-field">Short title<input data-flow-field="title" value="'+esc(q.title)+'"></label></div>'+
 '<label class="ecg-flow-field">Question shown to candidate<textarea data-flow-field="text">'+esc(q.text)+'</textarea></label>'+
 '<div class="ecg-flow-grid"><label class="ecg-flow-field">Answer type<select data-flow-field="type">'+option("choice","Choices / Yes-No",q.type==="choice")+option("leads","12 ECG leads",q.type==="leads")+option("number","Numeric answer",q.type==="number")+'</select></label><label class="ecg-flow-field">Parent question<select data-flow-field="parent">'+option("","None · main question",!q.parent)+safeParents.map(x=>option(x.id,"Step "+x.number+" — "+(x.text||x.title||"Untitled question").replace(/\s+/g," ").trim()+(x.title&&x.text?" ["+x.title+"]":""),x.id===q.parent)).join("")+'</select></label></div>'+
 (q.parent?'<label class="ecg-flow-field">Show this child if parent answer is (separate multiple with |)<input data-flow-field="trigger" value="'+esc(q.trigger||"")+'" placeholder="Leave empty for any parent answer"></label><p class="small muted">Parent choices: '+esc(parent?.options?.join(" · ")||"Any")+'</p>':"")+
 (q.type!=="number"?'<label class="ecg-flow-field">Choices — one per line<textarea data-flow-field="options">'+esc(q.options.join("\n"))+'</textarea></label><label style="display:flex;gap:9px;align-items:center;margin:12px 0;font-size:13px"><input type="checkbox" data-flow-field="multi" '+(q.multi?"checked":"")+'> Allow multiple answers</label><h4>📝 Commentary per choice</h4>'+choices:'<div class="ecg-flow-grid"><label class="ecg-flow-field">Unit<input data-flow-field="unit" value="'+esc(q.unit||"")+'" placeholder="bpm, ms, mm"></label><label class="ecg-flow-field">Input label<input data-flow-field="inputLabel" value="'+esc(q.inputLabel||"")+'"></label></div><label class="ecg-flow-field">Numeric commentary<input data-flow-field="numberComment" value="'+esc(q.numberComment||"")+'" placeholder="Heart rate: {value} bpm"></label>')+
 '<label class="ecg-flow-field">Admin-only note (optional)<input data-flow-field="adminSubtitle" value="'+esc(q.adminSubtitle||"")+'"></label>'+
 '<section class="ecg-flow-key"><strong>✓ Correct answer — ECG '+String(slot+1).padStart(2,"0")+'</strong><p class="small muted">This answer key is specific to the selected ECG.</p>'+keyControl+'</section>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn secondary" data-flow-add-child>↳ Add child</button><button type="button" class="btn secondary" style="color:#b42a3e" data-flow-delete>Delete question</button></div>';
}
function flowIsDescendant(id,ancestor){let p=flowDraft.find(q=>q.id===id)?.parent,seen=new Set();while(p&&!seen.has(p)){if(p===ancestor)return true;seen.add(p);p=flowDraft.find(q=>q.id===p)?.parent}return false}
function build(){
 $("builder").hidden=!admin();if(!admin())return;
 flowInit();flowCss();const heading=$("ecgKeyHeading");if(heading)heading.textContent="Correct answers · ECG "+String(slot+1).padStart(2,"0");
 if(!flowEditing||!flowDraft.some(q=>q.id===flowEditing))flowEditing=flowDraft[0]?.id||null;
 $("questionRows").innerHTML='<div class="ecg-flow-shell"><div class="ecg-flow-tree"><h3>🧭 Question flow</h3><p class="ecg-flow-description">Questions appear in order. Child questions branch beneath their parent.</p>'+flowQuestionTree()+'</div><div class="ecg-flow-detail" id="ecgFlowDetail">'+flowDetail()+'</div></div><div class="ecg-flow-savebar"><span id="flowSaveStatus">'+(flowDirty?"● Unsaved edits — click Save all changes":"✓ All changes saved")+'</span><button class="btn" id="flowSaveAll" type="button">💾 Save all changes</button></div>';
 $("keyRows").innerHTML='<p class="muted">Correct answers are now edited beside each question in the graphical editor above. Choose ECG 01–10 in the main ECG selector.</p>';
 document.querySelectorAll("[data-flow-select]").forEach(el=>el.onclick=e=>{if(e.target.closest("button"))return;flowSelect(el.dataset.flowSelect)});
 document.querySelectorAll("[data-flow-up]").forEach(el=>el.onclick=()=>flowMove(el.dataset.flowUp,-1));
 document.querySelectorAll("[data-flow-down]").forEach(el=>el.onclick=()=>flowMove(el.dataset.flowDown,1));
 document.querySelectorAll("[data-flow-child]").forEach(el=>el.onclick=()=>flowAdd(el.dataset.flowChild));
 document.querySelectorAll("[data-flow-copy]").forEach(el=>el.onclick=()=>flowDuplicate(el.dataset.flowCopy));
 document.querySelectorAll("[data-flow-edit]").forEach(el=>el.onclick=()=>flowSelect(el.dataset.flowEdit));
 document.querySelectorAll("[data-flow-delete-card]").forEach(el=>el.onclick=()=>flowDelete(el.dataset.flowDeleteCard));
 document.querySelectorAll("[data-flow-toggle]").forEach(el=>el.onclick=()=>flowToggleStep(el.dataset.flowToggle));
 flowWireDragDrop();
 const detail=document.getElementById("ecgFlowDetail"),q=flowDraft.find(x=>x.id===flowEditing);
 if(q){
  detail.querySelectorAll("[data-flow-field]").forEach(el=>{
   const field=el.dataset.flowField;
   const onChange=()=>{
    q[field]=field==="multi"?el.checked:field==="options"?el.value.split("\n").map(x=>x.trim()).filter(Boolean):el.value;
    if(field==="type"&&el.value==="leads")q.options=[...ECG_LEADS];
    if(field==="type"&&el.value==="number"){q.options=[];q.multi=false}
    if(field==="parent"){q.trigger=q.parent?q.trigger:"";const parent=flowDraft.find(x=>x.id===q.parent);if(parent&&parent.options.length&&!q.trigger)q.trigger=parent.options[0]}
    flowSetDirty();
    // Do not rebuild on each keystroke: replacing the textarea loses focus after one letter.
    if(["parent","type","options","number","title"].includes(field))build();
   };
   el.addEventListener(["parent","type","options","number","title"].includes(field)?"change":"input",onChange);
  });
  detail.querySelectorAll("[data-flow-choice]").forEach(el=>el.oninput=()=>{q.choiceComments??={};q.choiceComments[el.dataset.flowChoice]=el.value;flowSetDirty()});
  detail.querySelector("[data-flow-key]")?.addEventListener("change",e=>{flowKeys[slot][q.id]=e.target.value;flowSetDirty()});
  detail.querySelectorAll("[data-flow-keymulti]").forEach(el=>el.onchange=()=>{flowKeys[slot][q.id]=Array.from(detail.querySelectorAll("[data-flow-keymulti]:checked")).map(x=>x.dataset.flowKeymulti);flowSetDirty()});
  detail.querySelectorAll("[data-flow-keymin],[data-flow-keymax]").forEach(el=>el.oninput=()=>{flowKeys[slot][q.id]={min:detail.querySelector("[data-flow-keymin]").value,max:detail.querySelector("[data-flow-keymax]").value};flowSetDirty()});
  detail.querySelector("[data-flow-add-child]").onclick=()=>flowAdd(q.id);
  detail.querySelector("[data-flow-delete]").onclick=()=>flowDelete(q.id);
 }
 $("flowSaveAll").onclick=()=>{
  for(const q of flowDraft){
   if(!q.number?.trim()||!q.text?.trim()){alert("All questions need a step number and question text.");flowEditing=q.id;build();return}
   if(q.type!=="number"&&((q.options||[]).length<2||new Set(q.options).size!==q.options.length)){alert("Choices must be unique, and there must be at least two.");flowEditing=q.id;build();return}
   if(q.parent&&!flowDraft.some(p=>p.id===q.parent)){alert("Invalid parent for "+q.title);return}
   if(flowIsDescendant(q.id,q.id)){alert("Circular question branch detected.");return}
  }
  questions=flowClone(flowDraft);keys=flowClone(flowKeys);flowDirty=false;save();restart();render();build();
  $("flowSaveStatus").textContent="✓ Saved locally · Neon synchronization scheduled";
 };
}
$("addQuestion").onclick=()=>flowAdd("");
$("restoreQuestions").onclick=()=>{if(!confirm("Replace every question and all ECG answer keys with defaults? Save all changes afterward."))return;flowDraft=flowClone(defaults);flowKeys=Array.from({length:10},()=>({}));flowEditing=flowDraft[0].id;flowSetDirty();build()};
$("exportQuestions").onclick=()=>{flowInit();const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({questions:flowDraft,keys:flowKeys},null,2)],{type:"application/json"}));a.download="acl-ecg-flow-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$("importQuestions").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const d=JSON.parse(await file.text());if(!Array.isArray(d.questions)||!Array.isArray(d.keys)||d.keys.length!==10)throw Error("Invalid backup");flowDraft=d.questions;flowKeys=d.keys;flowEditing=flowDraft[0]?.id;flowSetDirty();build()}catch(err){alert(err.message)}e.target.value=""};

function path(){
 // Preserve strict numerical STEP order. Cross-step children must not run
 // immediately after their parent (e.g. Step 7 under a Step 4 question).
 const groups=new Map(),byId=new Map(questions.map(q=>[q.id,q]));
 for(const q of questions){
  const group=Number(String(q.number||"").match(/^\d+/)?.[0]||0);
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push(q);
 }
 const result=[],included=new Set();
 const eligible=q=>{
  if(!q.parent||!byId.has(q.parent))return true;
  const parent=byId.get(q.parent);
  if(!included.has(parent.id)||!Object.prototype.hasOwnProperty.call(answers,parent.id)||stepTiming[parent.id]?.correct!==true)return false;
  if(!q.trigger)return true;
  const accepted=q.trigger.split("|").map(x=>x.trim());
  const value=answers[parent.id];
  return (Array.isArray(value)?value:[value]).some(x=>accepted.includes(String(x)));
 };
 for(const group of [...groups.keys()].sort((a,b)=>a-b)){
  const pending=[...groups.get(group)];
  // Include children only when their parent is eligible and already answered.
  // Repeat to support multi-level subquestions without changing their saved order.
  let changed=true;
  while(changed){
   changed=false;
   for(let i=0;i<pending.length;i++){
    const q=pending[i];
    if(eligible(q)){result.push(q);included.add(q.id);pending.splice(i--,1);changed=true;}
   }
  }
 }
 return result;
}
let ecgFinalSubmittedAt=0,ecgFinishInProgress=false;
function seconds(){return started?Math.floor(((ecgFinalSubmittedAt||Date.now())-started)/1000):0}
function freezeEcgAttemptClock(){if(ecgFinalSubmittedAt||!started)return;ecgFinalSubmittedAt=Date.now();clearInterval(timer);timer=null;tick();}
function tick(){const t=seconds();const time=String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");$("clock").textContent=time;const previewClock=$("ecgReadyClock");if(previewClock)previewClock.textContent="⏱ "+time;}
function start(){if(!started){started=Date.now();stepEnteredAt=started;timer=setInterval(tick,1000);tick()}}
function recordStep(q,isCorrect){if(!q||stepRecorded.has(q.id))return;const now=Date.now();stepTiming[q.id]={id:q.id,number:q.number,title:q.title,seconds:Math.max(0,Math.round((now-(stepEnteredAt||started||now))/1000)),correct:isCorrect,answer:answers[q.id]??""};stepRecorded.add(q.id);stepEnteredAt=now;}
let ecgStepReview=null;
function restart(){document.getElementById("ecgFinalDiagnosisForm")?.remove();ecgFinalSubmittedAt=0;ecgFinishInProgress=false;emergencyDiagnosis=null;emergencyPending=null;closeEmergencyDialog();$("complete").querySelector("h2").textContent="Interpretation complete";ecgStepReview=null;failedAttempt=false;elapsedAtFailure=null;submitting=false;wrongCount=0;if($("ecgPeekModal")){$("ecgPeekModal").classList.add("hidden");document.body.classList.remove("ecg-peek-open")}clearInterval(timer);timer=null;started=0;index=0;selected="";checked=false;answers={};stepTiming={};stepRecorded=new Set();stepEnteredAt=0;tick()}

let emergencyDiagnosis=null,emergencyPending=null;
const emergencyLabels={vf:"Ventricular fibrillation",arrest:"Cardiac arrest rhythm (asystole / PEA suspected)",stemi:"ST-elevation myocardial infarction (STEMI)"};
function closeEmergencyDialog(){
 const dialog=$("ecgEmergencyModal");if(dialog)dialog.hidden=true;
 const confirmBox=$("ecgEmergencyConfirm");if(confirmBox)confirmBox.hidden=true;
 emergencyPending=null;
}
function stopForEmergency(diagnosis){
 clearInterval(timer);timer=null;
 $("questionPanel").classList.add("hidden");
 $("complete").classList.remove("hidden");
 $("complete").querySelector("h2").textContent="Emergency diagnosis submitted";
 document.getElementById("ecgIntro").hidden=true;
 document.getElementById("ecgSelector").hidden=true;
 const record={case_number:slot+1,diagnosis,mode,created_at:new Date().toISOString(),duration_seconds:seconds(),scored:false,status:"ended_early"};
 try{
   const prior=JSON.parse(localStorage.getItem("acl-ecg-emergency-episodes-v1")||"[]");
   prior.unshift(record);
   localStorage.setItem("acl-ecg-emergency-episodes-v1",JSON.stringify(prior.slice(0,100)));
 }catch(err){console.warn("Emergency result was not stored locally",err)}
 $("summary").textContent="ECG "+(slot+1)+" · "+emergencyLabels[diagnosis];
 $("result").textContent="Scenario ended early. Emergency diagnosis recorded on this device; no full-interpretation score or progression unlock is awarded.";
 $("ecgAttemptReport")?.remove();
 $("ecgCompletionBanner")?.remove();
 syncEcgReference();
}
(function wireEmergencyDialog(){
 const launch=$("ecgEmergencyLaunch"),dialog=$("ecgEmergencyModal"),confirmBox=$("ecgEmergencyConfirm");
 if(!launch||!dialog||!confirmBox)return;
 launch.addEventListener("click",()=>{
  if(!ecgAttemptOpened||index!==0||Object.keys(answers).length||emergencyDiagnosis)return;
  dialog.hidden=false;confirmBox.hidden=true;$("ecgEmergencyClose").focus();
 });
 $("ecgEmergencyClose").addEventListener("click",closeEmergencyDialog);
 $("ecgEmergencyCancel").addEventListener("click",()=>{emergencyPending=null;confirmBox.hidden=true});
 dialog.addEventListener("click",e=>{if(e.target===dialog)closeEmergencyDialog()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.hidden)closeEmergencyDialog()});
 dialog.querySelectorAll("[data-ecg-emergency]").forEach(button=>button.addEventListener("click",()=>{
  emergencyPending=button.dataset.ecgEmergency;
  $("ecgEmergencyConfirmText").textContent=emergencyPending==="stemi"?"Submit STEMI as your immediate impression and continue the normal ECG questions?":"Submit "+emergencyLabels[emergencyPending]+" and end this scenario without a complete-interpretation score?";
  confirmBox.hidden=false;
  $("ecgEmergencySubmit").textContent=emergencyPending==="stemi"?"Confirm & continue":"Confirm & end scenario";
  $("ecgEmergencySubmit").focus();
 }));
 $("ecgEmergencySubmit").addEventListener("click",()=>{
  if(!ecgAttemptOpened||index!==0||Object.keys(answers).length||emergencyDiagnosis||!emergencyLabels[emergencyPending])return;
  const diagnosis=emergencyPending;
  start();emergencyDiagnosis=diagnosis;closeEmergencyDialog();
  if(diagnosis==="stemi"){
   let note=$("ecgEmergencyNotice");
   if(!note){note=document.createElement("p");note.id="ecgEmergencyNotice";note.style.cssText="padding:12px;border-left:5px solid #bd3045;background:#fff1ee;color:#853344;border-radius:9px;font-weight:700";$("progress").insertAdjacentElement("afterend",note)}
   note.textContent="🚨 Immediate impression submitted: STEMI suspected. Continue the full ECG interpretation.";
   render();
  }else stopForEmergency(diagnosis);
 });
})();
function correct(q,value){const k=keys[slot][q.id];if(q.type==="number"){const n=Number(value),min=Number(k?.min),max=Number(k?.max);return value!==""&&k?.min!==undefined&&k?.max!==undefined&&k.min!==""&&k.max!==""&&Number.isFinite(n)&&Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&n>=min&&n<=max}if(q.multi)return Array.isArray(k)&&Array.isArray(value)&&value.length===k.length&&value.every(x=>k.includes(x));return !!k&&value===ecgResolvedKey(q)}
const attemptApi="https://acl-neon-api.drmohamedalaa90.workers.dev/learning/ecg-lab";const attemptCourse=new URLSearchParams(location.search).get("course")||"basic-special-3d7c42c2-fb4e-44ab-bc7d-09c59992660c";let ecgAttemptOpened=false;let availableEcgCases=new Set(),unlockedEcg=[1],attemptHistory=[],ecgProgressVerified=false,ecgProgressChecked=false,ecgRetryAllowed=true,wrongCount=0,submitting=false;const attemptToken=()=>sessionStorage.getItem("aclLegacyToken")||localStorage.getItem("aclLegacyToken");async function attemptRequest(method,body){const t=attemptToken();if(!t)throw Error("Sign in required");const response=await fetch(attemptApi+"?course="+encodeURIComponent(attemptCourse),{method,headers:{Authorization:"Bearer "+t,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok){const detail=[data.error,data.message,data.detail].filter(Boolean).join(" · ");throw Error((detail||"HTTP "+response.status)+" (HTTP "+response.status+")")}return data;}async function refreshAttemptProgress(){ecgProgressVerified=false;ecgProgressChecked=false;renderPreviousEcgResults();try{const data=await attemptRequest("GET");unlockedEcg=Array.isArray(data.unlocked)?data.unlocked:[1];
 availableEcgCases=new Set((data.cases||[]).filter(c=>typeof c.image_data==="string"&&c.image_data.startsWith("data:image/")&&Array.isArray(c.questions)&&c.questions.length>0).map(c=>Number(c.case_number)));
 attemptHistory=Array.isArray(data.attempts)?data.attempts:[];ecgRetryAllowed=data.retry_allowed!==false;ecgProgressVerified=true;slots();}catch(error){console.warn("ECG progress unavailable",error);unlockedEcg=[1];availableEcgCases=new Set();attemptHistory=[];ecgProgressVerified=false;slots();}finally{ecgProgressChecked=true;renderPreviousEcgResults();}}window.addEventListener("acl-ecg-access-ready",()=>void refreshAttemptProgress());window.addEventListener("acl-ecg-attempts-reset",()=>{attemptHistory=[];unlockedEcg=[1];ecgProgressVerified=false;renderPreviousEcgResults();void refreshAttemptProgress();});void refreshAttemptProgress();
let ecgImagesLoading=null;
async function restoreEcgImages(){try{const data=await attemptRequest("GET");for(const c of data.cases||[]){const n=Number(c.case_number)-1;if(n>=0&&n<10&&typeof c.image_data==="string"&&c.image_data.startsWith("data:image/")&&!images[n])images[n]=c.image_data;}if(images[slot])render();else slots();}catch(e){console.warn("ECG images could not be restored",e)}}window.addEventListener("acl-ecg-access-ready",()=>{ecgImagesLoading=restoreEcgImages()});ecgImagesLoading=restoreEcgImages();
async function encodeEcgImage(file){const source=await createImageBitmap(file);try{const maxWidth=2200,maxHeight=1500,ratio=Math.min(1,maxWidth/source.width,maxHeight/source.height),canvas=document.createElement("canvas");canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);let data=canvas.toDataURL("image/jpeg",.9);if(data.length>2400000)data=canvas.toDataURL("image/jpeg",.77);if(data.length>2400000)throw Error("ECG image is too large to save. Please reduce its resolution.");return data;}finally{source.close?.()}}
function isEcgCompleted(n){return !admin()&&attemptHistory.some(a=>Number(a.case_number)===n&&Number(a.score)===Number(a.total)&&Number(a.total)>0)}
function nextAvailableEcg(){return Array.from({length:10},(_,i)=>i+1).find(n=>availableEcgCases.has(n)&&unlockedEcg.includes(n)&&!isEcgCompleted(n)&&(ecgRetryAllowed||!attemptHistory.some(a=>Number(a.case_number)===n)))||null}

function previousEcgReports(){try{return JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]").filter(x=>x&&Array.isArray(x.steps))}catch{return []}}
function parseEcgStoredComment(value){
 const raw=String(value??"").trim();
 // Strip the label but never the initial letter of the clinical sentence:
 // "Step 1Electrodes" -> "Electrodes", "✓ Step 2Rhythm" -> "Rhythm".
 const label=/^(?:[✓✔✕✗]\s*)?[Ss]tep\s*(\d{1,2})/;
 const match=raw.match(label);
 if(!match)return {step:null,text:raw};
 const number=Number(match[1]);
 let text=raw.slice(match[0].length).replace(/^[a-z](?=\s|[:.)–—-]|$)/,"").replace(/^\s*[:.)–—-]?\s*/,"").trim();
 text=text.replace(/\s+([,.;!?])/g,"$1").replace(/,\s*,+/g,", ").replace(/\s{2,}/g," ");
 return {step:number,text};
}
function cleanEcgComment(value){return parseEcgStoredComment(value).text}
function ensureEcgHistoryLayout(){
 if(document.getElementById("ecgHistoryLayoutFix"))return;
 const style=document.createElement("style");style.id="ecgHistoryLayoutFix";
 style.textContent=`
 #ecgPreviousResults{width:100%;max-width:1100px;margin:20px auto;min-width:0}
 #ecgPreviousResults .ecg-results-return-header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px}
 #ecgPreviousResults .ecg-results-return-header .ecg-history-heading{margin:5px 0}
 #ecgPreviousResults .ecg-return-start{background:#087cba;color:#fff;border-radius:12px;padding:12px 17px}
 #ecgPreviousResults .ecg-next-locked{background:#edf3f8;border:1px solid #cfdeea;border-radius:12px;padding:12px 17px;color:#5d7990;font-weight:800;cursor:not-allowed}
 #ecgPreviousResults .ecg-history-score{color:#a15925;font-weight:800}
 #ecgPreviousResults .ecg-history-score.perfect{color:#08794d}
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
function openEcgSignaturePopup(caseNumber){
 // Custom branded modal instead of browser-native prompt.
 return new Promise(resolve=>{
  document.getElementById("aclEcgSignatureOverlay")?.remove();
  if(!document.getElementById("aclEcgSignaturePopupCSS")){
   const css=document.createElement("style");css.id="aclEcgSignaturePopupCSS";css.textContent=
   '#aclEcgSignatureOverlay{position:fixed;inset:0;z-index:200100;display:grid;place-items:center;padding:18px;background:rgba(7,27,47,.68);backdrop-filter:blur(5px)}'+
   '#aclEcgSignatureDialog{position:relative;box-sizing:border-box;width:min(100%,480px);padding:28px;border:1px solid #bddcf0;border-radius:22px;background:linear-gradient(160deg,#f5fbff,#fff);box-shadow:0 22px 80px #001b3860;color:#123e60}'+
   '#aclEcgSignatureDialog h2{margin:4px 0 9px;font-size:clamp(21px,4vw,27px);color:#0a4d7a}'+
   '#aclEcgSignatureDialog p{color:#57728a;line-height:1.5;margin:5px 0 19px}'+
   '#aclEcgSignatureDialog label{display:block;font-size:14px;font-weight:800;color:#204d6c;margin-bottom:8px}'+
   '#aclEcgSignatureDialog input{width:100%;box-sizing:border-box;padding:13px 15px;border-radius:12px;border:2px solid #b7d4e6;background:white;color:#143e5d;font-size:17px;outline-offset:3px}'+
   '#aclEcgSignatureDialog input:focus{border-color:#087ab8;box-shadow:0 0 0 3px #0e88c51c}'+
   '#aclEcgSignatureDialog .ecg-sig-preview{min-height:38px;margin:12px 0;padding:10px 12px;border-radius:10px;background:#edf6fd;font:italic 26px "Segoe Script","Brush Script MT",cursive;color:#15446d;overflow-wrap:anywhere}'+
   '#aclEcgSignatureDialog .ecg-sig-errors{min-height:20px;font-size:13px;color:#b42844;margin:7px 0}'+
   '#aclEcgSignatureDialog .ecg-sig-buttons{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap}'+
   '#aclEcgSignatureDialog .ecg-sig-buttons button{border:0;border-radius:12px;min-height:44px;padding:12px 18px;font-size:14px;font-weight:800;cursor:pointer}'+
   '#aclEcgSignatureDialog .ecg-sig-cancel{background:#e6f0f6;color:#295675}'+
   '#aclEcgSignatureDialog .ecg-sig-submit{background:linear-gradient(100deg,#0870ad,#078dbe);color:white}'+
   '#aclEcgSignatureDialog .ecg-sig-close{position:absolute;right:16px;top:13px;width:37px;height:37px;border:0;border-radius:10px;background:#e7f1f7;color:#1d5274;font-size:20px;cursor:pointer}'+
   '@media(max-width:530px){#aclEcgSignatureDialog{padding:22px 17px}#aclEcgSignatureDialog .ecg-sig-buttons button{flex:1}}';
   document.head.appendChild(css);
  }
  const modal=document.createElement("div");
  modal.id="aclEcgSignatureOverlay";
  modal.innerHTML='<section id="aclEcgSignatureDialog" role="dialog" aria-modal="true" aria-labelledby="aclEcgSignatureTitle" aria-describedby="aclEcgSignatureDescription">'+
   '<button type="button" class="ecg-sig-close" aria-label="Close signature popup">×</button>'+
   '<div aria-hidden="true" style="font-size:31px">✒️</div>'+
   '<h2 id="aclEcgSignatureTitle">Sign &amp; Export ECG '+String(caseNumber).padStart(2,"0")+'</h2>'+
   '<p id="aclEcgSignatureDescription">Enter your name in English to add your signature to your completed ECG interpretation.</p>'+
   '<form id="aclEcgSignatureForm" novalidate><label for="aclEcgSignatureName">Your full name (English)</label>'+
   '<input id="aclEcgSignatureName" type="text" maxlength="70" autocomplete="name" placeholder="e.g. Mohamed Alaa" required>'+
   '<div class="ecg-sig-preview" aria-label="Signature preview">Your signature</div>'+
   '<div class="ecg-sig-errors" role="alert" aria-live="polite"></div>'+
   '<div class="ecg-sig-buttons"><button type="button" class="ecg-sig-cancel">Cancel</button>'+
   '<button class="ecg-sig-submit" type="submit">✒️ Sign &amp; Download</button></div></form></section>';
  document.body.appendChild(modal);
  const previouslyFocused=document.activeElement;
  const input=modal.querySelector("input"),preview=modal.querySelector(".ecg-sig-preview"),error=modal.querySelector(".ecg-sig-errors");
  let completed=false;
  const finish=value=>{if(completed)return;completed=true;document.removeEventListener("keydown",onKey);modal.remove();previouslyFocused?.focus?.();resolve(value)};
  const cancel=()=>finish(null);
  const onKey=e=>{
   if(e.key==="Escape"){e.preventDefault();cancel();return}
   if(e.key==="Tab"){
    const focusable=[...modal.querySelectorAll("button,input")];
    const idx=focusable.indexOf(document.activeElement);
    if(e.shiftKey&&idx===0){e.preventDefault();focusable[focusable.length-1].focus()}
    else if(!e.shiftKey&&idx===focusable.length-1){e.preventDefault();focusable[0].focus()}
   }
  };
  document.addEventListener("keydown",onKey);
  modal.querySelector(".ecg-sig-cancel").addEventListener("click",cancel);
  modal.querySelector(".ecg-sig-close").addEventListener("click",cancel);
  modal.addEventListener("click",e=>{if(e.target===modal)cancel()});
  input.addEventListener("input",()=>{preview.textContent=input.value.trim()||"Your signature";error.textContent=""});
  modal.querySelector("form").addEventListener("submit",e=>{
   e.preventDefault();
   const name=input.value.trim().replace(/\s+/g," ");
   if(!/^[A-Za-z][A-Za-z .'-]{0,69}$/.test(name)){error.textContent="Please enter your name using English letters (up to 70 characters).";input.focus();return}
   finish(name);
  });
  input.focus();
 });
}

function renderPreviousEcgResults(){
 ensureEcgHistoryLayout();
 const intro=document.getElementById("ecgIntro");if(!intro)return;
 let area=document.getElementById("ecgPreviousResults");if(!area){area=document.createElement("section");area.id="ecgPreviousResults";intro.insertAdjacentElement("afterend",area)}
 // Show only completed attempts verified in Neon. Local browser drafts cannot resurrect a reset.
 const byCase=new Map();
 if(ecgProgressVerified){
  for(const a of attemptHistory){
   const n=Number(a.case_number);
   if(!Number.isInteger(n)||n<1||n>10||byCase.has(n)||!Number(a.total))continue;
   byCase.set(n,{
    attempt_id:Number(a.attempt_id)||0,case_number:n,score:Number(a.score)||0,total:Number(a.total)||0,
    duration_seconds:Number(a.duration_seconds)||0,
    steps:Array.isArray(a.step_details)?a.step_details:[],
    commentary:Array.isArray(a.commentary)?a.commentary:[],
    final_diagnosis:String(a.answers?._final_diagnosis||a.final_diagnosis||""),extra_notes:String(a.answers?._extra_notes||a.extra_notes||""),review:a.answers?._admin_review||a.review||null
   });
  }
 }
 const completed=[...byCase.values()].sort((a,b)=>a.case_number-b.case_number);
 const hasHistory=completed.length>0;
 // Returning candidates see their report instead of the introductory image.
 if(!ecgAttemptOpened)intro.hidden=!ecgProgressChecked||hasHistory;
 area.hidden=ecgAttemptOpened||!hasHistory;if(!hasHistory){area.innerHTML="";return}
 const upcoming=nextAvailableEcg();
 area.innerHTML='<div class="ecg-results-return-header"><div><h3 class="ecg-history-heading">🫀 Your ECG results</h3><p class="ecg-history-sub">Your submitted interpretations</p></div>'+(upcoming?'<button class="btn ecg-return-start" type="button" id="ecgReturnStart">▶ '+(completed.some(x=>x.case_number===upcoming)?'Repeat':'Start')+' ECG '+String(upcoming).padStart(2,"0")+'</button>':'<span class="ecg-next-locked" aria-disabled="true">🔒 Next ECG · Not uploaded yet</span>')+'</div>'+completed.map(r=>{
 const n=Number(r.case_number),img=images[n-1];

 // The saved commentary consists of one completed sentence per interpretation step.
 // Use its visual/clinical sequence for labels, not obsolete question IDs like 1a/2b.
 // Historical records may contain malformed embedded "Step" tags: never trust those labels.
 const normalizedComments=(r.commentary||[]).map(value=>String(value??"").trim()).filter(Boolean);
 const stepGroups=new Map();
 for(const detail of (r.steps||[])){
  const found=String(detail.number??"").match(/^\s*(\d+)/);
  if(!found)continue;
  const n=Number(found[1]);
  if(!stepGroups.has(n))stepGroups.set(n,[]);
  stepGroups.get(n).push(detail);
 }
 const stripOldPrefix=text=>parseEcgStoredComment(text).text;
 // Special annotations have no numerical Step and should not displace the nine interpretation lines.
 const special=normalizedComments.filter(raw=>!/^Step\s*\d/i.test(raw));
 const comments=normalizedComments.filter(raw=>/^Step\s*\d/i.test(raw));
 const expected=9;
 const lines=special.map(note=>'<div class="ecg-history-comment-row ecg-history-special"><span>'+esc(note)+'</span><b></b><time></time></div>').join("")
  +Array.from({length:Math.max(expected,comments.length)},(_,index)=>{
  const n=index+1,raw=comments[index];
  const details=stepGroups.get(n)||[];
  const wrong=details.some(x=>x.correct===false);
  const time=details.reduce((sum,x)=>sum+(Math.max(0,Number(x.seconds)||0)),0);
  let comment=raw?stripOldPrefix(raw):"Not recorded in this attempt.";
  // Repair legacy text damaged by an older prefix parser only at the start of a sentence.
  comment=comment.replace(/^lectrodes\b/i,"Electrodes").replace(/^hythm\b/i,"Rhythm")
   .replace(/^RS axis\b/i,"QRS axis").replace(/^RS morphology\b/i,"QRS morphology")
   .replace(/^R interval\b/i,"PR interval").replace(/^R segment\b/i,"PR segment")
   .replace(/^T interval\b/i,"QT interval");
  const result=details.length?(wrong?"✕ Incorrect":"✓ Correct"):"—";
  return '<div class="ecg-history-comment-row'+(raw?"":" ecg-history-missing")+'"><span class="ecg-history-comment-main"><strong class="ecg-history-step-label">Step '+n+':</strong><span class="ecg-history-comment-text">'+esc(comment)+'</span></span><b class="'+(wrong?"ecg-history-wrong":"")+'">'+result+'</b><time>'+(details.length?"⏱ "+fmtDuration(time):"—")+'</time></div>';
 }).join("");

 return '<article class="ecg-history-card"><div class="ecg-history-summary">'+(img?'<img src="'+img+'" alt="ECG '+n+'">':'<span>ECG '+n+'</span>')+'<div><strong>ECG '+String(n).padStart(2,"0")+' · Submitted</strong><p class="ecg-history-score '+(r.score===r.total?"perfect":"")+'">'+(r.score===r.total?'🏆 Perfect interpretation':'✓ Score: '+r.score+'/'+r.total+' · '+Math.max(0,r.total-r.score)+' incorrect')+'</p><small>⏱ '+fmtDuration(r.duration_seconds)+'</small><button type="button" class="btn secondary ecg-history-export" data-ecg-history-export="'+n+'">✒️ Sign and export report</button></div></div><details><summary>View commentary, ECG and timings</summary><div class="ecg-history-expanded">'+(img?'<img class="ecg-history-full" src="'+img+'" alt="Full ECG '+n+'">':'')+'<h4>Step 10 · Final diagnosis</h4><p class="ecg-diagnosis-readout">'+esc(r.final_diagnosis||"Not recorded")+'</p>'+(r.extra_notes?'<h4>Additional notes</h4><p class="ecg-diagnosis-readout">'+esc(r.extra_notes)+'</p>':'')+'<button type="button" class="ecg-validation-link" data-ecg-review="'+n+'">'+(r.review?.status==="validated"?"✅ Final diagnosis validated by Dr. Mohamed Alaa":r.review?.status==="needs_revision"?"🔄 Diagnosis review · Revision requested":"🕒 Final diagnosis awaiting Dr. Mohamed Alaa’s review")+' ↗</button>'+(r.review?.feedback?'<p class="ecg-review-feedback">'+esc(r.review.feedback)+'</p>':'')+'<h4>Your ECG commentary</h4><div class="ecg-history-comments">'+lines+'</div></div></details></article>'
 }).join("");
 // Continue with the next eligible ECG without revealing the introductory photograph.
 area.querySelector("#ecgReturnStart")?.addEventListener("click",()=>document.getElementById("ecgStart")?.click());
 area.querySelectorAll("[data-ecg-review]").forEach(btn=>btn.addEventListener("click",()=>{const report=byCase.get(Number(btn.dataset.ecgReview));if(report)openEcgClinicalReview(report)}));
 // Export from a previous completed attempt without restarting it or changing saved progress.
 area.querySelectorAll("[data-ecg-history-export]").forEach(button=>button.addEventListener("click",async()=>{
  const caseNumber=Number(button.dataset.ecgHistoryExport);
  const report=byCase.get(caseNumber);
  if(!report)return;
  // The branded popup validates an English signature before exporting.
  const signature=await openEcgSignaturePopup(caseNumber);
  if(signature===null)return;
  const original=button.textContent;button.disabled=true;button.textContent="Preparing image…";
  try{
   const blob=await createEcgResultImage(report,signature);
   if(!blob)throw Error("Could not prepare image");
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download="ACL-ECG-"+String(caseNumber).padStart(2,"0")+"-signed-report.png";
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){
   alert(error.message||"Could not export this report.");
  }finally{button.textContent=original;button.disabled=false}
 }));
 if(!document.getElementById("ecgHistoryCommentCSS")){const css=document.createElement("style");css.id="ecgHistoryCommentCSS";css.textContent='.ecg-history-export{margin-top:10px;font-size:13px;padding:8px 12px}.ecg-history-sign{display:flex;align-items:end;flex-wrap:wrap;gap:12px;margin-top:18px;padding:15px;background:#eef7fc;border:1px solid #cfe3ee;border-radius:13px}.ecg-history-sign label{display:grid;gap:5px;flex:1 1 235px;font-weight:750;color:#18476c}.ecg-history-sign input{width:100%;min-width:0;box-sizing:border-box;min-height:43px;background:white;font-size:16px}.ecg-history-sign .btn{min-height:43px}.ecg-history-card .ecg-history-summary{flex-wrap:wrap}.ecg-history-comment-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 80px;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid #e1eaf2;color:#183e5a;line-height:1.55}.ecg-history-comment-main{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;min-width:0}.ecg-history-step-label{display:inline-block;white-space:nowrap;color:#0d5985;font-weight:800;flex:none}.ecg-history-comment-text{min-width:0;overflow-wrap:break-word;word-break:normal}.ecg-history-comment-row b{color:#087b49;font-size:13px}.ecg-history-comment-row b.ecg-history-wrong{color:#c52649}.ecg-history-comment-row time{font-size:13px;color:#45647d}.ecg-history-missing{background:#fff9eb;color:#896c40}.ecg-history-special{color:#ad3e52;font-weight:700}@media(max-width:540px){.ecg-history-comment-row{grid-template-columns:minmax(0,1fr) auto;padding:12px 9px;gap:7px}.ecg-history-comment-row time{grid-column:2;justify-self:end}}';document.head.append(css)}
}

function slots(){
 $("slots").innerHTML=images.map((x,i)=>{const locked=!admin()&&!unlockedEcg.includes(i+1),done=attemptHistory.some(a=>Number(a.case_number)===i+1&&Number(a.score)===Number(a.total)&&Number(a.total)>0);
 const preview=x?'<img class="ecg-tile-preview" src="'+x+'" alt="ECG '+(i+1)+' recording" loading="lazy">':'<span class="ecg-tile-empty" aria-hidden="true">ECG not uploaded</span>';
 return '<button type="button" class="slot '+(slot===i?"current ":"")+(locked?"ecg-locked ":"")+(x?"ecg-has-image":"")+'" data-slot="'+i+'" aria-label="ECG '+(i+1)+(locked?", locked":"")+'"><span class="ecg-tile-art">'+preview+(locked?'<span class="ecg-tile-lock">🔒</span>':x?'<span class="ecg-tile-saved">✓ Saved</span>':'')+'</span><span class="ecg-tile-title">ECG '+String(i+1).padStart(2,"0")+(done?" ✓":"")+'</span></button>'}).join("");
 document.querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>{const chosen=+b.dataset.slot;if(!admin()&&!ecgRetryAllowed&&attemptHistory.some(a=>Number(a.case_number)===chosen+1)){alert("Only one attempt is allowed for ECG "+String(chosen+1).padStart(2,"0")+". Contact the administrator.");return;}if(!admin()&&isEcgCompleted(chosen+1)){alert("You have already completed ECG "+String(chosen+1).padStart(2,"0")+" with 100% accuracy. Please proceed to the next ECG.");return;}if(!admin()&&!unlockedEcg.includes(chosen+1)){alert("Complete ECG "+String(chosen).padStart(2,"0")+" with all answers correct to unlock this ECG.");return;}slot=chosen;document.getElementById("ecgCaseStage").hidden=false;if(!(ecgAttemptOpened&&started))restart();render();build();(admin()&&document.getElementById("ecgAdminOverlay")&&!document.getElementById("ecgAdminOverlay").hidden?document.getElementById("ecgCaseKeyTools"):document.getElementById("ecgCaseStage")).scrollIntoView({behavior:"smooth",block:"start"})})
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
function ecgResolvedKey(q){
 const raw=keys[slot]?.[q.id];
 // Earlier question drafts stored Yes/No even after changing choices to Normal/Abnormal.
 // Interpret the legacy key semantically, without rewriting any database values.
 if(q.type==="choice"&&Array.isArray(q.options)&&q.options.includes("Normal")&&q.options.includes("Abnormal")){
  if(raw==="Yes")return "Normal";
  if(raw==="No")return "Abnormal";
 }
 return raw;
}
function ecgQuestionComment(q,answer){
 const v=Array.isArray(answer)?answer.map(ecgReadableYesNo).join(", "):ecgReadableYesNo(answer);
 const lower=String(v).trim().toLowerCase();
 const yes=lower==="yes",no=lower==="no";
 const wording=String(q.text||"").toLowerCase();
 const title=String(q.title||"").trim();
 if(String(q.number||"").match(/^\d+/)?.[0]==="6"){
  if(/r.wave progression/.test(wording))return yes?"Normal R-wave progression":no?"Abnormal R-wave progression":("R-wave progression: "+v);
  if(/pathological q wave/.test(wording)&&/lead/.test(wording))return "Pathological Q waves in "+v;
  if(/pathological q wave/.test(wording))return yes?"Pathological Q waves present":no?"No pathological Q waves":"Pathological Q waves: "+v;
  if(/normal duration|qrs duration/.test(wording))return yes||lower==="normal"?"Normal QRS duration":no||lower==="abnormal"?"Prolonged QRS duration":"QRS duration: "+v;
  if(/qrs amplitude|voltage amplitude/.test(wording))return lower==="normal"?"Normal QRS amplitude":lower==="abnormal"?"Abnormal QRS amplitude":"QRS amplitude: "+v;
  if(/voltage criteria/.test(wording))return lower==="normal"?"Normal QRS voltage":"QRS voltage criteria: "+v;
  if(/morphology/.test(wording))return "QRS morphology: "+v;
 }
 if(q.type==="number")return title+": "+v+(q.unit?" "+q.unit:"");
 if(yes||no)return (q.text||title).replace(/[?\s]+$/,"")+": "+(yes?"Yes":"No");
 return (title&&title.toLowerCase()!=="qrs"?title:q.text||title)+": "+v;
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
  const line=custom||numberCustom||(phrases[q.id]?phrases[q.id](v):ecgQuestionComment(q,v));
  const group=String(q.number||"").match(/^\d+/)?.[0]||String(q.number||"");
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push({line:line.replace(/[.\\s]+$/,""),wrong:stepTiming[q.id]?.correct===false});
 });
 const prRows=completed.filter(q=>String(q.number||"").match(/^\d+/)?.[0]==="5");
 if(groups.has("5")&&prRows.length){const summary=ecgPrSummary(prRows,answers);if(summary)groups.set("5",[{line:summary.replace(/\\.$/,""),wrong:groups.get("5").some(item=>item.wrong)}]);}
 const cleanComment=text=>String(text||"").replace(/\baxi\b/gi,"axis").replace(/\s+([,.;])/g,"$1").replace(/,\s*,+/g,",").replace(/\.{2,}/g,".").trim();
 const statements=[...groups].map(([group,items])=>'<div class="ecg-comment-line '+(items.some(item=>item.wrong)?"ecg-comment-incorrect":"ecg-comment-correct")+'"><span class="ecg-comment-index">Step '+esc(group)+'</span><span>'+esc(cleanComment(items.map(item=>item.line).join(", ")).replace(/[.\s]+$/,""))+'.</span></div>');
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
 reference.hidden=!ecgAttemptOpened||ecgFinishInProgress||!images[slot]||panel.classList.contains("hidden")||ecgReferenceMode==="demand";
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
 document.getElementById("ecgIntro").hidden=ecgAttemptOpened||!ecgProgressChecked||(ecgProgressVerified&&attemptHistory.some(a=>Number(a.total)>0));
 document.getElementById("ecgSelector").hidden=ecgAttemptOpened;
 $("questionPanel").classList.toggle("hidden",!ecgAttemptOpened);
 if(!ecgAttemptOpened){$("complete").classList.add("hidden");$("questionPanel").classList.add("hidden");syncEcgReference();return;}
 if(ecgFinishInProgress){$("questionPanel").classList.add("hidden");syncEcgReference();return;}
 slots();$("imageArea").innerHTML=images[slot]?'<img alt="Uploaded ECG" src="'+images[slot]+'">':'<span class="muted">Upload an ECG image to begin.</span>';
 const ready=!!images[slot]&&questions.length>0;$("questionPanel").classList.toggle("hidden",!ready);$("complete").classList.add("hidden");if(!ready){syncEcgReference();return;}
 syncEcgReference();
 const qs=path(),q=qs[index];
 if($("ecgEmergencyLaunch"))$("ecgEmergencyLaunch").hidden=!(q&&index===0&&!Object.keys(answers).length&&!emergencyDiagnosis&&!ecgStepReview);
 const reviewBox=document.getElementById("ecgStepReviewBox");if(reviewBox)reviewBox.hidden=!ecgStepReview;
 if(ecgStepReview){renderEcgStepReview();return;}
 if(!q){renderFinalDiagnosisStep();return}
 const peekThumb=$("peekEcg");if(peekThumb){peekThumb.hidden=ecgReferenceMode==="fixed";const realImage=images[slot];peekThumb.querySelector(".ecg-mini-real")?.remove();peekThumb.querySelectorAll("svg:not(.eye-icon)").forEach(el=>el.style.display=realImage?"none":"");if(realImage){const thumb=document.createElement("img");thumb.className="ecg-mini-real";thumb.alt="ECG thumbnail";thumb.src=realImage;peekThumb.prepend(thumb)}}
 let previousGroup=document.getElementById("ecgPreviousGroup");
 if(!previousGroup){previousGroup=document.createElement("div");previousGroup.id="ecgPreviousGroup";$("question").parentElement.parentElement.insertBefore(previousGroup,$("question").parentElement);}
 const groupId=String(q.number||"").match(/^\d+/)?.[0]||String(q.number||"");
 const earlier=qs.slice(0,index).filter(item=>(String(item.number||"").match(/^\d+/)?.[0]||String(item.number||""))===groupId);
 previousGroup.innerHTML=earlier.map(item=>{
  const value=answers[item.id],display=Array.isArray(value)?value.join(", "):String(value??"");
  return '<div class="ecg-previous-branch"><div class="ecg-previous-title">Step '+esc(item.number)+' · '+esc(item.title)+' <span class="ecg-previous-locked">✓ Submitted · locked</span></div><div class="ecg-previous-question">'+esc(item.text)+'</div><div class="ecg-previous-answer">Your answer: '+esc(display)+'</div></div>';
 }).join("");
 previousGroup.hidden=!earlier.length;
 $("stepLabel").classList.add("ecg-step-with-title");$("stepLabel").innerHTML="<span>STEP "+esc(q.number)+"</span><span class=\"ecg-step-name\">"+esc(q.title)+"</span>";$("stepLabel").dataset.stepGroup=Number.parseInt(q.number,10)<=3?"red":Number.parseInt(q.number,10)<=5?"green":Number.parseInt(q.number,10)<=7?"blue":"orange";$("stepTitle").textContent=q.title;$("question").textContent=q.text;let multiHint=document.getElementById("ecgMultiChoiceHint");if(!multiHint){multiHint=document.createElement("div");multiHint.id="ecgMultiChoiceHint";multiHint.style.cssText="font-size:13px;color:#637d91;margin:5px 0 14px;font-weight:500";$("question").insertAdjacentElement("afterend",multiHint)}multiHint.textContent=q.multi?"More than one choice is allowed.":"";multiHint.hidden=!q.multi;$("hint").textContent=mode==="practice"?"Interpret the ECG and select your answer.":"Answer without immediate feedback.";$("count").textContent=Object.keys(answers).length+" answered";
 const groupKey=x=>String(x.number||"").match(/^\d+/)?.[0]||String(x.number||"");
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
$("reset").onclick=$("again").onclick=()=>{if(!admin()&&!ecgRetryAllowed){alert("Restarting completed ECG interpretations is disabled by the administrator.");return;}if(!admin()&&isEcgCompleted(slot+1)){ecgAttemptOpened=false;restart();const n=nextAvailableEcg();if(n)slot=n-1;render();return}restart();render()};

function showAnswerFeedback(isCorrect){const panel=$("questionPanel");panel.classList.remove("ecg-result-correct","ecg-result-wrong");void panel.offsetWidth;panel.classList.add(isCorrect?"ecg-result-correct":"ecg-result-wrong");document.querySelectorAll("#choices [data-answer]").forEach(button=>{if(button.dataset.answer===selected){button.classList.add("selected",isCorrect?"ecg-choice-correct":"ecg-choice-wrong");button.setAttribute("aria-label",button.textContent+(isCorrect?" — correct":" — incorrect"));}});$("feedback").className="feedback ecg-answer-animated "+(isCorrect?"good":"bad");$("feedback").innerHTML=isCorrect?'<span class="ecg-feedback-icon">✓</span><strong>Correct!</strong>':'<span class="ecg-feedback-icon">✕</span><strong>Incorrect!</strong><small>Continue interpreting the remaining ECG steps. Your complete report will show all correct and incorrect answers.</small>';document.querySelectorAll("[data-answer]").forEach(button=>button.disabled=true);$("next").disabled=true;}
let failedAttempt=false,elapsedAtFailure=null;
function ecgGroupOf(q){return String(q.number||"").match(/^\d+/)?.[0]||String(q.number||"")}
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
 // Review uses the SAME rendered commentary as the live interpretation.
 updateLiveComment();
 const liveRow=Array.from(document.querySelectorAll("#ecgLiveComment .ecg-comment-line")).find(row=>row.querySelector(".ecg-comment-index")?.textContent.trim()==="Step "+group);
 const liveText=liveRow?.querySelector("span:last-child")?.textContent.trim();
 const comment=liveText||rows.map(q=>statement(q).replace(/[.,;\s]+$/,"")).join(", ")+".";
 const mistakes=rows.filter(q=>stepTiming[q.id]?.correct!==true);
 box.innerHTML='<div class="ecg-review-heading"><span class="ecg-review-icon">'+(allCorrect?"✓":"!")+'</span><div><small>STEP '+esc(group)+' COMPLETED</small><h2>'+esc(label)+'</h2><p>'+good+'/'+rows.length+' correct · Review your interpretation before continuing.</p></div></div>'+
 '<article class="ecg-review-row '+(allCorrect?"ecg-review-ok":"ecg-review-bad")+'"><div class="ecg-review-row-head"><strong>Step '+esc(group)+'</strong><b>'+(allCorrect?"✓ Correct":"✕ "+mistakes.length+" incorrect")+'</b></div><div class="ecg-review-question">'+esc(comment)+'</div></article>'+
 (mistakes.length?'<div class="ecg-review-corrections"><strong>Corrections</strong>'+mistakes.map(q=>'<div class="ecg-review-correction"><b>'+esc(q.text)+'</b><br>Your answer: '+esc(fmt(answers[q.id]))+' · Correct answer: '+esc(fmt(ecgResolvedKey(q)))+'</div>').join("")+'</div>':"")+
 '<button type="button" class="ecg-review-continue" id="ecgReviewContinue">Continue to '+(ecgStepReview.next?"Step "+esc(ecgGroupOf(ecgStepReview.next)):"Step 10 · Final diagnosis")+' →</button>';
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
function renderFinalDiagnosisStep(){
 if(!ecgAttemptOpened||ecgFinishInProgress)return;
 const panel=$("questionPanel");panel.classList.remove("hidden");
 const previous=document.getElementById("ecgStepReviewBox");if(previous)previous.hidden=true;
 $("question").textContent="Step 10 · Final ECG interpretation";$("stepLabel").textContent="STEP 10 · Final diagnosis";
 $("choices").innerHTML="";$("next").classList.add("hidden");$("next").disabled=true;
 $("feedback").className="hidden";
 let form=document.getElementById("ecgFinalDiagnosisForm");
 if(!form){
  form=document.createElement("form");form.id="ecgFinalDiagnosisForm";form.noValidate=true;
  form.innerHTML='<div class="ecg-final-step"><div class="ecg-final-kicker">STEP 10</div><h2>Final diagnosis</h2><label for="ecgDiagnosisText">Your diagnosis</label><textarea id="ecgDiagnosisText" maxlength="1500" required rows="3" placeholder="Write your final ECG diagnosis"></textarea><label for="ecgExtraNotes">Additional notes <span>(optional)</span></label><textarea id="ecgExtraNotes" maxlength="2500" rows="3" placeholder="Additional findings"></textarea><p class="ecg-final-error" id="ecgFinalError" role="alert"></p><button class="btn ecg-final-submit" type="submit">✓ Submit interpretation</button></div>';
  form.addEventListener("submit",ev=>{
   ev.preventDefault();if(ecgFinishInProgress)return;
   const diagnosis=form.querySelector("#ecgDiagnosisText").value.trim(),notes=form.querySelector("#ecgExtraNotes").value.trim();
   if(!diagnosis){form.querySelector("#ecgFinalError").textContent="Enter your final diagnosis.";form.querySelector("#ecgDiagnosisText").focus();return}
   answers._final_diagnosis=diagnosis;answers._extra_notes=notes;
   freezeEcgAttemptClock();void finish();
  });
  if(!document.getElementById("ecgFinalStepCSS")){
   const style=document.createElement("style");style.id="ecgFinalStepCSS";
   style.textContent='#ecgFinalDiagnosisForm{margin:14px 0}.ecg-final-step{border:1px solid #bcdbea;border-radius:18px;background:linear-gradient(145deg,#edf7ff,#fff);padding:20px;display:grid;gap:11px}.ecg-final-kicker{color:#117cbb;letter-spacing:2px;font-size:12px;font-weight:900}.ecg-final-step h2{color:#123f65;margin:0 0 5px}.ecg-final-step label{color:#1b5074;font-weight:800}.ecg-final-step label span{color:#7690a1;font-weight:500}.ecg-final-step textarea{min-height:90px;resize:vertical;font:inherit;border:1px solid #aacddf;border-radius:11px;background:#fff;padding:12px;color:#143f61;width:100%;box-sizing:border-box}.ecg-final-step textarea:focus{outline:3px solid #b1e2f6}.ecg-final-submit{justify-self:start;padding:13px 19px!important}.ecg-final-error{color:#b32745;font-size:13px;margin:0}';
   document.head.appendChild(style);
  }
  panel.appendChild(form);
 }
 form.hidden=false;form.querySelector("#ecgDiagnosisText").focus({preventScroll:true});
 requestAnimationFrame(()=>form.scrollIntoView({behavior:"smooth",block:"nearest"}));
}
function submitAnswer(){
 const q=path()[index];if(!q||(Array.isArray(selected)?selected.length===0:selected==="")||checked||submitting)return;
 const value=Array.isArray(selected)?[...selected]:selected,k=ecgResolvedKey(q);
 if(k===undefined||k===""||(q.multi&&(!Array.isArray(k)||!k.length))||(q.type==="number"&&(!k||k.min===""||k.max===""||k.min===undefined||k.max===undefined))){
  $("feedback").className="feedback bad";$("feedback").textContent="Answer key unavailable. Ask the administrator to configure this ECG.";return;
 }
 checked=true;answers[q.id]=value;
 const isCorrect=correct(q,value);recordStep(q,isCorrect);updateLiveComment();showAnswerFeedback(isCorrect);
 if(!isCorrect)wrongCount++;
 // The clock remains running through Step 10 and freezes at the final submit.
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
 if(ecgFinishInProgress)return;ecgFinishInProgress=true;freezeEcgAttemptClock();
 document.getElementById("ecgIntro").hidden=true;document.getElementById("ecgSelector").hidden=true;
 clearInterval(timer);timer=null;$("questionPanel").classList.add("hidden");$("complete").classList.remove("hidden");syncEcgReference();
 const duration=elapsedAtFailure??seconds();
 const completedSteps=Object.values(stepTiming);const scoreLocal=completedSteps.filter(x=>x.correct).length;const report={case_number:slot+1,mode,created_at:new Date().toISOString(),duration_seconds:duration,score:scoreLocal,total:completedSteps.length,steps:completedSteps,emergency_diagnosis:emergencyDiagnosis,final_diagnosis:String(answers._final_diagnosis||""),extra_notes:String(answers._extra_notes||""),commentary:[...(emergencyDiagnosis==="stemi"?["Immediate diagnosis: STEMI suspected — continued full ECG interpretation."]:[]),...Array.from(document.querySelectorAll("#ecgLiveComment .ecg-comment-line")).map(el=>el.textContent.trim())]};
 try{const history=JSON.parse(localStorage.getItem("acl-ecg-step-reports-v1")||"[]");history.unshift(report);localStorage.setItem("acl-ecg-step-reports-v1",JSON.stringify(history.slice(0,200)));}catch(e){console.warn("Could not persist local ECG report",e)}
 $("summary").textContent="ECG "+(slot+1)+" · "+mode.toUpperCase()+" · "+Math.floor(duration/60)+"m "+duration%60+"s";
 $("result").textContent="Saving your complete ECG interpretation securely…";renderAttemptReport(report);showEcgCompletionHero(report,false);
 requestAnimationFrame(()=>requestAnimationFrame(()=>$("ecgCompletionBanner")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"})));
 try{
  const saved=await attemptRequest("POST",{action:"submit_attempt",case_number:slot+1,mode,answers,duration_seconds:duration,mistakes:wrongCount,step_details:report.steps,commentary:report.commentary});
  const passed=wrongCount===0&&saved.passed;
  showEcgCompletionHero(report,passed);
  requestAnimationFrame(()=>$("ecgCompletionBanner")?.scrollIntoView({behavior:"smooth",block:"start"}));
  if(passed&&saved.unlocked_next&&!unlockedEcg.includes(saved.unlocked_next))unlockedEcg.push(saved.unlocked_next);
  await refreshAttemptProgress();
  attemptHistory.unshift({case_number:slot+1,score:saved.score,total:saved.total});
  slots();
  $("summary").textContent+=" · Score "+saved.score+"/"+saved.total;
  $("result").textContent=passed?"Wonderful work! Your perfect interpretation has been saved. Review your detailed report below, then continue to the next ECG.":wrongCount>0?"Your full interpretation has been saved. Review the incorrect steps and try again.":"Your attempt has been saved. Keep practising to achieve a perfect interpretation.";
 }catch(error){$("result").innerHTML="⚠ Attempt not saved to Neon: "+esc(error.message)+". Your step-by-step report remains available locally. <button type=\"button\" class=\"btn\" id=\"retryEcgSave\">↻ Retry saving</button>";$("retryEcgSave").onclick=()=>retrySaveAttempt(report);}
}

function showEcgCompletionHero(report,passed){
 const panel=$("complete");if(!panel)return;
 renderPreviousEcgResults();
 let banner=document.getElementById("ecgCompletionBanner");if(!banner){banner=document.createElement("div");banner.id="ecgCompletionBanner";panel.prepend(banner)}
 const mistakes=(report.steps||[]).filter(x=>x.correct===false).length;
 const mastered=(report.total>0&&mistakes===0&&report.score===report.total);
 panel.classList.toggle("ecg-completion-passed",mastered);
 const duration=fmtDuration(report.duration_seconds),minutes=Number(report.duration_seconds||0)/60;
 const timeText=minutes>=1?(Math.floor(minutes)+" min "+String(Math.round(Number(report.duration_seconds||0)%60)).padStart(2,"0")+" sec"):(Math.round(Number(report.duration_seconds||0))+" seconds");
 const feedback=mastered
  ?{icon:"🏆",kicker:"CONGRATULATIONS!",headline:"YOU MASTERED ECG "+String(report.case_number).padStart(2,"0")+" in "+timeText+"!",detail:"Without a single mistake. Get ready for more practice!"}
  :mistakes<=2
   ?{icon:"🎯",kicker:"ALMOST THERE",headline:"You were close. Try again!",detail:"Only "+mistakes+" mistake"+(mistakes===1?"":"s")+". Review your answers and give it another try."}
   :mistakes<=5
    ?{icon:"📚",kicker:"KEEP IMPROVING",headline:"Revise more, practice more!",detail:"You made "+mistakes+" mistakes. Review the highlighted steps, then try again."}
    :mistakes<=8
     ?{icon:"💪",kicker:"KEEP PRACTISING",headline:"Keep going — practice makes progress!",detail:"You made "+mistakes+" mistakes. Revise the key ECG concepts and try again."}
     :{icon:"🌱",kicker:"NEVER GIVE UP",headline:"Never lose hope — it's all about practice!",detail:"Every attempt builds your ECG interpretation skills. Review the steps and keep practising."};
 banner.innerHTML='<div class="ecg-hero-glow"></div><div class="ecg-hero-graphic" aria-hidden="true">'+feedback.icon+'</div><div class="ecg-completion-kicker">✦ '+feedback.kicker+'</div><h2>'+esc(feedback.headline)+'</h2><p>'+esc(feedback.detail)+'</p><p class="ecg-review-disclaimer">🩺 Your final diagnosis and additional comments will still be reviewed and validated by Dr. Mohamed Alaa.</p><div class="ecg-completion-meter" role="img" aria-label="'+report.score+' of '+report.total+' assessments correct"><div style="width:'+Math.max(0,Math.min(100,100*report.score/Math.max(1,report.total)))+'%"></div></div><div class="ecg-completion-metrics"><span>🫀 ECG '+report.case_number+'</span><span>✓ '+report.score+'/'+report.total+' correct</span><span>⏱ '+duration+'</span></div>';

 let next=document.getElementById("ecgCompletionNext");if(!next){next=document.createElement("button");next.id="ecgCompletionNext";next.className="btn";next.type="button";banner.after(next)}
 const nextUnlocked=passed?nextAvailableEcg():null;
 next.hidden=!nextUnlocked;next.disabled=!nextUnlocked;next.textContent=nextUnlocked?"Continue to ECG "+String(nextUnlocked).padStart(2,"0")+" →":"🔒 Next ECG not available";
 next.onclick=()=>{const n=nextAvailableEcg();if(!n)return;ecgAttemptOpened=false;restart();slot=n-1;render();document.getElementById("ecgCaseStage")?.scrollIntoView({behavior:"smooth",block:"start"})};
 const again=$("again");panel.classList.toggle("ecg-retry-disabled",!admin()&&!ecgRetryAllowed);if(again){again.hidden=!admin()&&(!!passed||!ecgRetryAllowed);again.textContent=passed&&admin()?"↻ Try this ECG again (admin)":"↻ Restart interpretation"}
 if(!document.getElementById("ecgCompletionCSS")){const css=document.createElement("style");css.id="ecgCompletionCSS";css.textContent=`
 #ecgCompletionBanner{position:relative;overflow:hidden;background:linear-gradient(125deg,#063957,#076ca8);border-radius:19px;color:white;padding:24px;margin-bottom:14px;box-shadow:0 12px 25px #0a4a7524}
 #ecgCompletionBanner{scroll-margin-top:90px}
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
 #ecgCompletionBanner .ecg-review-disclaimer{background:#ffffff20;border:1px solid #ffffff50;border-radius:11px;padding:12px 14px;margin-top:13px;font-weight:750;line-height:1.5;color:#fff}
 .ecg-completion-metrics{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
 .ecg-completion-metrics span{background:#ffffff24;border:1px solid #ffffff55;border-radius:11px;padding:10px 14px;font-weight:750}
 #complete.ecg-completion-passed #again,#complete.ecg-retry-disabled #again{display:none!important}
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
async function createEcgResultImage(report,signatureValue){
  const W=1120,pad=76;
  const sig=String(signatureValue||"").trim().replace(/\s+/g," ");
  if(sig&&!/^[A-Za-z][A-Za-z .'-]{0,69}$/.test(sig)){
   throw Error("Please enter a signature using English letters only.");
  }
  const ecg=images[report.case_number-1];
  const image=await new Promise(resolve=>{if(!ecg)return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=ecg});
  const imgW=W-2*pad,imgH=image?Math.min(230,Math.round(image.height/image.width*imgW)):0;
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
  const font=(size,weight=500,family="Arial, sans-serif")=>weight+" "+size+"px "+family;
  const wrapText=(value,maxWidth,size=18,weight=500)=>{
   ctx.font=font(size,weight);
   const words=String(value).split(/\s+/).filter(Boolean),lines=[];
   let line="";
   for(const word of words){
    const next=line?line+" "+word:word;
    if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}
    else line=next;
   }
   if(line)lines.push(line);
   return lines.length?lines:[""];
  };
  const text=(v,x,y,size,color="#183e5b",weight=500,family="Arial, sans-serif")=>{
   ctx.fillStyle=color;ctx.font=font(size,weight,family);ctx.fillText(String(v),x,y);
  };
  const rounded=(x,y,w,h,r,color)=>{
   ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  };
  const rawComments=Array.isArray(report.commentary)?report.commentary:[];
  const special=rawComments.filter(raw=>!/^\s*(?:✓|✕|✔|✗)?\s*Step\s*\d+/i.test(String(raw)));
  const numbered=rawComments.map((raw,i)=>{
   const parsed=parseEcgStoredComment(raw);
   return {raw:String(raw),parsed,index:i};
  }).filter(row=>Number.isInteger(row.parsed.step)).sort((a,b)=>a.parsed.step-b.parsed.step||a.index-b.index);
  const rows=numbered.map(({parsed})=>{
   const step=String(parsed.step);
   const normalized=parsed.text;
   const lines=wrapText(normalized,W-2*pad-175,18);
   const h=Math.max(62,lines.length*27+27);
   const wrong=report.steps?.some(item=>String(item.number||"").match(/^\d+/)?.[0]===step&&item.correct===false)||false;
   return {step,lines,h,wrong};
  });
  // Step 10 is an unscored clinical interpretation requiring instructor validation.
  const diagnosis=String(report.final_diagnosis||report.answers?._final_diagnosis||"").trim();
  const extra=String(report.extra_notes||report.answers?._extra_notes||"").trim();
  if(diagnosis){
   const lines=wrapText("Final diagnosis: "+diagnosis,W-2*pad-175,18);
   rows.push({step:"10",lines,h:Math.max(62,lines.length*27+27),wrong:false});
   if(extra){
    const notesLines=wrapText("Additional notes: "+extra,W-2*pad-175,18);
    rows.push({step:"10",lines:notesLines,h:Math.max(62,notesLines.length*27+27),wrong:false});
   }
  }
  const headerH=138,statsH=81,ecgBlockH=imgH?imgH+47:0;
  const notesH=special.length?special.length*40+18:0;
  const rowH=rows.reduce((sum,r)=>sum+r.h+8,0);
  const commentaryY=54+headerH+statsH+ecgBlockH+notesH;
  const footerH=165;
  const height=commentaryY+66+rowH+footerH;
  canvas.width=W*2;canvas.height=height*2;ctx.scale(2,2);
  ctx.fillStyle="#f0f6fb";ctx.fillRect(0,0,W,height);
  rounded(26,26,W-52,height-52,19,"#ffffff");
  rounded(26,26,W-52,headerH,16,"#0a4267");
  text("CARDIOLOGY LEAGUE  /  ECG INTERPRETATION LAB",pad,81,19,"#c4e6fa",750);
  text("ECG "+String(report.case_number).padStart(2,"0")+"  ·  INTERPRETATION",pad,129,32,"#ffffff",800);
  const accuracy=Math.round(report.score/Math.max(1,report.total)*100);
  text(accuracy+"% correct",pad,211,24,"#118251",800);
  const time="Time taken: "+fmtDuration(report.duration_seconds);
  text(time,W-pad-ctx.measureText(time).width,211,19,"#234f70",700);
  let y=245;
  if(image){
   const displayW=Math.min(imgW,imgH*(image.width/image.height));
   ctx.drawImage(image,(W-displayW)/2,y,displayW,imgH);
   y+=imgH+36;
  }
  for(const raw of special){
   text(String(raw).replace(/\s+/g," ").slice(0,110),pad,y,17,"#a63c48",700);
   y+=40;
  }
  text("YOUR ECG COMMENTARY",pad,y+4,24,"#0c4569",800);
  y+=40;
  ctx.strokeStyle="#cfe3ef";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();
  y+=20;
  for(const row of rows){
   rounded(pad-7,y-19,W-2*pad+14,row.h,11,row.wrong?"#fff1f4":"#f3f9fd");
   rounded(pad-7,y-19,5,row.h,2,row.wrong?"#ca2b4a":"#1a925f");
   text("STEP "+row.step,pad+15,y+7,16,"#0e5781",800);
   row.lines.forEach((line,index)=>text(line,pad+136,y+7+index*27,18,"#193c55",500));
   y+=row.h+8;
  }
  ctx.strokeStyle="#b8d5e6";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,height-footerH+5);ctx.lineTo(W-pad,height-footerH+5);ctx.stroke();
  text("Interpretation signed by",pad,height-footerH+43,17,"#607e92",600);
  if(sig){
   text(sig,pad,height-footerH+92,36,"#183a5c",400,'"Brush Script MT","Segoe Script","Comic Sans MS",cursive');
   text(sig,pad,height-footerH+121,14,"#678196",500);
  }else text("Unsigned",pad,height-footerH+88,20,"#8a9dad",500);
  text("ACL ECG Interpretation Lab",W-pad-245,height-66,15,"#67869a",700);
  return new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
}

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

 const byStep=new Map();
 for(const q of (report.steps||[])){
  const n=Number(String(q.number??"").match(/^\d+/)?.[0]);
  if(!Number.isInteger(n)||n<1||n>99)continue;
  if(!byStep.has(n))byStep.set(n,[]);
  byStep.get(n).push(q);
 }
 const comments=new Map();
 for(const raw of (report.commentary||[])){
  const parsed=parseEcgStoredComment(raw);
  if(Number.isInteger(parsed.step)&&parsed.text)comments.set(parsed.step,parsed.text);
 }
 const stepNames={1:"Calibration & recording",2:"Rhythm & heart rate",3:"Electrical axis",4:"P waves",5:"PR interval",6:"QRS complex",7:"T waves",8:"PR / ST segments",9:"QT interval"};
 const stepCards=[...byStep.entries()].sort(([a],[b])=>a-b).map(([n,items])=>{
  const correctCount=items.filter(x=>x.correct===true).length,bad=items.length-correctCount;
  const summary=comments.get(n)||"Completed step "+n;
  const secs=items.reduce((sum,x)=>sum+Math.max(0,Number(x.seconds)||0),0);
  const breakdown=items.map(x=>'<div class="ecg-breakdown-question"><span>'+esc(x.title||x.number||"Assessment")+'</span><span class="'+(x.correct?"ok":"no")+'">'+(x.correct?"✓ Correct":"✕ Incorrect")+'</span></div>').join("");
  return '<article class="ecg-result-step '+(bad?"ecg-result-wrong":"ecg-result-right")+'"><div class="ecg-result-step-number">'+String(n).padStart(2,"0")+'</div><div class="ecg-result-step-body"><div class="ecg-result-step-heading"><strong>'+esc(stepNames[n]||"ECG assessment")+'</strong><span class="ecg-result-pill '+(bad?"no":"ok")+'">'+(bad?"✕ "+bad+" incorrect":"✓ Perfect")+'</span></div><p>'+esc(summary)+'</p><details class="ecg-result-breakdown" '+(bad?"open":"")+'><summary>'+items.length+' question'+(items.length===1?"":"s")+' · '+correctCount+' correct · ⏱ '+fmtDuration(secs)+'</summary>'+breakdown+'</details></div></article>';
 }).join("");
 if(!document.getElementById("ecgResultCardsCSS")){
  const style=document.createElement("style");style.id="ecgResultCardsCSS";style.textContent=
   '#ecgAttemptReport{overflow:visible!important;scroll-margin-top:90px}'+
   '#ecgAttemptReport>h3{font-size:clamp(22px,3vw,30px);color:#133d62;margin:14px 0 6px}'+
   '.ecg-result-grid{display:grid;gap:9px;margin:16px 0 20px}'+
   '.ecg-result-step{display:flex;gap:12px;align-items:start;border:1px solid #d5e5ef;border-left:5px solid #12a476;border-radius:15px;background:linear-gradient(100deg,#f0fcf8,#fff);padding:12px 14px;box-shadow:0 3px 14px #153e5c0c}'+
   '.ecg-result-step.ecg-result-wrong{border-left-color:#ee5370;background:linear-gradient(100deg,#fff3f6,#fff)}'+
   '.ecg-result-step-number{background:linear-gradient(145deg,#1269b0,#159ed1);color:white;border-radius:11px;flex:0 0 43px;width:43px;height:42px;display:grid;place-items:center;font-size:18px;font-weight:900}'+
   '.ecg-result-step-body{flex:1;min-width:0}'+
   '.ecg-result-step-heading{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap;color:#124566;font-size:16px}'+
   '.ecg-result-pill{border-radius:100px;padding:5px 9px;font-size:11px;font-weight:800;white-space:nowrap}'+
   '.ecg-result-pill.ok{background:#d9f8e8;color:#067d4a}.ecg-result-pill.no{background:#ffe1e8;color:#b12646}'+
   '.ecg-result-step p{margin:7px 0 5px;color:#23475d;font-size:14px;line-height:1.55;overflow-wrap:break-word}'+
   '.ecg-result-breakdown{font-size:12px;color:#648097}'+
   '.ecg-result-breakdown summary{cursor:pointer;font-weight:650;width:fit-content;padding:4px 0}'+
   '.ecg-breakdown-question{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #dbe7ef;padding:6px 0;color:#294d65}'+
   '.ecg-breakdown-question span:last-child{flex:none;font-weight:800}.ecg-breakdown-question .ok{color:#0b8755}.ecg-breakdown-question .no{color:#b42543}'+
   '@media(max-width:540px){.ecg-result-step{padding:10px;gap:9px}.ecg-result-step-number{flex-basis:36px;width:36px;height:36px;font-size:15px}.ecg-result-step-heading{font-size:14px}.ecg-result-step p{font-size:13px}}';
  document.head.appendChild(style);
 }
 panel.innerHTML='<h3>⚡ Your ECG interpretation breakdown</h3><p class="ecg-result-subtitle">ECG '+String(report.case_number).padStart(2,"0")+' · ⏱ '+fmtDuration(report.duration_seconds)+' · '+report.score+'/'+report.total+' correct</p><div class="ecg-result-grid">'+stepCards+'<article class="ecg-result-step"><div class="ecg-result-step-number">10</div><div class="ecg-result-step-body"><div class="ecg-result-step-heading"><strong>Final diagnosis</strong><span class="ecg-result-pill">Awaiting review</span></div><p>'+esc(report.final_diagnosis||"Not submitted")+'</p>'+(report.extra_notes?'<p><strong>Additional notes:</strong> '+esc(report.extra_notes)+'</p>':'')+'</div></article></div>';

 const shareActions=document.createElement("div");shareActions.className="ecg-report-actions";
 shareActions.innerHTML='<button type="button" class="btn" id="ecgExportResult">✒️ Sign &amp; export report</button>';
 panel.prepend(shareActions);
 shareActions.querySelector("#ecgExportResult").onclick=async()=>{
  const signature=await openEcgSignaturePopup(report.case_number);
  if(signature===null)return;
  const button=shareActions.querySelector("#ecgExportResult"),label=button.textContent;
  button.disabled=true;button.textContent="Preparing report…";
  try{
   const blob=await createEcgResultImage(report,signature);
   if(!blob)throw Error("Report unavailable");
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download="ACL-ECG-"+String(report.case_number).padStart(2,"0")+"-signed-report.png";
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){alert(error.message||"Export unsuccessful")}
  finally{button.textContent=label;button.disabled=false}
 };

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
function nextEcgNumber(){return admin()?(availableEcgCases.has(slot+1)?slot+1:nextAvailableEcg()):nextAvailableEcg()}
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
  if(upcoming===null)throw Error(ecgRetryAllowed?"Congratulations! You have completed all available ECGs with 100% accuracy.":"No additional ECG attempt is available under the current one-attempt policy. Contact your administrator.");
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
