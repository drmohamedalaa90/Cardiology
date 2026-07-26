(() => {
  "use strict";

  if (!window.supabase) {
    throw new Error("Supabase library did not load. Check index.html script order.");
  }

  const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        storageKey: "acl-candidate-auth-v2",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );

  const $ = (id) => document.getElementById(id);

  const S = {
    quiz: null,
    questions: [],
    attempt: null,
    participant: null,
    answers: {},
    reviews: {},
    index: 0,
    questionStartedAt: 0,
    timerHandle: null,
    toastHandle: null,
    warnings: 0,
    submitting: false,
    suppressVisibility: false,
    lastEventAt: 0
  };

  const screens = ["entry", "identity", "quiz", "result"];

  function showScreen(id) {
    closeConfidenceModal();
    closeFlashcard();
    screens.forEach((screenId) => {
      $(screenId)?.classList.toggle("hidden", screenId !== id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Cairo"
    }).format(new Date(value));
  }

  function formatDuration(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function showToast(message) {
    if (!message) return;
    const toast = $("violationToast");
    const text = $("violationToastText");
    if (!toast || !text) {
      console.warn(message);
      return;
    }
    window.clearTimeout(S.toastHandle);
    text.textContent = message;
    toast.classList.remove("hidden");
    S.toastHandle = window.setTimeout(() => toast.classList.add("hidden"), 4200);
  }

  function openConfidenceModal() {
    $("confidenceModal")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeConfidenceModal() {
    $("confidenceModal")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function closeFlashcard() {
    $("flashcardModal")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  async function authenticate() {
    const sessionResult = await sb.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    if (sessionResult.data.session) return;

    const signInResult = await sb.auth.signInAnonymously();
    if (signInResult.error) {
      throw new Error("Anonymous sign-in failed: " + signInResult.error.message);
    }
  }

  async function loadQuiz() {
    await authenticate();

    const quizResult = await sb
      .from("quizzes")
      .select(`
        id,title,description,slug,status,opens_at,closes_at,duration_minutes,
        access_type,allow_resume,timer_mode,quiz_duration_seconds,
        default_question_time_seconds,navigation_mode,feedback_mode,
        show_flashcards,show_final_review,require_review_before_next
      `)
      .eq("slug", QUIZ_SLUG)
      .single();

    if (quizResult.error) throw quizResult.error;

    const questionResult = await sb
      .from("questions")
      .select(`
        id,order_index,question_type,question_text,stem,scenario,image_url,
        time_limit_seconds,
        question_options(id,option_key,option_text,display_order)
      `)
      .eq("quiz_id", quizResult.data.id)
      .order("order_index", { ascending: true });

    if (questionResult.error) throw questionResult.error;

    S.quiz = {
      ...quizResult.data,
      navigation_mode: quizResult.data.navigation_mode || "free_review",
      feedback_mode: quizResult.data.feedback_mode || "immediate"
    };

    S.questions = (questionResult.data || []).map((question) => ({
      ...question,
      text: question.question_text || question.stem,
      options: [...(question.question_options || [])].sort(
        (first, second) => first.display_order - second.display_order
      )
    }));

    renderEntry();
  }

  function availability() {
    const now = Date.now();
    if (now < new Date(S.quiz.opens_at).getTime()) return "locked";
    if (now >= new Date(S.quiz.closes_at).getTime()) return "closed";
    return "open";
  }

  function timerDescription() {
    if (S.quiz.timer_mode === "none") return "No timer";
    if (S.quiz.timer_mode === "per_question") {
      return `${S.quiz.default_question_time_seconds || 60}s/question`;
    }
    const totalSeconds =
      S.quiz.quiz_duration_seconds ||
      (S.quiz.duration_minutes || 15) * 60;
    return `${Math.ceil(totalSeconds / 60)} minutes total`;
  }

  function renderEntry() {
    const state = availability();
    const hasQuestions = S.questions.length > 0;

    $("title").textContent = S.quiz.title;
    $("desc").textContent = S.quiz.description || "";
    $("opens").textContent = formatDate(S.quiz.opens_at);
    $("closes").textContent = formatDate(S.quiz.closes_at);
    $("timerMode").textContent = timerDescription();
    $("count").textContent = String(S.questions.length);
    $("status").textContent = state === "open" ? "Open now" : state === "locked" ? "Not open yet" : "Closed";
    $("status").className = `status-pill ${state}`;
    $("enterBtn").disabled = state !== "open" || !hasQuestions;

    if (!hasQuestions) {
      $("entryMsg").className = "msg error";
      $("entryMsg").textContent = "This quiz has no questions.";
    } else if (state === "open") {
      $("entryMsg").className = "msg success";
      $("entryMsg").textContent = "The competition is open.";
    } else if (state === "locked") {
      $("entryMsg").className = "msg warning";
      $("entryMsg").textContent = `Opens ${formatDate(S.quiz.opens_at)}`;
    } else {
      $("entryMsg").className = "msg error";
      $("entryMsg").textContent = `Closed ${formatDate(S.quiz.closes_at)}`;
    }

    $("passcodeField")?.classList.toggle("hidden", S.quiz.access_type !== "passcode");
  }

  async function beginAttempt(person) {
    const result = await sb.rpc("acl_start_or_resume_attempt", {
      p_quiz_id: S.quiz.id,
      p_full_name: person.name,
      p_email: person.email,
      p_phone: person.phone,
      p_academic_level: person.level,
      p_passcode: person.passcode || null
    });

    if (result.error) throw result.error;

    S.attempt = result.data;
    S.participant = person;
    S.index = Math.min(
      Math.max(Number(result.data.current_question_index) || 0, 0),
      Math.max(S.questions.length - 1, 0)
    );
    S.warnings = Number(result.data.violation_count) || 0;
    $("warnings").textContent = String(S.warnings);

    const answerResult = await sb
      .from("attempt_answers")
      .select("question_id,selected_option_ids,confidence,response_time_seconds")
      .eq("attempt_id", result.data.id);

    if (answerResult.error) throw answerResult.error;

    S.answers = {};
    (answerResult.data || []).forEach((answer) => {
      S.answers[answer.question_id] = {
        optionId: answer.selected_option_ids?.[0] || null,
        confidence: answer.confidence || null,
        responseTime: Number(answer.response_time_seconds) || 0
      };
    });
  }

  function currentQuestion() {
    return S.questions[S.index] || null;
  }

  function currentAnswer() {
    const question = currentQuestion();
    return question ? S.answers[question.id] || {} : {};
  }

  function isComplete(question) {
    const answer = S.answers[question.id];
    return Boolean(answer?.optionId && answer?.confidence);
  }

  function renderQuestionMap() {
    const map = $("questionMap");
    const section = $("questionMapSection");
    if (!map || !section) return;

    if (S.quiz.navigation_mode === "locked_sequential") {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    map.innerHTML = "";

    S.questions.forEach((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `Open question ${index + 1}`);

      if (index === S.index) button.classList.add("current");
      else if (isComplete(question)) button.classList.add("answered");

      if (S.quiz.timer_mode === "per_question" && index < S.index) {
        button.disabled = true;
      } else {
        button.addEventListener("click", () => moveToQuestion(index));
      }
      map.appendChild(button);
    });
  }

  function applyNavigationMode() {
    const mode = S.quiz.navigation_mode;
    const perQuestion = S.quiz.timer_mode === "per_question";
    $("prev")?.classList.toggle("hidden", mode !== "free_review");
    if ($("prev")) $("prev").disabled = S.index === 0 || perQuestion;
    $("skipQuestion")?.classList.toggle("hidden", mode === "locked_sequential");
  }

  function clearReview() {
    $("reviewPanel")?.classList.add("hidden");
    $("flashcardBtn")?.classList.add("hidden");
  }

  function renderQuestion() {
    closeConfidenceModal();
    closeFlashcard();
    clearReview();

    const question = currentQuestion();
    if (!question) {
      showToast("Question could not be loaded.");
      return;
    }

    const answer = currentAnswer();
    const locked = Boolean(answer.optionId && answer.confidence);
    S.questionStartedAt = Date.now();

    $("participant").textContent = S.participant.name;
    $("progress").textContent = `Question ${S.index + 1} of ${S.questions.length}`;
    $("bar").style.width = `${((S.index + 1) / S.questions.length) * 100}%`;
    $("stem").textContent = question.text;
    $("scenario").textContent = question.scenario || "";
    $("scenario").classList.toggle("hidden", !question.scenario);
    $("options").innerHTML = "";

    question.options.forEach((option) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const letter = document.createElement("span");
      const optionText = document.createElement("span");

      label.className =
        "option" +
        (answer.optionId === option.id ? " selected" : "") +
        (locked ? " locked" : "");

      input.type = "radio";
      input.name = `answer-${question.id}`;
      input.checked = answer.optionId === option.id;
      input.disabled = locked;
      letter.className = "letter";
      letter.textContent = option.option_key;
      optionText.textContent = option.option_text;

      input.addEventListener("change", async () => {
        S.answers[question.id] = {
          ...S.answers[question.id],
          optionId: option.id,
          confidence: null
        };

        document.querySelectorAll(".option").forEach((element) => {
          element.classList.remove("selected");
        });
        label.classList.add("selected");

        const saved = await saveCurrentAnswer();
        if (saved) {
          renderQuestionMap();
          openConfidenceModal();
        }
      });

      label.addEventListener("click", () => {
        const latest = S.answers[question.id];
        if (latest?.optionId === option.id && !latest?.confidence) {
          window.setTimeout(openConfidenceModal, 0);
        }
      });

      label.append(input, letter, optionText);
      $("options").appendChild(label);
    });

    applyNavigationMode();
    renderQuestionMap();
    startTimer();

    if (locked && S.quiz.feedback_mode === "immediate") {
      loadAndRenderReview(question.id);
    }
  }

  async function saveCurrentAnswer() {
    const question = currentQuestion();
    if (!S.attempt || !question) return false;

    const answer = currentAnswer();
    $("saveState").textContent = "Saving…";

    const responseTime = Math.max(
      0,
      Math.floor((Date.now() - S.questionStartedAt) / 1000)
    );

    const result = await sb.rpc("acl_save_answer_with_confidence", {
      p_attempt_id: S.attempt.id,
      p_question_id: question.id,
      p_selected_option_id: answer.optionId || null,
      p_confidence: answer.confidence || null,
      p_response_time_seconds: responseTime,
      p_current_question_index: S.index
    });

    if (result.error) {
      console.error(result.error);
      $("saveState").textContent = "Save failed";
      showToast("Your answer could not be saved.");
      return false;
    }

    S.answers[question.id] = { ...answer, responseTime };
    $("saveState").textContent = "Saved";
    return true;
  }

  async function selectConfidence(confidence) {
    const question = currentQuestion();
    const answer = currentAnswer();

    if (!question || !answer.optionId) {
      closeConfidenceModal();
      showToast("Select an answer before choosing confidence.");
      return;
    }

    S.answers[question.id] = { ...answer, confidence };
    closeConfidenceModal();

    const saved = await saveCurrentAnswer();
    if (!saved) return;

    renderQuestionMap();

    if (S.quiz.feedback_mode === "immediate") {
      await loadAndRenderReview(question.id);
      return;
    }

    await advanceAfterAnswer();
  }

  async function fetchReview(questionId) {
    if (S.reviews[questionId]) return S.reviews[questionId];

    const result = await sb.rpc("acl_get_question_review", {
      p_attempt_id: S.attempt.id,
      p_question_id: questionId
    });

    if (result.error) throw result.error;
    S.reviews[questionId] = result.data;
    return result.data;
  }

  function markReviewedOptions(review) {
    document.querySelectorAll(".option").forEach((label) => {
      const input = label.querySelector("input");
      input.disabled = true;
      label.classList.add("locked");

      if (label.querySelector(".letter")?.textContent === review.correct_option_key) {
        label.classList.add("correct");
      }
      if (input.checked && !review.is_correct) {
        label.classList.add("incorrect");
      }
    });
  }

  async function loadAndRenderReview(questionId) {
    try {
      const review = await fetchReview(questionId);
      markReviewedOptions(review);

      $("reviewBadge").textContent = review.is_correct ? "Correct" : "Incorrect";
      $("reviewBadge").className = `review-badge ${review.is_correct ? "correct" : "incorrect"}`;
      const points = Number(review.points_awarded) || 0;
      $("reviewPoints").textContent = `${points >= 0 ? "+" : ""}${points} point${Math.abs(points) === 1 ? "" : "s"}`;
      $("selectedAnswerText").textContent = review.selected_option_key
        ? `${review.selected_option_key}. ${review.selected_option_text}`
        : "Not answered";
      $("correctAnswerText").textContent = review.correct_option_key
        ? `${review.correct_option_key}. ${review.correct_option_text}`
        : "Not available";
      $("reviewExplanation").textContent = review.explanation || "No explanation has been added yet.";
      $("reviewReference").textContent = review.reference_text ? `Reference: ${review.reference_text}` : "";
      $("reviewReference").classList.toggle("hidden", !review.reference_text);
      $("reviewPanel").classList.remove("hidden");
      $("flashcardBtn").classList.toggle("hidden", !review.flashcard);
      $("continueBtn").textContent = S.index === S.questions.length - 1
        ? "Finish or review skipped questions"
        : "Continue";
      S.reviews[questionId] = review;
      $("reviewPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      console.error(error);
      showToast(error.message || "Question review could not be loaded.");
    }
  }

  function openFlashcard(review) {
    const card = review?.flashcard;
    if (!card) {
      showToast("No flashcard has been added for this question.");
      return;
    }

    $("flashcardType").textContent = card.type || "FLASHCARD";
    $("flashcardTitle").textContent = card.title || "Topic review";

    const content = card.content && typeof card.content === "object"
      ? card.content
      : {};

    $("flashcardContent").innerHTML = Object.entries(content)
      .map(([heading, lines]) => {
        const items = Array.isArray(lines) ? lines : [String(lines || "")];
        return `
          <section class="flashcard-section">
            <h3>${escapeHtml(heading)}</h3>
            <ul>${items.filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
          </section>
        `;
      })
      .join("");

    $("flashcardModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  async function advanceAfterAnswer() {
    if (S.index < S.questions.length - 1) {
      await moveToQuestion(S.index + 1);
      return;
    }

    const firstIncompleteIndex = S.questions.findIndex(
      (question) => !isComplete(question)
    );

    if (
      firstIncompleteIndex >= 0 &&
      S.quiz.navigation_mode !== "locked_sequential"
    ) {
      await moveToQuestion(firstIncompleteIndex);
      showToast("Returning to the first unanswered question.");
      return;
    }

    await submitAttempt(false);
  }

  async function moveToQuestion(index) {
    if (index < 0 || index >= S.questions.length) return;
    if (S.quiz.navigation_mode === "locked_sequential" && index < S.index) return;
    S.index = index;
    await updateCurrentIndex();
    renderQuestion();
  }

  async function updateCurrentIndex() {
    if (!S.attempt) return;
    const result = await sb
      .from("quiz_attempts")
      .update({
        current_question_index: S.index,
        last_saved_at: new Date().toISOString()
      })
      .eq("id", S.attempt.id);
    if (result.error) console.error(result.error);
  }

  function questionTimeLimit() {
    return currentQuestion()?.time_limit_seconds ||
      S.quiz.default_question_time_seconds ||
      60;
  }

  function startTimer() {
    window.clearInterval(S.timerHandle);

    if (S.quiz.timer_mode === "none") {
      $("timerBox").classList.add("hidden");
      return;
    }

    $("timerBox").classList.remove("hidden");

    const tick = async () => {
      let remaining;
      if (S.quiz.timer_mode === "per_question") {
        $("timerLabel").textContent = "Question time";
        remaining = questionTimeLimit() -
          Math.floor((Date.now() - S.questionStartedAt) / 1000);
      } else {
        $("timerLabel").textContent = "Quiz time";
        remaining = Math.floor(
          (new Date(S.attempt.expires_at).getTime() - Date.now()) / 1000
        );
      }

      $("timer").textContent = formatDuration(remaining);

      if (remaining <= 0) {
        window.clearInterval(S.timerHandle);
        if (S.quiz.timer_mode === "per_question") {
          await handleQuestionTimeout();
        } else {
          await submitAttempt(true);
        }
      }
    };

    tick();
    S.timerHandle = window.setInterval(tick, 1000);
  }

  async function handleQuestionTimeout() {
    closeConfidenceModal();
    const question = currentQuestion();
    if (!question) return;

    if (!S.answers[question.id]) {
      S.answers[question.id] = { optionId: null, confidence: null };
    }

    await saveCurrentAnswer();

    if (S.index === S.questions.length - 1) {
      await submitAttempt(true);
      return;
    }

    await moveToQuestion(S.index + 1);
  }

  async function recordEvent(type) {
    if (!S.attempt || S.submitting || S.suppressVisibility) return;
    const now = Date.now();
    if (now - S.lastEventAt < 5000) return;
    S.lastEventAt = now;

    const result = await sb.rpc("acl_record_attempt_event", {
      p_attempt_id: S.attempt.id,
      p_event_type: type,
      p_question_id: currentQuestion()?.id || null,
      p_browser_details: navigator.userAgent
    });

    if (result.error) {
      console.error(result.error);
      return;
    }
    if (result.data?.duplicate) return;

    S.warnings = result.data?.violation_count ?? S.warnings;
    $("warnings").textContent = String(S.warnings);
    if (result.data?.message) showToast(result.data.message);
  }

  async function submitAttempt(expired = false) {
    if (S.submitting) return;
    S.submitting = true;
    window.clearInterval(S.timerHandle);
    closeConfidenceModal();
    closeFlashcard();

    const result = await sb.rpc("acl_submit_and_score_attempt", {
      p_attempt_id: S.attempt.id,
      p_force_expired: expired
    });

    if (result.error) {
      S.submitting = false;
      showToast("Submission failed: " + result.error.message);
      return;
    }

    const values = result.data;
    const items = [
      ["Total score", values.total_score],
      ["Correct", values.correct_count],
      ["Incorrect", values.incorrect_count],
      ["Unanswered", values.unanswered_count],
      ["Accuracy", `${values.accuracy_percent}%`],
      ["High-confidence errors", values.high_confidence_errors],
      ["Penalty", values.anti_cheat_penalty],
      ["Total time", formatDuration(values.total_time_seconds)],
      ["Status", values.status]
    ];

    $("resultGrid").innerHTML = items
      .map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`)
      .join("");

    showScreen("result");

    if (S.quiz.show_final_review && S.quiz.feedback_mode !== "none") {
      await renderFinalReview();
    }
  }

  async function renderFinalReview() {
    const list = $("finalReviewList");
    if (!list) return;

    $("finalReviewSection").classList.remove("hidden");
    list.innerHTML = "<p>Loading final review…</p>";

    const reviews = [];
    for (const question of S.questions) {
      try {
        reviews.push({ question, review: await fetchReview(question.id) });
      } catch (error) {
        reviews.push({ question, error });
      }
    }

    list.innerHTML = reviews.map(({ question, review, error }, index) => {
      if (error || !review) {
        return `<details class="final-review-item"><summary>Question ${index + 1}: review unavailable</summary><div class="final-review-body">${escapeHtml(error?.message || "No review data.")}</div></details>`;
      }

      return `
        <details class="final-review-item ${review.is_correct ? "correct" : "incorrect"}">
          <summary>Question ${index + 1} — ${review.is_correct ? "Correct" : "Incorrect"} (${Number(review.points_awarded) >= 0 ? "+" : ""}${review.points_awarded})</summary>
          <div class="final-review-body">
            <h3>${escapeHtml(question.text)}</h3>
            <p><strong>Your answer:</strong> ${escapeHtml(review.selected_option_key ? `${review.selected_option_key}. ${review.selected_option_text}` : "Not answered")}</p>
            <p><strong>Correct answer:</strong> ${escapeHtml(`${review.correct_option_key}. ${review.correct_option_text}`)}</p>
            <p><strong>Explanation:</strong> ${escapeHtml(review.explanation || "No explanation has been added.")}</p>
          </div>
        </details>
      `;
    }).join("");
  }

  $("enterBtn").addEventListener("click", () => showScreen("identity"));
  $("backBtn").addEventListener("click", () => showScreen("entry"));

  $("identityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const person = {
      name: $("name").value.trim(),
      email: $("email").value.trim(),
      phone: $("phone").value.trim(),
      level: $("level").value,
      passcode: $("passcode")?.value || ""
    };

    try {
      await beginAttempt(person);
      $("formMsg").classList.add("hidden");
      showScreen("quiz");
      renderQuestion();
    } catch (error) {
      $("formMsg").className = "msg error";
      $("formMsg").textContent = error.message || "The attempt could not be started.";
      $("formMsg").classList.remove("hidden");
    }
  });

  $("high").addEventListener("click", () => selectConfidence("high"));
  $("low").addEventListener("click", () => selectConfidence("low"));
  $("rethink").addEventListener("click", closeConfidenceModal);
  $("continueBtn").addEventListener("click", advanceAfterAnswer);
  $("flashcardBtn").addEventListener("click", () => openFlashcard(S.reviews[currentQuestion()?.id]));
  $("closeFlashcard").addEventListener("click", closeFlashcard);
  $("closeFlashcardBottom").addEventListener("click", closeFlashcard);

  $("prev").addEventListener("click", async () => {
    if (
      S.index > 0 &&
      S.quiz.navigation_mode === "free_review" &&
      S.quiz.timer_mode !== "per_question"
    ) {
      await moveToQuestion(S.index - 1);
    }
  });

  $("skipQuestion").addEventListener("click", async () => {
    if (S.index < S.questions.length - 1) {
      await moveToQuestion(S.index + 1);
      return;
    }
    const firstIncomplete = S.questions.findIndex((question) => !isComplete(question));
    if (firstIncomplete >= 0) await moveToQuestion(firstIncomplete);
    else await submitAttempt(false);
  });

  $("saveExit").addEventListener("click", async () => {
    S.suppressVisibility = true;
    await saveCurrentAnswer();
    window.clearInterval(S.timerHandle);
    showScreen("entry");
    renderEntry();
    window.setTimeout(() => { S.suppressVisibility = false; }, 800);
  });

  document.addEventListener("visibilitychange", () => {
    if (
      document.hidden &&
      !S.suppressVisibility &&
      !S.submitting &&
      !$("quiz").classList.contains("hidden")
    ) {
      recordEvent("tab_hidden");
    }
  });

  window.addEventListener("offline", () => recordEvent("offline"));
  window.addEventListener("online", () => recordEvent("online"));

  loadQuiz().catch((error) => {
    console.error(error);
    $("status").textContent = "Error";
    $("status").className = "status-pill error";
    $("entryMsg").className = "msg error";
    $("entryMsg").textContent = error.message || "The quiz could not be loaded.";
    $("enterBtn").disabled = true;
  });
})();
