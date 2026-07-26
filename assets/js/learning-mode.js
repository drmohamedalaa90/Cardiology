import { supabaseClient } from "./supabase-client.js";
import { protectAndRender } from "./session-ui.js";
import {
  getOpenAttempt,
  createAttempt,
  saveAttempt,
  completeAttempt
} from "./cloud-progress.js";

const $ = (id) => document.getElementById(id);

const esc = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character]
  );

const params =
  new URLSearchParams(
    window.location.search
  );

const quizSlug =
  params.get("quiz");

const moduleId =
  params.get("module");

const HAPPY_MASCOT =
  "assets/images/dr-corazon-happy.webp";

const GOOD_JOB_MASCOT =
  "assets/images/dr-corazon-good-job.webp";

const SAD_MASCOT =
  "assets/images/dr-corazon-sad.webp";

const ANGRY_MASCOT =
  "assets/images/dr-corazon-angry.webp";

let quiz = null;
let questions = [];
let index = 0;
let answers = [];
let attempt = null;
let saving = false;
let reviewMode = false;


/* =========================================================
   GENERAL HELPERS
========================================================= */

function setStatus(
  text,
  error = false
) {
  const element =
    $("saveStatus");

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.classList.toggle(
    "error",
    error
  );

  element.classList.toggle(
    "success",
    !error
  );
}


function shuffle(items) {
  const result =
    [...items];

  for (
    let currentIndex =
      result.length - 1;

    currentIndex > 0;

    currentIndex -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        (currentIndex + 1)
      );

    [
      result[currentIndex],
      result[randomIndex]
    ] = [
      result[randomIndex],
      result[currentIndex]
    ];
  }

  return result;
}


function appState() {
  return {
    questionIds:
      questions.map(
        (question) =>
          question.id
      ),

    currentIndex:
      index,

    answers,

    score:
      answers.reduce(
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
      )
  };
}


async function persist(
  done = false
) {
  if (
    !attempt ||
    saving ||
    reviewMode
  ) {
    return;
  }

  saving =
    true;

  setStatus(
    "Saving…"
  );

  try {
    attempt =
      done
        ? await completeAttempt(
            attempt.id,
            appState()
          )
        : await saveAttempt(
            attempt.id,
            appState()
          );

    setStatus(
      done
        ? "Completed and saved"
        : "Saved to cloud"
    );
  } catch (error) {
    console.error(error);

    setStatus(
      "Save failed — check connection",
      true
    );
  } finally {
    saving =
      false;
  }
}


function currentQuestion() {
  return (
    questions[index] ||
    null
  );
}


function answerFor(
  question
) {
  return answers.find(
    (answer) =>
      answer.questionId ===
      question.id
  );
}


function setAnswer(
  answer
) {
  const answerIndex =
    answers.findIndex(
      (item) =>
        item.questionId ===
        answer.questionId
    );

  if (
    answerIndex >= 0
  ) {
    answers[answerIndex] =
      answer;
  } else {
    answers.push(
      answer
    );
  }
}


function optionsFor(
  question
) {
  if (
    !question._options
  ) {
    question._options =
      [
        ...(
          question.options ||
          []
        )
      ].sort(
        (
          first,
          second
        ) => {
          const orderDifference =
            Number(
              first.display_order ??
              999
            ) -
            Number(
              second.display_order ??
              999
            );

          return (
            orderDifference ||
            String(
              first.key ||
              ""
            ).localeCompare(
              String(
                second.key ||
                ""
              )
            )
          );
        }
      );
  }

  return question._options;
}


/* =========================================================
   FLASHCARD DATA
========================================================= */

function normaliseFlashcard(
  ...sources
) {
  for (
    const source of
    sources
  ) {
    if (
      !source ||
      typeof source !==
        "object"
    ) {
      continue;
    }

    const nested =
      source.flashcard &&
      typeof source.flashcard ===
        "object"
        ? source.flashcard
        : null;

    const title =
      nested?.title ||
      source.flashcard_title ||
      source.flashcardTitle;

    const content =
      nested?.content ||
      source.flashcard_content ||
      source.flashcardContent;

    const rawType =
      nested?.type ||
      source.flashcard_type ||
      source.flashcardType ||
      "FLASHCARD";

    if (
      title &&
      content
    ) {
      return {
        title,

        content,

        type:
          String(
            rawType
          ).toUpperCase() ===
          "TRIAL FLASHCARD"
            ? "TRIAL FLASHCARD"
            : "FLASHCARD"
      };
    }
  }

  return null;
}


async function loadFlashcard(
  question,
  rpcData
) {
  const embedded =
    normaliseFlashcard(
      rpcData,
      question
    );

  if (embedded) {
    return embedded;
  }

  try {
    const {
      data,
      error
    } = await supabaseClient
      .from("questions")
      .select(`
        flashcard_title,
        flashcard_type,
        flashcard_content
      `)
      .eq(
        "id",
        question.id
      )
      .maybeSingle();

    if (error) {
      console.info(
        "Flashcard fallback query unavailable:",
        error.message
      );

      return null;
    }

    return normaliseFlashcard(
      data
    );
  } catch (error) {
    console.info(
      "Flashcard could not be loaded:",
      error
    );

    return null;
  }
}


function flashcardSections(
  content
) {
  if (!content) {
    return [];
  }

  if (
    Array.isArray(
      content
    )
  ) {
    return [
      {
        heading:
          "High-yield review",

        lines:
          content
      }
    ];
  }

  if (
    typeof content ===
    "string"
  ) {
    return [
      {
        heading:
          "High-yield review",

        lines:
          [content]
      }
    ];
  }

  if (
    typeof content ===
    "object"
  ) {
    return Object.entries(
      content
    ).map(
      (
        [
          heading,
          value
        ]
      ) => ({
        heading,

        lines:
          Array.isArray(
            value
          )
            ? value
            : [
                String(
                  value ||
                  ""
                )
              ]
      })
    );
  }

  return [];
}


function openFlashcard(
  flashcard
) {
  if (!flashcard) {
    window.alert(
      "A flashcard has not yet been added for this question."
    );

    return;
  }

  const modal =
    $("learningFlashcardModal");

  const type =
    $("learningFlashcardType");

  const title =
    $("learningFlashcardTitle");

  const content =
    $("learningFlashcardContent");

  if (
    !modal ||
    !type ||
    !title ||
    !content
  ) {
    console.error(
      "Flashcard elements are missing from learning.html."
    );

    return;
  }

  type.textContent =
    flashcard.type ||
    "FLASHCARD";

  type.classList.toggle(
    "trial",
    flashcard.type ===
      "TRIAL FLASHCARD"
  );

  title.textContent =
    flashcard.title ||
    "Topic review";

  const sections =
    flashcardSections(
      flashcard.content
    );

  content.innerHTML =
    sections.length
      ? sections
          .map(
            (section) => `
              <section class="learning-flashcard-section">

                <h3>
                  ${esc(section.heading)}
                </h3>

                <ul>
                  ${section.lines
                    .filter(Boolean)
                    .map(
                      (line) => `
                        <li>
                          ${esc(line)}
                        </li>
                      `
                    )
                    .join("")}
                </ul>

              </section>
            `
          )
          .join("")
      : `
        <section class="learning-flashcard-section">
          <p>
            No flashcard content has been added yet.
          </p>
        </section>
      `;

  modal.hidden =
    false;

  document.body.classList.add(
    "learning-modal-open"
  );
}


function closeFlashcard() {
  const modal =
    $("learningFlashcardModal");

  if (modal) {
    modal.hidden =
      true;
  }

  document.body.classList.remove(
    "learning-modal-open"
  );
}


/* =========================================================
   DR. CORAZÓN FEEDBACK
========================================================= */

function feedbackHtml(
  answer
) {
  const correct =
    Boolean(
      answer.correct
    );

  const points =
    Number(
      answer.points ||
      0
    );

  const pointText =
    `${
      points >= 0
        ? "+"
        : ""
    }${points} point${
      Math.abs(points) === 1
        ? ""
        : "s"
    }`;
const mascot =
  correct
    ? GOOD_JOB_MASCOT
    : SAD_MASCOT;

  const mascotAlt =
    correct
      ? "Dr. Corazón celebrating a correct answer"
      : "Dr. Corazón looking thoughtful after an incorrect answer";

  const explanation =
    quiz.show_explanations &&
    answer.explanation
      ? `
        <div class="learning-explanation-card">

          <h3>
            Explanation
          </h3>

          <p>
            ${esc(answer.explanation)}
          </p>

          ${
            answer.referenceText
              ? `
                <p class="learning-reference">

                  <strong>
                    Reference:
                  </strong>

                  ${esc(
                    answer.referenceText
                  )}

                  ${
                    answer.referenceUrl
                      ? `
                        ·

                        <a
                          href="${esc(
                            answer.referenceUrl
                          )}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open source
                        </a>
                      `
                      : ""
                  }

                </p>
              `
              : ""
          }

        </div>
      `
      : "";

  return `
    <section
      class="
        learning-answer-feedback
        ${
          correct
            ? "is-correct"
            : "is-incorrect"
        }
      "
    >

      <div class="dr-corazon-stage">

        <img
          class="dr-corazon-image"
          src="${esc(mascot)}"
          alt="${esc(mascotAlt)}"
        >

        <div
          class="dr-corazon-fallback"
          hidden
          aria-hidden="true"
        >
          ${
            correct
              ? "😄🫀"
              : "🥺🫀"
          }
        </div>

        ${
          correct
            ? `
              <div
                class="dr-corazon-confetti"
                aria-hidden="true"
              >
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            `
            : `
              <span
                class="dr-corazon-tear"
                aria-hidden="true"
              ></span>
            `
        }

      </div>


      <div class="learning-feedback-copy">

        <span class="learning-feedback-kicker">
          ${
            correct
              ? "Correct answer"
              : "Learning opportunity"
          }
        </span>

        <h3 class="learning-feedback-title">
          ${
            correct
              ? "Excellent — correct!"
              : "Not quite — review this point"
          }
        </h3>

        <p class="learning-feedback-message">
          ${
            correct
              ? "Dr. Corazón is delighted. Reinforce the concept before moving forward."
              : "Dr. Corazón wants you to review the explanation and strengthen this concept."
          }
        </p>

        <span class="learning-feedback-score">
          ${pointText}
        </span>

        ${explanation}

        ${
  answer.flashcard
    ? `
      <div class="learning-feedback-actions">

        <button
          id="reviewCurrentFlashcard"
          type="button"
          class="review-flashcard-btn"
        >
          Review the flashcard
        </button>

      </div>
    `
    : ""
}

      </div>

    </section>
  `;
}


function bindFeedback(
  answer
) {
  const image =
    document.querySelector(
      ".dr-corazon-image"
    );

  const fallback =
    document.querySelector(
      ".dr-corazon-fallback"
    );

  image?.addEventListener(
    "error",
    () => {
      image.hidden =
        true;

      if (fallback) {
        fallback.hidden =
          false;
      }
    },
    {
      once: true
    }
  );

  $("reviewCurrentFlashcard")
    ?.addEventListener(
      "click",
      () =>
        openFlashcard(
          answer.flashcard
        )
    );

  $("answerFeedbackHost")
    ?.scrollIntoView({
      behavior:
        "smooth",

      block:
        "nearest"
    });
}


/* =========================================================
   QUESTION RENDERING
========================================================= */

function render() {
  closeFlashcard();

  const question =
    currentQuestion();

  if (!question) {
    finish();

    return;
  }

  const answer =
    answerFor(
      question
    );

  const multipleResponse =
    question.question_type ===
    "multiple_response";

  const progress =
    questions.length
      ? Math.round(
          (
            (
              index + 1
            ) /
            questions.length
          ) *
          100
        )
      : 0;

  $("progressFill").style.width =
    `${progress}%`;

  $("questionCount").textContent =
    `Question ${index + 1} of ${questions.length}`;

  $("quizArea").innerHTML = `
    ${
      question.topic
        ? `
          <span class="learning-topic">
            ${esc(question.topic)}
          </span>
        `
        : ""
    }

    ${
      question.clinical_scenario
        ? `
          <div class="clinical-scenario">
            ${esc(
              question.clinical_scenario
            )}
          </div>
        `
        : ""
    }

    <h2>
      ${esc(question.stem)}
    </h2>

    ${
      question.image_url
        ? `
          <img
            class="question-image"
            src="${esc(
              question.image_url
            )}"
            alt="${esc(
              question.image_alt ||
              "Question image"
            )}"
          >
        `
        : ""
    }

    <div class="learning-options">

      ${optionsFor(question)
        .map(
          (option) => {
            const selected =
              answer?.selectedIds
                ?.includes(
                  option.id
                );

            const correct =
              answer
                ?.correctOptionIds
                ?.includes(
                  option.id
                );

            const incorrect =
              Boolean(
                answer &&
                !answer.correct &&
                selected
              );

            return `
              <label
                class="
                  learning-option
                  ${
                    selected
                      ? "selected"
                      : ""
                  }
                  ${
                    correct
                      ? "correct is-correct"
                      : ""
                  }
                  ${
                    incorrect
                      ? "incorrect is-incorrect"
                      : ""
                  }
                "
              >

                <input
                  type="${
                    multipleResponse
                      ? "checkbox"
                      : "radio"
                  }"
                  name="answer"
                  value="${esc(option.id)}"
                  ${
                    selected
                      ? "checked"
                      : ""
                  }
                  ${
                    answer
                      ? "disabled"
                      : ""
                  }
                >

                <span class="option-key">
                  ${esc(option.key)}
                </span>

                <span>
                  ${esc(option.text)}
                </span>

              </label>
            `;
          }
        )
        .join("")}

    </div>

    ${
      multipleResponse &&
      !answer
        ? `
          <p class="muted">
            Select all answers that apply.
          </p>
        `
        : ""
    }
  `;

  $("answerFeedbackHost").innerHTML =
    answer
      ? feedbackHtml(
          answer
        )
      : "";

  $("submitAnswer").hidden =
    Boolean(answer);

  $("nextQuestion").hidden =
    !answer;

  if (answer) {
    bindFeedback(
      answer
    );
  }
}


/* =========================================================
   ANSWER CHECKING
========================================================= */

async function submit() {
  const question =
    currentQuestion();

  if (!question) {
    return;
  }

  const selectedIds =
    [
      ...document.querySelectorAll(
        'input[name="answer"]:checked'
      )
    ].map(
      (input) =>
        input.value
    );

  if (
    !selectedIds.length
  ) {
    $("answerFeedbackHost").innerHTML = `
      <div class="answer-feedback warning">
        Choose an answer first.
      </div>
    `;

    return;
  }

  $("submitAnswer").disabled =
    true;

  try {
    const {
      data,
      error
    } = await supabaseClient.rpc(
      "acl_check_learning_answer",
      {
        p_quiz_id:
          quiz.id,

        p_question_id:
          question.id,

        p_option_ids:
          selectedIds
      }
    );

    if (error) {
      throw error;
    }

    const flashcard =
      await loadFlashcard(
        question,
        data
      );

    const answer = {
      questionId:
        question.id,

      selectedIds,

      correct:
        Boolean(
          data.correct ??
          data.is_correct
        ),

      points:
        Number(
          data.points ??
          data.points_awarded ??
          0
        ),

      correctOptionIds:
        data.correct_option_ids ||
        data.correctOptionIds ||
        [],

      explanation:
        data.explanation ||
        question.explanation ||
        "",

      referenceText:
        data.reference_text ||
        data.referenceText ||
        "",

      referenceUrl:
        data.reference_url ||
        data.referenceUrl ||
        "",

      flashcard,

      answeredAt:
        new Date()
          .toISOString()
    };

    setAnswer(
      answer
    );

    await persist(
      false
    );

    render();
  } catch (error) {
    console.error(error);

    $("answerFeedbackHost").innerHTML = `
      <div class="answer-feedback incorrect">
        ${esc(
          error.message ||
          "Answer could not be checked."
        )}
      </div>
    `;
  } finally {
    $("submitAnswer").disabled =
      false;
  }
}


/* =========================================================
   COMPLETION AND REVIEW
========================================================= */

async function finish() {
  if (!reviewMode) {
    await persist(
      true
    );
  }

  const score =
    appState().score;

  const maximum =
    questions.reduce(
      (
        total,
        question
      ) =>
        total +
        Number(
          question.points ||
          1
        ),
      0
    );

  const percentage =
    maximum
      ? Math.round(
          (
            score /
            maximum
          ) *
          100
        )
      : 0;

  const passed =
    percentage >=
    Number(
      quiz.passing_percentage ||
      0
    );

  $("progressFill").style.width =
    "100%";

  $("answerFeedbackHost").innerHTML =
    "";

  $("quizArea").innerHTML = `
    <div class="learning-result">

      <span class="result-icon">
        ${
          passed
            ? "✓"
            : "↻"
        }
      </span>

      <h2>
        ${
          passed
            ? "Module completed"
            : "Learning attempt completed"
        }
      </h2>

      <div class="result-score">
        ${score} / ${maximum} points · ${percentage}%
      </div>

      <p>
        ${
          passed
            ? `You reached the ${quiz.passing_percentage}% pass mark.`
            : `The pass mark is ${quiz.passing_percentage}%. Review the explanations and try again.`
        }
      </p>

      <div class="result-actions">

        ${
          quiz.allow_review
            ? `
              <button
                id="reviewAttempt"
                class="secondary-btn"
                type="button"
              >
                Review answers
              </button>
            `
            : ""
        }

        <button
          id="retryAttempt"
          class="primary-btn"
          type="button"
        >
          Start a new attempt
        </button>

        <a
          class="secondary-btn"
          href="modules.html"
        >
          Back to modules
        </a>

      </div>

    </div>
  `;

  $("submitAnswer").hidden =
    true;

  $("nextQuestion").hidden =
    true;

  $("reviewAttempt")
    ?.addEventListener(
      "click",
      () => {
        reviewMode =
          true;

        index =
          0;

        render();
      }
    );

  $("retryAttempt")
    ?.addEventListener(
      "click",
      startNewAttempt
    );
}


async function startNewAttempt() {
  try {
    answers =
      [];

    index =
      0;

    reviewMode =
      false;

    attempt =
      await createAttempt({
        moduleId:
          quiz.module_id,

        moduleTitle:
          quiz.module_title,

        quizId:
          quiz.id,

        quizTitle:
          quiz.title,

        mode:
          quiz.mode,

        questionIds:
          questions.map(
            (question) =>
              question.id
          )
      });

    setStatus(
      "New learning attempt saved"
    );

    render();
  } catch (error) {
    console.error(error);

    setStatus(
      error.message ||
      "Could not create a new attempt.",
      true
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

$("submitAnswer")
  ?.addEventListener(
    "click",
    submit
  );


$("nextQuestion")
  ?.addEventListener(
    "click",
    async () => {
      index += 1;

      if (!reviewMode) {
        await persist(
          false
        );
      }

      render();
    }
  );


$("closeLearningFlashcard")
  ?.addEventListener(
    "click",
    closeFlashcard
  );


$("closeLearningFlashcardBottom")
  ?.addEventListener(
    "click",
    closeFlashcard
  );


$("learningFlashcardBackdrop")
  ?.addEventListener(
    "click",
    closeFlashcard
  );


document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key ===
      "Escape"
    ) {
      closeFlashcard();
    }
  }
);


/* =========================================================
   INITIALISATION
========================================================= */

(async () => {
  const profile =
    await protectAndRender(
      "login.html"
    );

  if (!profile) {
    return;
  }

  if (!quizSlug) {
    $("quizArea").innerHTML =
      "<p>No quiz was selected.</p>";

    return;
  }

  try {
    setStatus(
      "Loading learning mode…"
    );

    const {
      data,
      error
    } = await supabaseClient.rpc(
      "acl_get_learning_quiz",
      {
        p_quiz_slug:
          quizSlug,

        p_module_id:
          moduleId ||
          null
      }
    );

    if (error) {
      throw error;
    }

    quiz =
      data;

    $("moduleTitle").textContent =
      quiz.module_title;

    $("quizTitle").textContent =
      quiz.title;

    $("quizDescription").textContent =
      quiz.description ||
      "Immediate feedback, Dr. Corazón reactions, explanations and flashcards after every answer.";

    let pool =
      quiz.questions ||
      [];

    if (
      quiz.randomize_questions ||
      quiz.selection_mode ===
        "random"
    ) {
      pool =
        shuffle(pool);
    }

    questions =
      pool.slice(
        0,
        Math.min(
          Number(
            quiz.question_count ||
            pool.length
          ),
          pool.length
        )
      );

    attempt =
      await getOpenAttempt(
        quiz.module_id,
        quiz.id
      );

    if (attempt) {
      const questionMap =
        new Map(
          questions.map(
            (question) => [
              question.id,
              question
            ]
          )
        );

      questions =
        (
          attempt.question_ids ||
          []
        )
          .map(
            (id) =>
              questionMap.get(id)
          )
          .filter(Boolean);

      index =
        Number(
          attempt.current_question_index ||
          0
        );

      answers =
        attempt.answers ||
        [];

      setStatus(
        "Unfinished learning attempt restored"
      );
    } else {
      attempt =
        await createAttempt({
          moduleId:
            quiz.module_id,

          moduleTitle:
            quiz.module_title,

          quizId:
            quiz.id,

          quizTitle:
            quiz.title,

          mode:
            quiz.mode,

          questionIds:
            questions.map(
              (question) =>
                question.id
            )
        });

      setStatus(
        "New learning attempt saved"
      );
    }

    render();
  } catch (error) {
    console.error(error);

    setStatus(
      "Could not open learning mode",
      true
    );

    $("quizArea").innerHTML = `
      <div class="empty-state">
        ${esc(
          error.message ||
          "Quiz unavailable"
        )}
      </div>
    `;
  }
})();
