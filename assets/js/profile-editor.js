import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl,
  renderUserChip
} from "./session-ui.js?v=4.8.0";


console.log(
  "ACL PROFILE EDITOR v1.4.0 LOADED"
);


/* =========================================================
   PAGE STATE
========================================================= */

const profileEditorState = {
  profile: null,
  savingProfile: false,
  changingPassword: false,
  loadingTrophies: false,
  avatarPreviewUrl: "",
  selectedEdition: null
};


/* =========================================================
   EDITION
========================================================= */

profileEditorState.selectedEdition =
  resolveAclEdition();


/* =========================================================
   ELEMENT HELPERS
========================================================= */

function byId(
  id
) {
  return document.getElementById(
    id
  );
}


function setButtonState(
  button,
  {
    disabled,
    text
  }
) {
  if (!button) {
    return;
  }


  button.disabled =
    Boolean(
      disabled
    );


  button.textContent =
    text;
}


/* =========================================================
   INPUT NORMALIZATION
========================================================= */

function normalizeEgyptWhatsapp(
  value
) {
  let raw =
    String(
      value ||
      ""
    )
      .trim()
      .replace(
        /[\s().-]/g,
        ""
      );


  if (
    raw.startsWith(
      "+20"
    )
  ) {
    raw =
      `0${raw.slice(3)}`;
  } else if (
    raw.startsWith(
      "0020"
    )
  ) {
    raw =
      `0${raw.slice(4)}`;
  } else if (
    raw.startsWith(
      "20"
    ) &&
    raw.length ===
      12
  ) {
    raw =
      `0${raw.slice(2)}`;
  }


  raw =
    raw.replace(
      /\D/g,
      ""
    );


  if (
    !/^01\d{9}$/.test(
      raw
    )
  ) {
    return null;
  }


  return `+20${raw.slice(1)}`;
}


/* =========================================================
   EDITION DISPLAY
========================================================= */

function renderProfileEdition() {
  const editionName =
    byId(
      "profileEditionName"
    );


  const editionBadge =
    byId(
      "profileEditionBadge"
    );


  const modulesLink =
    byId(
      "profileModulesLink"
    );


  const switchEditionLink =
    byId(
      "profileSwitchEdition"
    );


  const isBasic =
    profileEditorState
      .selectedEdition ===
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
        profileEditorState
          .selectedEdition
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

function setStatus(
  elementId,
  message = "",
  type = ""
) {
  const status =
    byId(
      elementId
    );


  if (!status) {
    return;
  }


  status.textContent =
    message;


  status.hidden =
    !message;


  status.classList.remove(
    "error",
    "success"
  );


  if (
    message &&
    (
      type ===
        "error" ||
      type ===
        "success"
    )
  ) {
    status.classList.add(
      type
    );
  }
}


function setProfileStatus(
  message = "",
  type = ""
) {
  setStatus(
    "profileStatus",
    message,
    type
  );
}


function setPasswordStatus(
  message = "",
  type = ""
) {
  setStatus(
    "passwordStatus",
    message,
    type
  );
}


function setTrophiesStatus(
  message = "",
  type = ""
) {
  setStatus(
    "profileTrophiesStatus",
    message,
    type
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
    String(
      name
    )
      .trim()
      .split(
        /\s+/
      )
      .slice(
        0,
        2
      )
      .map(
        (
          part
        ) =>
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


function revokeAvatarPreviewUrl() {
  if (
    !profileEditorState
      .avatarPreviewUrl
  ) {
    return;
  }


  URL.revokeObjectURL(
    profileEditorState
      .avatarPreviewUrl
  );


  profileEditorState
    .avatarPreviewUrl =
      "";
}


function showAvatarImage(
  source
) {
  const image =
    byId(
      "avatarPreview"
    );


  const placeholder =
    byId(
      "avatarPlaceholder"
    );


  if (
    !image ||
    !placeholder
  ) {
    return;
  }


  image.src =
    source;


  image.hidden =
    false;


  placeholder.hidden =
    true;


  image.onerror =
    () => {
      image.hidden =
        true;


      image.removeAttribute(
        "src"
      );


      placeholder.hidden =
        false;
    };
}


function renderAvatar(
  profile
) {
  const image =
    byId(
      "avatarPreview"
    );


  const placeholder =
    byId(
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


  const avatarUrl =
    String(
      profile?.avatar_url ||
      ""
    ).trim();


  if (avatarUrl) {
    showAvatarImage(
      avatarUrl
    );


    return;
  }


  image.hidden =
    true;


  image.removeAttribute(
    "src"
  );


  placeholder.hidden =
    false;
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
      "Profile photo must be PNG, JPEG, or WebP."
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


function previewSelectedAvatar() {
  const file =
    byId(
      "avatarFile"
    )
      ?.files?.[0];


  if (!file) {
    revokeAvatarPreviewUrl();


    renderAvatar(
      profileEditorState.profile
    );


    return;
  }


  try {
    validateAvatarFile(
      file
    );


    revokeAvatarPreviewUrl();


    profileEditorState
      .avatarPreviewUrl =
        URL.createObjectURL(
          file
        );


    showAvatarImage(
      profileEditorState
        .avatarPreviewUrl
    );


    setProfileStatus(
      ""
    );
  } catch (
    error
  ) {
    const input =
      byId(
        "avatarFile"
      );


    if (input) {
      input.value =
        "";
    }


    revokeAvatarPreviewUrl();


    renderAvatar(
      profileEditorState.profile
    );


    setProfileStatus(
      error.message ||
      "The selected profile photo is invalid.",
      "error"
    );
  }
}


async function uploadAvatar(
  userId
) {
  const file =
    byId(
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
            false,

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


  const publicUrl =
    data?.publicUrl ||
    "";


  if (!publicUrl) {
    throw new Error(
      "The profile photo was uploaded, but its public URL could not be created."
    );
  }


  return publicUrl;
}


/* =========================================================
   PROFILE FORM
========================================================= */

function populateProfileForm(
  profile
) {
  const displayName =
    byId(
      "displayName"
    );


  const email =
    byId(
      "email"
    );


  const username =
    byId(
      "username"
    );


  const whatsapp =
    byId(
      "whatsapp"
    );


  const institution =
    byId(
      "institution"
    );


  const positionInput =
    byId(
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


    profileEditorState.profile =
      profile;


    populateProfileForm(
      profile
    );


    setProfileStatus(
      ""
    );


    return profile;
  } catch (
    error
  ) {
    console.error(
      "ACL PROFILE LOAD ERROR:",
      error
    );


    setProfileStatus(
      error.message ||
      "The profile could not be loaded.",
      "error"
    );


    return null;
  }
}


/* =========================================================
   SAVE PROFILE
========================================================= */

async function saveProfile(
  event
) {
  event.preventDefault();


  if (
    profileEditorState
      .savingProfile
  ) {
    return;
  }


  const submitButton =
    event.submitter ||
    event.currentTarget
      ?.querySelector(
        'button[type="submit"]'
      );


  setProfileStatus(
    ""
  );


  const displayName =
    String(
      byId(
        "displayName"
      )?.value ||
      ""
    ).trim();


  const whatsapp =
    normalizeEgyptWhatsapp(
      byId(
        "whatsapp"
      )?.value
    );


  const position =
    String(
      byId(
        "academicYear"
      )?.value ||
      ""
    ).trim();


  const institution =
    String(
      byId(
        "institution"
      )?.value ||
      ""
    ).trim();


  if (
    displayName.length <
      2 ||
    displayName.length >
      60
  ) {
    setProfileStatus(
      "Display name must contain between 2 and 60 characters.",
      "error"
    );


    byId(
      "displayName"
    )
      ?.focus();


    return;
  }


  if (!whatsapp) {
    setProfileStatus(
      "Enter a valid Egyptian WhatsApp number, such as +201XXXXXXXXX.",
      "error"
    );


    byId(
      "whatsapp"
    )
      ?.focus();


    return;
  }


  if (!position) {
    setProfileStatus(
      "Please select your position.",
      "error"
    );


    byId(
      "academicYear"
    )
      ?.focus();


    return;
  }


  if (!institution) {
    setProfileStatus(
      "Please enter your institution.",
      "error"
    );


    byId(
      "institution"
    )
      ?.focus();


    return;
  }


  if (
    institution.length >
    150
  ) {
    setProfileStatus(
      "Institution must be 150 characters or fewer.",
      "error"
    );


    byId(
      "institution"
    )
      ?.focus();


    return;
  }


  profileEditorState.savingProfile =
    true;


  setButtonState(
    submitButton,
    {
      disabled:
        true,

      text:
        "Saving profile…"
    }
  );


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


    const avatarUrl =
      await uploadAvatar(
        user.id
      );


    const updates = {
      display_name:
        displayName,

      whatsapp,

      phone_e164:
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


    const {
      error: metadataError
    } =
      await supabaseClient
        .auth
        .updateUser({
          data: {
            display_name:
              displayName,

            full_name:
              displayName,

            whatsapp,

            phone_e164:
              whatsapp,

            position,

            institution,

            ...(avatarUrl
              ? {
                  avatar_url:
                    avatarUrl
                }
              : {})
          }
        });


    if (metadataError) {
      console.warn(
        "ACL PROFILE METADATA UPDATE ERROR:",
        metadataError
      );
    }


    const updatedProfile = {
      ...profileEditorState.profile,
      ...data,

      email:
        user.email ||
        profileEditorState
          .profile
          ?.email ||
        ""
    };


    profileEditorState.profile =
      updatedProfile;


    window.aclCurrentProfile =
      updatedProfile;


    revokeAvatarPreviewUrl();


    const avatarInput =
      byId(
        "avatarFile"
      );


    if (avatarInput) {
      avatarInput.value =
        "";
    }


    populateProfileForm(
      updatedProfile
    );


    renderUserChip(
      updatedProfile
    );


    setProfileStatus(
      "Profile saved successfully.",
      "success"
    );


    const updatedUrl =
      new URL(
        window.location.href
      );


    updatedUrl.searchParams.set(
      "edition",
      profileEditorState
        .selectedEdition
    );


    window.history.replaceState(
      {},
      "",
      updatedUrl
    );
  } catch (
    error
  ) {
    console.error(
      "ACL PROFILE SAVE ERROR:",
      error
    );


    setProfileStatus(
      error.message ||
      "The profile could not be saved.",
      "error"
    );
  } finally {
    profileEditorState.savingProfile =
      false;


    setButtonState(
      submitButton,
      {
        disabled:
          false,

        text:
          "Save profile"
      }
    );
  }
}


/* =========================================================
   CHANGE PASSWORD
========================================================= */

function friendlyPasswordError(
  error
) {
  const message =
    String(
      error?.message ||
      ""
    ).trim();


  if (
    /invalid login credentials/i.test(
      message
    )
  ) {
    return "The current password is incorrect.";
  }


  if (
    /same password|different from the old password/i.test(
      message
    )
  ) {
    return "The new password must be different from your current password.";
  }


  if (
    /weak password|password should be at least/i.test(
      message
    )
  ) {
    return "The new password does not meet the minimum security requirements.";
  }


  if (
    /failed to fetch|network|load failed/i.test(
      message
    )
  ) {
    return "The ACL server could not be reached. Check your internet connection and retry.";
  }


  return (
    message ||
    "The password could not be changed."
  );
}


async function changePassword(
  event
) {
  event.preventDefault();


  if (
    profileEditorState
      .changingPassword
  ) {
    return;
  }


  const submitButton =
    event.submitter ||
    event.currentTarget
      ?.querySelector(
        'button[type="submit"]'
      );


  setPasswordStatus(
    ""
  );


  const currentPassword =
    String(
      byId(
        "currentPassword"
      )?.value ||
      ""
    );


  const newPassword =
    String(
      byId(
        "profileNewPassword"
      )?.value ||
      ""
    );


  const confirmation =
    String(
      byId(
        "profileConfirmPassword"
      )?.value ||
      ""
    );


  if (!currentPassword) {
    setPasswordStatus(
      "Enter your current password.",
      "error"
    );


    byId(
      "currentPassword"
    )
      ?.focus();


    return;
  }


  if (
    newPassword.length <
    8
  ) {
    setPasswordStatus(
      "New password must contain at least 8 characters.",
      "error"
    );


    byId(
      "profileNewPassword"
    )
      ?.focus();


    return;
  }


  if (
    newPassword !==
    confirmation
  ) {
    setPasswordStatus(
      "The new passwords do not match.",
      "error"
    );


    byId(
      "profileConfirmPassword"
    )
      ?.focus();


    return;
  }


  if (
    currentPassword ===
    newPassword
  ) {
    setPasswordStatus(
      "The new password must be different from your current password.",
      "error"
    );


    byId(
      "profileNewPassword"
    )
      ?.focus();


    return;
  }


  profileEditorState
    .changingPassword =
      true;


  setButtonState(
    submitButton,
    {
      disabled:
        true,

      text:
        "Changing password…"
    }
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
      throw signInError;
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


    event.currentTarget
      .reset();


    setPasswordStatus(
      "Password changed successfully.",
      "success"
    );
  } catch (
    error
  ) {
    console.error(
      "ACL PASSWORD CHANGE ERROR:",
      error
    );


    setPasswordStatus(
      friendlyPasswordError(
        error
      ),
      "error"
    );
  } finally {
    profileEditorState
      .changingPassword =
        false;


    setButtonState(
      submitButton,
      {
        disabled:
          false,

        text:
          "Change password"
      }
    );
  }
}


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


  const yesterday =
    new Date(
      today
    );


  yesterday.setDate(
    yesterday.getDate() -
    1
  );


  const todayKey =
    dateKey(
      today
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


function setTrophyValue(
  id,
  value
) {
  const element =
    byId(
      id
    );


  if (!element) {
    return;
  }


  const number =
    Number(
      value ||
      0
    );


  element.textContent =
    String(
      Number.isFinite(
        number
      )
        ? number
        : 0
    );
}


/* =========================================================
   LOAD TROPHIES
========================================================= */

async function loadProfileTrophies() {
  if (
    profileEditorState
      .loadingTrophies
  ) {
    return;
  }


  const trophiesGrid =
    byId(
      "profileTrophiesGrid"
    );


  const refreshButton =
    byId(
      "refreshProfileTrophies"
    );


  profileEditorState
    .loadingTrophies =
      true;


  setButtonState(
    refreshButton,
    {
      disabled:
        true,

      text:
        "Refreshing…"
    }
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
      Array.isArray(
        attempts
      )
        ? attempts
        : [];


    const completedModuleIds =
      new Set(
        completedAttempts
          .map(
            (
              attempt
            ) =>
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
      data: leaderboardRows,
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
        .limit(
          1
        );


    if (leaderboardError) {
      console.warn(
        "ACL CHALLENGE TROPHY ERROR:",
        leaderboardError
      );
    }


    const leaderboardRow =
      Array.isArray(
        leaderboardRows
      )
        ? leaderboardRows[0]
        : null;


    setTrophyValue(
      "trophyChallengeWins",
      leaderboardRow
        ?.challenge_wins ||
      0
    );


    const activityTimestamps =
      completedAttempts
        .map(
          (
            attempt
          ) =>
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
        (
          attempt
        ) => {
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
  } catch (
    error
  ) {
    console.error(
      "ACL PROFILE TROPHIES ERROR:",
      error
    );


    if (trophiesGrid) {
      trophiesGrid.hidden =
        true;
    }


    setTrophiesStatus(
      error.message ||
      "Trophies could not be loaded.",
      "error"
    );
  } finally {
    profileEditorState
      .loadingTrophies =
        false;


    setButtonState(
      refreshButton,
      {
        disabled:
          false,

        text:
          "Refresh"
      }
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

byId(
  "avatarFile"
)
  ?.addEventListener(
    "change",
    previewSelectedAvatar
  );


byId(
  "profileForm"
)
  ?.addEventListener(
    "submit",
    saveProfile
  );


byId(
  "passwordForm"
)
  ?.addEventListener(
    "submit",
    changePassword
  );


byId(
  "refreshProfileTrophies"
)
  ?.addEventListener(
    "click",
    () => {
      void loadProfileTrophies();
    }
  );


window.addEventListener(
  "beforeunload",
  revokeAvatarPreviewUrl
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


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void startProfilePage();
    },
    {
      once:
        true
    }
  );
} else {
  void startProfilePage();
}
