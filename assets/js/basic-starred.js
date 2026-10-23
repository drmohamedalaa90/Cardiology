import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const moduleId = params.get("module") || "";

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

const {
  data: { session }
} = await supabaseClient.auth.getSession();

if (!session?.user) {
  location.replace("login.html");
} else {
  const userId = session.user.id;

  try {
    let starQuery =
      supabaseClient
        .from("acl_starred_questions")
        .select("question_id,module_id,quiz_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (moduleId) {
      starQuery =
        starQuery.eq("module_id", moduleId);
    }

    const { data: stars, error: starError } =
      await starQuery;

    if (starError) throw starError;

    const rows = stars || [];
    $("bsCount").textContent = rows.length;

    const moduleIds =
      [...new Set([moduleId,...rows.map(row => row.module_id)].filter(Boolean))];

    const questionIds =
      [...new Set(rows.map(row => row.question_id).filter(Boolean))];

    const [
      { data: modules },
      { data: questions },
      { data: options }
    ] = await Promise.all([
      moduleIds.length
        ? supabaseClient
            .from("modules")
            .select("id,title")
            .in("id", moduleIds)
        : Promise.resolve({ data: [] }),

      questionIds.length
        ? supabaseClient
            .from("questions")
            .select("id,module_id,question_text,stem,clinical_scenario,topic,explanation,reference_text")
            .in("id", questionIds)
        : Promise.resolve({ data: [] }),

      questionIds.length
        ? supabaseClient
            .from("question_options")
            .select("id,question_id,option_key,option_text,is_correct,display_order")
            .in("question_id", questionIds)
            .order("display_order", { ascending: true })
        : Promise.resolve({ data: [] })
    ]);

    const moduleMap =
      new Map((modules || []).map(module => [String(module.id), module]));

    const questionMap =
      new Map((questions || []).map(question => [String(question.id), question]));

    const optionsByQuestion =
      new Map();

    (options || []).forEach(option => {
      const key = String(option.question_id);

      if (!optionsByQuestion.has(key)) {
        optionsByQuestion.set(key, []);
      }

      optionsByQuestion.get(key).push(option);
    });

    if (moduleId) {
      const module =
        moduleMap.get(moduleId);

      $("bsTitle").textContent =
        module?.title || "Your saved questions";

      $("bsSubtitle").textContent =
        "Questions you starred from this module.";

      $("bsBack").href =
        `basic-module.html?edition=basic&module=${encodeURIComponent(moduleId)}`;
    }

    if (!rows.length) {
      $("bsList").innerHTML =
        '<div class="basic-empty-state">You have no starred questions here yet. Use the ☆ button during a quiz to save one.</div>';
    } else {
      $("bsList").innerHTML =
        rows.map((star, index) => {
          const q =
            questionMap.get(String(star.question_id));

          if (!q) return "";

          const module =
            moduleMap.get(String(star.module_id));

          const qOptions =
            optionsByQuestion.get(String(star.question_id)) || [];

          return `
            <article class="basic-starred-review-card">
              <header>
                <div>
                  <span class="basic-starred-module">
                    ${esc(module?.title || "Basic module")}
                  </span>
                  <strong>
                    ${index + 1}. ${esc(q.question_text || q.stem || "Question")}
                  </strong>
                </div>

                <button
                  class="basic-unstar-btn"
                  type="button"
                  data-unstar="${esc(star.question_id)}"
                >
                  ★ Unstar
                </button>
              </header>

              ${q.clinical_scenario ? `
                <div class="basic-starred-scenario">
                  ${esc(q.clinical_scenario)}
                </div>
              ` : ""}

              <div class="basic-starred-options">
                ${qOptions.map(option => `
                  <div class="basic-starred-option ${option.is_correct ? "is-answer" : ""}">
                    <span>${esc(option.option_key || "")}</span>
                    <p>${esc(option.option_text || "")}</p>
                    ${option.is_correct ? "<strong>Correct answer</strong>" : ""}
                  </div>
                `).join("")}
              </div>

              ${q.explanation ? `
                <details class="basic-starred-explanation">
                  <summary>Review explanation</summary>
                  <p>${esc(q.explanation)}</p>
                  ${q.reference_text ? `<small>${esc(q.reference_text)}</small>` : ""}
                </details>
              ` : ""}
            </article>
          `;
        }).join("");

      $("bsList")
        .querySelectorAll("[data-unstar]")
        .forEach(button => {
          button.addEventListener("click", async () => {
            const questionId =
              button.dataset.unstar;

            button.disabled = true;

            const { error } =
              await supabaseClient
                .from("acl_starred_questions")
                .delete()
                .eq("user_id", userId)
                .eq("question_id", questionId);

            if (error) {
              console.error(error);
              button.disabled = false;
              return;
            }

            button
              .closest(".basic-starred-review-card")
              ?.remove();

            const remaining =
              $("bsList")
                .querySelectorAll(".basic-starred-review-card")
                .length;

            $("bsCount").textContent =
              remaining;

            if (!remaining) {
              $("bsList").innerHTML =
                '<div class="basic-empty-state">No starred questions remain in this list.</div>';
            }
          });
        });
    }
  } catch (error) {
    console.error("BASIC STARRED REVIEW:", error);

    $("bsList").innerHTML =
      '<div class="basic-empty-state">Could not load starred questions.</div>';
  }
}