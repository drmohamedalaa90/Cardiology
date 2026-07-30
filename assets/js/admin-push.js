import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.7.0";


console.log(
  "ACL ADMIN PUSH v1.1.0 LOADED"
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
  isSending: false,
  lastResult: null
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

function escapeHtml(
  value = ""
) {
  return String(
    value ??
    ""
  ).replace(
    /[&<>'"]/g,
    (
      character
    ) =>
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
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function pluralize(
  value,
  singular,
  plural = `${singular}s`
) {
  return Number(
    value
  ) ===
    1
    ? singular
    : plural;
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
    role ===
      "admin" ||
    role ===
      "administrator"
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
    Boolean(
      sending
    );


  if (sendButton) {
    sendButton.disabled =
      state.isSending;


    sendButton.setAttribute(
      "aria-busy",
      state.isSending
        ? "true"
        : "false"
    );


    sendButton.textContent =
      state.isSending
        ? "Sending…"
        : "Send Push Notification";
  }


  if (resetButton) {
    resetButton.disabled =
      state.isSending;
  }


  [
    audienceSelect,
    typeSelect,
    userIdsInput,
    titleInput,
    bodyInput,
    urlInput,
    tagInput,
    requireInteractionInput
  ].forEach(
    (
      element
    ) => {
      if (element) {
        element.disabled =
          state.isSending;
      }
    }
  );
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


    const allowedHosts =
      new Set([
        window.location.hostname,
        "drmohamedalaa90.github.io",
        "acl.drmohamedalaa.org"
      ]);


    if (
      !allowedHosts.has(
        parsed.hostname
      )
    ) {
      throw new Error(
        "The destination must be an ACL page."
      );
    }


    if (
      parsed.hostname ===
        "drmohamedalaa90.github.io" &&
      !parsed.pathname.startsWith(
        "/Cardiology/"
      )
    ) {
      throw new Error(
        "The GitHub Pages destination must begin with /Cardiology/."
      );
    }


    if (
      parsed.hostname ===
        window.location.hostname &&
      window.location.pathname.startsWith(
        "/Cardiology/"
      ) &&
      !parsed.pathname.startsWith(
        "/Cardiology/"
      )
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
  } catch (
    error
  ) {
    throw new Error(
      error?.message ||
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
          (
            item
          ) =>
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
      "all active registered devices",

    basic:
      "all active Basic Edition devices",

    expert:
      "all active Expert Edition devices",

    selected:
      "the selected users' active devices"
  };


  return (
    labels[
      value
    ] ||
    labels.all
  );
}


function selectedUserCount() {
  if (
    audienceSelect?.value !==
      "selected"
  ) {
    return 0;
  }


  return parseUserIds(
    userIdsInput?.value
  ).length;
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
  if (
    !audienceSelect ||
    !titleInput ||
    !bodyInput ||
    !typeSelect ||
    !urlInput ||
    !tagInput ||
    !requireInteractionInput
  ) {
    throw new Error(
      "The push notification form is incomplete."
    );
  }


  const audience =
    audienceSelect.value;


  const allowedAudiences =
    new Set([
      "all",
      "basic",
      "expert",
      "selected"
    ]);


  if (
    !allowedAudiences.has(
      audience
    )
  ) {
    throw new Error(
      "Choose a valid notification audience."
    );
  }


  const title =
    titleInput.value
      .trim();


  const body =
    bodyInput.value
      .trim();


  const notificationType =
    typeSelect.value;


  const url =
    normalizeInternalUrl(
      urlInput.value
    );


  const tag =
    tagInput.value
      .trim();


  const userIds =
    audience ===
      "selected"
      ? parseUserIds(
          userIdsInput?.value
        )
      : [];


  if (!title) {
    throw new Error(
      "Notification title is required."
    );
  }


  if (
    title.length >
    120
  ) {
    throw new Error(
      "Notification title cannot exceed 120 characters."
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
    audience ===
      "selected" &&
    !userIds.length
  ) {
    throw new Error(
      "Enter at least one user ID."
    );
  }


  if (
    userIds.length >
    1000
  ) {
    throw new Error(
      "A maximum of 1,000 selected users can be included in one send."
    );
  }


  const invalidUserIds =
    userIds.filter(
      (
        id
      ) =>
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
      audience ===
        "basic" ||
      audience ===
        "expert"
        ? audience
        : null,

    user_ids:
      audience ===
        "selected"
        ? userIds
        : [],

    tag:
      tag ||
      `acl-${notificationType}-${Date.now()}`,

    requireInteraction:
      Boolean(
        requireInteractionInput.checked
      ),

    icon:
      "/Cardiology/assets/images/acl-icon-192.png",

   
