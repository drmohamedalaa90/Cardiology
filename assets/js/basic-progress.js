import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);

const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
  );

const asArray = value => {
  if (Array.isArray(value)) return value;

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const accuracy = attempt => {
  const answers = asArray(attempt.answers);

  if (answers.length) {
    return Math.round(
      answers.filter(answer => answer?.correct === true).length /
      answers.length *
      100
    );
  }

  const direct =
    Number(
      attempt.accuracy_percent ??
      attempt.percentage
    );

  return Number.isFinite(direct)
    ? Math.round(direct)
    : null;
};

let uid = "";
let modules = [];
let attempts = [];
let stars = [];

const {
  data: { session }
} = await supabaseClient.auth.getSession();

if (!session?.user) {
  location.replace("login.html");
} else {
  uid = session.user.id;

  try {
    const [
      moduleResult,
      attemptResult,
      starResult
    ] = await Promise.all([
      supabaseClient
        .from("modules")
        .select("id,title,display_order")
        .eq("edition", "basic")
        .order("display_order"),

      supabaseClient
        .from("quiz_attempts")
        .select("id,module_id,status,question_count,current_question_index,score,accuracy_percent,percentage,correct_count,incorrect_count,completed_at,updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false }),

      supabaseClient
        .from("acl_starred_questions")
        .select("question_id,module_id")
        .eq("user_id", uid)
    ]);

    if (moduleResult.error) throw moduleResult.error;
    if (attemptResult.error) throw attemptResult.error;
    if (starResult.error) throw starResult.error;

    modules =
      moduleResult.data || [];

    const moduleIds =
      new Set(
        modules.map(module => String(module.id))
      );

    attempts =
      (attemptResult.data || [])
        .filter(
          attempt =>
            moduleIds.has(
              String(attempt.module_id)
            )
        );

    stars =
      (starResult.data || [])
        .filter(
          star =>
            moduleIds.has(
              String(star.module_id)
            )
        );

    render();
  } catch (error) {
    console.error(error);

    $("basicModuleProgress").innerHTML =
      '<div class="basic-empty-state">Could not load progress.</div>';
  }
}

function render() {
  const attemptedModules =
    new Set(
      attempts.map(
        attempt =>
          String(
            attempt.module_id
          )
      )
    );

  const completed =
    attempts.filter(
      attempt =>
        attempt.status === "completed"
    );

  const questionsAnswered =
    completed.reduce(
      (total, attempt) =>
        total +
        Number(
          attempt.question_count ||
          0
        ),
      0
    );

  const correct =
    completed.reduce(
      (total, attempt) => {
        const direct =
          Number(
            attempt.correct_count
          );

        if (Number.isFinite(direct)) {
          return total + direct;
        }

        const attemptAccuracy =
          accuracy(attempt);

        return (
          total +
          (
            attemptAccuracy === null
              ? 0
              : Math.round(
                  Number(
                    attempt.question_count ||
                    0
                  ) *
                  attemptAccuracy /
                  100
                )
          )
        );
      },
      0
    );

  $("bpModules").textContent =
    attemptedModules.size;

  $("bpCompleted").textContent =
    completed.length;

  $("bpQuestions").textContent =
    questionsAnswered;

  $("bpAccuracy").textContent =
    questionsAnswered
      ? Math.round(
          correct /
          questionsAnswered *
          100
        ) + "%"
      : "—";

  $("bpStarred").textContent =
    stars.length;

  $("basicModuleProgress").innerHTML =
    modules.length
      ? modules.map(module => {
          const rows =
            attempts.filter(
              attempt =>
                String(attempt.module_id) ===
                String(module.id)
            );

          const completedRows =
            rows.filter(
              attempt =>
                attempt.status === "completed"
            );

          const best =
            completedRows
              .map(accuracy)
              .filter(value => value !== null)
              .sort((a, b) => b - a)[0] ??
            null;

          const latest =
            rows[0];

          const wrong =
            completedRows.reduce(
              (total, attempt) =>
                total +
                Math.max(
                  0,
                  Number(
                    attempt.incorrect_count
                  ) ||
                  0
                ),
              0
            );

          const starCount =
            stars.filter(
              star =>
                String(star.module_id) ===
                String(module.id)
            ).length;

          const statusText =
            rows.length
              ? (
                  completedRows.length
                    ? `${completedRows.length} completed attempt${completedRows.length === 1 ? "" : "s"}${latest?.status === "in_progress" ? " · attempt in progress" : ""}`
                    : "Attempt in progress"
                )
              : "Not started";

          return `
            <article class="basic-progress-row">
              <div class="basic-progress-module">
                <strong>${esc(module.title)}</strong>
                <small>${esc(statusText)}</small>
                <div class="basic-mini-bar">
                  <i style="width:${best ?? 0}%"></i>
                </div>
              </div>

              <div class="basic-progress-metric">
                <span>Best</span>
                <strong>${best === null ? "—" : best + "%"}</strong>
              </div>

              <div class="basic-progress-metric">
                <span>Wrong</span>
                <strong>${wrong}</strong>
              </div>

              <div class="basic-progress-metric">
                <span>Starred</span>
                <strong>${starCount}</strong>
              </div>

              <div class="basic-progress-actions">
                <button
                  class="basic-secondary-btn"
                  data-review="${esc(module.id)}"
                  ${completedRows.length ? "" : "disabled"}
                >
                  Review mistakes
                </button>

                <a
                  class="basic-secondary-btn ${starCount ? "" : "is-disabled"}"
                  href="${starCount ? `basic-starred.html?edition=basic&module=${encodeURIComponent(module.id)}` : "#"}"
                  ${starCount ? "" : 'aria-disabled="true"'}
                >
                  Review starred
                </a>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="basic-empty-state">No Basic Edition modules found.</div>';

  $("basicModuleProgress")
    .querySelectorAll("[data-review]")
    .forEach(button => {
      button.onclick =
        () =>
          reviewModule(
            button.dataset.review
          );
    });

  $("basicModuleProgress")
    .querySelectorAll("a.is-disabled")
    .forEach(link => {
      link.addEventListener(
        "click",
        event =>
          event.preventDefault()
      );
    });
}

async function reviewModule(moduleId) {
  const modal =
    $("basicWrongModal");

  const body =
    $("basicWrongBody");

  const module =
    modules.find(
      item =>
        String(item.id) ===
        String(moduleId)
    );

  $("basicWrongTitle").textContent =
    (module?.title || "Module") +
    " · wrong answers";

  modal.hidden =
    false;

  body.innerHTML =
    '<div class="basic-status">Loading wrong answers…</div>';

  try {
    const {
      data: rows,
      error
    } =
      await supabaseClient
        .from("quiz_attempts")
        .select("answers")
        .eq("user_id", uid)
        .eq("module_id", moduleId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

    if (error) throw error;

    const wrong =
      (rows || [])
        .flatMap(
          row =>
            asArray(
              row.answers
            )
        )
        .filter(
          answer =>
            answer?.correct === false
        );

    if (!wrong.length) {
      body.innerHTML =
        '<div class="basic-empty-state">No wrong answers saved for this module. Excellent.</div>';

      return;
    }

    const questionIds =
      [...new Set(
        wrong
          .map(
            answer =>
              String(
                answer.questionId ||
                answer.question_id ||
                ""
              )
          )
          .filter(Boolean)
      )];

    const [
      { data: questions },
      { data: options }
    ] = await Promise.all([
      supabaseClient
        .from("questions")
        .select("id,question_text,stem,explanation,reference_text")
        .in("id", questionIds),

      supabaseClient
        .from("question_options")
        .select("id,question_id,option_text,is_correct")
        .in("question_id", questionIds)
    ]);

    const questionMap =
      new Map(
        (questions || []).map(
          question => [
            String(question.id),
            question
          ]
        )
      );

    const optionsMap =
      new Map();

    (options || []).forEach(
      option => {
        const key =
          String(
            option.question_id
          );

        if (!optionsMap.has(key)) {
          optionsMap.set(
            key,
            []
          );
        }

        optionsMap.get(key)
          .push(option);
      }
    );

    body.innerHTML =
      wrong.map((answer, index) => {
        const questionId =
          String(
            answer.questionId ||
            answer.question_id ||
            ""
          );

        const question =
          questionMap.get(
            questionId
          );

        const questionOptions =
          optionsMap.get(
            questionId
          ) || [];

        const selected =
          new Set(
            [
              ...(
                answer.selectedOptionIds ||
                answer.selectedIds ||
                []
              )
            ].map(String)
          );

        const correctIds =
          new Set(
            [
              ...(
                answer.correctOptionIds ||
                []
              )
            ].map(String)
          );

        const yourAnswer =
          questionOptions
            .filter(
              option =>
                selected.has(
                  String(option.id)
                )
            )
            .map(
              option =>
                option.option_text
            )
            .join("; ") ||
          "No answer submitted";

        const correctAnswer =
          questionOptions
            .filter(
              option =>
                option.is_correct ||
                correctIds.has(
                  String(option.id)
                )
            )
            .map(
              option =>
                option.option_text
            )
            .join("; ") ||
          "Correct option unavailable";

        return `
          <article class="basic-wrong-item">
            <h3>
              ${index + 1}.
              ${esc(
                question?.question_text ||
                question?.stem ||
                "Question"
              )}
            </h3>

            <div class="basic-answer-line yours">
              <strong>Your answer:</strong>
              ${esc(yourAnswer)}
            </div>

            <div class="basic-answer-line correct">
              <strong>Correct answer:</strong>
              ${esc(correctAnswer)}
            </div>

            <div class="basic-explanation">
              ${esc(
                answer.explanation ||
                question?.explanation ||
                ""
              )}

              ${question?.reference_text
                ? `<br><small>${esc(question.reference_text)}</small>`
                : ""}
            </div>
          </article>
        `;
      }).join("");
  } catch (error) {
    console.error(error);

    body.innerHTML =
      '<div class="basic-empty-state">Could not load wrong-answer review.</div>';
  }
}

const modal =
  $("basicWrongModal");

$("basicWrongClose")
  ?.addEventListener(
    "click",
    () =>
      modal.hidden = true
  );

modal
  ?.addEventListener(
    "click",
    event => {
      if (event.target === modal) {
        modal.hidden = true;
      }
    }
  );