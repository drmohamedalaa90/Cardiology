import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl,
  renderUserChip
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL PROFILE EDITOR v1.3.0 LOADED"
);


/* =========================================================
   EDITION
========================================================= */

const selectedEdition =
  resolveAclEdition();


/* =========================================================
   ELEMENT HELPERS
========================================================= */

const el =
  (id) =>
    document.getElementById(
      id
    );


/* =========================================================
   EDITION DISPLAY
========================================================= */

function renderProfileEdition() {
  const editionName =
    el(
      "profileEditionName"
    );


  const editionBadge =
    el(
      "profileEditionBadge"
    );


  const modulesLink =
    el(
      "profileModulesLink"
    );


  const switchEditionLink =
    el(
      "profileSwitchEdition"
    );


  const isBasic =
    selectedEdition ===
    "basic";


  const fullEditionName =
    isBasic
      ? "Basic Edition"
      : "Expert Edition";


  const badgeText =
    isBasic
      ? "BASIC EDITION"
      : "EXPERT EDITION";


  if (editionName) {
    editionName.textContent =
      fullEditionName;
  }


  if (editionBadge) {
    editionBadge.textContent =
      badgeText;
  }


  if (modulesLink) {
    modulesLink.href =
      aclUrl(
        "modules.html",
        selectedEdition
      );
  }


  if (switchEditionLink) {
    switchEditionLink.href =
      "pathways.html";
  }


  document.title =
    `${fullEditionName} Profile | ACL`;
}


/* =========================================================
   STATUS MESSAGES
========================================================= */

function setProfileStatus(
  message = "",
  isError = false
) {
  const status =
    el(
      "profileStatus"
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


  status.classList.toggle(
    "success",
    Boolean(
      message
    ) &&
    !isError
  );
}


function setPasswordStatus(
  message = "",
  isError = false
) {
  const status =
    el(
      "passwordStatus"
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


  status.classList.toggle(
    "success",
    Boolean(
      message
    ) &&
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
      .split(
        /\s+/
      )
      .slice(
        0,
        2
      )
      .map(
        (part) =>
          part.charAt(
            0
          )
      )
      .join(
        ""
      )
      .toUpperCase() ||
    "ACL"
  );
}


function renderAvatar(
  profile
) {
  const image =
    el(
      "avatarPreview"
    );


  const placeholder =
    el(
      "avatarPlaceholder"
    );


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


  if (
    profile?.avatar_url
  ) {
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
    image.removeAttribute(
      "src"
    );


    image.style.display =
      "none";


    placeholder.style.display =
      "grid";
  }
}


function validateAvatarFile(
  file
) {
  if (!file) {
    return;
  }


  const allowedTypes =
    new Set([
      "image/png",
      "image/jpeg",
      "image/webp"
    ]);


  if (
    !allowedTypes.has(
      file.type
    )
  ) {
    throw new Error(
      "Profile photo must be PNG, JPEG or WebP."
    );
  }


  const maximumSize =
    5 *
    1024 *
    1024;


  if (
    file.size >
    maximumSize
  ) {
    throw new Error(
      "Profile photo must be smaller than 5 MB."
    );
  }
}


async function uploadAvatar(
  userId
) {
  const file =
    el(
      "avatarFile"
    )
      ?.files?.[0];


  if (!file) {
    return null;
  }


  validateAvatarFile(
    file
  );


  const extensionMap = {
    "image/png":
      "png",

    "image/jpeg":
      "jpg",

    "image/webp":
      "webp"
  };


  const extension =
    extensionMap[
      file.type
    ] ||
    "webp";


  const filePath =
    `${userId}/avatar-${Date.now()}.${extension}`;


  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from(
        "avatars"
      )
      .upload(
        filePath,
        file,
        {
          upsert:
            true,

          contentType:
            file.type,

          cacheControl:
            "3600"
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
      .from(
        "avatars"
      )
      .getPublicUrl(
        filePath
      );


  return (
    data?.publicUrl ||
    null
  );
}


/* =========================================================
   FILL PROFILE FORM
========================================================= */

function populateProfileForm(
  profile
) {
  const displayName =
    el(
      "displayName"
    );


  const email =
    el(
      "email"
    );


  const username =
    el(
      "username"
    );


  const whatsapp =
    el(
      "whatsapp"
    );


  const institution =
    el(
      "institution"
    );


  const positionInput =
    el(
      "academicYear"
    );


  if (displayName) {
    displayName.value =
      profile.display_name ||
      profile.full_name ||
      profile.username ||
      "";
  }


  if (email) {
    email.value =
      profile.email ||
      "";
  }


  if (username) {
    username.value =
      profile.username ||
      "";
  }


  if (whatsapp) {
    whatsapp.value =
      profile.whatsapp ||
      profile.phone_e164 ||
      "";
  }


  if (institution) {
    institution.value =
      profile.institution ||
      "";
  }


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
      return null;
    }


    populateProfileForm(
      profile
    );


    setProfileStatus(
      ""
    );


    return profile;
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


    return null;
  }
}


/* =========================================================
   SAVE PROFILE
========================================================= */

el(
  "profileForm"
)
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      const submitButton =
        event.submitter;


      setProfileStatus(
        "Saving profile…"
      );


      if (submitButton) {
        submitButton.disabled =
          true;


        submitButton.textContent =
          "Saving…";
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


        const user =
          userData?.user;


        if (!user) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }


        const displayName =
          el(
            "displayName"
          )
            ?.value
            ?.trim() ||
          "";


        const whatsapp =
          el(
            "whatsapp"
          )
            ?.value
            ?.trim() ||
          "";


        const position =
          el(
            "academicYear"
          )
            ?.value ||
          "";


        const institution =
          el(
            "institution"
          )
            ?.value
            ?.trim() ||
          "";


        if (
          displayName.length <
          2
        ) {
          throw new Error(
            "Display name must contain at least 2 characters."
          );
        }


        if (!whatsapp) {
          throw new Error(
            "Please enter your WhatsApp number."
          );
        }


        if (!position) {
          throw new Error(
            "Please select your position."
          );
        }


        if (!institution) {
          throw new Error(
            "Please enter your institution."
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
            .from(
              "profiles"
            )
            .update(
              updates
            )
            .eq(
              "id",
              user.id
            )
            .select(
              "*"
            )
            .single();


        if (error) {
          throw error;
        }


        const updatedProfile = {
          ...window.aclCurrentProfile,
          ...data,

          email:
            user.email
        };


        window.aclCurrentProfile =
          updatedProfile;


        populateProfileForm(
          updatedProfile
        );


        renderUserChip(
          updatedProfile
        );


        setProfileStatus(
          "Profile saved successfully."
        );


        /*
         * Preserve the active edition in the URL.
         */

        const updatedUrl =
          new URL(
            window.location.href
          );


        updatedUrl.searchParams.set(
          "edition",
          selectedEdition
        );


        window.history.replaceState(
          {},
          "",
          updatedUrl
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
      } finally {
        if (submitButton) {
          submitButton.disabled =
            false;


          submitButton.textContent =
            "Save profile";
        }
      }
    }
  );


/* =========================================================
   CHANGE PASSWORD
========================================================= */

el(
  "passwordForm"
)
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      const submitButton =
        event.submitter;


      setPasswordStatus(
        ""
      );


      const currentPassword =
        el(
          "currentPassword"
        )
          ?.value ||
        "";


      const newPassword =
        el(
          "profileNewPassword"
        )
          ?.value ||
        "";


      const confirmation =
        el(
          "profileConfirmPassword"
        )
          ?.value ||
        "";


      if (!currentPassword) {
        setPasswordStatus(
          "Enter your current password.",
          true
        );


        return;
      }


      if (
        newPassword.length <
        8
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


      if (
        currentPassword ===
        newPassword
      ) {
        setPasswordStatus(
          "The new password must be different from your current password.",
          true
        );


        return;
      }


      if (submitButton) {
        submitButton.disabled =
          true;


        submitButton.textContent =
          "Changing password…";
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
      } finally {
        if (submitButton) {
          submitButton.disabled =
            false;


          submitButton.textContent =
            "Change password";
        }
      }
    }
  );


/* =========================================================
   TROPHY HELPERS
========================================================= */

function dateKey(
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
    return "";
  }


  return [
    date.getFullYear(),

    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join(
    "-"
  );
}


function calculateStreaks(
  timestamps
) {
  const activityDays =
    [
      ...new Set(
        timestamps
          .map(
            dateKey
          )
          .filter(
            Boolean
          )
      )
    ].sort();


  if (
    !activityDays.length
  ) {
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
    let index =
      1;

    index <
    activityDays.length;

    index +=
      1
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


    if (
      differenceDays ===
      1
    ) {
      running +=
        1;
    } else {
      running =
        1;
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
    dateKey(
      today
    );


  const yesterday =
    new Date(
      today
    );


  yesterday.setDate(
    yesterday.getDate() -
    1
  );


  const yesterdayKey =
    dateKey(
      yesterday
    );


  const latestDay =
    activityDays[
      activityDays.length -
      1
    ];


  let current =
    0;


  if (
    latestDay ===
      todayKey ||
    latestDay ===
      yesterdayKey
  ) {
    current =
      1;


    for (
      let index =
        activityDays.length -
        1;

      index >
        0;

      index -=
        1
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


      if (
        differenceDays !==
        1
      ) {
        break;
      }


      current +=
        1;
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
    el(
      id
    );


  if (element) {
    element.textContent =
      String(
        Number(
          value ||
          0
        )
      );
  }
}


/* =========================================================
   LOAD TROPHIES
========================================================= */

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
          question_count,
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
          .filter(
            Boolean
          )
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
        .select(
          "challenge_wins"
        )
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
        .filter(
          Boolean
        );


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


    const perfectScores =
      completedAttempts.filter(
        (attempt) => {
          const score =
            Number(
              attempt.score ||
              0
            );


          const questionCount =
            Number(
              attempt.question_count ||
              0
            );


          return (
            questionCount >
              0 &&
            score >=
              questionCount
          );
        }
      ).length;


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


/* =========================================================
   TROPHY EVENTS
========================================================= */

el(
  "refreshProfileTrophies"
)
  ?.addEventListener(
    "click",
    async () => {
      await loadProfileTrophies();
    }
  );


/* =========================================================
   START
========================================================= */

async function startProfilePage() {
  renderProfileEdition();


  const profile =
    await loadProfilePage();


  if (!profile) {
    return;
  }


  await loadProfileTrophies();
}


void startProfilePage();
