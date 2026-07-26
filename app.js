(() => {
  "use strict";

  if (!window.supabase) {
    throw new Error(
      "Supabase library did not load. Check the script order in index.html."
    );
  }

  const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const S = {
    quiz: null,
    qs: [],
    attempt: null,
    person: null,
    answers: {},

    i: 0,
    timer: null,
    qStart: 0,

    warnings: 0,
    submitting: false,

    lastEventAt: 0,
    toastTimer: null,
    suppressVisibility: false
  };

  const $ = (id) => document.getElementById(id);

  const screens = [
    "entry",
    "identity",
    "quiz",
    "result"
  ];


  /* ======================================================
     GENERAL HELPERS
  ====================================================== */

  function show(id) {
    closeConfidenceModal();

    screens.forEach((screenId) => {
      $(screenId)?.classList.toggle(
        "hidden",
        screenId !== id
      );
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function fmt(dateValue) {
    if (!dateValue) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Cairo"
      }
    ).format(new Date(dateValue));
  }

  function mmss(seconds) {
    const safeSeconds = Math.max(
      0,
      Math.floor(Number(seconds) || 0)
    );

    const minutes = Math.floor(
      safeSeconds / 60
    );

    const remainingSeconds =
      safeSeconds % 60;

    return (
      `${String(minutes).padStart(2, "0")}:` +
      `${String(remainingSeconds).padStart(2, "0")}`
    );
  }

  function showToast(message) {
    if (!message) {
      return;
    }

    const toast =
      $("violationToast");

    const text =
      $("violationToastText");

    if (!toast || !text) {
      console.warn(message);
      return;
    }

    window.clearTimeout(
      S.toastTimer
    );

    text.textContent =
      message;

    toast.classList.remove(
      "hidden"
    );

    S.toastTimer =
      window.setTimeout(() => {
        toast.classList.add(
          "hidden"
        );
      }, 4200);
  }


  /* ======================================================
     CONFIDENCE MODAL
  ====================================================== */

  function openConfidenceModal() {
    const modal =
      $("confidenceModal");

    if (!modal) {
      console.error(
        "confidenceModal is missing from index.html."
      );

      return;
    }

    modal.classList.remove(
      "hidden"
    );

    document.body.style.overflow =
      "hidden";
  }

  function closeConfidenceModal() {
    $("confidenceModal")
      ?.classList.add("hidden");

    document.body.style.overflow =
      "";
  }


  /* ======================================================
     NAVIGATION ELEMENTS
  ====================================================== */

  function ensureNavigationUI() {
    const sidebar =
      document.querySelector(
        "#quiz .quiz-sidebar"
      );

    const saveExitButton =
      $("saveExit");

    if (!sidebar || !saveExitButton) {
      return;
    }

    /*
     * These elements are already present in the latest HTML.
     * The fallback creates them only if an older HTML file is used.
     */

    if (!$("questionMapSection")) {
      const mapSection =
        document.createElement("div");

      mapSection.id =
        "questionMapSection";

      mapSection.className =
        "sidebar-block question-map-section";

      mapSection.innerHTML = `
        <small>Question map</small>

        <div
          id="questionMap"
          class="question-map"
          aria-label="Question navigation map"
        ></div>
      `;

      sidebar.insertBefore(
        mapSection,
        saveExitButton
      );
    }

    if (!$("skipQuestion")) {
      const skipButton =
        document.createElement("button");

      skipButton.id =
        "skipQuestion";

      skipButton.type =
        "button";

      skipButton.className =
        "secondary full-button skip-question-button";

      skipButton.textContent =
        "Skip and review later";

      sidebar.insertBefore(
        skipButton,
        saveExitButton
      );
    }
  }


  /* ======================================================
     AUTHENTICATION
  ====================================================== */

  async function authenticate() {
    const sessionResult =
      await sb.auth.getSession();

    if (sessionResult.error) {
      throw sessionResult.error;
    }

    if (sessionResult.data.session) {
      return;
    }

    const signInResult =
      await sb.auth.signInAnonymously();

    if (signInResult.error) {
      throw new Error(
        "Anonymous sign-in failed: " +
        signInResult.error.message
      );
    }
  }


  /* ======================================================
     LOAD QUIZ
  ====================================================== */

  async function fetchQuizRow() {
    const standardColumns = `
      id,
      title,
      description,
      slug,
      status,
      opens_at,
      closes_at,
      duration_minutes,
      access_type,
      allow_resume,
      timer_mode,
      quiz_duration_seconds,
      default_question_time_seconds
    `;

    let result =
      await sb
        .from("quizzes")
        .select(`
          ${standardColumns},
          navigation_mode
        `)
        .eq("slug", QUIZ_SLUG)
        .single();

    /*
     * Compatibility fallback if navigation_mode has not
     * yet been added to the quizzes table.
     */
    if (
      result.error &&
      result.error.message
        ?.toLowerCase()
        .includes("navigation_mode")
    ) {
      result =
        await sb
          .from("quizzes")
          .select(standardColumns)
          .eq("slug", QUIZ_SLUG)
          .single();

      if (result.data) {
        result.data.navigation_mode =
          "free_review";
      }
    }

    return result;
  }

  async function load() {
    try {
      await authenticate();

      const quizResult =
        await fetchQuizRow();

      if (quizResult.error) {
        throw quizResult.error;
      }

      const questionResult =
        await sb
          .from("questions")
          .select(`
            id,
            order_index,
            question_type,
            question_text,
            stem,
            scenario,
            image_url,
            time_limit_seconds,

            question_options (
              id,
              option_key,
              option_text,
              display_order
            )
          `)
          .eq(
            "quiz_id",
            quizResult.data.id
          )
          .order(
            "order_index",
            {
              ascending: true
            }
          );

      if (questionResult.error) {
        throw questionResult.error;
      }

      S.quiz =
        quizResult.data;

      S.quiz.navigation_mode =
        S.quiz.navigation_mode ||
        "free_review";

      S.qs =
        (questionResult.data || []).map(
          (question) => ({
            ...question,

            text:
              question.question_text ||
              question.stem,

            options:
              [
                ...(
                  question.question_options ||
                  []
                )
              ].sort(
                (first, second) =>
                  first.display_order -
                  second.display_order
              )
          })
        );

      ensureNavigationUI();
      bindNavigationEvents();
      renderEntry();
    } catch (error) {
      console.error(error);

      $("status").textContent =
        "Error";

      $("status").className =
        "status-pill error";

      $("entryMsg").className =
        "msg error";

      $("entryMsg").textContent =
        error.message ||
        "The quiz could not be loaded.";

      $("enterBtn").disabled =
        true;
    }
  }


  /* ======================================================
     ENTRY SCREEN
  ====================================================== */

  function availability() {
    const now =
      Date.now();

    const opens =
      new Date(
        S.quiz.opens_at
      ).getTime();

    const closes =
      new Date(
        S.quiz.closes_at
      ).getTime();

    if (now < opens) {
      return "locked";
    }

    if (now >= closes) {
      return "closed";
    }

    return "open";
  }

  function timerDescription() {
    if (
      S.quiz.timer_mode ===
      "none"
    ) {
      return "No timer";
    }

    if (
      S.quiz.timer_mode ===
      "per_question"
    ) {
      return (
        `${S.quiz.default_question_time_seconds || 60}` +
        "s/question"
      );
    }

    const totalSeconds =
      S.quiz.quiz_duration_seconds ||
      (
        S.quiz.duration_minutes ||
        15
      ) * 60;

    return (
      `${Math.ceil(totalSeconds / 60)}` +
      " minutes total"
    );
  }

  function renderEntry() {
    const state =
      availability();

    $("title").textContent =
      S.quiz.title;

    $("desc").textContent =
      S.quiz.description || "";

    $("opens").textContent =
      fmt(S.quiz.opens_at);

    $("closes").textContent =
      fmt(S.quiz.closes_at);

    $("timerMode").textContent =
      timerDescription();

    $("count").textContent =
      String(S.qs.length);

    $("status").textContent =
      state === "open"
        ? "Open now"
        : state === "locked"
          ? "Not open yet"
          : "Closed";

    $("status").className =
      `status-pill ${state}`;

    const hasQuestions =
      S.qs.length > 0;

    $("enterBtn").disabled =
      state !== "open" ||
      !hasQuestions;

    if (!hasQuestions) {
      $("entryMsg").textContent =
        "This quiz has no questions yet.";

      $("entryMsg").className =
        "msg error";
    } else if (state === "open") {
      $("entryMsg").textContent =
        "The competition is open.";

      $("entryMsg").className =
        "msg success";
    } else if (state === "locked") {
      $("entryMsg").textContent =
        `Opens ${fmt(S.quiz.opens_at)}`;

      $("entryMsg").className =
        "msg warning";
    } else {
      $("entryMsg").textContent =
        `Closed ${fmt(S.quiz.closes_at)}`;

      $("entryMsg").className =
        "msg error";
    }

    const passcodeRequired =
      S.quiz.access_type ===
      "passcode";

    $("passcodeField")
      ?.classList.toggle(
        "hidden",
        !passcodeRequired
      );

    $("passcode")
      ?.classList.toggle(
        "hidden",
        !passcodeRequired
      );
  }


  /* ======================================================
     START OR RESUME ATTEMPT
  ====================================================== */

  async function begin(person) {
    if (!S.qs.length) {
      throw new Error(
        "This quiz has no questions."
      );
    }

    const result =
      await sb.rpc(
        "acl_start_or_resume_attempt",
        {
          p_quiz_id:
            S.quiz.id,

          p_full_name:
            person.name,

          p_email:
            person.email,

          p_phone:
            person.phone,

          p_academic_level:
            person.level,

          p_passcode:
            person.passcode || null
        }
      );

    if (result.error) {
      throw result.error;
    }

    S.attempt =
      result.data;

    S.person =
      person;

    S.i = Math.min(
      Math.max(
        Number(
          result.data
            .current_question_index
        ) || 0,
        0
      ),
      Math.max(
        S.qs.length - 1,
        0
      )
    );

    S.warnings =
      Number(
        result.data
          .violation_count
      ) || 0;

    $("warnings").textContent =
      String(S.warnings);

    const answerResult =
      await sb
        .from("attempt_answers")
        .select(`
          question_id,
          selected_option_ids,
          confidence,
          response_time_seconds
        `)
        .eq(
          "attempt_id",
          result.data.id
        );

    if (answerResult.error) {
      throw answerResult.error;
    }

    S.answers = {};

    (
      answerResult.data ||
      []
    ).forEach((answer) => {
      S.answers[
        answer.question_id
      ] = {
        optionId:
          answer
            .selected_option_ids
            ?.[0] ||
          null,

        confidence:
          answer.confidence ||
          null,

        responseTime:
          Number(
            answer.response_time_seconds
          ) || 0
      };
    });
  }


  /* ======================================================
     NAVIGATION MODES
  ====================================================== */

  function navigationMode() {
    return (
      S.quiz.navigation_mode ||
      "free_review"
    );
  }

  function applyNavigationMode() {
    const mode =
      navigationMode();

    const previousButton =
      $("prev");

    const nextButton =
      $("next");

    const skipButton =
      $("skipQuestion");

    const mapSection =
      $("questionMapSection");

    const nav =
      document.querySelector(
        ".question-card .nav"
      );

    /*
     * High or Low confidence now automatically advances.
     * Therefore the old Save and Next button is always hidden.
     */
    nextButton?.classList.add(
      "hidden"
    );

    const perQuestion =
      S.quiz.timer_mode ===
      "per_question";

    if (
      mode ===
      "locked_sequential"
    ) {
      previousButton?.classList.add(
        "hidden"
      );

      skipButton?.classList.add(
        "hidden"
      );

      mapSection?.classList.add(
        "hidden"
      );

      nav?.classList.add(
        "hidden"
      );

      return;
    }

    mapSection?.classList.remove(
      "hidden"
    );

    skipButton?.classList.remove(
      "hidden"
    );

    if (
      mode ===
      "map_review"
    ) {
      previousButton?.classList.add(
        "hidden"
      );

      nav?.classList.add(
        "hidden"
      );
    } else {
      previousButton?.classList.remove(
        "hidden"
      );

      previousButton.disabled =
        S.i === 0 ||
        perQuestion;

      nav?.classList.remove(
        "hidden"
      );
    }
  }

  async function moveToQuestion(index) {
    if (
      index < 0 ||
      index >= S.qs.length
    ) {
      return;
    }

    await save();

    S.i =
      index;

    await updateCurrentIndex();

    renderQuestion();
  }

  function renderQuestionMap() {
    const map =
      $("questionMap");

    const section =
      $("questionMapSection");

    if (!map || !section) {
      return;
    }

    const mode =
      navigationMode();

    if (
      mode ===
      "locked_sequential"
    ) {
      section.classList.add(
        "hidden"
      );

      return;
    }

    section.classList.remove(
      "hidden"
    );

    map.innerHTML =
      "";

    S.qs.forEach(
      (question, index) => {
        const answer =
          S.answers[
            question.id
          ];

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.textContent =
          String(index + 1);

        button.setAttribute(
          "aria-label",
          `Open question ${index + 1}`
        );

        const completed =
          Boolean(
            answer?.optionId &&
            answer?.confidence
          );

        if (index === S.i) {
          button.classList.add(
            "current"
          );
        } else if (completed) {
          button.classList.add(
            "answered"
          );
        } else {
          button.classList.add(
            "unanswered"
          );
        }

        /*
         * Earlier questions cannot be reopened when each
         * question has an individual countdown.
         */
        if (
          S.quiz.timer_mode ===
            "per_question" &&
          index < S.i
        ) {
          button.disabled =
            true;
        } else {
          button.addEventListener(
            "click",
            () => {
              moveToQuestion(
                index
              );
            }
          );
        }

        map.appendChild(
          button
        );
      }
    );
  }


  /* ======================================================
     RENDER QUESTION
  ====================================================== */

  function renderQuestion() {
    closeConfidenceModal();

    const question =
      S.qs[S.i];

    if (!question) {
      showToast(
        "The question could not be loaded."
      );

      return;
    }

    const answer =
      S.answers[
        question.id
      ] || {};

    S.qStart =
      Date.now();

    $("participant").textContent =
      S.person.name;

    $("progress").textContent =
      `Question ${S.i + 1} of ${S.qs.length}`;

    $("bar").style.width =
      `${((S.i + 1) / S.qs.length) * 100}%`;

    $("stem").textContent =
      question.text;

    $("scenario").textContent =
      question.scenario || "";

    $("scenario").classList.toggle(
      "hidden",
      !question.scenario
    );

    $("options").innerHTML =
      "";

    question.options.forEach(
      (option) => {
        const label =
          document.createElement(
            "label"
          );

        label.className =
          "option" +
          (
            answer.optionId ===
            option.id
              ? " selected"
              : ""
          );

        const input =
          document.createElement(
            "input"
          );

        input.type =
          "radio";

        input.name =
          `answer-${question.id}`;

        input.checked =
          answer.optionId ===
          option.id;

        const letter =
          document.createElement(
            "span"
          );

        letter.className =
          "letter";

        letter.textContent =
          option.option_key;

        const optionText =
          document.createElement(
            "span"
          );

        optionText.textContent =
          option.option_text;

        input.addEventListener(
          "change",
          async () => {
            S.answers[
              question.id
            ] = {
              ...S.answers[
                question.id
              ],

              optionId:
                option.id,

              /*
               * Changing an answer always requires
               * a new confidence declaration.
               */
              confidence:
                null
            };

            document
              .querySelectorAll(
                ".option"
              )
              .forEach(
                (element) => {
                  element.classList.remove(
                    "selected"
                  );
                }
              );

            label.classList.add(
              "selected"
            );

            await save();

            renderQuestionMap();

            openConfidenceModal();
          }
        );

        /*
         * After selecting “Let me think again,” clicking the
         * same selected answer reopens the confidence modal.
         */
        label.addEventListener(
          "click",
          () => {
            const currentAnswer =
              S.answers[
                question.id
              ];

            if (
              currentAnswer?.optionId ===
                option.id &&
              !currentAnswer?.confidence
            ) {
              window.setTimeout(
                openConfidenceModal,
                0
              );
            }
          }
        );

        label.append(
          input,
          letter,
          optionText
        );

        $("options").appendChild(
          label
        );
      }
    );

    applyNavigationMode();
    renderQuestionMap();
    startTimer();
  }


  /* ======================================================
     SAVE ANSWER
  ====================================================== */

  async function save() {
    if (
      !S.attempt ||
      !S.qs[S.i]
    ) {
      return false;
    }

    const question =
      S.qs[S.i];

    const answer =
      S.answers[
        question.id
      ] || {};

    $("saveState").textContent =
      "Saving…";

    const responseTime =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            S.qStart
          ) / 1000
        )
      );

    const result =
      await sb.rpc(
        "acl_save_answer_with_confidence",
        {
          p_attempt_id:
            S.attempt.id,

          p_question_id:
            question.id,

          p_selected_option_id:
            answer.optionId ||
            null,

          p_confidence:
            answer.confidence ||
            null,

          p_response_time_seconds:
            responseTime,

          p_current_question_index:
            S.i
        }
      );

    if (result.error) {
      $("saveState").textContent =
        "Save failed";

      console.error(
        "Answer save failed:",
        result.error
      );

      showToast(
        "Your answer could not be saved. Please try again."
      );

      return false;
    }

    S.answers[
      question.id
    ] = {
      ...answer,
      responseTime
    };

    $("saveState").textContent =
      "Saved";

    return true;
  }


  /* ======================================================
     CONFIDENCE SELECTION AND AUTOMATIC ADVANCE
  ====================================================== */

  async function selectConfidence(
    confidence
  ) {
    const question =
      S.qs[S.i];

    if (
      !question ||
      !S.answers[
        question.id
      ]?.optionId
    ) {
      closeConfidenceModal();

      showToast(
        "Select an answer before choosing confidence."
      );

      return;
    }

    S.answers[
      question.id
    ] = {
      ...S.answers[
        question.id
      ],

      confidence
    };

    closeConfidenceModal();

    const saved =
      await save();

    if (!saved) {
      return;
    }

    renderQuestionMap();

    /*
     * High or Low confidence immediately submits the current
     * question and moves to the following question.
     */
    if (
      S.i <
      S.qs.length - 1
    ) {
      S.i += 1;

      await updateCurrentIndex();

      renderQuestion();

      return;
    }

    /*
     * On the final question, return to the first incomplete
     * question when review is permitted.
     */
    const firstIncompleteIndex =
      S.qs.findIndex(
        (item) => {
          const itemAnswer =
            S.answers[
              item.id
            ];

          return !(
            itemAnswer?.optionId &&
            itemAnswer?.confidence
          );
        }
      );

    if (
      firstIncompleteIndex >= 0 &&
      navigationMode() !==
        "locked_sequential"
    ) {
      S.i =
        firstIncompleteIndex;

      await updateCurrentIndex();

      renderQuestion();

      showToast(
        "Returning to the first unanswered question."
      );

      return;
    }

    /*
     * Every required question is complete.
     */
    await submit(false);
  }


  /* ======================================================
     TIMER
  ====================================================== */

  function questionLimit() {
    return (
      S.qs[S.i]
        .time_limit_seconds ||
      S.quiz
        .default_question_time_seconds ||
      60
    );
  }

  function startTimer() {
    window.clearInterval(
      S.timer
    );

    if (
      S.quiz.timer_mode ===
      "none"
    ) {
      $("timerBox").classList.add(
        "hidden"
      );

      return;
    }

    $("timerBox").classList.remove(
      "hidden"
    );

    const tick =
      async () => {
        let remaining;

        if (
          S.quiz.timer_mode ===
          "per_question"
        ) {
          $("timerLabel").textContent =
            "Question time";

          remaining =
            questionLimit() -
            Math.floor(
              (
                Date.now() -
                S.qStart
              ) / 1000
            );
        } else {
          $("timerLabel").textContent =
            "Quiz time";

          remaining =
            Math.floor(
              (
                new Date(
                  S.attempt.expires_at
                ).getTime() -
                Date.now()
              ) / 1000
            );
        }

        $("timer").textContent =
          mmss(remaining);

        if (remaining <= 0) {
          window.clearInterval(
            S.timer
          );

          if (
            S.quiz.timer_mode ===
            "per_question"
          ) {
            await timeoutQuestion();
          } else {
            await submit(true);
          }
        }
      };

    tick();

    S.timer =
      window.setInterval(
        tick,
        1000
      );
  }

  async function timeoutQuestion() {
    closeConfidenceModal();

    const question =
      S.qs[S.i];

    if (
      !S.answers[
        question.id
      ]?.optionId
    ) {
      S.answers[
        question.id
      ] = {
        optionId: null,
        confidence: null
      };

      await save();
    }

    if (
      S.i ===
      S.qs.length - 1
    ) {
      await submit(true);

      return;
    }

    S.i += 1;

    await updateCurrentIndex();

    renderQuestion();
  }


  /* ======================================================
     UPDATE CURRENT QUESTION INDEX
  ====================================================== */

  async function updateCurrentIndex() {
    if (!S.attempt) {
      return false;
    }

    const result =
      await sb
        .from("quiz_attempts")
        .update({
          current_question_index:
            S.i,

          last_saved_at:
            new Date()
              .toISOString()
        })
        .eq(
          "id",
          S.attempt.id
        );

    if (result.error) {
      console.error(
        "Question index update failed:",
        result.error
      );

      return false;
    }

    return true;
  }


  /* ======================================================
     ANTI-CHEAT EVENTS
  ====================================================== */

  async function recordEvent(type) {
    if (
      !S.attempt ||
      S.submitting ||
      S.suppressVisibility
    ) {
      return;
    }

    const now =
      Date.now();

    /*
     * Ignore duplicate browser events caused by
     * one genuine visibility change.
     */
    if (
      now - S.lastEventAt <
      5000
    ) {
      return;
    }

    S.lastEventAt =
      now;

    const result =
      await sb.rpc(
        "acl_record_attempt_event",
        {
          p_attempt_id:
            S.attempt.id,

          p_event_type:
            type,

          p_question_id:
            S.qs[S.i]?.id ||
            null,

          p_browser_details:
            navigator.userAgent
        }
      );

    if (result.error) {
      console.error(
        "Anti-cheat event failed:",
        result.error
      );

      return;
    }

    if (result.data?.duplicate) {
      return;
    }

    S.warnings =
      result.data
        ?.violation_count ??
      S.warnings;

    $("warnings").textContent =
      String(S.warnings);

    if (result.data?.message) {
      showToast(
        result.data.message
      );
    }
  }


  /* ======================================================
     FINAL SUBMISSION
  ====================================================== */

  async function submit(
    expired = false
  ) {
    if (S.submitting) {
      return;
    }

    S.submitting =
      true;

    window.clearInterval(
      S.timer
    );

    closeConfidenceModal();

    const saved =
      await save();

    if (!saved && !expired) {
      S.submitting =
        false;

      return;
    }

    const result =
      await sb.rpc(
        "acl_submit_and_score_attempt",
        {
          p_attempt_id:
            S.attempt.id,

          p_force_expired:
            expired
        }
      );

    if (result.error) {
      S.submitting =
        false;

      console.error(
        "Submission failed:",
        result.error
      );

      showToast(
        "Submission failed: " +
        result.error.message
      );

      return;
    }

    const values =
      result.data;

    const items = [
      [
        "Total score",
        values.total_score
      ],
      [
        "Correct",
        values.correct_count
      ],
      [
        "Incorrect",
        values.incorrect_count
      ],
      [
        "Unanswered",
        values.unanswered_count
      ],
      [
        "Accuracy",
        values.accuracy_percent +
          "%"
      ],
      [
        "High-confidence errors",
        values.high_confidence_errors
      ],
      [
        "Penalty",
        values.anti_cheat_penalty
      ],
      [
        "Total time",
        mmss(
          values.total_time_seconds
        )
      ],
      [
        "Status",
        values.status
      ]
    ];

    $("resultGrid").innerHTML =
      items
        .map(
          ([label, value]) => `
            <div>
              <small>${label}</small>
              <b>${value}</b>
            </div>
          `
        )
        .join("");

    show("result");
  }


  /* ======================================================
     SKIP BUTTON
  ====================================================== */

  let navigationEventsBound =
    false;

  function bindNavigationEvents() {
    if (navigationEventsBound) {
      return;
    }

    navigationEventsBound =
      true;

    $("skipQuestion")
      ?.addEventListener(
        "click",
        async () => {
          closeConfidenceModal();

          await save();

          if (
            S.i <
            S.qs.length - 1
          ) {
            S.i += 1;

            await updateCurrentIndex();

            renderQuestion();

            return;
          }

          const firstIncompleteIndex =
            S.qs.findIndex(
              (question) => {
                const answer =
                  S.answers[
                    question.id
                  ];

                return !(
                  answer?.optionId &&
                  answer?.confidence
                );
              }
            );

          if (
            firstIncompleteIndex >= 0
          ) {
            S.i =
              firstIncompleteIndex;

            await updateCurrentIndex();

            renderQuestion();
          } else {
            showToast(
              "All questions have been completed."
            );
          }
        }
      );
  }


  /* ======================================================
     MAIN EVENT HANDLERS
  ====================================================== */

  $("enterBtn").onclick =
    () => show("identity");

  $("backBtn").onclick =
    () => show("entry");

  $("identityForm").onsubmit =
    async (event) => {
      event.preventDefault();

      const person = {
        name:
          $("name")
            .value
            .trim(),

        email:
          $("email")
            .value
            .trim(),

        phone:
          $("phone")
            .value
            .trim(),

        level:
          $("level")
            .value,

        passcode:
          $("passcode")
            ?.value ||
          ""
      };

      try {
        await begin(person);

        $("formMsg")
          .classList.add(
            "hidden"
          );

        show("quiz");

        renderQuestion();
      } catch (error) {
        console.error(error);

        $("formMsg").className =
          "msg error";

        $("formMsg").textContent =
          error.message ||
          "The attempt could not be started.";

        $("formMsg")
          .classList.remove(
            "hidden"
          );
      }
    };


  /*
   * High and Low confidence immediately save
   * and advance to the next question.
   */
  $("high").onclick =
    () => selectConfidence(
      "high"
    );

  $("low").onclick =
    () => selectConfidence(
      "low"
    );


  /*
   * Rethink closes the modal and keeps the participant
   * on the same question.
   */
  $("rethink").onclick =
    () => {
      closeConfidenceModal();
    };


  $("prev").onclick =
    async () => {
      if (
        S.i <= 0 ||
        S.quiz.timer_mode ===
          "per_question" ||
        navigationMode() !==
          "free_review"
      ) {
        return;
      }

      await moveToQuestion(
        S.i - 1
      );
    };


  /*
   * The Next button is retained in the HTML for compatibility
   * but hidden because confidence selection now advances.
   */
  if ($("next")) {
    $("next").onclick =
      () => {
        const question =
          S.qs[S.i];

        const answer =
          S.answers[
            question.id
          ];

        if (!answer?.optionId) {
          showToast(
            "Select an answer first."
          );

          return;
        }

        if (!answer?.confidence) {
          openConfidenceModal();
        }
      };
  }


  $("saveExit").onclick =
    async () => {
      S.suppressVisibility =
        true;

      closeConfidenceModal();

      await save();

      window.clearInterval(
        S.timer
      );

      show("entry");

      renderEntry();

      window.setTimeout(() => {
        S.suppressVisibility =
          false;
      }, 800);
    };


  /*
   * Only genuine document hiding is counted.
   * window.blur is intentionally not used.
   */
  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden &&
        !S.suppressVisibility &&
        !S.submitting &&
        !$("quiz")
          .classList
          .contains("hidden")
      ) {
        recordEvent(
          "tab_hidden"
        );
      }
    }
  );

  window.addEventListener(
    "offline",
    () => {
      recordEvent(
        "offline"
      );
    }
  );

  window.addEventListener(
    "online",
    () => {
      recordEvent(
        "online"
      );
    }
  );


  /* ======================================================
     START
  ====================================================== */

  load();
})();