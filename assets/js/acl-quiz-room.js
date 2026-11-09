
const $=id=>document.getElementById(id);
const KEY="acl-quiz-room-preview-v1";
let candidateName="";
const defaults={settings:{count:10,seconds:60,published:false,order:"manual"},questions:[]};
let db;try{db=JSON.parse(localStorage.getItem(KEY))||structuredClone(defaults)}catch{db=structuredClone(defaults)}
let current=null,idx=0,queue=[],chosen=-1,violations=0,penalty=0,remaining=0,timer=null,running=false,completed=false,correctCount=0,answerLog=[];
const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch(e){alert("Browser storage is full. Use smaller images. Changes could not be saved.");return false}};
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const makeId=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const show=section=>["welcome","play","results","editor"].forEach(id=>$(id).hidden=id!==section);
const zoom=url=>{if(!url)return;$("zoomImage").src=url;$("zoom").hidden=false};
$("closeZoom").onclick=()=>{$("zoom").hidden=true;$("zoomImage").style.transform="scale(1)"};
$("zoom").onclick=e=>{if(e.target===$("zoom"))$("closeZoom").click();else if(e.target.tagName==="IMG"){e.target.style.transform=e.target.style.transform==="scale(2)"?"scale(1)":"scale(2)"}};
document.addEventListener("click",e=>{const img=e.target.closest("img[data-zoom]");if(img)zoom(img.src)});
async function identity(){
 const studioRequested=new URLSearchParams(location.search).get("studio")==="1";
 const status=$("welcomeStatus");
 try{
  const {supabaseClient}=await import("./supabase-client.js");
  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error)throw error;
  const email=String(session?.user?.email||"").trim().toLowerCase();
  if(!session?.user){
   if(studioRequested){show("welcome");status.innerHTML='Admin sign-in required. <a href="login.html">Sign in using your existing ACL password</a>, then reopen the Studio link.';}
   return;
  }
  if(email!=="drmohamedalaa90@gmail.com"){
   if(studioRequested){show("welcome");status.textContent="Access denied: the Question Studio is restricted to the ACL administrator account.";}
   return;
  }
  $("editToggle").hidden=false;
  $("editToggle").onclick=()=>{$("editor").hidden?openEditor():show("welcome")};
  if(studioRequested)openEditor();
 }catch(e){
  console.warn("Quiz admin verification unavailable",e);
  if(studioRequested){show("welcome");status.textContent="Unable to verify your ACL admin session. Please sign in to ACL and retry.";}
 }
}
identity();
$("openStudioNow")?.addEventListener("click",async()=>{const status=$("studioEntryStatus");status.textContent="Checking your ACL administrator session…";try{const {supabaseClient}=await import("./supabase-client.js");const {data:{session},error}=await supabaseClient.auth.getSession();if(error)throw error;if(!session?.user){status.innerHTML='Please <a href="login.html">sign in to ACL</a> with your existing administrator password, then return here.';return;}if(String(session.user.email||"").toLowerCase()!=="drmohamedalaa90@gmail.com"){status.textContent="Only the ACL administrator account may open Question Studio.";return;}openEditor();status.textContent="";}catch(e){status.textContent="Could not verify your ACL login. Please sign in again.";}});

function openEditor(){
  $("quizCount").value=db.settings.count;$("defaultTime").value=db.settings.seconds;$("quizPublished").value=String(!!db.settings.published);$("quizOrder").value=db.settings.order;
  show("editor");renderQuestionList();if(current)loadQuestion(current);
}
$("saveSettings").onclick=()=>{
 db.settings={count:Math.max(1,Math.min(300,Number($("quizCount").value)||10)),seconds:Math.max(5,Number($("defaultTime").value)||60),published:$("quizPublished").value==="true",order:$("quizOrder").value};
 if(store())$("editorStatus").textContent="Saved locally in this browser ✓";
};
const blank=()=>({id:makeId(),text:"",image:"",answers:[{text:"",image:""},{text:"",image:""},{text:"",image:""},{text:"",image:""}],correct:0,difficulty:"Moderate",timerEnabled:true,seconds:60,explanation:""});
function renderQuestionList(){
 const list=$("questionList");list.innerHTML=db.questions.length?db.questions.map((q,i)=>'<button type="button" class="'+(q.id===current?"active":"")+'" data-q="'+esc(q.id)+'"><b>'+(i+1)+'.</b> '+esc(q.text?.slice(0,55)||"Untitled question")+'<small style="display:block;color:#bfcce3;margin-top:5px">'+esc(q.difficulty)+'</small></button>').join(""):'<div class="empty">No questions yet. Click + Add.</div>';
 list.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>loadQuestion(b.dataset.q));
}
$("addQuestion").onclick=()=>{const q=blank();db.questions.push(q);store();loadQuestion(q.id)};
function getQuestion(){return db.questions.find(q=>q.id===current)}
function preview(container,url){
 $(container).innerHTML=url?'<img class="thumb" data-zoom alt="Image preview" src="'+esc(url)+'"><button type="button" class="secondary" data-remove-image="'+container+'">Remove image</button>':"";
 $(container).querySelector("[data-remove-image]")?.addEventListener("click",()=>{const q=getQuestion();if(container==="qImagePreview"){q.image=""}else{q.answers[Number(container.slice(1))].image=""}store();preview(container,"")})
}
function loadQuestion(id){
 current=id;const q=getQuestion();if(!q)return;
 $("questionFields").hidden=false;$("editQuestionTitle").textContent="Editing question "+(db.questions.indexOf(q)+1);
 $("qText").value=q.text;$("qImageFile").value="";preview("qImagePreview",q.image);
 $("answerFields").innerHTML=q.answers.map((a,i)=>'<div class="panel" style="padding:12px;margin:10px 0"><label class="field">Answer '+("ABCD"[i])+'<textarea id="aText'+i+'" rows="2" required></textarea></label><label class="field">Answer '+("ABCD"[i])+' image<input type="file" accept="image/*" id="aFile'+i+'"></label><div id="a'+i+'"></div></div>').join("");
 q.answers.forEach((a,i)=>{$("aText"+i).value=a.text;preview("a"+i,a.image);$("aFile"+i).onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{a.image=await readImage(file);store();preview("a"+i,a.image)}catch(err){alert(err.message)}}});
 $("correctAnswer").value=q.correct;$("qDifficulty").value=q.difficulty;$("qTimerEnabled").value=String(q.timerEnabled);$("qSeconds").value=q.seconds;$("qExplanation").value=q.explanation;
 renderQuestionList();
}
async function readImage(file){
 if(!file.type.startsWith("image/"))throw Error("Please choose an image file.");
 if(file.size>3*1024*1024)throw Error("Please use an image smaller than 3 MB for this browser preview.");
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("Could not read image"));reader.readAsDataURL(file)});
}
$("qImageFile").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const q=getQuestion();q.image=await readImage(file);store();preview("qImagePreview",q.image)}catch(err){alert(err.message)}};
$("questionForm").onsubmit=e=>{
 e.preventDefault();const q=getQuestion();if(!q)return;
 q.text=$("qText").value.trim();q.answers.forEach((a,i)=>a.text=$("aText"+i).value.trim());
 q.correct=Number($("correctAnswer").value);q.difficulty=$("qDifficulty").value;
 q.timerEnabled=$("qTimerEnabled").value==="true";q.seconds=Math.max(5,Math.min(3600,Number($("qSeconds").value)||60));q.explanation=$("qExplanation").value.trim();
 if(store()){renderQuestionList();$("editQuestionTitle").textContent="✓ Question saved"}
};
$("deleteQuestion").onclick=()=>{const q=getQuestion();if(!q||!confirm("Delete this question?"))return;db.questions=db.questions.filter(x=>x.id!==q.id);current=null;store();$("questionFields").hidden=true;$("editQuestionTitle").textContent="Select a question";renderQuestionList()};
function move(direction){const i=db.questions.findIndex(q=>q.id===current),j=i+direction;if(i<0||j<0||j>=db.questions.length)return;[db.questions[i],db.questions[j]]=[db.questions[j],db.questions[i]];store();renderQuestionList();$("editQuestionTitle").textContent="Editing question "+(j+1)}
$("moveUp").onclick=()=>move(-1);$("moveDown").onclick=()=>move(1);
$("start").onclick=()=>{
 candidateName=String($("candidateName")?.value||"").trim();
 if(candidateName.length<3){$("welcomeStatus").textContent="Enter your full name to continue.";return;}
 try{sessionStorage.setItem("aclQuizCandidateName",candidateName)}catch{}
 if(!$("agree").checked){$("welcomeStatus").textContent="Please accept the integrity rules first.";return}
 if(!db.settings.published){$("welcomeStatus").textContent="Quiz 1 is currently locked by the administrator.";return}
 if(!db.questions.length){$("welcomeStatus").textContent="Quiz 1 has no published questions yet.";return}
 queue=[...db.questions].filter(q=>q.text&&q.answers.every(a=>a.text));
 if(db.settings.order==="random")queue.sort(()=>Math.random()-.5);
 queue=queue.slice(0,Number(db.settings.count)||10);
 if(!queue.length){$("welcomeStatus").textContent="There are no complete questions yet.";return}
 idx=0;violations=0;penalty=0;correctCount=0;answerLog=[];running=true;completed=false;show("play");drawQuestion();
};
function drawQuestion(){
 if(idx>=queue.length)return finish(false);
 const q=queue[idx];chosen=-1;
 $("progressText").textContent="QUESTION "+(idx+1)+" / "+queue.length;
 $("progressFill").style.width=(100*idx/queue.length)+"%";
 $("difficulty").textContent=q.difficulty+" LEVEL";
 $("questionText").innerHTML=esc(q.text)+(q.image?'<img data-zoom alt="Question image" src="'+esc(q.image)+'">':"");
 $("answers").innerHTML=q.answers.map((a,i)=>'<button class="answer" type="button" data-answer="'+i+'"><b>'+("ABCD"[i])+':</b>'+esc(a.text)+(a.image?'<img data-zoom alt="Answer '+("ABCD"[i])+' image" src="'+esc(a.image)+'">':"")+'</button>').join("");
 $("answers").querySelectorAll("button.answer").forEach(b=>b.onclick=e=>{if(e.target.closest("img"))return;chosen=Number(b.dataset.answer);$("answers").querySelectorAll("button.answer").forEach(x=>x.classList.toggle("selected",x===b))});
 $("playStatus").textContent="Choose one answer and confirm.";$("submitAnswer").disabled=false;
 clearInterval(timer);
 if(q.timerEnabled){remaining=Number(q.seconds)||Number(db.settings.seconds)||60;$("timer").textContent="⏱ "+remaining+"s";timer=setInterval(()=>{if(!running)return;remaining--; $("timer").textContent="⏱ "+Math.max(0,remaining)+"s";if(remaining<=0){clearInterval(timer);accept(-1)}},1000)}else{$("timer").textContent="No time limit"}
}
function accept(answer){
 if(!running||completed)return;
 clearInterval(timer);const q=queue[idx];if(answer===q.correct)correctCount++;
 answerLog.push({id:q.id,answer,correct:q.correct});idx++;drawQuestion();
}
$("submitAnswer").onclick=()=>{if(chosen<0){$("playStatus").textContent="Please select an answer.";return}accept(chosen)};
function finish(terminated){
 if(completed)return;
 running=false;completed=true;clearInterval(timer);show("results");
 const total=queue.length;const finalScore=Math.max(0,correctCount-penalty);
 $("resultTitle").textContent=terminated?"Quiz terminated — integrity violation":"Quiz 1 completed";
 $("resultScore").textContent=finalScore+" / "+total;
 $("resultDetails").textContent=correctCount+" correct · "+penalty+" penalty points · "+violations+" screen changes. This is a browser-only preview, not an official recorded score.";
}
function violation(){
 if(!running||completed||Date.now()-lastScreenExit<1400)return;
 lastScreenExit=Date.now();
 violations++;$("violations").textContent="Screen changes: "+violations+"/4";
 if(violations===2)penalty+=1;
 if(violations===3)penalty+=3;
 if(violations>=4){finish(true);return}
 $("playStatus").textContent=violations===1?"⚠ First screen change: warning.":violations===2?"⚠ Second screen change: −1 point.":"⚠ Third screen change: additional −3 points (−4 total).";
}
let hiddenRecorded=false,lastScreenExit=0;
document.addEventListener("visibilitychange",()=>{if(document.hidden){hiddenRecorded=true;violation()}else hiddenRecorded=false});
window.addEventListener("blur",()=>{if(!document.hidden&&!hiddenRecorded){hiddenRecorded=true;violation()}});
window.addEventListener("focus",()=>{hiddenRecorded=false});
window.addEventListener("beforeunload",e=>{if(running){e.preventDefault();e.returnValue=""}});

try{const saved=sessionStorage.getItem("aclQuizCandidateName");if(saved&&$("candidateName"))$("candidateName").value=saved}catch{}
