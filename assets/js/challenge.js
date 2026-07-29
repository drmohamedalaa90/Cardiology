import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL CHALLENGE v2.1.0 LOADED"
);


/* =========================================================
   PAGE STATE
========================================================= */

const selectedEdition =
  resolveAclEdition();


const state = {
  user: null,
  profile: null,
  challenge: null,
  module: null,
  quiz: null,
  role: null
};


const el =
  (id) =>
    document.getElementById(
      id
    );


const form =
  el(
    "challengeForm"
  );


const moduleSelect =
  el(
    "challengeModule"
  );


const quizSelect =
  el(
    "challengeQuiz"
  );


const questionCountSelect =
  el(
    "challengeQuestions"
  );


const expirySelect =
  el(
    "challengeExpiry"
  );


const messageInput =
  el(
    "challengeMessage"
  );


const messageCount =
  el(
    "challengeMessageCount"
  );


const createButton =
  el(
    "createChallengeButton"
  );


const formError =
  el(
    "challengeFormError"
  );


const creatorPanel =
  el(
    "challengeCreatorPanel"
  );


const createdCard =
  el(
    "challengeCreatedCard"
  );


const incomingPanel =
  el(
    "incomingChallengePanel"
  );


const resultPanel =
  el(
    "challengeResultPanel"
  );


/* =========================================================
   GENERAL HELPERS
========================================================= */

function escapeHtml(
  value = ""
) {
  return String(
    value
  ).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        "'":
          "&#39;",

        '"':
          "&quot;"
      })[
        character
      ]
  );
}


function setError(
  target,
  message = ""
) {
  if (!target) {
    return;
  }


  target.textContent =
    message;


  target.hidden =
    !message;
}


function setLoading(
  button,
  loading,
  loadingText =
    "Please wait…"
) {
  if (!button) {
    return;
  }


  if (
    !button.dataset.originalText
  ) {
    button.dataset.originalText =
      button.innerHTML;
  }


  button.disabled =
    loading;


  button.innerHTML =
    loading
      ? loadingText
      : button.dataset.originalText;
}


function formatDate(
  value
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  ).format(
    date
  );
}


function formatTime(
  seconds
) {
  if (
    seconds === null ||
    seconds === undefined
  ) {
    return "Waiting";
  }


  const total =
    Math.max(
      0,
      Math.round(
        Number(
          seconds
        ) ||
        0
      )
    );


  const minutes =
    Math.floor(
      total /
      60
    );


  const remainder =
    total %
    60;


  return `${minutes}:${String(
    remainder
  ).padStart(
    2,
    "0"
  )}`;
}


function randomChallengeCode() {
  return `ACL-${crypto
    .randomUUID()
    .replaceAll(
      "-",
      ""
    )
    .slice(
      0,
      10
    )
    .toUpperCase()}`;
}


function shuffleItems(
  items
) {
  const result = [
    ...items
  ];


  for (
    let index =
      result.length -
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
      result[index],
      result[randomIndex]
    ] = [
      result[randomIndex],
      result[index]
    ];
  }


  return result;
}


function challengeInvitationUrl(
  challengeCode
) {
  const url =
    new URL(
      "challenge.html",
      window.location.href
    );


  url.searchParams.set(
    "code",
    challengeCode
  );


  url.searchParams.set(
    "edition",
    selectedEdition
  );


  return url.toString();
}


/* =========================================================
   EDITION DISPLAY
========================================================= */

function renderEdition() {
  const isBasic =
    selectedEdition ===
    "basic";


  document.body.classList.remove(
    "acl-theme-basic",
    "acl-theme-expert"
  );


  document.body.classList.add(
    isBasic
      ? "acl-theme-basic"
      : "acl-theme-expert"
  );


  const badge =
    el(
      "challengeEditionBadge"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "ACL BASIC EDITION"
        : "ACL EXPERT EDITION";
  }


  const themeColor =
    el(
      "challengeThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const backLink =
    el(
      "challengeBackLink"
    );


  if (backLink) {
    backLink.href =
      aclUrl(
        "modules.html",
        selectedEdition
      );
  }


  document.title =
    selectedEdition ===
      "basic"
      ? "Challenge a Colleague | ACL Basic Edition"
      : "Challenge a Colleague | ACL Expert Edition";


  const currentUrl =
    new URL(
      window.location.href
    );


  currentUrl.searchParams.set(
    "edition",
    selectedEdition
  );


  window.history.replaceState(
    {},
    "",
    currentUrl
  );
}


/* =========================================================
   AUTHENTICATION
========================================================= */

async function requireAuthenticatedUser() {
  const profile =
    await protectAndRender(
      "login.html"
    );


  if (!profile) {
    return false;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getUser();


  if (error) {
    throw error;
  }


  if (!data?.user) {
    throw new Error(
      "Please sign in to use ACL challenges."
    );
  }


  state.user =
    data.user;


  state.profile =
    profile;


  return true;
}


/* =========================================================
   LOAD EDITION MODULES
========================================================= */

async function loadModules() {
  if (
    !moduleSelect
  ) {
    return;
  }


  moduleSelect.disabled =
    true;


  moduleSelect.innerHTML = `
    <option value="">
      Loading modules…
    </option>
  `;


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "modules"
      )
      .select(`
        id,
        slug,
        title,
        edition,
        status,
        launch_path,
        display_order
      `)
      .eq(
        "edition",
        selectedEdition
      )
      .neq(
        "status",
        "coming_soon"
      )
      .order(
        "display_order",
        {
          ascending:
            true
        }
      )
      .order(
        "title",
        {
          ascending:
            true
        }
      );


  if (error) {
    throw error;
  }


  const modules =
    data ||
    [];


  if (!modules.length) {
    moduleSelect.innerHTML = `
      <option value="">
        No ${escapeHtml(
          selectedEdition
        )} modules available
      </option>
    `;


    setError(
      formError,
      `No ${selectedEdition} modules are currently available.`
    );


    return;
  }


  moduleSelect.innerHTML = [
    `
      <option value="">
        Choose a module
      </option>
    `,

    ...modules.map(
      (module) => `
        <option
          value="${escapeHtml(
            module.id
          )}"
          data-slug="${escapeHtml(
            module.slug ||
            ""
          )}"
          data-title="${escapeHtml(
            module.title ||
            "ACL Module"
          )}"
          data-launch-path="${escapeHtml(
            module.launch_path ||
            ""
          )}"
        >
          ${escapeHtml(
            module.title
          )}
        </option>
      `
    )
  ].join(
    ""
  );


  moduleSelect.disabled =
    false;


  const moduleText =
    el(
      "moduleLoadingText"
    );


  if (moduleText) {
    moduleText.textContent =
      selectedEdition ===
        "basic"
        ? "Showing Basic Edition modules only."
        : "Showing Expert Edition modules only.";
  }
}


/* =========================================================
   LOAD QUIZZES FOR MODULE
========================================================= */

async function loadQuizzesForModule(
  moduleId
) {
  if (!quizSelect) {
    return;
  }


  quizSelect.disabled =
    true;


  quizSelect.innerHTML = `
    <option value="">
      Loading quizzes…
    </option>
  `;


  setError(
    formError,
    ""
  );


  if (!moduleId) {
    quizSelect.innerHTML = `
      <option value="">
        Choose a module first
      </option>
    `;


    return;
  }


  const selectedOption =
    moduleSelect
      ?.selectedOptions?.[0];


  state.module = {
    id:
      moduleId,

    slug:
      selectedOption
        ?.dataset
        ?.slug ||
      "",

    title:
      selectedOption
        ?.dataset
        ?.title ||
      "ACL Module",

    launchPath:
      selectedOption
        ?.dataset
        ?.launchPath ||
      ""
  };


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quizzes"
      )
      .select(`
        id,
        slug,
        title,
        module_id,
        edition,
        status,
        question_count,
        opens_at,
        closes_at
      `)
      .eq(
        "module_id",
        moduleId
      )
      .eq(
        "edition",
        selectedEdition
      )
      .eq(
        "status",
        "published"
      )
      .order(
        "title",
        {
          ascending:
            true
        }
      );


  if (error) {
    throw error;
  }


  const quizzes =
    data ||
    [];


  if (!quizzes.length) {
    quizSelect.innerHTML = `
      <option value="">
        No published quiz available
      </option>
    `;


    setError(
      formError,
      "No published quiz belongs to this module and edition."
    );


    return;
  }


  quizSelect.innerHTML = [
    `
      <option value="">
        Choose a quiz
      </option>
    `,

    ...quizzes.map(
      (quiz) => `
        <option
          value="${escapeHtml(
            quiz.id
          )}"
          data-slug="${escapeHtml(
            quiz.slug
          )}"
          data-title="${escapeHtml(
            quiz.title
          )}"
          data-question-count="${Number(
            quiz.question_count ||
            0
          )}"
        >
          ${escapeHtml(
            quiz.title
          )}
        </option>
      `
    )
  ].join(
    ""
  );


  quizSelect.disabled =
    false;


  const loadingText =
    el(
      "quizLoadingText"
    );


  if (loadingText) {
    loadingText.textContent =
      `${quizzes.length} published quiz${
        quizzes.length ===
        1
          ? ""
          : "zes"
      } available.`;
  }
}


/* =========================================================
   QUIZ SELECTION
========================================================= */

function handleQuizSelection() {
  const option =
    quizSelect
      ?.selectedOptions?.[0];


  if (
    !option ||
    !option.value
  ) {
    state.quiz =
      null;


    createButton.disabled =
      true;


    return;
  }


  state.quiz = {
    id:
      option.value,

    slug:
      option.dataset
        .slug ||
      "",

    title:
      option.dataset
        .title ||
      "ACL Quiz",

    questionCount:
      Number(
        option.dataset
          .questionCount ||
        0
      )
  };


  createButton.disabled =
    false;
}


/* =========================================================
   CREATE CHALLENGE
========================================================= */

async function createChallenge(
  event
) {
  event.preventDefault();


  setError(
    formError,
    ""
  );


  if (
    !state.module?.id ||
    !state.quiz?.id
  ) {
    setError(
      formError,
      "Choose both a module and a published quiz."
    );


    return;
  }


  const requestedCount =
    Number(
      questionCountSelect
        ?.value ||
      10
    );


  const expiryHours =
    Number(
      expirySelect
        ?.value ||
      24
    );


  setLoading(
    createButton,
    true,
    "Creating challenge…"
  );


  try {
    const {
      data: questionRows,
      error: questionError
    } =
      await supabaseClient
        .from(
          "questions"
        )
        .select(`
          id,
          order_index
        `)
        .eq(
          "quiz_id",
          state.quiz.id
        )
        .order(
          "order_index",
          {
            ascending:
              true
          }
        );


    if (questionError) {
      throw questionError;
    }


    if (
      !Array.isArray(
        questionRows
      ) ||
      !questionRows.length
    ) {
      throw new Error(
        "This quiz does not contain any available questions."
      );
    }


    const questionIds =
      shuffleItems(
        questionRows
      )
        .slice(
          0,
          Math.min(
            requestedCount,
            questionRows.length
          )
        )
        .map(
          (question) =>
            question.id
        );


    const startsAt =
      new Date();


    const endsAt =
      new Date(
        startsAt.getTime() +
        (
          expiryHours *
          60 *
          60 *
          1000
        )
      );


    const challengeCode =
      randomChallengeCode();


    const {
      data: challenge,
      error: challengeError
    } =
      await supabaseClient
        .from(
          "module_challenges"
        )
        .insert({
          module_id:
            state.module.id,

          quiz_id:
            state.quiz.id,

          creator_id:
            state.user.id,

          challenge_code:
            challengeCode,

          title:
            `${state.module.title} Challenge`,

          question_ids:
            questionIds,

          maximum_participants:
            2,

          starts_at:
            startsAt.toISOString(),

          ends_at:
            endsAt.toISOString(),

          status:
            "open"
        })
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
          status
        `)
        .single();


    if (challengeError) {
      throw challengeError;
    }


    const {
      error: participantError
    } =
      await supabaseClient
        .from(
          "module_challenge_participants"
        )
        .upsert(
          {
            challenge_id:
              challenge.id,

            user_id:
              state.user.id,

            invitation_status:
              "joined"
          },
          {
            onConflict:
              "challenge_id,user_id"
          }
        );


    if (participantError) {
      throw participantError;
    }


    state.challenge =
      challenge;


    state.role =
      "challenger";


    showCreatedChallenge(
      challenge,
      questionIds.length
    );
  } catch (error) {
    console.error(
      "CREATE CHALLENGE ERROR:",
      error
    );


    setError(
      formError,
      error.message ||
      "The challenge could not be created."
    );
  } finally {
    setLoading(
      createButton,
      false
    );
  }
}


/* =========================================================
   CREATED CHALLENGE DISPLAY
========================================================= */

function showCreatedChallenge(
  challenge,
  questionCount
) {
  const inviteUrl =
    challengeInvitationUrl(
      challenge.challenge_code
    );


  el(
    "createdModuleName"
  ).textContent =
    state.module?.title ||
    "ACL Module";


  el(
    "createdQuestionCount"
  ).textContent =
    `${questionCount} questions`;


  el(
    "createdExpiry"
  ).textContent =
    formatDate(
      challenge.ends_at
    );


  el(
    "challengeInviteLink"
  ).value =
    inviteUrl;


  createdCard.hidden =
    false;


  createdCard.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start"
  });


  el(
    "startMyChallengeButton"
  ).onclick =
    () =>
      openChallengeAttempt(
        challenge,
        "challenger"
      );


  el(
    "copyChallengeLinkButton"
  ).onclick =
    copyInviteLink;


  el(
    "shareChallengeButton"
  ).onclick =
    shareInviteLink;
}


/* =========================================================
   COPY AND SHARE
========================================================= */

async function copyInviteLink() {
  const input =
    el(
      "challengeInviteLink"
    );


  const feedback =
    el(
      "copyChallengeFeedback"
    );


  const value =
    input?.value ||
    "";


  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator
        .clipboard
        .writeText(
          value
        );
    } else {
      input.focus();
      input.select();

      document.execCommand(
        "copy"
      );
    }


    feedback.textContent =
      "Invitation link copied.";
  } catch (error) {
    console.error(
      "COPY CHALLENGE ERROR:",
      error
    );


    input.focus();
    input.select();


    feedback.textContent =
      "Please copy the selected invitation link manually.";
  }
}


async function shareInviteLink() {
  const url =
    el(
      "challengeInviteLink"
    )
      ?.value ||
    "";


  const profileName =
    state.profile
      ?.display_name ||
    state.profile
      ?.full_name ||
    state.profile
      ?.username ||
    "A colleague";


  const editionName =
    selectedEdition ===
      "basic"
      ? "ACL Basic Edition"
      : "ACL Expert Edition";


  const title =
    `${editionName} Challenge`;


  const customMessage =
    messageInput
      ?.value
      ?.trim();


  const text =
    customMessage ||
    `${profileName} challenged you in ${state.module?.title || editionName}.`;


  if (
    navigator.share
  ) {
    try {
      await navigator.share({
        title,
        text,
        url
      });


      return;
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }
    }
  }


  await copyInviteLink();
}


/* =========================================================
   LOAD INCOMING CHALLENGE
========================================================= */

async function loadIncomingChallenge(
  challengeCode
) {
  creatorPanel.hidden =
    true;


  incomingPanel.hidden =
    false;


  setError(
    el(
      "incomingChallengeError"
    ),
    ""
  );


  const {
    data: challenge,
    error: challengeError
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
        status
      `)
      .eq(
        "challenge_code",
        challengeCode
      )
      .maybeSingle();


  if (challengeError) {
    throw challengeError;
  }


  if (!challenge) {
    throw new Error(
      "This invitation is invalid or is no longer available."
    );
  }


  const [
    moduleResult,
    quizResult,
    creatorResult,
    participantResult
  ] =
    await Promise.all([
      supabaseClient
        .from(
          "modules"
        )
        .select(`
          id,
          slug,
          title,
          edition,
          launch_path
        `)
        .eq(
          "id",
          challenge.module_id
        )
        .maybeSingle(),

      supabaseClient
        .from(
          "quizzes"
        )
        .select(`
          id,
          slug,
          title,
          edition
        `)
        .eq(
          "id",
          challenge.quiz_id
        )
        .maybeSingle(),

      supabaseClient
        .from(
          "profiles"
        )
        .select(`
          id,
          display_name,
          full_name,
          username,
          avatar_url
        `)
        .eq(
          "id",
          challenge.creator_id
        )
        .maybeSingle(),

      supabaseClient
        .from(
          "module_challenge_participants"
        )
        .select(`
          challenge_id,
          user_id,
          invitation_status
        `)
        .eq(
          "challenge_id",
          challenge.id
        )
    ]);


  if (moduleResult.error) {
    throw moduleResult.error;
  }


  if (quizResult.error) {
    throw quizResult.error;
  }


  if (creatorResult.error) {
    console.warn(
      "CREATOR PROFILE ERROR:",
      creatorResult.error
    );
  }


  if (participantResult.error) {
    throw participantResult.error;
  }


  const module =
    moduleResult.data;


  const quiz =
    quizResult.data;


  if (
    !module ||
    !quiz
  ) {
    throw new Error(
      "The module or quiz linked to this challenge could not be found."
    );
  }


  if (
    String(
      module.edition ||
      ""
    )
      .trim()
      .toLowerCase() !==
      selectedEdition ||
    String(
      quiz.edition ||
      ""
    )
      .trim()
      .toLowerCase() !==
      selectedEdition
  ) {
    throw new Error(
      `This invitation belongs to the ${module.edition || quiz.edition} edition.`
    );
  }


  state.challenge =
    challenge;


  state.module =
    module;


  state.quiz =
    quiz;


  const participants =
    participantResult.data ||
    [];


  const currentParticipant =
    participants.find(
      (participant) =>
        participant.user_id ===
        state.user.id
    );


  state.role =
    challenge.creator_id ===
      state.user.id
      ? "challenger"
      : currentParticipant
        ? "opponent"
        : null;


  renderIncomingChallenge(
    challenge,
    creatorResult.data,
    participants
  );
}


/* =========================================================
   RENDER INCOMING CHALLENGE
========================================================= */

function renderIncomingChallenge(
  challenge,
  creator,
  participants
) {
  const creatorName =
    creator?.display_name ||
    creator?.full_name ||
    creator?.username ||
    "ACL colleague";


  el(
    "challengerName"
  ).textContent =
    creatorName;


  el(
    "challengerInitial"
  ).textContent =
    creatorName
      .trim()
      .charAt(
        0
      )
      .toUpperCase() ||
    "C";


  el(
    "incomingModuleName"
  ).textContent =
    state.module?.title ||
    "ACL Module";


  el(
    "incomingQuestionCount"
  ).textContent =
    `${state.challenge?.question_ids?.length || 0} questions`;


  el(
    "incomingExpiry"
  ).textContent =
    formatDate(
      challenge.ends_at
    );


  const statusPill =
    el(
      "incomingChallengeState"
    );


  statusPill.textContent =
    humanizeStatus(
      challenge.status
    );


  const acceptButton =
    el(
      "acceptChallengeButton"
    );


  if (
    new Date(
      challenge.ends_at
    ).getTime() <=
      Date.now() ||
    challenge.status ===
      "expired" ||
    challenge.status ===
      "cancelled" ||
    challenge.status ===
      "closed"
  ) {
    acceptButton.hidden =
      true;


    setError(
      el(
        "incomingChallengeError"
      ),
      "This challenge invitation has expired or is closed."
    );


    return;
  }


  if (
    challenge.creator_id ===
    state.user.id
  ) {
    acceptButton.hidden =
      false;


    acceptButton.textContent =
      "Start my challenge attempt";


    acceptButton.onclick =
      () =>
        openChallengeAttempt(
          challenge,
          "challenger"
        );


    return;
  }


  const alreadyJoined =
    participants.some(
      (participant) =>
        participant.user_id ===
        state.user.id
    );


  const opponentCount =
    participants.filter(
      (participant) =>
        participant.user_id !==
        challenge.creator_id
    ).length;


  if (
    !alreadyJoined &&
    opponentCount >=
      Math.max(
        1,
        Number(
          challenge.maximum_participants ||
          2
        ) -
        1
      )
  ) {
    acceptButton.hidden =
      true;


    setError(
      el(
        "incomingChallengeError"
      ),
      "This private invitation has already been accepted by another competitor."
    );


    return;
  }


  acceptButton.hidden =
    false;


  acceptButton.textContent =
    alreadyJoined
      ? "Continue my challenge"
      : "Accept and start";


  acceptButton.onclick =
    acceptIncomingChallenge;
}


/* =========================================================
   ACCEPT CHALLENGE
========================================================= */

async function acceptIncomingChallenge() {
  const button =
    el(
      "acceptChallengeButton"
    );


  setLoading(
    button,
    true,
    "Accepting…"
  );


  setError(
    el(
      "incomingChallengeError"
    ),
    ""
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "module_challenge_participants"
        )
        .upsert(
          {
            challenge_id:
              state.challenge.id,

            user_id:
              state.user.id,

            invitation_status:
              "joined"
          },
          {
            onConflict:
              "challenge_id,user_id"
          }
        );


    if (error) {
      throw error;
    }


    state.role =
      "opponent";


    openChallengeAttempt(
      state.challenge,
      "opponent"
    );
  } catch (error) {
    console.error(
      "ACCEPT CHALLENGE ERROR:",
      error
    );


    setError(
      el(
        "incomingChallengeError"
      ),
      error.message ||
      "The challenge could not be accepted."
    );
  } finally {
    setLoading(
      button,
      false
    );
  }
}


/* =========================================================
   OPEN CHALLENGE QUIZ
========================================================= */

function openChallengeAttempt(
  challenge,
  role
) {
  const launchPath =
    state.module
      ?.launch_path ||
    state.module
      ?.launchPath ||
    "learning.html";


  const url =
    new URL(
      launchPath,
      window.location.href
    );


  if (
    state.quiz?.slug
  ) {
    url.searchParams.set(
      "quiz",
      state.quiz.slug
    );
  }


  if (
    state.module?.slug
  ) {
    url.searchParams.set(
      "module",
      state.module.slug
    );
  }


  url.searchParams.set(
    "challenge",
    challenge.id
  );


  url.searchParams.set(
    "challenge_code",
    challenge.challenge_code
  );


  url.searchParams.set(
    "challenge_role",
    role
  );


  url.searchParams.set(
    "edition",
    selectedEdition
  );


  window.location.href =
    url.toString();
}


/* =========================================================
   STATUS HELPERS
========================================================= */

function humanizeStatus(
  status
) {
  return String(
    status ||
    "open"
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


/* =========================================================
   CHALLENGE LEADERBOARD
========================================================= */

async function loadChallengeLeaderboard() {
  const status =
    el(
      "challengeLeaderboardStatus"
    );


  const table =
    el(
      "challengeLeaderboardTable"
    );


  if (
    !status ||
    !table
  ) {
    return;
  }


  status.hidden =
    false;


  status.textContent =
    "Loading leaderboard…";


  table.hidden =
    true;


  table.innerHTML =
    "";


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "module_challenge_leaderboard"
        )
        .select(`
          leaderboard_position,
          participant_name,
          username,
          avatar_url,
          completed_challenges,
          challenge_wins,
          total_challenge_score,
          average_duration_seconds
        `)
        .order(
          "leaderboard_position",
          {
            ascending:
              true
          }
        )
        .limit(
          50
        );


    if (error) {
      throw error;
    }


    if (
      !Array.isArray(
        data
      ) ||
      !data.length
    ) {
      status.textContent =
        "No completed challenges yet.";


      return;
    }


    table.innerHTML = `
      <div class="challenge-leaderboard-header">
        <span>Rank</span>
        <span>Competitor</span>
        <span>Wins</span>
        <span>Score</span>
        <span>Average time</span>
      </div>

      ${data.map(
        (
          participant,
          index
        ) =>
          challengeLeaderboardRowHtml(
            participant,
            index
          )
      ).join("")}
    `;


    status.hidden =
      true;


    table.hidden =
      false;
  } catch (error) {
    console.error(
      "CHALLENGE LEADERBOARD ERROR:",
      error
    );


    status.textContent =
      error.message ||
      "The challenge leaderboard could not be loaded.";
  }
}


function challengeLeaderboardRowHtml(
  participant,
  index
) {
  const position =
    Number(
      participant
        .leaderboard_position ||
      index +
      1
    );


  const participantName =
    participant
      .participant_name ||
    participant
      .username ||
    "ACL Competitor";


  const initials =
    participantName
      .trim()
      .split(
        /\s+/
      )
      .slice(
        0,
        2
      )
      .map(
        (part) =>
          part
            .charAt(
              0
            )
            .toUpperCase()
      )
      .join(
        ""
      ) ||
    "ACL";


  const averageSeconds =
    Math.max(
      0,
      Math.round(
        Number(
          participant
            .average_duration_seconds ||
          0
        )
      )
    );


  const formattedTime =
    formatTime(
      averageSeconds
    );


  const medal =
    position ===
      1
      ? "🥇"
      : position ===
          2
        ? "🥈"
        : position ===
            3
          ? "🥉"
          : position;


  return `
    <article
      class="
        challenge-leaderboard-row
        ${
          position <=
          3
            ? `is-top-${position}`
            : ""
        }
      "
    >
      <div class="challenge-leaderboard-rank">
        ${medal}
      </div>

      <div class="challenge-leaderboard-person">
        ${
          participant.avatar_url
            ? `
              <img
                src="${escapeHtml(
                  participant.avatar_url
                )}"
                alt=""
                class="challenge-leaderboard-avatar"
              >
            `
            : `
              <span
                class="
                  challenge-leaderboard-avatar
                  challenge-leaderboard-initials
                "
                aria-hidden="true"
              >
                ${escapeHtml(
                  initials
                )}
              </span>
            `
        }

        <div>
          <strong>
            ${escapeHtml(
              participantName
            )}
          </strong>

          <small>
            ${Number(
              participant
                .completed_challenges ||
              0
            )}
            completed
          </small>
        </div>
      </div>

      <strong class="challenge-leaderboard-value">
        ${Number(
          participant
            .challenge_wins ||
          0
        )}
      </strong>

      <strong class="challenge-leaderboard-value">
        ${Number(
          participant
            .total_challenge_score ||
          0
        )}
      </strong>

      <strong class="challenge-leaderboard-value">
        ${formattedTime}
      </strong>
    </article>
  `;
}


/* =========================================================
   EVENTS
========================================================= */

messageInput
  ?.addEventListener(
    "input",
    () => {
      if (messageCount) {
        messageCount.textContent =
          String(
            messageInput.value.length
          );
      }
    }
  );


moduleSelect
  ?.addEventListener(
    "change",
    async () => {
      state.quiz =
        null;


      createButton.disabled =
        true;


      await loadQuizzesForModule(
        moduleSelect.value
      );
    }
  );


quizSelect
  ?.addEventListener(
    "change",
    handleQuizSelection
  );


form
  ?.addEventListener(
    "submit",
    createChallenge
  );


el(
  "refreshChallengeLeaderboard"
)
  ?.addEventListener(
    "click",
    loadChallengeLeaderboard
  );


/* =========================================================
   START
========================================================= */

async function initChallengePage() {
  try {
    renderEdition();


    const authenticated =
      await requireAuthenticatedUser();


    if (!authenticated) {
      return;
    }


    const parameters =
      new URLSearchParams(
        window.location.search
      );


    const challengeCode =
      String(
        parameters.get(
          "code"
        ) ||
        ""
      )
        .trim()
        .toUpperCase();


    if (challengeCode) {
      await loadIncomingChallenge(
        challengeCode
      );
    } else {
      await loadModules();
    }


    await loadChallengeLeaderboard();
  } catch (error) {
    console.error(
      "CHALLENGE PAGE ERROR:",
      error
    );


    const target =
      incomingPanel &&
      !incomingPanel.hidden
        ? el(
            "incomingChallengeError"
          )
        : formError;


    setError(
      target,
      error.message ||
      "The challenge page could not be initialized."
    );


    if (createButton) {
      createButton.disabled =
        true;
    }
  }
}


void initChallengePage();
