import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const moduleId = params.get("module") || params.get("slug") || "";
const ADMIN_EMAIL = "drmohamedalaa90@gmail.com";

let module = null;
let quiz = null;
let count = 0;
let limit = 0;
let selected = new Set();
let actualQuestionCount = 0;
let isAdmin = false;

function accuracy(attempt) {
  const n = Number(attempt.accuracy_percent ?? attempt.percentage);
  if (Number.isFinite(n)) return Math.round(n);

  const total = Number(attempt.question_count);
  const correct = Number(attempt.correct_count);

  return total > 0 && Number.isFinite(correct)
    ? Math.round(correct / total * 100)
    : null;
}

function guideScroll(target, block = "center") {
  if (!target) return;

  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() =>
      target.scrollIntoView({
        behavior: "smooth",
        block,
        inline: "nearest"
      })
    )
  );
}

async function refreshActualQuestionCount() {
  if (!quiz?.id) {
    actualQuestionCount = 0;
    return;
  }

  const { count: storedCount, error } =
    await supabaseClient
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", quiz.id);

  if (error) {
    console.warn("BASIC QUESTION COUNT:", error);
    return;
  }

  actualQuestionCount = Number(storedCount || 0);

  if ($("bmAdminQuestionCount")) {
    $("bmAdminQuestionCount").textContent = String(actualQuestionCount);
  }

  document.querySelectorAll("[data-count]").forEach(button => {
    const requested = Number(button.dataset.count || 0);
    const unavailable = actualQuestionCount < requested;

    button.disabled = unavailable;
    button.classList.toggle("not-ready", unavailable);

    const note = button.querySelector("small");

    if (note) {
      if (unavailable) {
        note.textContent = `${actualQuestionCount} questions currently available`;
      } else if (requested === 10) {
        note.textContent = "Choose 2 Life Savers";
      } else if (requested === 25) {
        note.textContent = "Choose 3 Life Savers";
      } else {
        note.textContent = "All Life Savers";
      }
    }
  });

  if (!actualQuestionCount && $("bmOpenQuiz")) {
    $("bmOpenQuiz").disabled = true;
    $("bmOpenQuiz").textContent = isAdmin
      ? "Add questions to activate quiz"
      : "Question bank being prepared";
  } else if ($("bmOpenQuiz")) {
    $("bmOpenQuiz").disabled = false;
    $("bmOpenQuiz").textContent = "Choose quiz mode →";
  }
}

function setupAdminEditor(session) {
  isAdmin =
    String(session?.user?.email || "").toLowerCase() === ADMIN_EMAIL;

  const adminTools = $("bmAdminTools");

  if (!isAdmin || !adminTools) return;

  adminTools.hidden = false;

  $("bmAdminToggle")?.addEventListener("click", () => {
    const form = $("bmAdminForm");
    if (!form) return;

    form.hidden = !form.hidden;

    $("bmAdminToggle").textContent =
      form.hidden ? "+ Add question" : "Close editor";

    if (!form.hidden) {
      guideScroll(form, "start");
      $("bmAdminStem")?.focus();
    }
  });

  $("bmAdminForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const correct =
      document.querySelector('input[name="bmCorrect"]:checked')?.value || "";

    const status = $("bmAdminStatus");
    const save = $("bmAdminSave");

    if (!correct) {
      status.textContent = "Select the correct answer.";
      status.className = "basic-admin-status error";
      return;
    }

    save.disabled = true;
    status.textContent = "Saving question…";
    status.className = "basic-admin-status";

    const { data, error } =
      await supabaseClient.rpc("acl_admin_add_basic_question", {
        p_module_id: moduleId,
        p_stem: $("bmAdminStem").value.trim(),
        p_option_a: $("bmOptionA").value.trim(),
        p_option_b: $("bmOptionB").value.trim(),
        p_option_c: $("bmOptionC").value.trim(),
        p_option_d: $("bmOptionD").value.trim(),
        p_correct_key: correct,
        p_explanation: $("bmAdminExplanation").value.trim() || null,
        p_topic: $("bmAdminTopic").value.trim() || null,
        p_reference_text: $("bmAdminReference").value.trim() || null
      });

    if (error) {
      console.error("ADMIN ADD BASIC QUESTION:", error);
      status.textContent = error.message || "Could not save the question.";
      status.className = "basic-admin-status error";
      save.disabled = false;
      return;
    }

    $("bmAdminForm").reset();

    status.textContent = "Question saved successfully.";
    status.className = "basic-admin-status success";

    await refreshActualQuestionCount();

    save.disabled = false;

    setTimeout(() => {
      if (status.textContent === "Question saved successfully.") {
        status.textContent = "";
        status.className = "basic-admin-status";
      }
    }, 3000);
  });
}

const {
  data: { session }
} = await supabaseClient.auth.getSession();

if (!session?.user) {
  location.replace("login.html");
} else if (!moduleId) {
  location.replace("basic-home.html?edition=basic");
} else {
  setupAdminEditor(session);

  try {
    const [
      { data: moduleData, error: moduleError },
      { data: quizzes, error: quizError },
      { data: attempts },
      { data: videos },
      { data: stars }
    ] = await Promise.all([
      supabaseClient
        .from("modules")
        .select("*")
        .eq("id", moduleId)
        .eq("edition", "basic")
        .maybeSingle(),

      supabaseClient
        .from("quizzes")
        .select("id,slug,title,module_id,question_count,display_order,created_at")
        .eq("module_id", moduleId)
        .eq("edition", "basic")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseClient
        .from("quiz_attempts")
        .select("status,accuracy_percent,percentage,question_count,correct_count,updated_at")
        .eq("user_id", session.user.id)
        .eq("module_id", moduleId)
        .order("updated_at", { ascending: false }),

      supabaseClient
        .from("videos")
        .select("title,youtube_url,description,is_active")
        .eq("module_id", moduleId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),

      supabaseClient
        .from("acl_starred_questions")
        .select("question_id")
        .eq("user_id", session.user.id)
        .eq("module_id", moduleId)
    ]);

    if (moduleError || !moduleData) {
      throw moduleError || new Error("Module not found");
    }

    if (quizError) throw quizError;

    module = moduleData;

    quiz =
      (quizzes || []).find(
        item => !String(item.slug || "").toLowerCase().includes("review")
      ) ||
      (quizzes || [])[0] ||
      null;

    $("bmTitle").textContent = module.title;

    $("bmDescription").textContent =
      module.short_description ||
      module.description ||
      "Review the lecture or flashcards, then test yourself.";

    const completedAttempts =
      (attempts || []).filter(attempt => attempt.status === "completed");

    const scores =
      completedAttempts
        .map(accuracy)
        .filter(value => value !== null);

    $("bmBest").textContent =
      scores.length
        ? Math.max(...scores) + "%"
        : "—";

    $("bmAttempts").textContent =
      completedAttempts.length
        ? `${completedAttempts.length} completed attempt${completedAttempts.length === 1 ? "" : "s"}`
        : "No attempts yet";

    $("bmFlashcardsLink").href =
      `basic-flashcards.html?edition=basic&module=${encodeURIComponent(module.id)}`;

    $("bmStarredCount").textContent =
      String((stars || []).length);

    $("bmStarredLink").href =
      `basic-starred.html?edition=basic&module=${encodeURIComponent(module.id)}`;

    $("bmChallengeMode").href =
      `challenge.html?edition=basic&module=${encodeURIComponent(module.id)}`;

    const lecture = (videos || [])[0];
    const lectureLink = $("bmLectureLink");

    if (lecture?.youtube_url) {
      lectureLink.href = lecture.youtube_url;
      lectureLink.textContent = "Watch on YouTube ↗";

      const match =
        String(lecture.youtube_url).match(
          /(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{6,})/
        );

      if (match) {
        const visual = $("bmLectureVisual");

        visual.style.backgroundImage =
          `linear-gradient(rgba(5,37,59,.22),rgba(5,37,59,.42)),url("https://img.youtube.com/vi/${match[1]}/hqdefault.jpg")`;

        visual.style.backgroundSize = "cover";
        visual.style.backgroundPosition = "center";
      }
    } else {
      lectureLink.removeAttribute("target");
      lectureLink.textContent = "Lecture link coming soon";
      lectureLink.classList.add("disabled");
      lectureLink.addEventListener("click", event => event.preventDefault());
    }

    await refreshActualQuestionCount();
  } catch (error) {
    console.error(error);
    $("bmTitle").textContent = "Module unavailable";
  }
}

$("bmOpenQuiz")?.addEventListener("click", () => {
  if ($("bmOpenQuiz").disabled) return;

  $("bmQuizSetup").hidden = false;
  guideScroll($("bmQuizSetup"), "start");
});

$("bmCloseSetup")?.addEventListener("click", () => {
  $("bmQuizSetup").hidden = true;
});

$("bmSoloMode")?.addEventListener("click", () => {
  $("bmSoloSetup").hidden = false;
  guideScroll($("bmSoloSetup"), "start");
});

function refresh() {
  document.querySelectorAll("[data-life]").forEach(button => {
    const id = button.dataset.life;

    button.classList.toggle("selected", selected.has(id));
    button.classList.toggle("locked", count === 50);
  });

  $("bmLifeSaverCounter").textContent =
    `${selected.size} / ${limit}`;

  $("bmStartSolo").disabled =
    !quiz ||
    !count ||
    selected.size !== limit ||
    actualQuestionCount < count;
}

document.querySelectorAll("[data-count]").forEach(button =>
  button.addEventListener("click", () => {
    if (button.disabled) return;

    document
      .querySelectorAll("[data-count]")
      .forEach(item => item.classList.remove("selected"));

    button.classList.add("selected");

    count = Number(button.dataset.count);
    limit = count === 10 ? 2 : count === 25 ? 3 : 4;

    selected =
      count === 50
        ? new Set(["filter", "swap", "expert", "time"])
        : new Set();

    $("bmLifeSaverBlock").hidden = false;

    $("bmLifeSaverInstruction").textContent =
      count === 50
        ? "All four Life Savers are available. Each can be used once."
        : `Choose any ${limit} of the four Life Savers. Each selected Life Saver can be used once.`;

    refresh();

    if (count === 50) {
      guideScroll($("bmStartSolo"), "center");
    } else {
      guideScroll($("bmLifeSaverBlock"), "start");
    }
  })
);

document.querySelectorAll("[data-life]").forEach(button =>
  button.addEventListener("click", () => {
    if (!count || count === 50) return;

    const id = button.dataset.life;

    if (selected.has(id)) {
      selected.delete(id);
    } else if (selected.size < limit) {
      selected.add(id);
    }

    refresh();

    if (selected.size === limit) {
      guideScroll($("bmStartSolo"), "center");
    }
  })
);

$("bmStartSolo")?.addEventListener("click", () => {
  if (
    !quiz ||
    selected.size !== limit ||
    actualQuestionCount < count
  ) {
    return;
  }

  const url =
    new URL("learning.html", location.href);

  url.searchParams.set("edition", "basic");
  url.searchParams.set("module", module.id);
  url.searchParams.set("quiz", quiz.slug);
  url.searchParams.set("count", String(count));
  url.searchParams.set("new", "1");
  url.searchParams.set("question_time_seconds", "120");
  url.searchParams.set("lifelines", [...selected].join(","));
  url.searchParams.set("basic_quiz", "1");
  url.searchParams.set("timer_session", String(Date.now()));

  location.href = url.toString();
});
