console.log(
  "ACL QUIZ ENGINE v5.3.0 LOADED"
);


/* =========================================================
   CONSTANTS
========================================================= */

const TIMER_MODES =
  new Set([
    "none",
    "quiz",
    "question"
  ]);


const MAX_IDLE_GAP_SECONDS =
  5;


/* =========================================================
   GENERAL HELPERS
========================================================= */

function normalizeNonNegativeNumber(
  value,
  fallback = 0
) {
  const numericValue =
    Number(
      value
    );


  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    return fallback;
  }


  return numericValue;
}


function normalizePositiveInteger(
  value,
  fallback = 0
) {
  const numericValue =
    Math.floor(
      Number(
        value
      )
    );


  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return fallback;
  }


  return numericValue;
}


function normalizeTimestamp(
  value
) {
  const numericValue =
    Number(
      value
    );


  if (
    Number.isFinite(
      numericValue
    ) &&
    numericValue > 0
  ) {
    return numericValue;
  }


  if (
    typeof value ===
      "string"
  ) {
    const parsed =
      new Date(
        value
      ).getTime();


    if (
      Number.isFinite(
        parsed
      )
    ) {
      return parsed;
    }
  }


  return null;
}


/* =========================================================
   QUIZ ENGINE
========================================================= */

export class QuizEngine {
  constructor({
    questions,
    count = 5,
    questionIds = null,
    currentIndex = 0,
    answers = [],
    confidenceEnabled = false,

    timerMode = "none",
    quizDurationSeconds = 0,
    defaultQuestionTimeSeconds = 0,

    activeTimeSeconds = 0,
    questionTimeSeconds = 0,
    questionStartedAt = null,
    lastActiveTimestamp = null,
    timingActive = false
  }) {
    const safeQuestions =
      Array.isArray(
        questions
      )
        ? questions.filter(
            (
              question
            ) =>
              question &&
              question.id !==
                undefined &&
              question.id !==
                null
          )
        : [];


    const questionsById =
      new Map(
        safeQuestions.map(
          (
            question
          ) => [
            String(
              question.id
            ),
            question
          ]
        )
      );


    const restoredQuestions =
      Array.isArray(
        questionIds
      ) &&
      questionIds.length
        ? questionIds
            .map(
              (
                id
              ) =>
                questionsById.get(
                  String(
                    id
                  )
                )
            )
            .filter(
              Boolean
            )
        : null;


    const requestedCount =
      Math.max(
        0,
        Math.floor(
          Number(
            count
          ) ||
          0
        )
      );


    this.questions =
      restoredQuestions ||
      this.shuffleQuestions(
        safeQuestions
      ).slice(
        0,
        Math.min(
          requestedCount,
          safeQuestions.length
        )
      );


    this.index =
      Math.min(
        Math.max(
          Math.floor(
            Number(
              currentIndex
            ) ||
            0
          ),
          0
        ),
        this.questions.length
      );


    this.confidenceEnabled =
      Boolean(
        confidenceEnabled
      );


    this.answers =
      Array.isArray(
        answers
      )
        ? answers
            .map(
              (
                answer
              ) =>
                this.normalizeSavedAnswer(
                  answer
                )
            )
            .filter(
              Boolean
            )
        : [];


    /*
     * Timing state is deliberately stored inside the engine.
     * The page will call resumeTiming() and pauseTiming()
     * according to visibility and module status.
     */

    this.timerMode =
      this.normalizeTimerMode(
        timerMode
      );


    this.quizDurationSeconds =
      normalizePositiveInteger(
        quizDurationSeconds,
        0
      );


    this.defaultQuestionTimeSeconds =
      normalizePositiveInteger(
        defaultQuestionTimeSeconds,
        0
      );


    this.activeTimeSeconds =
      normalizeNonNegativeNumber(
        activeTimeSeconds,
        0
      );


    this.questionTimeSeconds =
      normalizeNonNegativeNumber(
        questionTimeSeconds,
        0
      );


    this.questionStartedAt =
      normalizeTimestamp(
        questionStartedAt
      );


    this.lastActiveTimestamp =
      normalizeTimestamp(
        lastActiveTimestamp
      );


    this.timingActive =
      Boolean(
        timingActive
      );


    /*
     * A restored attempt must never silently count the entire
     * period between the previous browser session and now.
     */

    if (
      this.timingActive
    ) {
      this.lastActiveTimestamp =
        Date.now();
    }


    if (
      !this.current()
    ) {
      this.timingActive =
        false;

      this.lastActiveTimestamp =
        null;
    }
  }


  /* =========================================================
     QUESTION SELECTION
  ========================================================= */

  shuffleQuestions(
    questions
  ) {
    const shuffled =
      [
        ...questions
      ];


    for (
      let index =
        shuffled.length -
        1;

      index >
        0;

      index -=
        1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
          (
            index +
            1
          )
        );


      [
        shuffled[index],
        shuffled[randomIndex]
      ] = [
        shuffled[randomIndex],
        shuffled[index]
      ];
    }


    return shuffled;
  }


  /* =========================================================
     QUESTION AND ANSWER ID HELPERS
  ========================================================= */

  sameQuestionId(
    first,
    second
  ) {
    return (
      String(
        first
      ) ===
      String(
        second
      )
    );
  }


  answerQuestionId(
    answer
  ) {
    return (
      answer?.questionId ??
      answer?.question_id ??
      null
    );
  }


  /* =========================================================
     CURRENT QUESTION
  ========================================================= */

  current() {
    return (
      this.questions[
        this.index
      ] ||
      null
    );
  }


  currentAnswer() {
    const question =
      this.current();


    if (!question) {
      return null;
    }


    return (
      this.answers.find(
        (
          answer
        ) =>
          this.sameQuestionId(
            answer.questionId,
            question.id
          )
      ) ||
      null
    );
  }


  getAnswerByQuestionId(
    questionId
  ) {
    return (
      this.answers.find(
        (
          answer
        ) =>
          this.sameQuestionId(
            answer.questionId,
            questionId
          )
      ) ||
      null
    );
  }


  hasAnsweredCurrent() {
    return Boolean(
      this.currentAnswer()
    );
  }


  /* =========================================================
     CONFIDENCE SETTINGS
  ========================================================= */

  setConfidenceEnabled(
    enabled
  ) {
    this.confidenceEnabled =
      Boolean(
        enabled
      );
  }


  isConfidenceEnabled() {
    return this.confidenceEnabled;
  }


  normalizeConfidence(
    confidence
  ) {
    if (
      confidence ===
        null ||
      confidence ===
        undefined ||
      confidence ===
        ""
    ) {
      return null;
    }


    const normalized =
      String(
        confidence
      )
        .trim()
        .toLowerCase();


    if (
      normalized ===
        "high" ||
      normalized ===
        "high-confidence" ||
      normalized ===
        "high_confidence"
    ) {
      return "high";
    }


    if (
      normalized ===
        "low" ||
      normalized ===
        "low-confidence" ||
      normalized ===
        "low_confidence"
    ) {
      return "low";
    }


    return null;
  }


  /* =========================================================
     TIMER CONFIGURATION
  ========================================================= */

  normalizeTimerMode(
    mode
  ) {
    const normalized =
      String(
        mode ||
        "none"
      )
        .trim()
        .toLowerCase();


    const aliases = {
      none:
        "none",

      off:
        "none",

      disabled:
        "none",

      quiz:
        "quiz",

      per_quiz:
        "quiz",

      "per-quiz":
        "quiz",

      whole_quiz:
        "quiz",

      question:
        "question",

      per_question:
        "question",

      "per-question":
        "question"
    };


    const resolved =
      aliases[
        normalized
      ] ||
      normalized;


    return TIMER_MODES.has(
      resolved
    )
      ? resolved
      : "none";
  }


  setTimerConfiguration({
    timerMode =
      this.timerMode,

    quizDurationSeconds =
      this.quizDurationSeconds,

    defaultQuestionTimeSeconds =
      this.defaultQuestionTimeSeconds
  } = {}) {
    this.syncTiming();


    this.timerMode =
      this.normalizeTimerMode(
        timerMode
      );


    this.quizDurationSeconds =
      normalizePositiveInteger(
        quizDurationSeconds,
        0
      );


    this.defaultQuestionTimeSeconds =
      normalizePositiveInteger(
        defaultQuestionTimeSeconds,
        0
      );


    return this.timerConfiguration();
  }


  timerConfiguration() {
    return {
      timerMode:
        this.timerMode,

      quizDurationSeconds:
        this.quizDurationSeconds,

      defaultQuestionTimeSeconds:
        this.defaultQuestionTimeSeconds
    };
  }


  hasTimer() {
    return (
      this.timerMode !==
      "none"
    );
  }


  hasQuizTimer() {
    return (
      this.timerMode ===
      "quiz" &&
      this.quizDurationSeconds >
        0
    );
  }


  hasQuestionTimer() {
    return (
      this.timerMode ===
      "question" &&
      this.currentQuestionTimeLimit() >
        0
    );
  }


  currentQuestionTimeLimit() {
    const question =
      this.current();


    if (!question) {
      return 0;
    }


    const questionSpecificLimit =
      normalizePositiveInteger(
        question.timeLimitSeconds ??
        question.time_limit_seconds,
        0
      );


    return (
      questionSpecificLimit ||
      this.defaultQuestionTimeSeconds
    );
  }


  /* =========================================================
     ACTIVE TIME TRACKING
  ========================================================= */

  now() {
    return Date.now();
  }


  resumeTiming(
    timestamp =
      this.now()
  ) {
    if (
      !this.current() ||
      this.isFinished()
    ) {
      this.timingActive =
        false;

      this.lastActiveTimestamp =
        null;


      return false;
    }


    const normalizedTimestamp =
      normalizeTimestamp(
        timestamp
      ) ||
      this.now();


    this.timingActive =
      true;


    this.lastActiveTimestamp =
      normalizedTimestamp;


    if (
      !this.questionStartedAt
    ) {
      this.questionStartedAt =
        normalizedTimestamp;
    }


    return true;
  }


  pauseTiming(
    timestamp =
      this.now()
  ) {
    this.syncTiming(
      timestamp
    );


    this.timingActive =
      false;


    this.lastActiveTimestamp =
      null;


    return this.activeTimeSeconds;
  }


  syncTiming(
    timestamp =
      this.now()
  ) {
    if (
      !this.timingActive ||
      !this.lastActiveTimestamp
    ) {
      return 0;
    }


    const normalizedTimestamp =
      normalizeTimestamp(
        timestamp
      ) ||
      this.now();


    const elapsedMilliseconds =
      Math.max(
        0,
        normalizedTimestamp -
        this.lastActiveTimestamp
      );


    let elapsedSeconds =
      elapsedMilliseconds /
      1000;


    /*
     * A very large gap usually means the browser suspended the
     * page, the device slept, or the tab stopped executing.
     * Count only a small safe interval rather than incorrectly
     * adding the whole inactive period.
     */

    if (
      elapsedSeconds >
      MAX_IDLE_GAP_SECONDS
    ) {
      elapsedSeconds =
        MAX_IDLE_GAP_SECONDS;
    }


    this.activeTimeSeconds +=
      elapsedSeconds;


    this.questionTimeSeconds +=
      elapsedSeconds;


    this.lastActiveTimestamp =
      normalizedTimestamp;


    return elapsedSeconds;
  }


  isTimingActive() {
    return Boolean(
      this.timingActive
    );
  }


  getActiveTimeSeconds() {
    this.syncTiming();


    return Math.max(
      0,
      Math.round(
        this.activeTimeSeconds
      )
    );
  }


  getQuestionTimeSeconds() {
    this.syncTiming();


    return Math.max(
      0,
      Math.round(
        this.questionTimeSeconds
      )
    );
  }


  resetQuestionTimer(
    timestamp =
      this.now()
  ) {
    this.syncTiming(
      timestamp
    );


    this.questionTimeSeconds =
      0;


    this.questionStartedAt =
      normalizeTimestamp(
        timestamp
      ) ||
      this.now();


    if (
      this.timingActive
    ) {
      this.lastActiveTimestamp =
        this.questionStartedAt;
    }


    return this.questionTimeSeconds;
  }


  remainingQuizSeconds() {
    if (
      !this.hasQuizTimer()
    ) {
      return null;
    }


    this.syncTiming();


    return Math.max(
      0,
      Math.ceil(
        this.quizDurationSeconds -
        this.activeTimeSeconds
      )
    );
  }


  remainingQuestionSeconds() {
    if (
      !this.hasQuestionTimer()
    ) {
      return null;
    }


    this.syncTiming();


    return Math.max(
      0,
      Math.ceil(
        this.currentQuestionTimeLimit() -
        this.questionTimeSeconds
      )
    );
  }


  isQuizTimedOut() {
    const remaining =
      this.remainingQuizSeconds();


    return (
      remaining !==
        null &&
      remaining <=
        0
    );
  }


  isQuestionTimedOut() {
    const remaining =
      this.remainingQuestionSeconds();


    return (
      remaining !==
        null &&
      remaining <=
        0
    );
  }


  timerSnapshot() {
    this.syncTiming();


    return {
      timerMode:
        this.timerMode,

      quizDurationSeconds
