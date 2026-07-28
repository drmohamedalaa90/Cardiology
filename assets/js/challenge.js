import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender
} from "./session-ui.js?v=5.3.0";


const $ = (id) =>
  document.getElementById(
    id
  );


const esc = (value = "") =>
  String(
    value
  ).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[
        character
      ]
  );


const params =
  new URLSearchParams(
    window.location.search
  );


const challengeCode =
  params.get(
    "code"
  );


let currentUser =
  null;


let currentChallenge =
  null;


let currentParticipant =
  null;


/* =========================================================
   UI HELPERS
========================================================= */

function showChallengeView() {
  $("challengeLoading").hidden =
    true;

  $("challengeError").hidden =
    true;

  $("challengeView").hidden =
    false;
}


function showChallengeError(
  message
) {
  $("challengeLoading").hidden =
    true;

  $("challengeView").hidden =
    true;

  $("challengeError").hidden =
    false;

  $("challengeErrorMessage")
    .textContent =
      message;
}


function showMessage(
  message,
  type = "info"
) {
  const element =
    $("challengeMessage");

  if (!element) {
    return;
  }

  element.hidden =
    false;

  element.className =
    `challenge-message is-${type}`;

  element.textContent =
    message;
}


function formatEndDate(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not specified";
  }

  return date.toLocaleString(
    [],
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  );
}


function challengeExpired(
  challenge
) {
  return (
    new Date(
      challenge.ends_at
    ).getTime() <=
    Date.now()
  );
}


/* =========================================================
   CHALLENGE DATA
========================================================= */

async function loadChallenge() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "module_challenges"
      )
      .select(`
        id,
        module_id,
        quiz_id,
        creator_id,
        challenge_code,
        title,
        question_ids,
        maximum_participants,
        starts_at,
        ends_at,
        status,
        modules (
          id,
          title,
          slug,
          launch_path
        ),
        quizzes (
          id,
          title,
          slug,
          status
        )
      `)
      .eq(
        "challenge_code",
        challengeCode
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "The challenge code was not found."
    );
  }

  return data;
}


async function loadParticipantCount(
  challengeId
) {
  const {
    count,
    error
  } =
    await supabaseClient
      .from(
        "module_challenge_participants"
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true
        }
      )
      .eq(
        "challenge_id",
        challengeId
      );

  if (error) {
    throw error;
  }

  return Number(
    count ||
    0
  );
}


async function loadCurrentParticipant(
  challengeId
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "module_challenge_participants"
      )
      .select(`
        id,
        challenge_id,
        user_id,
        attempt_id,
        invitation_status,
        joined_at,
        completed_at,
        score,
        duration_seconds,
        correct_answers
      `)
      .eq(
        "challenge_id",
        challengeId
      )
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   RENDERING
========================================================= */

function renderChallenge(
  participantCount
) {
  const moduleData =
    Array.isArray(
      currentChallenge.modules
    )
      ? currentChallenge.modules[0]
      : currentChallenge.modules;

  const quizData =
    Array.isArray(
      currentChallenge.quizzes
    )
      ? currentChallenge.quizzes[0]
      : currentChallenge.quizzes;

  $("challengeTitle").textContent =
    currentChallenge.title ||
    `${
      moduleData?.title ||
      "ACL"
    } Challenge`;

  $("challengeModuleTitle")
    .textContent =
      quizData?.title ||
      moduleData?.title ||
      "Learning module";

  $("challengeCode").textContent =
    currentChallenge
      .challenge_code;

  $("challengeParticipantCount")
    .textContent =
      currentChallenge
        .maximum_participants
        ? `${participantCount} / ${currentChallenge.maximum_participants}`
        : String(
            participantCount
          );

  $("challengeEndsAt").textContent =
    formatEndDate(
      currentChallenge.ends_at
    );

  const expired =
    challengeExpired(
      currentChallenge
    );

  const open =
    currentChallenge.status ===
      "open" &&
    !expired;

  $("challengeStatusBadge")
    .textContent =
      expired
        ? "Expired"
        : currentChallenge
            .status ===
          "open"
          ? "Open"
          : currentChallenge
              .status;

  $("challengeStatusBadge")
    .classList.toggle(
      "is-closed",
      !open
    );

  const joined =
    Boolean(
      currentParticipant
    );

  const completed =
    currentParticipant
      ?.invitation_status ===
      "completed";

  $("joinChallenge").hidden =
    joined ||
    !open;

  $("startChallenge").hidden =
    !joined ||
    !open ||
    completed;

  if (completed) {
    showMessage(
      `Challenge already completed. Score: ${
        currentParticipant.score ??
        0
      }.`,
      "success"
    );
  } else if (!open) {
    showMessage(
      expired
        ? "This challenge has expired."
        : "This challenge is no longer open.",
      "warning"
    );
  } else if (joined) {
    showMessage(
      "You have joined this challenge. Start when ready.",
      "success"
    );
  }

  showChallengeView();
}


/* =========================================================
   JOIN
========================================================= */

async function joinChallenge() {
  if (
    !currentChallenge ||
    !currentUser
  ) {
    return;
  }

  const button =
    $("joinChallenge");

  button.disabled =
    true;

  button.textContent =
    "Joining…";

  try {
    if (
      challengeExpired(
        currentChallenge
      ) ||
      currentChallenge.status !==
        "open"
    ) {
      throw new Error(
        "This challenge is no longer open."
      );
    }

    const participantCount =
      await loadParticipantCount(
        currentChallenge.id
      );

    if (
      currentChallenge
        .maximum_participants &&
      participantCount >=
        currentChallenge
          .maximum_participants
    ) {
      throw new Error(
        "This challenge has reached its maximum number of participants."
      );
    }

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "module_challenge_participants"
        )
        .upsert(
          {
            challenge_id:
              currentChallenge.id,

            user_id:
              currentUser.id,

            invitation_status:
              "joined"
          },
          {
            onConflict:
              "challenge_id,user_id"
          }
        )
        .select()
        .single();

    if (error) {
      throw error;
    }

    currentParticipant =
      data;

    renderChallenge(
      participantCount + 1
    );
  } catch (error) {
    console.error(
      "JOIN CHALLENGE ERROR:",
      error
    );

    showMessage(
      error.message ||
      "Challenge could not be joined.",
      "error"
    );
  } finally {
    button.disabled =
      false;

    button.textContent =
      "Join challenge";
  }
}


/* =========================================================
   START
========================================================= */

function startChallenge() {
  if (
    !currentChallenge ||
    !currentParticipant
  ) {
    return;
  }

  const moduleData =
    Array.isArray(
      currentChallenge.modules
    )
      ? currentChallenge.modules[0]
      : currentChallenge.modules;

  const quizData =
    Array.isArray(
      currentChallenge.quizzes
    )
      ? currentChallenge.quizzes[0]
      : currentChallenge.quizzes;

  if (
    !moduleData?.id ||
    !quizData?.slug
  ) {
    showMessage(
      "The challenge quiz link is incomplete.",
      "error"
    );

    return;
  }

  const url =
    new URL(
      "learning.html",
      window.location.href
    );

  url.searchParams.set(
    "quiz",
    quizData.slug
  );

  url.searchParams.set(
    "module",
    moduleData.id
  );

  url.searchParams.set(
    "challenge",
    currentChallenge.id
  );

  window.location.href =
    url.toString();
}


/* =========================================================
   INITIALISATION
========================================================= */

(async () => {
  try {
    const profile =
      await protectAndRender(
        "login.html"
      );

    if (!profile) {
      return;
    }

    const {
      data: userData,
      error: userError
    } =
      await supabaseClient
        .auth
        .getUser();

    if (userError) {
      throw userError;
    }

    currentUser =
      userData?.user;

    if (!currentUser) {
      throw new Error(
        "Please sign in to open this challenge."
      );
    }

    if (!challengeCode) {
      throw new Error(
        "No challenge code was provided."
      );
    }

    currentChallenge =
      await loadChallenge();

    currentParticipant =
      await loadCurrentParticipant(
        currentChallenge.id
      );

    const participantCount =
      await loadParticipantCount(
        currentChallenge.id
      );

    renderChallenge(
      participantCount
    );
  } catch (error) {
    console.error(
      "CHALLENGE PAGE ERROR:",
      error
    );

    showChallengeError(
      error.message ||
      "This challenge could not be opened."
    );
  }
})();


$("joinChallenge")
  ?.addEventListener(
    "click",
    joinChallenge
  );


$("startChallenge")
  ?.addEventListener(
    "click",
    startChallenge
  );
