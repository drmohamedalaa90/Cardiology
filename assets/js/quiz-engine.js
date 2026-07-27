export class QuizEngine {
  constructor({
    questions,
    count = 5,
    questionIds = null,
    currentIndex = 0,
    answers = [],
    confidenceEnabled = false
  }) {
    const safeQuestions =
      Array.isArray(questions)
        ? questions
        : [];

    const byId =
      new Map(
        safeQuestions.map(
          (question) => [
            question.id,
            question
          ]
        )
      );

    this.questions =
      Array.isArray(questionIds) &&
      questionIds.length
        ? questionIds
            .map(
              (id) =>
                byId.get(id)
            )
            .filter(Boolean)
        : [...safeQuestions]
            .sort(
              () =>
                Math.random() -
                0.5
            )
            .slice(
              0,
              count
            );

    this.index =
      Math.min(
        Math.max(
          Number(currentIndex) ||
            0,
          0
        ),
        this.questions.length
      );

    this.confidenceEnabled =
      Boolean(
        confidenceEnabled
      );

    this.answers =
      Array.isArray(answers)
        ? answers
            .map(
              (answer) =>
                this.normalizeSavedAnswer(
                  answer
                )
            )
            .filter(Boolean)
        : [];
  }


  /* =========================================================
     CURRENT QUESTION
  ========================================================= */

  current() {
    return (
      this.questions[
        this.index
      ] || null
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
        (answer) =>
          answer.questionId ===
          question.id
      ) || null
    );
  }


  getAnswerByQuestionId(
    questionId
  ) {
    return (
      this.answers.find(
        (answer) =>
          answer.questionId ===
          questionId
      ) || null
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
      Boolean(enabled);
  }


  isConfidenceEnabled() {
    return this.confidenceEnabled;
  }


  normalizeConfidence(
    confidence
  ) {
    if (
      confidence === null ||
      confidence === undefined ||
      confidence === ""
    ) {
      return null;
    }

    const normalized =
      String(confidence)
        .trim()
        .toLowerCase();

    if (
      normalized === "high" ||
      normalized ===
        "high-confidence" ||
      normalized ===
        "high_confidence"
    ) {
      return "high";
    }

    if (
      normalized === "low" ||
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
     SCORING
  ========================================================= */

  calculatePoints({
    correct,
    confidence = null,
    timedOut = false,
    confidenceEnabled =
      this.confidenceEnabled
  }) {
    /*
     * A timed-out or unanswered question
     * always receives -1.
     */

    if (timedOut) {
      return -1;
    }

    /*
     * Normal scoring when confidence
     * answering is disabled.
     */

    if (!confidenceEnabled) {
      return correct
        ? 1
        : 0;
    }

    const normalizedConfidence =
      this.normalizeConfidence(
        confidence
      );

    /*
     * Confidence scoring:
     *
     * Correct + High = +2
     * Correct + Low  = +1
     * Wrong + Low    =  0
     * Wrong + High   = -1
     */

    if (
      correct &&
      normalizedConfidence ===
        "high"
    ) {
      return 2;
    }

    if (
      correct &&
      normalizedConfidence ===
        "low"
    ) {
      return 1;
    }

    if (
      !correct &&
      normalizedConfidence ===
        "low"
    ) {
      return 0;
    }

    if (
      !correct &&
      normalizedConfidence ===
        "high"
    ) {
      return -1;
    }

    /*
     * Defensive fallback.
     *
     * The interface should prevent this
     * state when confidence is enabled.
     */

    return correct
      ? 1
      : 0;
  }


  /* =========================================================
     ANSWER SUBMISSION
  ========================================================= */

  submitAnswer({
    choice,
    confidence = null,
    timedOut = false
  }) {
    const question =
      this.current();

    if (!question) {
      return {
        accepted: false,
        reason:
          "no-current-question",
        answer: null
      };
    }

    const existing =
      this.answers.find(
        (answer) =>
          answer.questionId ===
          question.id
      );

    if (existing) {
      return {
        accepted: false,
        reason:
          "already-answered",
        answer:
          existing
      };
    }

    const normalizedConfidence =
      this.normalizeConfidence(
        confidence
      );

    /*
     * When confidence answering is enabled,
     * the candidate must select High or Low
     * confidence before submission.
     */

    if (
      this.confidenceEnabled &&
      !timedOut &&
      !normalizedConfidence
    ) {
      return {
        accepted: false,
        reason:
          "confidence-required",
        answer: null
      };
    }

    const numericChoice =
      timedOut ||
      choice === null ||
      choice === undefined ||
      choice === ""
        ? null
        : Number(choice);

    const correct =
      !timedOut &&
      numericChoice !== null &&
      Number.isFinite(
        numericChoice
      ) &&
      numericChoice ===
        Number(
          question.answer
        );

    const points =
      this.calculatePoints({
        correct,
        confidence:
          normalizedConfidence,
        timedOut,
        confidenceEnabled:
          this.confidenceEnabled
      });

    const answerRecord = {
      questionId:
        question.id,

      choice:
        numericChoice,

      correct,

      confidence:
        this.confidenceEnabled
          ? normalizedConfidence
          : null,

      confidenceEnabled:
        this.confidenceEnabled,

      timedOut:
        Boolean(timedOut),

      points,

      answeredAt:
        new Date().toISOString()
    };

    this.answers.push(
      answerRecord
    );

    return {
      accepted: true,
      reason: null,
      answer:
        answerRecord
    };
  }


  /*
   * Backward-compatible method.
   *
   * Existing code that currently calls:
   *
   * engine.answer(choice)
   *
   * will continue to work.
   *
   * Confidence-aware code can call:
   *
   * engine.answer(choice, "high")
   * engine.answer(choice, "low")
   */

  answer(
    choice,
    confidence = null
  ) {
    const result =
      this.submitAnswer({
        choice,
        confidence,
        timedOut: false
      });

    if (
      result.reason ===
      "confidence-required"
    ) {
      return null;
    }

    return (
      result.answer?.correct ??
      false
    );
  }


  markTimedOut() {
    return this.submitAnswer({
      choice: null,
      confidence: null,
      timedOut: true
    });
  }


  /* =========================================================
     NAVIGATION
  ========================================================= */

  next() {
    if (
      this.index <
      this.questions.length
    ) {
      this.index += 1;
    }

    return this.current();
  }


  previous() {
    if (this.index > 0) {
      this.index -= 1;
    }

    return this.current();
  }


  goTo(index) {
    const targetIndex =
      Number(index);

    if (
      !Number.isInteger(
        targetIndex
      )
    ) {
      return this.current();
    }

    this.index =
      Math.min(
        Math.max(
          targetIndex,
          0
        ),
        this.questions.length
      );

    return this.current();
  }


  /* =========================================================
     RESULTS
  ========================================================= */

  score() {
    return this.answers.reduce(
      (
        total,
        answer
      ) =>
        total +
        Number(
          answer.points ||
            0
        ),
      0
    );
  }


  correctCount() {
    return this.answers.filter(
      (answer) =>
        answer.correct
    ).length;
  }


  incorrectCount() {
    return this.answers.filter(
      (answer) =>
        !answer.correct &&
        !answer.timedOut
    ).length;
  }


  timedOutCount() {
    return this.answers.filter(
      (answer) =>
        answer.timedOut
    ).length;
  }


  answeredCount() {
    return this.answers.length;
  }


  remainingCount() {
    return Math.max(
      this.questions.length -
        this.answers.length,
      0
    );
  }


  maximumPossibleScore() {
    return (
      this.questions.length *
      (
        this.confidenceEnabled
          ? 2
          : 1
      )
    );
  }


  minimumPossibleScore() {
    return (
      this.questions.length *
      -1
    );
  }


  /* =========================================================
     SAVED ANSWER COMPATIBILITY
  ========================================================= */

  normalizeSavedAnswer(
    answer
  ) {
    if (
      !answer ||
      !answer.questionId
    ) {
      return null;
    }

    const question =
      this.questions.find(
        (item) =>
          item.id ===
          answer.questionId
      );

    const timedOut =
      Boolean(
        answer.timedOut
      );

    const confidenceEnabled =
      answer.confidenceEnabled !==
        undefined
        ? Boolean(
            answer.confidenceEnabled
          )
        : Boolean(
            answer.confidence
          );

    const confidence =
      this.normalizeConfidence(
        answer.confidence
      );

    const choice =
      answer.choice === null ||
      answer.choice ===
        undefined ||
      answer.choice === ""
        ? null
        : Number(
            answer.choice
          );

    const correct =
      typeof answer.correct ===
        "boolean"
        ? answer.correct
        : Boolean(
            question &&
            !timedOut &&
            choice !== null &&
            choice ===
              Number(
                question.answer
              )
          );

    const points =
      Number.isFinite(
        Number(
          answer.points
        )
      )
        ? Number(
            answer.points
          )
        : this.calculatePoints({
            correct,
            confidence,
            timedOut,
            confidenceEnabled
          });

    return {
      ...answer,

      questionId:
        answer.questionId,

      choice,

      correct,

      confidence:
        confidenceEnabled
          ? confidence
          : null,

      confidenceEnabled,

      timedOut,

      points,

      answeredAt:
        answer.answeredAt ||
        new Date().toISOString()
    };
  }


  /* =========================================================
     STATE
  ========================================================= */

  state() {
    return {
      questionIds:
        this.questions.map(
          (question) =>
            question.id
        ),

      currentIndex:
        this.index,

      answers:
        this.answers,

      score:
        this.score(),

      correctCount:
        this.correctCount(),

      incorrectCount:
        this.incorrectCount(),

      timedOutCount:
        this.timedOutCount(),

      answeredCount:
        this.answeredCount(),

      remainingCount:
        this.remainingCount(),

      confidenceEnabled:
        this.confidenceEnabled
    };
  }
}
