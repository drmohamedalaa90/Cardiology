import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender
} from "./session-ui.js?v=2.8.0";


console.log(
  "ACL PROFILE EDITOR v1.1.1 LOADED"
);


const el = (id) =>
  document.getElementById(id);


/* =========================================================
   STATUS MESSAGES
========================================================= */

function setProfileStatus(
  message = "",
  isError = false
) {
  const status =
    el("profileStatus");

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.hidden =
    !message;

  status.classList.toggle(
    "error",
    isError
  );

  status.classList.toggle(
    "success",
    Boolean(message) &&
    !isError
  );
}


function setPasswordStatus(
  message = "",
  isError = false
) {
  const status =
    el("passwordStatus");

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.hidden =
    !message;

  status.classList.toggle(
    "error",
    isError
  );

  status.classList.toggle(
    "success",
    Boolean(message) &&
    !isError
  );
}


/* =========================================================
   AVATAR
========================================================= */

function profileInitials(
  profile
) {
  const name =
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    "ACL";

  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        (part) =>
          part.charAt(0)
      )
      .join("")
      .toUpperCase() ||
    "ACL"
  );
}


function renderAvatar(
  profile
) {
  const image =
    el("avatarPreview");

  const placeholder =
    el("avatarPlaceholder");

  if (
    !image ||
    !placeholder
  ) {
    return;
  }

  placeholder.textContent =
    profileInitials(
      profile
    );

  if (profile?.avatar_url) {
    image.src =
      profile.avatar_url;

    image.style.display =
      "block";

    placeholder.style.display =
      "none";

    image.onerror =
      () => {
        image.style.display =
          "none";

        placeholder.style.display =
          "grid";
      };
  } else {
    image.style.display =
      "none";

    placeholder.style.display =
      "grid";
  }
}


async function uploadAvatar(
  userId
) {
  const file =
    el("avatarFile")
      ?.files?.[0];

  if (!file) {
    return null;
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "webp";

  const filePath =
    `${userId}/avatar-${Date.now()}.${extension}`;

  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from("avatars")
      .upload(
        filePath,
        file,
        {
          upsert: true
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data
  } =
    supabaseClient
      .storage
      .from("avatars")
      .getPublicUrl(
        filePath
      );

  return (
    data?.publicUrl ||
    null
  );
}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfilePage() {
  try {
    const profile =
      await protectAndRender(
        "login.html"
      );

    if (!profile) {
      return;
    }

    if (el("displayName")) {
      el("displayName").value =
        profile.display_name ||
        profile.full_name ||
        profile.username ||
        "";
    }

    if (el("email")) {
      el("email").value =
        profile.email ||
        "";
    }

    if (el("username")) {
      el("username").value =
        profile.username ||
        "";
    }

    if (el("whatsapp")) {
      el("whatsapp").value =
        profile.whatsapp ||
        profile.phone_e164 ||
        "";
    }

    if (el("institution")) {
      el("institution").value =
        profile.institution ||
        "";
    }

    const positionInput =
      el("academicYear");

    if (positionInput) {
      const savedPosition =
        profile.position ||
        profile.academic_year ||
        "";

      positionInput.value =
        savedPosition;

      if (
        positionInput.value !==
        savedPosition
      ) {
        positionInput.value =
          "";
      }
    }

    renderAvatar(
      profile
    );

    setProfileStatus(
      ""
    );
  } catch (error) {
    console.error(
      "PROFILE LOAD ERROR:",
      error
    );

    setProfileStatus(
      error.message ||
      "The profile could not be loaded.",
      true
    );
  }
}


/* =========================================================
   SAVE PROFILE
========================================================= */

el("profileForm")
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setProfileStatus(
        "Saving profile…"
      );

      try {
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

        const user =
          userData?.user;

        if (!user) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        const displayName =
          el("displayName")
            ?.value
            ?.trim() ||
          "";

        const whatsapp =
          el("whatsapp")
            ?.value
            ?.trim() ||
          "";

        const position =
          el("academicYear")
            ?.value ||
          "";

        const institution =
          el("institution")
            ?.value
            ?.trim() ||
          "";

        if (
          displayName.length < 2
        ) {
          throw new Error(
            "Display Name must contain at least 2 characters."
          );
        }

        const avatarUrl =
          await uploadAvatar(
            user.id
          );

        const updates = {
          display_name:
            displayName,

          whatsapp,

          academic_year:
            position,

          institution
        };

        if (avatarUrl) {
          updates.avatar_url =
            avatarUrl;
        }

        const {
          data,
          error
        } =
          await supabaseClient
            .from("profiles")
            .update(
              updates
            )
            .eq(
              "id",
              user.id
            )
            .select("*")
            .single();

        if (error) {
          throw error;
        }

        window.aclCurrentProfile = {
          ...window.aclCurrentProfile,
          ...data,
          email:
            user.email
        };

        renderAvatar(
          window.aclCurrentProfile
        );

        setProfileStatus(
          "Profile saved successfully."
        );
      } catch (error) {
        console.error(
          "PROFILE SAVE ERROR:",
          error
        );

        setProfileStatus(
          error.message ||
          "The profile could not be saved.",
          true
        );
      }
    }
  );


/* =========================================================
   CHANGE PASSWORD
========================================================= */

el("passwordForm")
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setPasswordStatus(
        ""
      );

      const currentPassword =
        el("currentPassword")
          ?.value ||
        "";

      const newPassword =
        el("profileNewPassword")
          ?.value ||
        "";

      const confirmation =
        el("profileConfirmPassword")
          ?.value ||
        "";

      if (
        newPassword.length < 8
      ) {
        setPasswordStatus(
          "New password must contain at least 8 characters.",
          true
        );

        return;
      }

      if (
        newPassword !==
        confirmation
      ) {
        setPasswordStatus(
          "The new passwords do not match.",
          true
        );

        return;
      }

      try {
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

        const email =
          userData
            ?.user
            ?.email;

        if (!email) {
          throw new Error(
            "The signed-in email could not be found."
          );
        }

        const {
          error: signInError
        } =
          await supabaseClient
            .auth
            .signInWithPassword({
              email,
              password:
                currentPassword
            });

        if (signInError) {
          throw new Error(
            "The current password is incorrect."
          );
        }

        const {
          error: updateError
        } =
          await supabaseClient
            .auth
            .updateUser({
              password:
                newPassword
            });

        if (updateError) {
          throw updateError;
        }

        event.target.reset();

        setPasswordStatus(
          "Password changed successfully."
        );
      } catch (error) {
        console.error(
          "PASSWORD CHANGE ERROR:",
          error
        );

        setPasswordStatus(
          error.message ||
          "The password could not be changed.",
          true
        );
      }
    }
  );

/* =========================================================
   PROFILE TROPHIES
========================================================= */

function dateKey(
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("-");
}


function calculateStreaks(
  timestamps
) {
  const activityDays =
    [
      ...new Set(
        timestamps
          .map(dateKey)
          .filter(Boolean)
      )
    ]
      .sort();


  if (!activityDays.length) {
    return {
      current:
        0,

      best:
        0
    };
  }


  let best =
    1;

  let running =
    1;


  for (
    let index = 1;
    index < activityDays.length;
    index += 1
  ) {
    const previous =
      new Date(
        `${activityDays[index - 1]}T12:00:00`
      );

    const current =
      new Date(
        `${activityDays[index]}T12:00:00`
      );

    const differenceDays =
      Math.round(
        (
          current -
          previous
        ) /
        86400000
      );


    if (differenceDays === 1) {
      running += 1;
    } else {
      running = 1;
    }


    best =
      Math.max(
        best,
        running
      );
  }


  const today =
    new Date();

  const todayKey =
    dateKey(today);


  const yesterday =
    new Date(today);

  yesterday.setDate(
    yesterday.getDate() - 1
  );


  const yesterdayKey =
    dateKey(yesterday);


  const latestDay =
    activityDays[
      activityDays.length - 1
    ];


  let current =
    0;


  if (
    latestDay === todayKey ||
    latestDay === yesterdayKey
  ) {
    current =
      1;


    for (
      let index =
        activityDays.length - 1;

      index > 0;

      index -= 1
    ) {
      const later =
        new Date(
          `${activityDays[index]}T12:00:00`
        );

      const earlier =
        new Date(
          `${activityDays[index - 1]}T12:00:00`
        );

      const differenceDays =
        Math.round(
          (
            later -
            earlier
          ) /
          86400000
        );


      if (differenceDays !== 1) {
        break;
      }


      current += 1;
    }
  }


  return {
    current,
    best
  };
}
function setTrophiesStatus(
  message = "",
  isError = false
) {
  const status =
    el(
      "profileTrophiesStatus"
    );

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.hidden =
    !message;

  status.classList.toggle(
    "error",
    isError
  );
}


function setTrophyValue(
  id,
  value
) {
  const element =
    el(id);

  if (element) {
    element.textContent =
      String(
        Number(value || 0)
      );
  }
}
async function loadProfileTrophies() {
  const trophiesGrid =
    el(
      "profileTrophiesGrid"
    );


  setTrophiesStatus(
    "Loading trophies…"
  );


  try {
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


    const user =
      userData?.user;


    if (!user) {
      throw new Error(
        "Please sign in to view your trophies."
      );
    }


    const {
      data: attempts,
      error: attemptsError
    } =
      await supabaseClient
        .from(
          "quiz_attempts"
        )
        .select(`
          id,
          module_id,
          status,
          score,
          updated_at,
          completed_at
        `)
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "status",
          "completed"
        )
        .order(
          "updated_at",
          {
            ascending:
              true
          }
        );


    if (attemptsError) {
      throw attemptsError;
    }


    const completedAttempts =
      attempts ||
      [];


    const completedModuleIds =
      new Set(
        completedAttempts
          .map(
            (attempt) =>
              attempt.module_id
          )
          .filter(Boolean)
      );


    setTrophyValue(
      "trophyModulesCompleted",
      completedModuleIds.size
    );


    setTrophyValue(
      "trophyCompletedAttempts",
      completedAttempts.length
    );
        const {
      data: leaderboardRow,
      error: leaderboardError
    } =
      await supabaseClient
        .from(
          "module_challenge_leaderboard"
        )
        .select(`
          challenge_wins
        `)
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


    if (
      leaderboardError &&
      leaderboardError.code !==
        "PGRST116"
    ) {
      console.warn(
        "CHALLENGE TROPHY ERROR:",
        leaderboardError
      );
    }


    setTrophyValue(
      "trophyChallengeWins",
      leaderboardRow
        ?.challenge_wins ||
      0
    );
        const activityTimestamps =
      completedAttempts
        .map(
          (attempt) =>
            attempt.completed_at ||
            attempt.updated_at
        )
        .filter(Boolean);


    const streaks =
      calculateStreaks(
        activityTimestamps
      );


    setTrophyValue(
      "trophyCurrentStreak",
      streaks.current
    );


    setTrophyValue(
      "trophyBestStreak",
      streaks.best
    );
        let perfectScores =
      0;


    for (
      const attempt of
      completedAttempts
    ) {
      const score =
        Number(
          attempt.score ||
          0
        );


      if (score > 0) {
        perfectScores +=
          0;
      }
    }


    setTrophyValue(
      "trophyPerfectScores",
      perfectScores
    );
        if (trophiesGrid) {
      trophiesGrid.hidden =
        false;
    }


    setTrophiesStatus(
      ""
    );
  } catch (error) {
    console.error(
      "PROFILE TROPHIES ERROR:",
      error
    );


    if (trophiesGrid) {
      trophiesGrid.hidden =
        true;
    }


    setTrophiesStatus(
      error.message ||
      "Trophies could not be loaded.",
      true
    );
  }
}


el("refreshProfileTrophies")
  ?.addEventListener(
    "click",
    loadProfileTrophies
  );

/* =========================================================
   START
========================================================= */

loadProfilePage();

loadProfileTrophies();
