import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const moduleId = params.get("module") || "";
const ADMIN_EMAIL = "drmohamedalaa90@gmail.com";

let moduleRecord = null;
let questions = [];

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);

const difficultyLabel = value => ({
  foundation: "Easy",
  intermediate: "Moderate",
  advanced: "Difficult"
})[value] || "Easy";

function optionsMap(question) {
  const map = new Map(
    (question.options || []).map(option => [
      String(option.key || "").toUpperCase(),
      option
    ])
  );

  return ["A","B","C","D"].map(key => ({
    key,
    text: map.get(key)?.text || "",
    isCorrect: Boolean(map.get(key)?.is_correct)
  }));
}

function setPageStatus(message = "", type = "") {
  const el = $("baqStatus");
  el.textContent = message;
  el.className = "baq-page-status" + (type ? " " + type : "");
}

function populateTopicFilter() {
  const select = $("baqTopicFilter");
  const current = select.value;
  const topics = [...new Set(
    questions
      .map(question => String(question.topic || "").trim())
      .filter(Boolean)
  )].sort((a,b) => a.localeCompare(b));

  select.innerHTML =
    '<option value="all">All topics</option>' +
    topics.map(topic =>
      `<option value="${esc(topic)}">${esc(topic)}</option>`
    ).join("");

  if ([...select.options].some(option => option.value === current)) {
    select.value = current;
  }
}

function filteredQuestions() {
  const search = $("baqSearch").value.trim().toLowerCase();
  const status = $("baqStatusFilter").value;
  const difficulty = $("baqDifficultyFilter").value;
  const topic = $("baqTopicFilter").value;

  return questions.filter(question => {
    if (status !== "all" && question.status !== status) return false;
    if (difficulty !== "all" && question.difficulty !== difficulty) return false;
    if (topic !== "all" && String(question.topic || "") !== topic) return false;

    if (search) {
      const haystack = [
        question.stem,
        question.topic,
        question.explanation,
        question.reference_text,
        question.dr_corazon_hint,
        ...(question.options || []).map(option => option.text)
      ].join(" ").toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function detailsHtml(question) {
  const options = optionsMap(question);

  return `
    <div class="baq-details" data-details="${question.id}">
      <div class="baq-preview-options">
        ${options.map(option => `
          <div class="baq-preview-option ${option.isCorrect ? "is-correct" : ""}">
            <strong>${option.key}</strong>
            <span>${esc(option.text || "—")}</span>
            ${option.isCorrect ? '<em>Correct answer</em>' : ""}
          </div>
        `).join("")}
      </div>

      <div class="baq-preview-grid">
        <div class="baq-preview-note">
          <span>Explanation</span>
          <p>${esc(question.explanation || "No explanation added.")}</p>
        </div>

        <div class="baq-preview-note">
          <span>Reference</span>
          <p>${esc(question.reference_text || "No reference added.")}</p>
        </div>

        <div class="baq-preview-note">
          <span>Dr. Corazón advice</span>
          <p>${esc(question.dr_corazon_hint || "No custom advice added.")}</p>
        </div>
      </div>
    </div>
  `;
}


function editorHtml(question) {
  const options = optionsMap(question);
  const correct = options.find(option => option.isCorrect)?.key || "A";

  return `
    <form class="baq-editor" data-editor="${question.id}" hidden>
      <label class="baq-field">
        <span>Question</span>
        <textarea data-field="stem" rows="4" required>${esc(question.stem || "")}</textarea>
      </label>

      <div class="baq-choices">
        ${options.map(option => `
          <label class="baq-choice">
            <input type="radio" name="correct-${question.id}" value="${option.key}" ${correct === option.key ? "checked" : ""}>
            <strong>${option.key}</strong>
            <input type="text" data-option="${option.key}" value="${esc(option.text)}" required>
          </label>
        `).join("")}
      </div>

      <div class="baq-grid">
        <label class="baq-field">
          <span>Topic</span>
          <input data-field="topic" type="text" value="${esc(question.topic || "")}">
        </label>

        <label class="baq-field">
          <span>Difficulty</span>
          <select data-field="difficulty">
            <option value="foundation" ${question.difficulty === "foundation" ? "selected" : ""}>🟢 Easy</option>
            <option value="intermediate" ${question.difficulty === "intermediate" ? "selected" : ""}>🟠 Moderate</option>
            <option value="advanced" ${question.difficulty === "advanced" ? "selected" : ""}>🔴 Difficult</option>
          </select>
        </label>
      </div>

      <div class="baq-grid">
        <label class="baq-field">
          <span>Reference</span>
          <input data-field="reference" type="text" value="${esc(question.reference_text || "")}">
        </label>

        <label class="baq-field">
          <span>Dr. Corazón advice</span>
          <input data-field="hint" type="text" value="${esc(question.dr_corazon_hint || "")}" placeholder="Indirect clue only">
        </label>
      </div>

      <label class="baq-field">
        <span>Explanation</span>
        <textarea data-field="explanation" rows="3">${esc(question.explanation || "")}</textarea>
      </label>

      <div class="baq-editor-footer">
        <button class="baq-btn" type="button" data-cancel="${question.id}">Cancel</button>
        <button class="baq-save" type="submit">Save changes</button>
      </div>
    </form>
  `;
}

function render() {
  const rows = filteredQuestions();
  $("baqCount").textContent =
    `${questions.length} question${questions.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    $("baqList").innerHTML =
      '<div class="baq-empty">No questions match the current filters.</div>';
    return;
  }

  $("baqList").innerHTML = rows.map((question, index) => `
    <article class="baq-card ${question.status === "archived" ? "is-hidden" : ""}" data-card="${question.id}">
      <div class="baq-card-head" data-expand="${question.id}" role="button" tabindex="0" aria-expanded="false">
        <span class="baq-number">${index + 1}</span>

        <div class="baq-card-main">
          <div class="baq-meta">
            <span class="baq-difficulty">
              <i class="baq-dot ${esc(question.difficulty || "foundation")}"></i>
              ${difficultyLabel(question.difficulty)}
            </span>

            <span class="baq-state ${question.status === "archived" ? "hidden" : ""}">
              ${question.status === "archived" ? "Hidden" : "Visible"}
            </span><label class="baq-inline-topic">Topic <input data-quick-topic="${question.id}" value="${esc(question.topic || '')}" placeholder="Add topic" maxlength="160"></label><button class="baq-btn" type="button" data-save-topic="${question.id}">Save topic</button>
          </div>

          <h2>${esc(question.stem || "Question")}</h2>

          <div class="baq-quick-controls" data-quick-controls="${question.id}">
            <div class="baq-quick-difficulty" aria-label="Set difficulty">
              <button type="button"
                class="baq-diff-btn easy ${question.difficulty === "foundation" ? "active" : ""}"
                data-quick-difficulty="${question.id}"
                data-difficulty="foundation"
                title="Mark Easy">
                <i></i><span>Easy</span>
              </button>

              <button type="button"
                class="baq-diff-btn intermediate ${question.difficulty === "intermediate" ? "active" : ""}"
                data-quick-difficulty="${question.id}"
                data-difficulty="intermediate"
                title="Mark Intermediate">
                <i></i><span>Intermediate</span>
              </button>

              <button type="button"
                class="baq-diff-btn hard ${question.difficulty === "advanced" ? "active" : ""}"
                data-quick-difficulty="${question.id}"
                data-difficulty="advanced"
                title="Mark Hard">
                <i></i><span>Hard</span>
              </button>
            </div>

            <div class="baq-quick-hint">
              <span class="baq-corazon-mini">Dr. Corazón</span>
              <input
                type="text"
                data-quick-hint="${question.id}"
                value="${esc(question.dr_corazon_hint || "")}"
                placeholder="Add indirect advice…">
              <button type="button" data-save-hint="${question.id}">Save</button>
            </div>
          </div>

          <small class="baq-expand-hint">Click question to expand</small>
        </div>

        <span class="baq-expand-chevron" aria-hidden="true">⌄</span>

        <div class="baq-card-actions">
          <button class="baq-btn" type="button" data-edit="${question.id}">Edit</button>
          <button class="baq-btn hide" type="button" data-toggle="${question.id}">
            ${question.status === "archived" ? "Show" : "Hide"}
          </button>
          <button class="baq-btn delete" type="button" data-delete="${question.id}">Delete</button>
        </div>
      </div>

      ${detailsHtml(question)}
      ${editorHtml(question)}
    </article>
  `).join("");

  bindCardActions();
}

function questionById(id) {
  return questions.find(question => String(question.id) === String(id));
}

async function quickSaveQuestionMeta(question, patch = {}, sourceButton = null) {
  if (!question) return false;

  const options = optionsMap(question);
  const byKey = Object.fromEntries(options.map(option => [option.key, option]));
  const correct =
    options.find(option => option.isCorrect)?.key || "A";

  if (sourceButton) sourceButton.disabled = true;

  const { error } =
    await supabaseClient.rpc("acl_admin_save_basic_question", {
      p_question_id: question.id,
      p_module_id: moduleId,
      p_stem: question.stem || question.question_text || "",
      p_option_a: byKey.A?.text || "",
      p_option_b: byKey.B?.text || "",
      p_option_c: byKey.C?.text || "",
      p_option_d: byKey.D?.text || "",
      p_correct_key: correct,
      p_topic: Object.prototype.hasOwnProperty.call(patch,"topic") ? (patch.topic || null) : (question.topic || null),
      p_reference_text: question.reference_text || null,
      p_explanation: question.explanation || null,
      p_dr_corazon_hint:
        Object.prototype.hasOwnProperty.call(patch, "dr_corazon_hint")
          ? (patch.dr_corazon_hint || null)
          : (question.dr_corazon_hint || null),
      p_difficulty:
        patch.difficulty ||
        question.difficulty ||
        "foundation",
      p_status: question.status || "published"
    });

  if (sourceButton) sourceButton.disabled = false;

  if (error) {
    console.error("QUICK QUESTION UPDATE:", error);
    setPageStatus(error.message || "Could not update question.", "error");
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "difficulty")) {
    question.difficulty = patch.difficulty;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "dr_corazon_hint")) {
    question.dr_corazon_hint = patch.dr_corazon_hint || null;
  }

  if(Object.prototype.hasOwnProperty.call(patch,"topic")) question.topic=patch.topic||null;
  setPageStatus("Question updated.", "success");
  return true;
}

function toggleQuestionDetails(id) {
  const details = document.querySelector(`[data-details="${id}"]`);
  const head = document.querySelector(`[data-expand="${id}"]`);

  if (!details || !head) return;

  const willOpen = !details.classList.contains("is-open");

  details.classList.toggle("is-open", willOpen);
  head.setAttribute("aria-expanded", willOpen ? "true" : "false");

  const hint = head.querySelector(".baq-expand-hint");
  if (hint) {
    hint.textContent = willOpen
      ? "Click question to collapse"
      : "Click question to expand";
  }

  const chevron = head.querySelector(".baq-expand-chevron");
  if (chevron) {
    chevron.textContent = willOpen ? "⌃" : "⌄";
  }
}

function bindCardActions() {
  document.querySelectorAll('[data-quick-topic],[data-save-topic]').forEach(el=>{
    el.addEventListener('click',event=>event.stopPropagation());
    el.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'&&el.matches('input')){event.preventDefault();document.querySelector(`[data-save-topic="${el.dataset.quickTopic}"]`)?.click();}});
  });
  document.querySelectorAll('[data-save-topic]').forEach(button=>button.addEventListener('click',async()=>{
    const question=questionById(button.dataset.saveTopic),input=document.querySelector(`[data-quick-topic="${button.dataset.saveTopic}"]`);
    if(!question||!input)return;
    const ok=await quickSaveQuestionMeta(question,{topic:input.value.trim()},button);
    if(ok){button.textContent='Saved';const editor=document.querySelector(`[data-editor="${question.id}"] [data-field="topic"]`);if(editor)editor.value=question.topic||'';populateTopicFilter();setTimeout(()=>button.textContent='Save topic',1200);}
  }));
  document.querySelectorAll("[data-quick-difficulty]").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();

      const question = questionById(button.dataset.quickDifficulty);
      if (!question) return;

      const nextDifficulty = button.dataset.difficulty;
      if (question.difficulty === nextDifficulty) return;

      const ok = await quickSaveQuestionMeta(
        question,
        { difficulty: nextDifficulty },
        button
      );

      if (!ok) return;

      const group = button.closest(".baq-quick-difficulty");
      group?.querySelectorAll(".baq-diff-btn").forEach(item =>
        item.classList.toggle("active", item === button)
      );

      const card = button.closest(".baq-card");
      const badge = card?.querySelector(".baq-difficulty");

      if (badge) {
        badge.innerHTML =
          '<i class="baq-dot ' +
          esc(nextDifficulty) +
          '"></i>' +
          difficultyLabel(nextDifficulty);
      }
    });
  });

  document.querySelectorAll("[data-save-hint]").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();

      const question = questionById(button.dataset.saveHint);
      const input = document.querySelector(
        '[data-quick-hint="' + button.dataset.saveHint + '"]'
      );

      if (!question || !input) return;

      const hint = input.value.trim();

      const ok = await quickSaveQuestionMeta(
        question,
        { dr_corazon_hint: hint },
        button
      );

      if (!ok) return;

      button.textContent = "Saved";
      setTimeout(() => {
        button.textContent = "Save";
      }, 1200);
    });
  });

  document.querySelectorAll("[data-quick-hint]").forEach(input => {
    input.addEventListener("click", event => event.stopPropagation());

    input.addEventListener("keydown", event => {
      event.stopPropagation();

      if (event.key === "Enter") {
        event.preventDefault();

        document.querySelector(
          '[data-save-hint="' + input.dataset.quickHint + '"]'
        )?.click();
      }
    });
  });

  document.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.edit;
      const editor = document.querySelector(`[data-editor="${id}"]`);
      if (!editor) return;
      editor.hidden = false;
      editor.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
  });

  document.querySelectorAll("[data-cancel]").forEach(button => {
    button.addEventListener("click", () => {
      const editor = document.querySelector(`[data-editor="${button.dataset.cancel}"]`);
      if (editor) editor.hidden = true;
    });
  });

  document.querySelectorAll(".baq-editor").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const id = form.dataset.editor;
      const question = questionById(id);
      if (!question) return;

      const save = form.querySelector(".baq-save");
      save.disabled = true;
      setPageStatus("Saving changes…");

      const correct =
        form.querySelector(`input[name="correct-${id}"]:checked`)?.value || "";

      const payload = {
        p_question_id: id,
        p_module_id: moduleId,
        p_stem: form.querySelector('[data-field="stem"]').value.trim(),
        p_option_a: form.querySelector('[data-option="A"]').value.trim(),
        p_option_b: form.querySelector('[data-option="B"]').value.trim(),
        p_option_c: form.querySelector('[data-option="C"]').value.trim(),
        p_option_d: form.querySelector('[data-option="D"]').value.trim(),
        p_correct_key: correct,
        p_topic: form.querySelector('[data-field="topic"]').value.trim() || null,
        p_reference_text: form.querySelector('[data-field="reference"]').value.trim() || null,
        p_explanation: form.querySelector('[data-field="explanation"]').value.trim() || null,
        p_dr_corazon_hint: form.querySelector('[data-field="hint"]').value.trim() || null,
        p_difficulty: form.querySelector('[data-field="difficulty"]').value,
        p_status: question.status
      };

      const { error } =
        await supabaseClient.rpc("acl_admin_save_basic_question", payload);

      if (error) {
        console.error(error);
        setPageStatus(error.message || "Could not save changes.", "error");
        save.disabled = false;
        return;
      }

      setPageStatus("Question updated.", "success");
      await loadQuestions();
    });
  });

  document.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", async () => {
      const question = questionById(button.dataset.toggle);
      if (!question) return;

      button.disabled = true;
      setPageStatus(question.status === "archived" ? "Showing question…" : "Hiding question…");

      const { error } =
        await supabaseClient.rpc("acl_admin_set_basic_question_visible", {
          p_question_id: question.id,
          p_visible: question.status === "archived"
        });

      if (error) {
        console.error(error);
        setPageStatus(error.message || "Could not change visibility.", "error");
        button.disabled = false;
        return;
      }

      setPageStatus(
        question.status === "archived" ? "Question is visible again." : "Question hidden from quizzes.",
        "success"
      );

      await loadQuestions();
    });
  });

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const question = questionById(button.dataset.delete);
      if (!question) return;

      if (!confirm("Delete this question permanently? This cannot be undone.")) {
        return;
      }

      button.disabled = true;
      setPageStatus("Deleting question…");

      const { error } =
        await supabaseClient.rpc("acl_admin_delete_basic_question", {
          p_question_id: question.id
        });

      if (error) {
        console.error(error);
        setPageStatus(error.message || "Could not delete question.", "error");
        button.disabled = false;
        return;
      }

      setPageStatus("Question deleted.", "success");
      await loadQuestions();
    });
  });
}

async function loadQuestions() {
  const { data, error } =
    await supabaseClient.rpc("acl_admin_get_basic_module_questions", {
      p_module_id: moduleId
    });

  if (error) throw error;

  questions = Array.isArray(data) ? data : [];
  populateTopicFilter();
  render();
}

$("baqList")?.addEventListener("click", event => {
  if (event.target.closest("button,a,input,select,textarea,label,form,.baq-quick-controls")) {
    return;
  }

  const head = event.target.closest("[data-expand]");
  if (!head) return;

  toggleQuestionDetails(head.dataset.expand);
});

$("baqList")?.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const head = event.target.closest("[data-expand]");
  if (!head || event.target !== head) return;

  event.preventDefault();
  toggleQuestionDetails(head.dataset.expand);
});

["baqSearch","baqStatusFilter","baqDifficultyFilter","baqTopicFilter"]
  .forEach(id => {
    $(id)?.addEventListener("input", render);
    $(id)?.addEventListener("change", render);
  });

const {
  data: { session }
} = await supabaseClient.auth.getSession();

if (!session?.user) {
  location.replace("login.html");
} else if (
  String(session.user.email || "").toLowerCase() !== ADMIN_EMAIL
) {
  location.replace("basic-home.html?edition=basic");
} else if (!moduleId) {
  location.replace("basic-home.html?edition=basic");
} else {
  try {
    const { data: moduleData, error: moduleError } =
      await supabaseClient
        .from("modules")
        .select("id,title")
        .eq("id", moduleId)
        .eq("edition", "basic")
        .maybeSingle();

    if (moduleError || !moduleData) {
      throw moduleError || new Error("Module not found");
    }

    moduleRecord = moduleData;
    $("baqModuleTitle").textContent = moduleData.title + " · Questions";
    $("baqBack").href =
      `basic-module.html?edition=basic&module=${encodeURIComponent(moduleId)}`;

    await loadQuestions();
  } catch (error) {
    console.error(error);
    setPageStatus(error.message || "Could not load the question bank.", "error");
    $("baqList").innerHTML =
      '<div class="baq-empty">Question bank unavailable.</div>';
  }
}