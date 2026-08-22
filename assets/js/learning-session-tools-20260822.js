/* =========================================================
   ACL EXPERT LEARNING SESSION TOOLS — 2026-08-22 v4
   Floating per-question countdown and autosaved question notes.
========================================================= */

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

const moduleKey =
  params.get("module") ||
  params.get("slug") ||
  "acl-module";

const edition =
  String(params.get("edition") || "expert").toLowerCase() === "basic"
    ? "basic"
    : "expert";

const timerCard = $("learningTimerCard");
const timerValue = $("learningTimerValue");
const timerLabel = $("learningTimerLabel");
const notesToggle = $("learningNotesToggle");
const notesPanel = $("learningNotesPanel");
const notesClose = $("learningNotesClose");
const notesText = $("learningNotesText");
const notesStatus = $("learningNotesStatus");
const notesTitle = $("learningNotesTitle");
const notesClear = $("learningNotesClear");
const notesDot = $("learningNotesDot");
const backToModule = $("learningBackToModule");

let activeQuestion = null;
let timerInterval = null;
let timerDeadline = 0;
let timerPausedRemaining = null;
let saveTimer = null;

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {}
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {}
}

function timerStorageKey(questionId) {
  return `acl:learning-timer:${edition}:${moduleKey}:${questionId}`;
}

function noteStorageKey(questionId) {
  return `acl:learning-note:${edition}:${moduleKey}:${questionId}`;
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function resolvedDefaultSeconds(detail = {}) {
  const fromDetail = Number(detail.timeLimitSeconds || 0);
  if (Number.isFinite(fromDetail) && fromDetail > 0) {
    return Math.round(fromDetail);
  }

  for (const name of [
    "question_time_seconds",
    "time_limit_seconds",
    "question_time"
  ]) {
    const value = Number(params.get(name) || 0);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  return 60;
}

function currentRemaining() {
  if (timerPausedRemaining !== null) {
    return Math.max(0, timerPausedRemaining);
  }

  if (!timerDeadline) {
    return 0;
  }

  return Math.max(0, (timerDeadline - Date.now()) / 1000);
}

function updateTimerVisual() {
  if (!timerCard || !timerValue) return;

  const remaining = currentRemaining();
  timerValue.textContent = formatTime(remaining);

  timerCard.classList.toggle(
    "is-warning",
    remaining > 0 && remaining <= 15
  );

  timerCard.classList.toggle(
    "is-expired",
    remaining <= 0
  );
}

function clearTimerInterval() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startInterval() {
  clearTimerInterval();
  updateTimerVisual();

  timerInterval = window.setInterval(() => {
    updateTimerVisual();

    if (currentRemaining() <= 0) {
      clearTimerInterval();
    }
  }, 250);
}

function persistTimer() {
  if (!activeQuestion?.id || !timerDeadline) return;

  safeSet(
    sessionStorage,
    timerStorageKey(activeQuestion.id),
    JSON.stringify({
      deadline: timerDeadline,
      pausedRemaining: timerPausedRemaining,
      questionNumber: activeQuestion.number
    })
  );
}

function restoreOrStartTimer(detail) {
  const questionId = String(detail.questionId || detail.questionNumber || "question");
  const questionNumber = Number(detail.questionNumber || 0) || null;
  const sameQuestion = activeQuestion?.id === questionId;

  activeQuestion = {
    id: questionId,
    number: questionNumber,
    total: Number(detail.totalQuestions || 0) || null
  };

  if (timerLabel) {
    timerLabel.textContent = "Question time";
  }

  if (!sameQuestion) {
    timerPausedRemaining = null;
    timerDeadline = 0;

    const storedRaw = safeGet(
      sessionStorage,
      timerStorageKey(questionId)
    );

    if (storedRaw) {
      try {
        const stored = JSON.parse(storedRaw);
        const storedDeadline = Number(stored?.deadline || 0);
        const storedPaused = stored?.pausedRemaining;

        if (Number.isFinite(storedDeadline) && storedDeadline > 0) {
          timerDeadline = storedDeadline;
        }

        if (storedPaused !== null && storedPaused !== undefined) {
          const n = Number(storedPaused);
          if (Number.isFinite(n) && n >= 0) {
            timerPausedRemaining = n;
          }
        }
      } catch {}
    }

    if (!timerDeadline && timerPausedRemaining === null) {
      timerDeadline =
        Date.now() + resolvedDefaultSeconds(detail) * 1000;
      persistTimer();
    }
  }

  if (detail.answered) {
    if (timerPausedRemaining === null) {
      timerPausedRemaining = currentRemaining();
      persistTimer();
    }

    timerCard?.classList.add("is-paused");
    clearTimerInterval();
    updateTimerVisual();
  } else {
    timerCard?.classList.remove("is-paused");

    if (timerPausedRemaining !== null) {
      timerDeadline = Date.now() + timerPausedRemaining * 1000;
      timerPausedRemaining = null;
      persistTimer();
    }

    startInterval();
  }

  loadNoteForCurrentQuestion();
}

function addTimeBonus(seconds) {
  const bonus = Math.max(0, Number(seconds) || 0);
  if (!bonus || !activeQuestion) return;

  if (timerPausedRemaining !== null) {
    timerPausedRemaining += bonus;
  } else {
    if (!timerDeadline) {
      timerDeadline = Date.now();
    }
    timerDeadline += bonus * 1000;
  }

  persistTimer();
  timerCard?.classList.remove("is-expired");
  startInterval();
}

function currentNoteKey() {
  if (!activeQuestion?.id) return null;
  return noteStorageKey(activeQuestion.id);
}

function updateNoteDot() {
  if (!notesDot || !notesText) return;
  notesDot.classList.toggle(
    "has-note",
    Boolean(notesText.value.trim())
  );
}

function loadNoteForCurrentQuestion() {
  if (!notesText) return;

  const key = currentNoteKey();
  const value = key ? safeGet(localStorage, key) || "" : "";

  notesText.value = value;

  if (notesTitle) {
    notesTitle.textContent = activeQuestion?.number
      ? `Question ${activeQuestion.number} notes`
      : "Question notes";
  }

  if (notesStatus) {
    notesStatus.textContent = "Autosaved";
  }

  updateNoteDot();
}

function saveCurrentNote() {
  if (!notesText) return;
  const key = currentNoteKey();
  if (!key) return;

  const value = notesText.value;

  if (value.trim()) {
    safeSet(localStorage, key, value);
  } else {
    safeRemove(localStorage, key);
  }

  if (notesStatus) {
    notesStatus.textContent = "Autosaved";
  }

  updateNoteDot();
}

function openNotes() {
  if (!notesPanel) return;
  notesPanel.hidden = false;
  document.body.classList.add("learning-notes-open");
  notesToggle?.setAttribute("aria-expanded", "true");
  loadNoteForCurrentQuestion();
  window.setTimeout(() => notesText?.focus(), 30);
}

function closeNotes() {
  if (!notesPanel) return;
  saveCurrentNote();
  notesPanel.hidden = true;
  document.body.classList.remove("learning-notes-open");
  notesToggle?.setAttribute("aria-expanded", "false");
}

notesToggle?.addEventListener("click", openNotes);
notesClose?.addEventListener("click", closeNotes);

notesText?.addEventListener("input", () => {
  if (notesStatus) {
    notesStatus.textContent = "Saving…";
  }

  updateNoteDot();

  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(
    saveCurrentNote,
    220
  );
});

notesClear?.addEventListener("click", () => {
  if (!notesText) return;
  notesText.value = "";
  saveCurrentNote();
  notesText.focus();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && notesPanel && !notesPanel.hidden) {
    closeNotes();
  }
});

window.addEventListener("acl:learning-question-changed", event => {
  restoreOrStartTimer(event.detail || {});
});

window.addEventListener("acl:learning-time-bonus", event => {
  addTimeBonus(event.detail?.seconds || 60);
});

/* Back-to-module is always in normal flow on mobile and receives the
   exact current module target here. */
if (backToModule) {
  const moduleId = params.get("module");
  const slug = params.get("slug");
  const p = new URLSearchParams({ edition });

  if (moduleId) p.set("module", moduleId);
  if (slug) p.set("slug", slug);

  backToModule.href =
    moduleId || slug
      ? `module-hub.html?${p.toString()}`
      : `modules.html?edition=${edition}`;
}

/* Fallback for a very early render that happened before this module loaded.
   The normal path uses the custom event dispatched by learning-mode.js. */
const questionCount = $("questionCount");
if (questionCount) {
  const observer = new MutationObserver(() => {
    const match = questionCount.textContent.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
    if (!match) return;

    const questionNumber = Number(match[1]);
    const totalQuestions = Number(match[2]);
    const fallbackId = `q-${questionNumber}`;

    if (activeQuestion?.number === questionNumber) return;

    restoreOrStartTimer({
      questionId: fallbackId,
      questionNumber,
      totalQuestions,
      timeLimitSeconds: 60,
      answered: false
    });
  });

  observer.observe(questionCount, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
