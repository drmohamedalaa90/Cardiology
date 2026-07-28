(() => {
  "use strict";

  const db =
    window.supabaseClient ||
    window.aclSupabase ||
    window.supabase;

  const state = {
    user: null,
    profile: null,
    challenge: null,
    role: null
  };

  const MODULE_NAMES = {
    ecg: "ECG Rhythms",
    ppci: "Primary PCI",
    "left-main": "Left Main Interventions",
    mitral: "Mitral Valve Interventions",
    mcs: "Mechanical Circulatory Support",
    "heart-failure": "Heart Failure"
  };

  const el = (id) => document.getElementById(id);

  const form = el("challengeForm");
  const moduleSelect = el("challengeModule");
  const quizSelect = el("challengeQuiz");
  const questionCountSelect = el("challengeQuestions");
  const expirySelect = el("challengeExpiry");
  const messageInput = el("challengeMessage");
  const messageCount = el("challengeMessageCount");
  const sameQuestionsInput = el("challengeSameQuestions");
  const createButton = el("createChallengeButton");
  const formError = el("challengeFormError");

  const creatorPanel = el("challengeCreatorPanel");
  const createdCard = el("challengeCreatedCard");
  const incomingPanel = el("incomingChallengePanel");
  const resultPanel = el("challengeResultPanel");

  function setError(target, message) {
    target.textContent = message || "";
    target.hidden = !message;
  }

  function setLoading(button, loading, loadingText = "Please wait…") {
    if (!button) return;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }
    button.disabled = loading;
    button.innerHTML = loading ? loadingText : button.dataset.originalText;
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined) return "Waiting";
    const total = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")} minutes`;
  }

  async function requireAuthenticatedUser() {
    if (!db?.auth) {
      throw new Error(
        "Supabase client was not found. Load config.js before challenge.js."
      );
    }

    const { data, error } = await db.auth.getUser();
    if (error) throw error;

    state.user = data.user;

    if (!state.user) {
      const next = encodeURIComponent(location.href);
      location.href = `login.html?next=${next}`;
      return false;
    }

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .eq("id", state.user.id)
      .maybeSingle();

    if (profileError) console.warn(profileError);
    state.profile = profile || {
      id: state.user.id,
      full_name: state.user.email?.split("@")[0] || "ACL Competitor"
    };

    return true;
  }

  async function loadQuizzesForModule(moduleSlug) {
    quizSelect.disabled = true;
    quizSelect.innerHTML = '<option value="">Loading quizzes…</option>';
    setError(formError, "");

    if (!moduleSlug) {
      quizSelect.innerHTML = '<option value="">Choose a module first</option>';
      return;
    }

    const { data, error } = await db
      .from("quizzes")
      .select("id, slug, title, status, opens_at, closes_at")
      .eq("module_slug", moduleSlug)
      .order("title");

    if (error) {
      console.error(error);
      quizSelect.innerHTML = '<option value="">Unable to load quizzes</option>';
      setError(
        formError,
        "Could not load quizzes. Confirm that quizzes.module_slug exists and RLS allows signed-in users to read quizzes."
      );
      return;
    }

    const available = (data || []).filter((quiz) => quiz.status !== "draft");

    if (!available.length) {
      quizSelect.innerHTML = '<option value="">No published quiz found</option>';
      return;
    }

    quizSelect.innerHTML = [
      '<option value="">Choose a quiz</option>',
      ...available.map(
        (quiz) =>
          `<option value="${quiz.id}" data-slug="${escapeHtml(quiz.slug)}">${escapeHtml(quiz.title)}</option>`
      )
    ].join("");

    quizSelect.disabled = false;
  }

  async function createChallenge(event) {
    event.preventDefault();
    setError(formError, "");

    const quizOption = quizSelect.selectedOptions[0];
    const quizId = quizSelect.value;
    const quizSlug = quizOption?.dataset.slug || "";
    const moduleSlug = moduleSelect.value;
    const questionCount = Number(questionCountSelect.value);
    const expiryHours = Number(expirySelect.value);
    const message = messageInput.value.trim();

    if (!moduleSlug || !quizId || !quizSlug) {
      setError(formError, "Choose both a module and a quiz.");
      return;
    }

    setLoading(createButton, true, "Creating challenge…");

    try {
      const expiresAt = new Date(
        Date.now() + expiryHours * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await db
        .from("challenges")
        .insert({
          created_by: state.user.id,
          quiz_id: quizId,
          quiz_slug: quizSlug,
          module_slug: moduleSlug,
          question_count: questionCount,
          same_questions: sameQuestionsInput.checked,
          invitation_message: message || null,
          expires_at: expiresAt,
          status: "waiting"
        })
        .select("*")
        .single();

      if (error) throw error;

      state.challenge = data;
      state.role = "challenger";
      showCreatedChallenge(data);
      subscribeToChallenge(data.id);
    } catch (error) {
      console.error(error);
      setError(formError, error.message || "The challenge could not be created.");
    } finally {
      setLoading(createButton, false);
    }
  }

  function showCreatedChallenge(challenge) {
    const inviteUrl = new URL("challenge.html", location.href);
    inviteUrl.searchParams.set("id", challenge.id);

    el("createdModuleName").textContent =
      MODULE_NAMES[challenge.module_slug] || challenge.module_slug;
    el("createdQuestionCount").textContent =
      `${challenge.question_count} questions`;
    el("createdExpiry").textContent = formatDate(challenge.expires_at);
    el("challengeInviteLink").value = inviteUrl.href;

    createdCard.hidden = false;
    createdCard.scrollIntoView({ behavior: "smooth", block: "start" });

    el("startMyChallengeButton").onclick = () =>
      openChallengeAttempt(challenge, "challenger");

    el("copyChallengeLinkButton").onclick = copyInviteLink;
    el("shareChallengeButton").onclick = shareInviteLink;
  }

  async function copyInviteLink() {
    const value = el("challengeInviteLink").value;
    const feedback = el("copyChallengeFeedback");

    try {
      await navigator.clipboard.writeText(value);
      feedback.textContent = "Invitation link copied.";
    } catch {
      el("challengeInviteLink").select();
      document.execCommand("copy");
      feedback.textContent = "Invitation link copied.";
    }
  }

  async function shareInviteLink() {
    const url = el("challengeInviteLink").value;
    const title = "ACL Expert Edition Challenge";
    const text = `${
      state.profile?.full_name || "A colleague"
    } challenged you in ${MODULE_NAMES[state.challenge.module_slug] || "ACL Expert Edition"}.`;

    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await copyInviteLink();
    }
  }

  async function loadIncomingChallenge(challengeId) {
    const { data, error } = await db
      .from("challenges")
      .select(`
        *,
        challenger:profiles!challenges_created_by_fkey(
          id,
          full_name,
          username,
          avatar_url
        )
      `)
      .eq("id", challengeId)
      .single();

    if (error) {
      creatorPanel.hidden = true;
      incomingPanel.hidden = false;
      setError(
        el("incomingChallengeError"),
        "This invitation is invalid, unavailable, or you do not have permission to view it."
      );
      el("acceptChallengeButton").hidden = true;
      return;
    }

    state.challenge = data;
    state.role =
      data.created_by === state.user.id
        ? "challenger"
        : data.opponent_id === state.user.id
          ? "opponent"
          : null;

    creatorPanel.hidden = true;

    if (new Date(data.expires_at) <= new Date() && data.status !== "completed") {
      await markExpired(data.id);
      data.status = "expired";
    }

    renderIncomingChallenge(data);

    if (data.status === "completed" || data.challenger_completed_at || data.opponent_completed_at) {
      renderResult(data);
    }

    subscribeToChallenge(data.id);
  }

  function renderIncomingChallenge(challenge) {
    incomingPanel.hidden = false;

    const challengerName =
      challenge.challenger?.full_name ||
      challenge.challenger?.username ||
      "ACL colleague";

    el("challengerName").textContent = challengerName;
    el("challengerInitial").textContent =
      challengerName.trim().charAt(0).toUpperCase() || "C";
    el("incomingModuleName").textContent =
      MODULE_NAMES[challenge.module_slug] || challenge.module_slug;
    el("incomingQuestionCount").textContent =
      `${challenge.question_count} questions`;
    el("incomingExpiry").textContent = formatDate(challenge.expires_at);

    if (challenge.invitation_message) {
      el("incomingChallengeMessage").hidden = false;
      el("incomingChallengeMessage").textContent =
        `“${challenge.invitation_message}”`;
    }

    const statePill = el("incomingChallengeState");
    statePill.textContent = humanizeStatus(challenge.status);

    const acceptButton = el("acceptChallengeButton");
    acceptButton.onclick = acceptIncomingChallenge;

    if (challenge.status === "expired" || challenge.status === "cancelled") {
      acceptButton.hidden = true;
      setError(
        el("incomingChallengeError"),
        `This challenge is ${challenge.status}.`
      );
      return;
    }

    if (challenge.created_by === state.user.id) {
      acceptButton.hidden = false;
      acceptButton.textContent = challenge.challenger_completed_at
        ? "View my attempt"
        : "Start my attempt";
      acceptButton.onclick = () => openChallengeAttempt(challenge, "challenger");
      return;
    }

    if (challenge.opponent_id && challenge.opponent_id !== state.user.id) {
      acceptButton.hidden = true;
      setError(
        el("incomingChallengeError"),
        "This private invitation has already been accepted by another competitor."
      );
      return;
    }

    if (challenge.opponent_id === state.user.id) {
      acceptButton.textContent = challenge.opponent_completed_at
        ? "View my completed attempt"
        : "Continue my attempt";
    } else {
      acceptButton.textContent = "Accept and start";
    }
  }

  async function acceptIncomingChallenge() {
    const button = el("acceptChallengeButton");
    setLoading(button, true, "Accepting…");
    setError(el("incomingChallengeError"), "");

    try {
      let challenge = state.challenge;

      if (!challenge.opponent_id) {
        const { data, error } = await db.rpc("acl_accept_challenge", {
          p_challenge_id: challenge.id
        });

        if (error) throw error;
        challenge = Array.isArray(data) ? data[0] : data;
        state.challenge = { ...state.challenge, ...challenge };
      }

      state.role = "opponent";
      openChallengeAttempt(state.challenge, "opponent");
    } catch (error) {
      console.error(error);
      setError(
        el("incomingChallengeError"),
        error.message || "The challenge could not be accepted."
      );
    } finally {
      setLoading(button, false);
    }
  }

  function openChallengeAttempt(challenge, role) {
    const url = new URL("learning.html", location.href);
    url.searchParams.set("quiz", challenge.quiz_slug);
    url.searchParams.set("module", challenge.module_slug);
    url.searchParams.set("challenge", challenge.id);
    url.searchParams.set("challenge_role", role);
    url.searchParams.set("question_count", challenge.question_count);

    location.href = url.href;
  }

  async function markExpired(challengeId) {
    await db
      .from("challenges")
      .update({ status: "expired" })
      .eq("id", challengeId)
      .neq("status", "completed");
  }

  function renderResult(challenge) {
    resultPanel.hidden = false;

    el("resultChallengerName").textContent =
      challenge.challenger_name ||
      challenge.challenger?.full_name ||
      "Challenger";
    el("resultOpponentName").textContent =
      challenge.opponent_name || "Opponent";

    el("resultChallengerScore").textContent =
      challenge.challenger_score === null ||
      challenge.challenger_score === undefined
        ? "—"
        : `${challenge.challenger_score} pts`;

    el("resultOpponentScore").textContent =
      challenge.opponent_score === null ||
      challenge.opponent_score === undefined
        ? "—"
        : `${challenge.opponent_score} pts`;

    el("resultChallengerTime").textContent =
      formatTime(challenge.challenger_time_seconds);
    el("resultOpponentTime").textContent =
      formatTime(challenge.opponent_time_seconds);

    const bothFinished =
      Boolean(challenge.challenger_completed_at) &&
      Boolean(challenge.opponent_completed_at);

    el("resultStatusPill").textContent = bothFinished
      ? "Completed"
      : "Waiting for both";

    const banner = el("challengeWinnerBanner");
    banner.hidden = !bothFinished;

    if (bothFinished) {
      banner.textContent = getWinnerText(challenge);
    }

    const role =
      challenge.created_by === state.user.id ? "challenger" : "opponent";
    const attemptUrl = new URL("learning.html", location.href);
    attemptUrl.searchParams.set("quiz", challenge.quiz_slug);
    attemptUrl.searchParams.set("module", challenge.module_slug);
    attemptUrl.searchParams.set("challenge", challenge.id);
    attemptUrl.searchParams.set("challenge_role", role);
    el("openChallengeQuizLink").href = attemptUrl.href;
  }

  function getWinnerText(challenge) {
    const challengerScore = Number(challenge.challenger_score);
    const opponentScore = Number(challenge.opponent_score);
    const challengerTime = Number(challenge.challenger_time_seconds);
    const opponentTime = Number(challenge.opponent_time_seconds);

    if (challengerScore > opponentScore) {
      return `${challenge.challenger_name || "The challenger"} wins the challenge!`;
    }

    if (opponentScore > challengerScore) {
      return `${challenge.opponent_name || "The opponent"} wins the challenge!`;
    }

    if (challengerTime < opponentTime) {
      return `${challenge.challenger_name || "The challenger"} wins the tie-break by time!`;
    }

    if (opponentTime < challengerTime) {
      return `${challenge.opponent_name || "The opponent"} wins the tie-break by time!`;
    }

    return "Perfect tie — same score and same total time!";
  }

  function subscribeToChallenge(challengeId) {
    if (!db?.channel) return;

    db.channel(`challenge-${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenges",
          filter: `id=eq.${challengeId}`
        },
        (payload) => {
          state.challenge = { ...state.challenge, ...payload.new };
          renderIncomingChallenge(state.challenge);
          renderResult(state.challenge);
        }
      )
      .subscribe();
  }

  function humanizeStatus(status) {
    return String(status || "waiting")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
      await db
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

        <span>
          Rank
        </span>

        <span>
          Competitor
        </span>

        <span>
          Wins
        </span>

        <span>
          Score
        </span>

        <span>
          Average time
        </span>

      </div>

      ${data
        .map(
          (
            participant,
            participantIndex
          ) =>
            challengeLeaderboardRowHtml(
              participant,
              participantIndex
            )
        )
        .join("")}
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
  participantIndex
) {
  const position =
    Number(
      participant
        .leaderboard_position ||
      participantIndex + 1
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
      .join("") ||
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

  const minutes =
    Math.floor(
      averageSeconds /
      60
    );

  const seconds =
    averageSeconds %
    60;

  const formattedTime =
    `${minutes}:${String(
      seconds
    ).padStart(
      2,
      "0"
    )}`;

  const medal =
    position === 1
      ? "🥇"
      : position === 2
        ? "🥈"
        : position === 3
          ? "🥉"
          : position;

  return `
    <article
      class="
        challenge-leaderboard-row
        ${
          position <= 3
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
                class="challenge-leaderboard-avatar challenge-leaderboard-initials"
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
  async function init() {
    try {
      const authenticated = await requireAuthenticatedUser();
      if (!authenticated) return;

      messageInput?.addEventListener("input", () => {
        messageCount.textContent = messageInput.value.length;
      });

      moduleSelect?.addEventListener("change", () =>
        loadQuizzesForModule(moduleSelect.value)
      );

      form?.addEventListener("submit", createChallenge);
await loadChallengeLeaderboard();


el(
  "refreshChallengeLeaderboard"
)
  ?.addEventListener(
    "click",
    loadChallengeLeaderboard
  );
      const challengeId = new URLSearchParams(location.search).get("id");

      if (challengeId) {
        await loadIncomingChallenge(challengeId);
      }
    } catch (error) {
      console.error(error);
      setError(
        formError,
        error.message || "The challenge page could not be initialized."
      );
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
