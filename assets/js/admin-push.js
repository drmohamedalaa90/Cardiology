import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.8.0";


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

    badge:
      "/Cardiology/assets/images/acl-icon-192.png",

    data: {
      source:
        "acl-admin-push",

      sent_at:
        new Date()
          .toISOString(),

      audience,

      selected_user_count:
        userIds.length
    }
  };
}


/* =========================================================
   CONFIRMATION
========================================================= */

function confirmSend(
  payload
) {
  const audience =
    audienceSelect?.value ||
    "all";


  const audienceText =
    audienceLabel(
      audience
    );


  const selectedCount =
    payload.user_ids
      ?.length ||
    0;


  const selectedLine =
    audience ===
      "selected"
      ? `\nSelected users: ${selectedCount}`
      : "";


  return window.confirm(
    `Send this push notification?\n\n` +
    `Audience: ${audienceText}` +
    `${selectedLine}\n` +
    `Type: ${titleCase(
      payload.type
    )}\n` +
    `Title: ${payload.title}\n\n` +
    `This action may immediately notify multiple devices.`
  );
}


/* =========================================================
   FUNCTION ERROR
========================================================= */

async function extractFunctionError(
  error
) {
  if (!error) {
    return {
      message:
        "The push notification could not be sent.",

      details:
        null
    };
  }


  try {
    if (
      error.context &&
      typeof error.context.json ===
        "function"
    ) {
      const response =
        await error.context
          .json();


      return {
        message:
          response?.message ||
          response?.error ||
          error.message ||
          "The push notification could not be sent.",

        details:
          response?.details ||
          null
      };
    }
  } catch (
    contextError
  ) {
    console.warn(
      "PUSH ERROR CONTEXT READ FAILED:",
      contextError
    );
  }


  return {
    message:
      error.message ||
      "The push notification could not be sent.",

    details:
      null
  };
}


/* =========================================================
   RESULT CONTAINER
========================================================= */

function ensureResultDetailsContainer() {
  const resultBox =
    byId(
      "pushSendResult"
    );


  if (!resultBox) {
    return null;
  }


  let details =
    byId(
      "pushResultDetails"
    );


  if (!details) {
    details =
      document.createElement(
        "div"
      );


    details.id =
      "pushResultDetails";


    details.className =
      "push-result-details";


    resultBox.appendChild(
      details
    );
  }


  return details;
}


function setResultValue(
  id,
  value
) {
  const element =
    byId(
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
   FAILURE DETAILS
========================================================= */

function failureDescription(
  failure
) {
  const status =
    Number(
      failure?.status ||
      0
    );


  const statusText =
    String(
      failure?.statusText ||
      ""
    ).trim();


  const errorText =
    String(
      failure?.error ||
      ""
    ).trim();


  if (
    status ===
    404 ||
    status ===
    410
  ) {
    return (
      errorText ||
      "The browser subscription expired or was removed."
    );
  }


  if (
    status ===
    401 ||
    status ===
    403
  ) {
    return (
      errorText ||
      "The push provider rejected the authentication details."
    );
  }


  if (
    status ===
    429
  ) {
    return (
      errorText ||
      "The push provider temporarily rate-limited this delivery."
    );
  }


  if (
    status >=
    500
  ) {
    return (
      errorText ||
      "The external push provider returned a server error."
    );
  }


  return (
    errorText ||
    statusText ||
    "The delivery failed for an unknown reason."
  );
}


function renderFailureList(
  failures
) {
  if (
    !Array.isArray(
      failures
    ) ||
    !failures.length
  ) {
    return "";
  }


  const items =
    failures
      .slice(
        0,
        20
      )
      .map(
        (
          failure
        ) => {
          const status =
            Number(
              failure?.status ||
              0
            );


          const statusLabel =
            status >
            0
              ? `HTTP ${status}`
              : escapeHtml(
                  failure?.statusText ||
                  "Delivery error"
                );


          return `
            <li class="push-result-failure-item">

              <div class="push-result-failure-heading">

                <strong>
                  ${statusLabel}
                </strong>

                ${
                  failure?.deactivated
                    ? `
                      <span class="push-result-deactivated-badge">
                        Endpoint deactivated
                      </span>
                    `
                    : ""
                }

              </div>


              <p>
                ${escapeHtml(
                  failureDescription(
                    failure
                  )
                )}
              </p>


              <small>
                Provider:
                ${escapeHtml(
                  failure?.endpointHost ||
                  "Unknown"
                )}
              </small>


              ${
                failure?.deactivationError
                  ? `
                    <small class="push-result-deactivation-error">
                      Cleanup error:
                      ${escapeHtml(
                        failure.deactivationError
                      )}
                    </small>
                  `
                  : ""
              }

            </li>
          `;
        }
      )
      .join(
        ""
      );


  return `
    <details class="push-result-failure-details">

      <summary>
        Review ${failures.length}
        ${pluralize(
          failures.length,
          "delivery failure"
        )}
      </summary>

      <ul class="push-result-failure-list">
        ${items}
      </ul>

    </details>
  `;
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


  state.lastResult =
    result;


  const total =
    Number(
      result?.total ||
      0
    );


  const sent =
    Number(
      result?.sent ||
      0
    );


  const failed =
    Number(
      result?.failed ||
      0
    );


  const deactivated =
    Number(
      result?.deactivated ||
      0
    );


  const activeAfterDelivery =
    Number(
      result?.activeAfterDelivery ??
      Math.max(
        0,
        total -
        deactivated
      )
    );


  setResultValue(
    "pushResultTotal",
    total
  );


  setResultValue(
    "pushResultSent",
    sent
  );


  setResultValue(
    "pushResultFailed",
    failed
  );


  setResultValue(
    "pushResultDeactivated",
    deactivated
  );


  const details =
    ensureResultDetailsContainer();


  if (details) {
    details.innerHTML = `
      <div class="push-result-extra-summary">

        <span>
          <strong>
            ${deactivated}
          </strong>

          stale
          ${pluralize(
            deactivated,
            "endpoint"
          )}
          deactivated
        </span>


        <span>
          <strong>
            ${activeAfterDelivery}
          </strong>

          active
          ${pluralize(
            activeAfterDelivery,
            "subscription"
          )}
          remaining
        </span>

      </div>


      ${
        result?.message
          ? `
            <p class="push-result-server-message">
              ${escapeHtml(
                result.message
              )}
            </p>
          `
          : ""
      }


      ${renderFailureList(
        result?.failures
      )}
    `;
  }


  box.dataset.resultType =
    failed ===
      0
      ? "success"
      : sent >
          0
        ? "partial"
        : "error";


  box.hidden =
    false;
}


/* =========================================================
   SEND
========================================================= */

async function sendPushNotification() {
  if (
    state.isSending
  ) {
    return;
  }


  const payload =
    buildPayload();


  if (
    !confirmSend(
      payload
    )
  ) {
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


    const deactivated =
      Number(
        data?.deactivated ||
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
      sent ===
        0 &&
      failed >
        0
    ) {
      setStatus(
        `Delivery failed for all ${failed} selected ${pluralize(
          failed,
          "subscription"
        )}. Review the failure details below.`,
        "error"
      );


      return;
    }


    if (
      failed >
      0
    ) {
      setStatus(
        `Delivery completed with partial success: ${sent} sent, ${failed} failed${
          deactivated >
          0
            ? `, and ${deactivated} stale ${pluralize(
                deactivated,
                "endpoint"
              )} deactivated`
            : ""
        }.`,
        "warning"
      );


      return;
    }


    setStatus(
      `Push notification sent successfully to ${sent} registered ${pluralize(
        sent,
        "device"
      )}.`,
      "success"
    );
  } catch (
    error
  ) {
    console.error(
      "ADMIN PUSH SEND ERROR:",
      error
    );


    const extractedError =
      await extractFunctionError(
        error
      );


    setStatus(
      extractedError.message,
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
  if (
    state.isSending
  ) {
    return;
  }


  form?.reset();


  if (titleInput) {
    titleInput.value =
      "Alexandria Cardiology League";
  }


  if (bodyInput) {
    bodyInput.value =
      "";
  }


  if (urlInput) {
    urlInput.value =
      "/Cardiology/notifications.html";
  }


  if (audienceSelect) {
    audienceSelect.value =
      "all";
  }


  if (typeSelect) {
    typeSelect.value =
      "announcement";
  }


  if (tagInput) {
    tagInput.value =
      "";
  }


  if (userIdsInput) {
    userIdsInput.value =
      "";
  }


  if (
    requireInteractionInput
  ) {
    requireInteractionInput.checked =
      false;
  }


  setStatus(
    ""
  );


  state.lastResult =
    null;


  const resultBox =
    byId(
      "pushSendResult"
    );


  if (resultBox) {
    resultBox.hidden =
      true;


    resultBox.removeAttribute(
      "data-result-type"
    );
  }


  const details =
    byId(
      "pushResultDetails"
    );


  if (details) {
    details.innerHTML =
      "";
  }


  updatePreview();
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  form
    ?.addEventListener(
      "submit",
      async (
        event
      ) => {
        event.preventDefault();


        try {
          await sendPushNotification();
        } catch (
          error
        ) {
          console.error(
            "ADMIN PUSH VALIDATION ERROR:",
            error
          );


          setStatus(
            error?.message ||
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
    requireInteractionInput,
    userIdsInput
  ].forEach(
    (
      element
    ) => {
      element
        ?.addEventListener(
          "input",
          updatePreview
        );


      element
        ?.addEventListener(
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
  } catch (
    error
  ) {
    console.error(
      "ADMIN PUSH INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error?.message ||
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
