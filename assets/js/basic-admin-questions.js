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
    <div class="baq-details" data-details="${question.id}" hidden>
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
            <span class="baq-topic">${esc(question.topic || "No topic")}</span>
            <span class="baq-state ${question.status === "archived" ? "hidden" : ""}">
              ${question.status === "archived" ? "Hidden" : "Visible"}
            </span>
          </div>

          <h2>${esc(question.stem || "Question")}</h2>
          <small class="baq-expand-hint">Click to view choices and details</small>
        </div>

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

function bindCardActions() {
  const toggleDetails = id => {
    const details = document.querySelector(`[data-details="${id}"]`);
    const head = document.querySelector(`[data-expand="${id}"]`);

    if (!details || !head) return;

    details.hidden = !details.hidden;
    head.setAttribute("aria-expanded", details.hidden ? "false" : "true");

    const hint = head.querySelector(".baq-expand-hint");
    if (hint) {
      hint.textContent = details.hidden
        ? "Click to view choices and details"
        : "Click to collapse";
    }
  };

  document.querySelectorAll("[data-expand]").forEach(head => {
    head.addEventListener("click", event => {
      if (event.target.closest("button,a,input,select,textarea,label")) return;
      toggleDetails(head.dataset.expand);
    });

    head.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target !== head) return;
      event.preventDefault();
      toggleDetails(head.dataset.expand);
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