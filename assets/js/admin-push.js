import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL ADMIN PUSH v1.0.0 LOADED"
);


/* =========================================================
   STATE
========================================================= */

const selectedEdition =
  resolveAclEdition();


const byId =
  (id) =>
    document.getElementById(
      id
    );


const state = {
  profile: null,
  isSending: false
};


/* =========================================================
   ELEMENTS
========================================================= */

const form =
  byId(
    "adminPushForm"
  );


const audienceSelect =
  byId(
    "pushAudience"
  );


const typeSelect =
  byId(
    "pushType"
  );


const selectedUsersField =
  byId(
    "selectedUsersField"
  );


const userIdsInput =
  byId(
    "pushUserIds"
  );


const titleInput =
  byId(
    "pushTitle"
  );


const bodyInput =
  byId(
    "pushBody"
  );


const urlInput =
  byId(
    "pushUrl"
  );


const tagInput =
  byId(
    "pushTag"
  );


const requireInteractionInput =
  byId(
    "pushRequireInteraction"
  );


const sendButton =
  byId(
    "sendPushButton"
  );


const resetButton =
  byId(
    "resetPushForm"
  );


/* =========================================================
   HELPERS
========================================================= */

function titleCase(
  value = ""
) {
  return String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function isAdminProfile(
  profile
) {
  const role =
    String(
      profile?.role ||
      ""
    )
      .trim()
      .toLowerCase();


  return Boolean(
    profile?.is_admin ||
    role === "admin" ||
    role === "administrator"
  );
}


function setStatus(
  message = "",
  type = ""
) {
  const box =
    byId(
      "adminPushStatus"
    );


  if (!box) {
    return;
  }


  box.textContent =
    message;


  box.className =
    `admin-push-status ${type}`.trim();


  box.hidden =
    !message;
}


function setSending(
  sending
) {
  state.isSending =
    sending;


  if (sendButton) {
    sendButton.disabled =
      sending;


    sendButton.textContent =
      sending
        ? "Sending…"
        : "Send Push Notification";
  }


  if (resetButton) {
    resetButton.disabled =
      sending;
  }
}


function normalizeInternalUrl(
  value
) {
  const fallback =
    "/Cardiology/notifications.html";


  const supplied =
    String(
      value ||
      fallback
    ).trim();


  try {
    const parsed =
      new URL(
        supplied,
        window.location.origin
      );


    if (
      parsed.origin !==
      window.location.origin
    ) {
      throw new Error(
        "The destination must be an ACL page."
      );
    }


    if (
      !parsed.pathname.startsWith(
        "/Cardiology/"
      ) &&
      parsed.pathname !==
        "/Cardiology/"
    ) {
      throw new Error(
        "The destination path must begin with /Cardiology/."
      );
    }


    return (
      `${parsed.pathname}` +
      `${parsed.search}` +
      `${parsed.hash}`
    );
  } catch (error) {
    throw new Error(
      error.message ||
      "Enter a valid internal ACL URL."
    );
  }
}


function parseUserIds(
  value
) {
  return [
    ...new Set(
      String(
        value ||
        ""
      )
        .split(
          /[\s,;]+/
        )
        .map(
          (item) =>
            item.trim()
        )
        .filter(
          Boolean
        )
    )
  ];
}


function validUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      value
    );
}


function audienceLabel(
  value
) {
  const labels = {
    all:
      "All registered devices",

    basic:
      "Basic Edition devices",

    expert:
      "Expert Edition devices",

    selected:
      "Selected users"
  };


  return (
    labels[
      value
    ] ||
    labels.all
  );
}


/* =========================================================
   EDITION
========================================================= */

function applyEditionContext() {
  const isBasic =
    selectedEdition ===
    "basic";


  const badge =
    byId(
      "adminPushEditionBadge"
    );


  const themeColor =
    byId(
      "adminPushThemeColor"
    );


  if (badge) {
    badge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const dashboardLink =
    byId(
      "adminPushDashboardLink"
    );


  const notificationsLink =
    byId(
      "adminPushNotificationsLink"
    );


  if (dashboardLink) {
    dashboardLink.href =
      aclUrl(
        "admin.html",
        selectedEdition
      );
  }


  if (notificationsLink) {
    notificationsLink.href =
      aclUrl(
        "notifications.html",
        selectedEdition
      );
  }


  document.title =
    `Send Push Notification | ACL ${
      isBasic
        ? "Basic Edition"
        : "Expert Edition"
    } Admin`;


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
   PREVIEW
========================================================= */

function updatePreview() {
  const title =
    titleInput?.value.trim() ||
    "Alexandria Cardiology League";


  const body =
    bodyInput?.value.trim() ||
    "Your notification message will appear here.";


  const audience =
    audienceSelect?.value ||
    "all";


  const notificationType =
    typeSelect?.value ||
    "announcement";


  const url =
    urlInput?.value.trim() ||
    "/Cardiology/notifications.html";


  const previewTitle =
    byId(
      "pushPreviewTitle"
    );


  const previewBody =
    byId(
      "pushPreviewBody"
    );


  const previewAudience =
    byId(
      "pushPreviewAudience"
    );


  const previewType =
    byId(
      "pushPreviewType"
    );


  const previewUrl =
    byId(
      "pushPreviewUrl"
    );


  const bodyCounter =
    byId(
      "pushBodyCounter"
    );


  if (previewTitle) {
    previewTitle.textContent =
      title;
  }


  if (previewBody) {
    previewBody.textContent =
      body;
  }


  if (previewAudience) {
    previewAudience.textContent =
      audienceLabel(
        audience
      );
  }


  if (previewType) {
    previewType.textContent =
      titleCase(
        notificationType
      );
  }


  if (previewUrl) {
    previewUrl.textContent =
      url;
  }


  if (bodyCounter) {
    bodyCounter.textContent =
      `${
        bodyInput?.value.length ||
        0
      } / 500`;
  }


  if (selectedUsersField) {
    selectedUsersField.hidden =
      audience !==
      "selected";
  }
}


/* =========================================================
   PAYLOAD
========================================================= */

function buildPayload() {
  const audience =
    audienceSelect.value;


  const title =
    titleInput.value.trim();


  const body =
    bodyInput.value.trim();


  const notificationType =
    typeSelect.value;


  const url =
    normalizeInternalUrl(
      urlInput.value
    );


  const tag =
    tagInput.value.trim();


  const userIds =
    audience === "selected"
      ? parseUserIds(
          userIdsInput.value
        )
      : [];


  if (!title) {
    throw new Error(
      "Notification title is required."
    );
  }


  if (!body) {
    throw new Error(
      "Notification message is required."
    );
  }


  if (
    body.length >
    500
  ) {
    throw new Error(
      "Notification message cannot exceed 500 characters."
    );
  }


  if (
    audience === "selected" &&
    !userIds.length
  ) {
    throw new Error(
      "Enter at least one user ID."
    );
  }


  const invalidUserIds =
    userIds.filter(
      (id) =>
        !validUuid(
          id
        )
    );


  if (
    invalidUserIds.length
  ) {
    throw new Error(
      `Invalid user ID: ${
        invalidUserIds[
          0
        ]
      }`
    );
  }


  return {
    title,

    body,

    url,

    type:
      notificationType,

    edition:
      audience === "basic" ||
      audience === "expert"
        ? audience
        : null,

    user_ids:
      audience === "selected"
        ? userIds
        : [],

    tag:
      tag ||
      `acl-${notificationType}-${Date.now()}`,

    requireInteraction:
      requireInteractionInput.checked,

    icon:
      "/Cardiology/assets/images/acl-icon-192.png",

    badge:
      "/Cardiology/assets/images/acl-icon-192.png",

    data: {
      source:
        "acl-admin-push",

      sent_at:
        new Date()
          .toISOString(),

      audience
    }
  };
}


/* =========================================================
   FUNCTION ERROR
========================================================= */

async function extractFunctionError(
  error
) {
  if (!error) {
    return "The push notification could not be sent.";
  }


  try {
    if (
      error.context &&
      typeof error.context.json ===
        "function"
    ) {
      const response =
        await error.context.json();


      return (
        response?.message ||
        response?.error ||
        error.message
      );
    }
  } catch (contextError) {
    console.warn(
      "PUSH ERROR CONTEXT READ FAILED:",
      contextError
    );
  }


  return (
    error.message ||
    "The push notification could not be sent."
  );
}


/* =========================================================
   RESULTS
========================================================= */

function renderResult(
  result
) {
  const box =
    byId(
      "pushSendResult"
    );


  if (!box) {
    return;
  }


  byId(
    "pushResultTotal"
  ).textContent =
    String(
      Number(
        result?.total ||
        0
      )
    );


  byId(
    "pushResultSent"
  ).textContent =
    String(
      Number(
        result?.sent ||
        0
      )
    );


  byId(
    "pushResultFailed"
  ).textContent =
    String(
      Number(
        result?.failed ||
        0
      )
    );


  box.hidden =
    false;
}


/* =========================================================
   SEND
========================================================= */

async function sendPushNotification() {
  if (state.isSending) {
    return;
  }


  const payload =
    buildPayload();


  const audience =
    audienceLabel(
      audienceSelect.value
    );


  const confirmed =
    window.confirm(
      `Send this notification to ${audience}?`
    );


  if (!confirmed) {
    return;
  }


  setSending(
    true
  );


  setStatus(
    "Sending push notification…"
  );


  const resultBox =
    byId(
      "pushSendResult"
    );


  if (resultBox) {
    resultBox.hidden =
      true;
  }


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .functions
        .invoke(
          "send-push",
          {
            body:
              payload
          }
        );


    if (error) {
      throw error;
    }


    renderResult(
      data
    );


    const sent =
      Number(
        data?.sent ||
        0
      );


    const failed =
      Number(
        data?.failed ||
        0
      );


    const total =
      Number(
        data?.total ||
        0
      );


    if (
      total ===
      0
    ) {
      setStatus(
        "No active push subscriptions matched this audience.",
        "warning"
      );


      return;
    }


    if (
      failed >
      0
    ) {
      setStatus(
        `Push delivery completed: ${sent} sent and ${failed} failed.`,
        "warning"
      );


      return;
    }


    setStatus(
      `Push notification sent successfully to ${sent} registered device${
        sent === 1
          ? ""
          : "s"
      }.`,
      "success"
    );
  } catch (error) {
    console.error(
      "ADMIN PUSH SEND ERROR:",
      error
    );


    setStatus(
      await extractFunctionError(
        error
      ),
      "error"
    );
  } finally {
    setSending(
      false
    );
  }
}


/* =========================================================
   RESET
========================================================= */

function resetForm() {
  form.reset();


  titleInput.value =
    "Alexandria Cardiology League";


  bodyInput.value =
    "";


  urlInput.value =
    "/Cardiology/notifications.html";


  audienceSelect.value =
    "all";


  typeSelect.value =
    "announcement";


  setStatus(
    ""
  );


  const resultBox =
    byId(
      "pushSendResult"
    );


  if (resultBox) {
    resultBox.hidden =
      true;
  }


  updatePreview();
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  form?.addEventListener(
    "submit",
    async (
      event
    ) => {
      event.preventDefault();


      try {
        await sendPushNotification();
      } catch (error) {
        console.error(
          "ADMIN PUSH VALIDATION ERROR:",
          error
        );


        setStatus(
          error.message ||
          "Check the notification details.",
          "error"
        );
      }
    }
  );


  resetButton
    ?.addEventListener(
      "click",
      resetForm
    );


  [
    audienceSelect,
    typeSelect,
    titleInput,
    bodyInput,
    urlInput,
    tagInput,
    requireInteractionInput
  ].forEach(
    (element) => {
      element?.addEventListener(
        "input",
        updatePreview
      );


      element?.addEventListener(
        "change",
        updatePreview
      );
    }
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAdminPush() {
  try {
    applyEditionContext();


    const profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
    }


    if (
      !isAdminProfile(
        profile
      )
    ) {
      window.location.replace(
        aclUrl(
          "modules.html",
          selectedEdition
        )
      );


      return;
    }


    state.profile =
      profile;


    bindEvents();
    updatePreview();


    setStatus(
      "Push sender ready.",
      "success"
    );
  } catch (error) {
    console.error(
      "ADMIN PUSH INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The push notification sender could not be initialized.",
      "error"
    );
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAdminPush,
    {
      once:
        true
    }
  );
} else {
  void initializeAdminPush();
}
