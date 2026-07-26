\
(() => {
  "use strict";

  const config = window.ACL_QUIZ_CONFIG;
  const storageKey = `acl_attempt_${config.quizId}`;

  const state = {
    participant: null,
    currentQuestionIndex: 0,
    answers: {},
    startedAt: null,
    expiresAt: null,
    completed: false,
    timerHandle: null
  };

  const els = {
    screens: document.querySelectorAll(".screen"),
    entryScreen: document.getElementById("entryScreen"),
    identityScreen: document.getElementById("identityScreen"),
    quizScreen: document.getElementById("quizScreen"),
    completionScreen: document.getElementById("completionScreen"),
    statusPill: document.getElementById("statusPill"),
    quizTitle: document.getElementById("quizTitle"),
    quizDescription: document.getElementById("quizDescription"),
    opensAt: document.getElementById("opensAt"),
    closesAt: document.getElementById("closesAt"),
    duration: document.getElementById("duration"),
    questionCount: document.getElementById("questionCount"),
    entryMessage: document.getElementById("entryMessage"),
    startEntryBtn: document.getElementById("startEntryBtn"),
    identityForm: document.getElementById("identityForm"),
    fullName: document.getElementById("fullName"),
    email: document.getElementById("email"),
    phone: document.getElementById("phone"),
    academicLevel: document.getElementById("academicLevel"),
    passcodeField: document.getElementById("passcodeField"),
    passcode: document.getElementById("passcode"),
    aclScoreField: document.getElementById("aclScoreField"),
    aclScore: document.getElementById("aclScore"),
    eligibilityMessage: document.getElementById("eligibilityMessage"),
    backToEntryBtn: document.getElementById("backToEntryBtn"),
    participantName: document.getElementById("participantName"),
    progressText: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"),
    timerText: document.getElementById("timerText"),
    questionTypeBadge: document.getElementById("questionTypeBadge"),
    autosaveState: document.getElementById("autosaveState"),
    questionText: document.getElementById("questionText"),
    questionScenario: document.getElementById("questionScenario"),
    questionImage: document.getElementById("questionImage"),
    optionsContainer: document.getElementById("optionsContainer"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    saveExitBtn: document.getElementById("saveExitBtn"),
    completionSummary: document.getElementById("completionSummary"),
    restartDemoBtn: document.getElementById("restartDemoBtn")
  };

  function showScreen(screen) {
    els.screens.forEach(s => s.classList.add("hidden"));
    screen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatDate(iso) {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Cairo"
    }).format(date);
  }

  function getAvailability() {
    const now = Date.now();
    const opens = new Date(config.opensAt).getTime();
    const closes = new Date(config.closesAt).getTime();

    if (now < opens) return "locked";
    if (now >= closes) return "closed";
    return "open";
  }

  function updateEntryState() {
    const availability = getAvailability();
    const saved = loadAttempt();

    els.statusPill.className = `status-pill ${availability}`;

    if (availability === "locked") {
      els.statusPill.textContent = "Not open yet";
      els.entryMessage.className = "message-box warning";
      els.entryMessage.textContent = `This competition opens on ${formatDate(config.opensAt)}.`;
      els.startEntryBtn.disabled = true;
      els.startEntryBtn.textContent = "Competition locked";
      return;
    }

    if (availability === "closed") {
      els.statusPill.textContent = "Closed";
      els.entryMessage.className = "message-box error";
      els.entryMessage.textContent = `This competition closed on ${formatDate(config.closesAt)}.`;
      els.startEntryBtn.disabled = true;
      els.startEntryBtn.textContent = "Competition closed";
      return;
    }

    els.statusPill.textContent = "Open now";
    els.startEntryBtn.disabled = false;

    if (saved && !saved.completed && config.behavior.allowResume) {
      els.entryMessage.className = "message-box success";
      els.entryMessage.textContent = "A saved attempt was found. You can continue from where you stopped.";
      els.startEntryBtn.textContent = "Resume attempt";
    } else {
      els.entryMessage.className = "message-box success";
      els.entryMessage.textContent = "The competition is open. Confirm your details to begin.";
      els.startEntryBtn.textContent = "Enter competition";
    }
  }

  function configureAccessFields() {
    els.passcodeField.classList.toggle("hidden", config.access.type !== "passcode");
    els.aclScoreField.classList.toggle("hidden", config.access.type !== "minimumScore");
  }

  function validateEligibility(formData) {
    if (config.access.type === "passcode") {
      if (formData.passcode !== config.access.passcode) {
        return { ok: false, message: "Incorrect module passcode." };
      }
    }

    if (config.access.type === "minimumScore") {
      const score = Number(formData.aclScore);
      if (!Number.isFinite(score) || score < config.access.minimumAclScore) {
        return {
          ok: false,
          message: `This module requires a minimum ACL score of ${config.access.minimumAclScore}%.`
        };
      }
    }

    return { ok: true };
  }

  function saveAttempt() {
    els.autosaveState.textContent = "Saving…";
    const payload = {
      ...state,
      timerHandle: null,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    window.setTimeout(() => {
      els.autosaveState.textContent = "Saved";
    }, 250);
  }

  function loadAttempt() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  function restoreAttempt(saved) {
    state.participant = saved.participant;
    state.currentQuestionIndex = saved.currentQuestionIndex || 0;
    state.answers = saved.answers || {};
    state.startedAt = saved.startedAt;
    state.expiresAt = saved.expiresAt;
    state.completed = Boolean(saved.completed);
  }

  function startNewAttempt(participant) {
    const now = Date.now();
    state.participant = participant;
    state.currentQuestionIndex = 0;
    state.answers = {};
    state.startedAt = new Date(now).toISOString();
    state.expiresAt = new Date(now + config.durationMinutes * 60 * 1000).toISOString();
    state.completed = false;
    saveAttempt();
  }

  function renderQuestion() {
    const question = config.questions[state.currentQuestionIndex];
    const selectedAnswer = state.answers[question.id];

    els.participantName.textContent = state.participant.fullName;
    els.progressText.textContent = `Question ${state.currentQuestionIndex + 1} of ${config.questions.length}`;
    els.progressBar.style.width = `${((state.currentQuestionIndex + 1) / config.questions.length) * 100}%`;

    els.questionTypeBadge.textContent = question.type === "single"
      ? "Single best answer"
      : question.type;

    els.questionText.textContent = question.text;

    if (question.scenario) {
      els.questionScenario.textContent = question.scenario;
      els.questionScenario.classList.remove("hidden");
    } else {
      els.questionScenario.classList.add("hidden");
    }

    if (question.image) {
      els.questionImage.src = question.image;
      els.questionImage.classList.remove("hidden");
    } else {
      els.questionImage.classList.add("hidden");
    }

    els.optionsContainer.innerHTML = "";

    question.options.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "option";
      if (selectedAnswer === index) label.classList.add("selected");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `answer-${question.id}`;
      input.value = String(index);
      input.checked = selectedAnswer === index;

      input.addEventListener("change", () => {
        state.answers[question.id] = index;
        document.querySelectorAll(".option").forEach(node => node.classList.remove("selected"));
        label.classList.add("selected");
        saveAttempt();
      });

      const letter = document.createElement("span");
      letter.className = "option-letter";
      letter.textContent = String.fromCharCode(65 + index);

      const text = document.createElement("span");
      text.textContent = option;

      label.append(input, letter, text);
      els.optionsContainer.appendChild(label);
    });

    els.prevBtn.disabled = state.currentQuestionIndex === 0;
    els.nextBtn.textContent = state.currentQuestionIndex === config.questions.length - 1
      ? "Finish section"
      : "Save and next";
  }

  function startTimer() {
    window.clearInterval(state.timerHandle);

    const tick = () => {
      const remaining = new Date(state.expiresAt).getTime() - Date.now();

      if (remaining <= 0) {
        els.timerText.textContent = "00:00";
        finishAttempt(true);
        return;
      }

      const totalSeconds = Math.floor(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      els.timerText.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    tick();
    state.timerHandle = window.setInterval(tick, 1000);
  }

  function enterQuiz() {
    if (new Date(state.expiresAt).getTime() <= Date.now()) {
      finishAttempt(true);
      return;
    }

    showScreen(els.quizScreen);
    renderQuestion();
    startTimer();
  }

  function finishAttempt(expired = false) {
    window.clearInterval(state.timerHandle);
    state.completed = true;
    saveAttempt();

    const answered = Object.keys(state.answers).length;
    els.completionSummary.innerHTML = `
      <strong>${expired ? "Time expired." : "Section completed."}</strong><br>
      Answered: ${answered} of ${config.questions.length}<br>
      Saved at: ${new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Cairo"
      }).format(new Date())}
    `;

    showScreen(els.completionScreen);
  }

  els.startEntryBtn.addEventListener("click", () => {
    const saved = loadAttempt();

    if (saved && !saved.completed && config.behavior.allowResume) {
      restoreAttempt(saved);
      enterQuiz();
      return;
    }

    showScreen(els.identityScreen);
  });

  els.backToEntryBtn.addEventListener("click", () => showScreen(els.entryScreen));

  els.identityForm.addEventListener("submit", event => {
    event.preventDefault();

    const participant = {
      fullName: els.fullName.value.trim(),
      email: els.email.value.trim(),
      phone: els.phone.value.trim(),
      academicLevel: els.academicLevel.value,
      passcode: els.passcode.value,
      aclScore: els.aclScore.value
    };

    const result = validateEligibility(participant);

    if (!result.ok) {
      els.eligibilityMessage.textContent = result.message;
      els.eligibilityMessage.className = "message-box error full-width";
      els.eligibilityMessage.classList.remove("hidden");
      return;
    }

    els.eligibilityMessage.classList.add("hidden");
    startNewAttempt(participant);
    enterQuiz();
  });

  els.prevBtn.addEventListener("click", () => {
    if (state.currentQuestionIndex > 0) {
      state.currentQuestionIndex -= 1;
      saveAttempt();
      renderQuestion();
    }
  });

  els.nextBtn.addEventListener("click", () => {
    const question = config.questions[state.currentQuestionIndex];
    const hasAnswer = Object.prototype.hasOwnProperty.call(state.answers, question.id);

    if (config.behavior.requireAnswerBeforeNext && !hasAnswer) {
      alert("Please select an answer before continuing.");
      return;
    }

    if (state.currentQuestionIndex === config.questions.length - 1) {
      finishAttempt(false);
      return;
    }

    state.currentQuestionIndex += 1;
    saveAttempt();
    renderQuestion();
  });

  els.saveExitBtn.addEventListener("click", () => {
    saveAttempt();
    window.clearInterval(state.timerHandle);
    showScreen(els.entryScreen);
    updateEntryState();
  });

  els.restartDemoBtn.addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    window.location.reload();
  });

  window.addEventListener("beforeunload", () => {
    if (state.participant && !state.completed) saveAttempt();
  });

  function init() {
    els.quizTitle.textContent = config.title;
    els.quizDescription.textContent = config.description;
    els.opensAt.textContent = formatDate(config.opensAt);
    els.closesAt.textContent = formatDate(config.closesAt);
    els.duration.textContent = `${config.durationMinutes} minutes`;
    els.questionCount.textContent = String(config.questions.length);

    configureAccessFields();
    updateEntryState();
  }

  init();
})();
