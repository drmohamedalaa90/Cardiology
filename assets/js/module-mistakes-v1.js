import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const esc = (v="") => String(v).replace(/[&<>'"]/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
}[c]));

const params = new URLSearchParams(location.search);
const moduleId = params.get("module");
const edition = params.get("edition") === "basic" ? "basic" : "expert";

let moduleRow = null;
let mistakes = [];

function timeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error(`${label} timed out`)),ms))
  ]);
}

function parseQuizSlug(launchPath){
  try{
    return new URL(launchPath, location.href).searchParams.get("quiz");
  }catch{
    return null;
  }
}

function questionId(answer){
  return answer?.question_id ?? answer?.questionId ?? answer?.id ?? null;
}

function render(){
  const filter = $("mistakesFilter").value;

  let rows = mistakes;

  if(filter === "high-confidence"){
    rows = rows.filter(x => x.confidence === "high");
  }else if(filter === "repeated"){
    rows = rows.filter(x => x.count > 1);
  }

  $("mistakesCount").textContent =
    `${rows.length} mistake${rows.length===1?"":"s"}`;

  const high = mistakes.filter(x=>x.confidence==="high").length;
  $("mistakesPriority").textContent =
    high ? `${high} high-confidence misconception${high===1?"":"s"} need priority review` : "";

  $("mistakesGrid").innerHTML = rows.length
    ? rows.map((m,index)=>`
      <article class="module-mistake-card ${m.confidence==="high"?"priority":""}">
        <div class="module-mistake-head">
          <div>
            <span class="module-mistake-badge">
              ${m.confidence==="high"?"PRIORITY MISCONCEPTION":"MISTAKE"}
            </span>
            <h2>${esc(m.stem || `Question ${index+1}`)}</h2>
          </div>
          ${m.count>1?`<strong class="module-mistake-repeat">${m.count}× wrong</strong>`:""}
        </div>

        ${m.explanation?`
          <section>
            <h3>Why this matters</h3>
            <p>${esc(m.explanation)}</p>
          </section>`:""}

        ${m.referenceText?`
          <section>
            <h3>Reference</h3>
            <p>${esc(m.referenceText)}</p>
          </section>`:""}

        <div class="module-mistake-meta">
          <span>Confidence: <strong>${esc(m.confidence || "not recorded")}</strong></span>
        </div>
      </article>`).join("")
    : `<div class="card muted">No mistakes match this filter.</div>`;
}

async function load(){
  const sessionResult = await timeout(
    supabaseClient.auth.getSession(), 6000, "Session"
  );
  const user = sessionResult?.data?.session?.user;
  if(!user){
    location.replace("login.html");
    return;
  }

  const moduleResult = await timeout(
    supabaseClient
      .from("modules")
      .select("*")
      .eq("id",moduleId)
      .eq("edition",edition)
      .maybeSingle(),
    7000,
    "Module"
  );

  if(moduleResult.error) throw moduleResult.error;
  moduleRow = moduleResult.data;
  if(!moduleRow) throw new Error("Module not found.");

  $("mistakesTitle").textContent = `${moduleRow.title} — My Mistakes`;
  $("mistakesSubtitle").textContent =
    "Review wrong answers, explanations and confidence mismatches from this module.";
  $("mistakesBackLink").href =
    `module-hub.html?edition=${encodeURIComponent(edition)}&module=${encodeURIComponent(moduleRow.id)}`;

  const attemptsResult = await timeout(
    supabaseClient
      .from("quiz_attempts")
      .select("*")
      .eq("user_id",user.id)
      .eq("module_id",moduleRow.id)
      .order("updated_at",{ascending:false}),
    8000,
    "Attempts"
  );

  if(attemptsResult.error) throw attemptsResult.error;

  const allAnswers = (attemptsResult.data || [])
    .flatMap(a => Array.isArray(a.answers) ? a.answers : [])
    .filter(a => a?.correct === false);

  const quizSlug = parseQuizSlug(moduleRow.launch_path);
  let questionMap = new Map();

  if(quizSlug){
    try{
      const quizResult = await timeout(
        supabaseClient.rpc("acl_get_learning_quiz",{
          p_quiz_slug:quizSlug,
          p_module_id:moduleRow.id
        }),
        10000,
        "Question bank"
      );

      if(!quizResult.error && quizResult.data){
        const questions = quizResult.data.questions || [];
        questionMap = new Map(
          questions.map(q => [String(q.id), q])
        );
      }
    }catch(error){
      console.warn("Mistakes question lookup skipped",error);
    }
  }

  const grouped = new Map();

  allAnswers.forEach(answer=>{
    const id = questionId(answer);
    if(id == null) return;

    const key = String(id);
    const q = questionMap.get(key) || {};

    if(!grouped.has(key)){
      grouped.set(key,{
        id:key,
        stem:q.stem || q.question || q.text || "",
        explanation:answer.explanation || q.explanation || "",
        referenceText:answer.referenceText || answer.reference_text || "",
        confidence:answer.confidence || null,
        count:0
      });
    }

    const row = grouped.get(key);
    row.count += 1;

    if(answer.confidence === "high"){
      row.confidence = "high";
    }

    if(!row.explanation && answer.explanation){
      row.explanation = answer.explanation;
    }
  });

  mistakes = [...grouped.values()].sort((a,b)=>{
    if(a.confidence==="high" && b.confidence!=="high") return -1;
    if(b.confidence==="high" && a.confidence!=="high") return 1;
    return b.count-a.count;
  });

  render();
}

$("mistakesFilter")?.addEventListener("change",render);

try{
  await load();
}catch(error){
  console.error(error);
  $("mistakesGrid").innerHTML =
    `<div class="card muted">${esc(error.message || "Could not load mistakes.")}</div>`;
}
