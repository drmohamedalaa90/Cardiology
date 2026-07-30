console.log(
  "ACL QUIZ ENGINE v5.2.1 LOADED"
);


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
     SCORING
  ========================================================= */

  calculatePoints({
    correct,
    confidence = null,
    timedOut = false,
    confidenceEnabled =
      this.confidenceEnabled
  }) {
    if (timedOut) {
      return -1;
    }


    if (
      !confidenceEnabled
    ) {
      return correct
        ? 1
        : 0;
    }


    const normalizedConfidence =
      this.normalizeConfidence(
        confidence
      );


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
        accepted:
          false,

        reason:
          "no-current-question",

        answer:
          null
      };
    }


    const existing =
      this.getAnswerByQuestionId(
        question.id
      );


    if (existing) {
      return {
        accepted:
          false,

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


    if (
      this.confidenceEnabled &&
      !timedOut &&
      !normalizedConfidence
    ) {
      return {
        accepted:
          false,

        reason:
          "confidence-required",

        answer:
          null
      };
    }


    const numericChoice =
      timedOut ||
      choice ===
        null ||
      choice ===
        undefined ||
      choice ===
        ""
        ? null
        : Number(
            choice
          );


    const validChoice =
      numericChoice !==
        null &&
      Number.isInteger(
        numericChoice
      ) &&
      Array.isArray(
        question.options
      ) &&
      numericChoice >=
        0 &&
      numericChoice <
        question.options.length;


    if (
      !timedOut &&
      !validChoice
    ) {
      return {
        accepted:
          false,

        reason:
          "invalid-choice",

        answer:
          null
      };
    }


    const correct =
      !timedOut &&
      validChoice &&
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
        Boolean(
          timedOut
        ),

      points,

      answeredAt:
        new Date()
          .toISOString()
    };


    this.answers.push(
      answerRecord
    );


    return {
      accepted:
        true,

      reason:
        null,

      answer:
        answerRecord
    };
  }


  answer(
    choice,
    confidence = null
  ) {
    const result =
      this.submitAnswer({
        choice,
        confidence,
        timedOut:
          false
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
      choice:
        null,

      confidence:
        null,

      timedOut:
        true
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
      this.index +=
        1;
    }


    return this.current();
  }


  previous() {
    if (
      this.index >
      0
    ) {
      this.index -=
        1;
    }


    return this.current();
  }


  goTo(
    index
  ) {
    const targetIndex =
      Number(
        index
      );


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
      (
        answer
      ) =>
        answer.correct ===
        true
    ).length;
  }


  incorrectCount() {
    return this.answers.filter(
      (
        answer
      ) =>
        answer.correct !==
          true &&
        !answer.timedOut
    ).length;
  }


  timedOutCount() {
    return this.answers.filter(
      (
        answer
      ) =>
        answer.timedOut ===
        true
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
    /*
     * Use the scoring mode selected for this attempt.
     * Existing saved answers keep their original points even if
     * the user changes the setting later.
     */

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


  accuracyPercentage() {
    if (
      !this.questions.length
    ) {
      return 0;
    }


    return Math.round(
      (
        this.correctCount() /
        this.questions.length
      ) *
      100
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
      typeof answer !==
        "object"
    ) {
      return null;
    }


    const questionId =
      this.answerQuestionId(
        answer
      );


    if (
      questionId ===
        null ||
      questionId ===
        undefined ||
      questionId ===
        ""
    ) {
      return null;
    }


    const question =
      this.questions.find(
        (
          item
        ) =>
          this.sameQuestionId(
            item.id,
            questionId
          )
      );


    if (!question) {
      return null;
    }


    const timedOut =
      Boolean(
        answer.timedOut ??
        answer.timed_out
      );


    const confidenceEnabled =
      answer.confidenceEnabled !==
        undefined
        ? Boolean(
            answer.confidenceEnabled
          )
        : answer.confidence_enabled !==
            undefined
          ? Boolean(
              answer.confidence_enabled
            )
          : Boolean(
              answer.confidence
            );


    const confidence =
      this.normalizeConfidence(
        answer.confidence
      );


    const rawChoice =
      answer.choice ??
      answer.selectedChoice ??
      answer.selected_choice ??
      null;


    const choice =
      rawChoice ===
        null ||
      rawChoice ===
        undefined ||
      rawChoice ===
        ""
        ? null
        : Number(
            rawChoice
          );


    const validChoice =
      choice !==
        null &&
      Number.isInteger(
        choice
      ) &&
      Array.isArray(
        question.options
      ) &&
      choice >=
        0 &&
      choice <
        question.options.length;


    const correct =
      typeof answer.correct ===
        "boolean"
        ? answer.correct
        : typeof answer.is_correct ===
            "boolean"
          ? answer.is_correct
          : Boolean(
              !timedOut &&
              validChoice &&
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
        question.id,

      choice:
        validChoice
          ? choice
          : null,

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
        answer.answered_at ||
        new Date()
          .toISOString()
    };
  }


  /* =========================================================
     STATE
  ========================================================= */

  state() {
    return {
      questionIds:
        this.questions.map(
          (
            question
          ) =>
            question.id
        ),

      currentIndex:
        this.index,

      answers:
        this.answers.map(
          (
            answer
          ) => ({
            ...answer
          })
        ),

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
