import {
  supabaseClient
} from "./supabase-client.js";


import {
  ACL_CONFIG
} from "./config.js?v=1.1.0";


import {
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.7.0";


console.log(
  "ACL NOTIFICATION ONBOARDING v1.1.0 LOADED"
);


/* =========================================================
   CONFIGURATION
========================================================= */

const selectedEdition =
  resolveAclEdition();


const VAPID_PUBLIC_KEY =
  String(
    ACL_CONFIG.vapidPublicKey ||
    ""
  ).trim();


const SESSION_DISMISS_KEY =
  "aclNotificationPromptDismissedThisSession";


const REMIND_AFTER_KEY =
  "aclNotificationPromptRemindAfter";


const REMIND_AFTER_DAYS =
  7;


const PROMPT_DELAY_MS =
  1200;


const SUCCESS_CLOSE_DELAY_MS =
  1200;


/* =========================================================
   ELEMENTS
========================================================= */

const modal =
  document.getElementById(
    "aclNotificationOnboarding"
  );


const enableButton =
  document.getElementById(
    "enableAclNotificationsOnboarding"
  );


const laterButton =
  document.getElementById(
    "dismissAclNotificationsOnboarding"
  );


const closeButton =
  document.getElementById(
    "closeAclNotificationOnboarding"
  );


const statusBox =
  document.getElementById(
    "aclNotificationOnboardingStatus"
  );


const installButton =
  document.getElementById(
    "installAclBeforeNotifications"
  );


const backdrop =
  document.getElementById(
    "aclNotificationOnboardingBackdrop"
  );


/* =========================================================
   STATE
========================================================= */

const state = {
  user: null,
  registration: null,
  subscription: null,
  busy: false,
  previousFocusedElement: null,
  openTimer: null
};


/* =========================================================
   PLATFORM
========================================================= */

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );
}


function isStandaloneMode() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone ===
      true
  );
}


function deviceType() {
  const userAgent =
    navigator.userAgent
      .toLowerCase();


  if (
    /iphone|ipad|ipod/.test(
      userAgent
    )
  ) {
    return "ios";
  }


  if (
    /android/.test(
      userAgent
    )
  ) {
    return "android";
  }


  if (
    /windows/.test(
      userAgent
    )
  ) {
    return "windows";
  }


  if (
    /macintosh|mac os/.test(
      userAgent
    )
  ) {
    return "macos";
  }


  return "other";
}


function pushSupported() {
  return (
    "serviceWorker" in
      navigator &&
    "PushManager" in
      window &&
    "Notification" in
      window
  );
}


/* =========================================================
   HELPERS
========================================================= */

function setStatus(
  message = "",
  kind = ""
) {
  if (!statusBox) {
    return;
  }


  statusBox.textContent =
    message;


  statusBox.className =
    `notification-onboarding-status ${kind}`.trim();


  statusBox.hidden =
    !message;
}


function setBusy(
  busy
) {
  state.busy =
    Boolean(
      busy
    );


  if (enableButton) {
    enableButton.disabled =
      state.busy;


    enableButton.textContent =
      state.busy
        ? "Enabling…"
        : "Enable Notifications";
  }


  if (laterButton) {
    laterButton.disabled =
      state.busy;
  }


  if (closeButton) {
    closeButton.disabled =
      state.busy;
  }


  if (installButton) {
    installButton.disabled =
      state.busy;
  }
}


function urlBase64ToUint8Array(
  base64String
) {
  const padding =
    "=".repeat(
      (
        4 -
        (
          base64String.length %
          4
        )
      ) %
      4
    );


  const normalized =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );


  const rawData =
    window.atob(
      normalized
    );


  return Uint8Array.from(
    [
      ...rawData
    ].map(
      (
        character
      ) =>
        character.charCodeAt(
          0
        )
    )
  );
}


function arrayBufferToBase64(
  buffer
) {
  if (!buffer) {
    return null;
  }


  const bytes =
    new Uint8Array(
      buffer
    );


  let binary =
    "";


  for (
    const byte of
    bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }


  return window.btoa(
    binary
  );
}


/* =========================================================
   PROMPT VISIBILITY
========================================================= */

function openPrompt() {
  if (
    !modal ||
    !modal.hidden
  ) {
    return;
  }


  state.previousFocusedElement =
    document.activeElement instanceof
      HTMLElement
      ? document.activeElement
      : null;


  modal.hidden =
    false;


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "acl-notification-onboarding-open"
  );


  window.setTimeout(
    () => {
      const preferredButton =
        !enableButton?.hidden
          ? enableButton
          : !installButton?.hidden
            ? installButton
            : laterButton;


      preferredButton
        ?.focus();
    },
    80
  );
}


function closePrompt() {
  if (!modal) {
    return;
  }


  if (
    state.openTimer
  ) {
    window.clearTimeout(
      state.openTimer
    );


    state.openTimer =
      null;
  }


  modal.hidden =
    true;


  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.classList.remove(
    "acl-notification-onboarding-open"
  );


  state.previousFocusedElement
    ?.focus?.();


  state.previousFocusedElement =
    null;
}


function dismissPrompt() {
  if (
    state.busy
  ) {
    return;
  }


  sessionStorage.setItem(
    SESSION_DISMISS_KEY,
    "true"
  );


  const remindAfter =
    Date.now() +
    (
      REMIND_AFTER_DAYS *
      24 *
      60 *
      60 *
      1000
    );


  localStorage.setItem(
    REMIND_AFTER_KEY,
    String(
      remindAfter
    )
  );


  closePrompt();
}


function promptRecentlyDismissed() {
  if (
    sessionStorage.getItem(
      SESSION_DISMISS_KEY
    ) ===
    "true"
  ) {
    return true;
  }


  const remindAfter =
    Number(
      localStorage.getItem(
        REMIND_AFTER_KEY
      ) ||
      0
    );


  if (
    !Number.isFinite(
      remindAfter
    ) ||
    remindAfter <=
      0
  ) {
    return false;
  }


  if (
    remindAfter <=
    Date.now()
  ) {
    localStorage.removeItem(
      REMIND_AFTER_KEY
    );


    return false;
  }


  return true;
}


/* =========================================================
   SERVICE WORKER
========================================================= */

async function getRegistration() {
  if (
    state.registration
  ) {
    return state.registration;
  }


  if (
    window.aclPwa
      ?.getRegistration
  ) {
    state.registration =
      await window.aclPwa
        .getRegistration();


    return state.registration;
  }


  if (
    window.aclServiceWorkerReady
  ) {
    state.registration =
      await window
        .aclServiceWorkerReady;


    return state.registration;
  }


  state.registration =
    await navigator
      .serviceWorker
      .ready;


  return state.registration;
}


/* =========================================================
   DATABASE
========================================================= */

async function saveSubscription(
  subscription
) {
  if (
    !state.user?.id
  ) {
    throw new Error(
      "Your ACL login session is unavailable. Sign out, sign in again, and retry."
    );
  }


  if (
    !subscription?.endpoint
  ) {
    throw new Error(
      "The browser did not provide a valid push subscription endpoint."
    );
  }


  const p256dh =
    subscription.getKey(
      "p256dh"
    );


  const auth =
    subscription.getKey(
      "auth"
    );


  if (
    !p256dh ||
    !auth
  ) {
    throw new Error(
      "The browser push subscription is missing its encryption keys."
    );
  }


  const payload = {
    user_id:
      state.user.id,

    endpoint:
      subscription.endpoint,

    p256dh:
      arrayBufferToBase64(
        p256dh
      ),

    auth:
      arrayBufferToBase64(
        auth
      ),

    user_agent:
      navigator.userAgent,

    device_type:
      deviceType(),

    edition:
      selectedEdition,

    is_active:
      true,

    updated_at:
      new Date()
        .toISOString()
  };


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "push_subscriptions"
      )
      .upsert(
        payload,
        {
          onConflict:
            "endpoint"
        }
      )
      .select(
        "id, user_id, endpoint, device_type, edition, is_active, updated_at"
      )
      .single();


  if (error) {
    console.error(
      "ACL ONBOARDING SUBSCRIPTION DATABASE ERROR:",
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint
      }
    );


    const enhancedError =
      new Error(
        error.message ||
        "The device subscription could not be saved."
      );


    enhancedError.code =
      error.code;


    enhancedError.details =
      error.details;


    enhancedError.hint =
      error.hint;


    throw enhancedError;
  }


  return data;
}


function subscriptionErrorMessage(
  error
) {
  const code =
    String(
      error?.code ||
      ""
    ).trim();


  const message =
    String(
      error?.message ||
      error?.details ||
      ""
    ).trim();


  if (
    code ===
    "42501"
  ) {
    return "Supabase rejected the device registration. Sign out, sign in again, and retry.";
  }


  if (
    code ===
    "42P01"
  ) {
    return "The push subscription database table could not be found.";
  }


  if (
    code ===
    "23505"
  ) {
    return "This browser subscription already exists but could not be updated. Refresh the page and retry.";
  }


  if (
    /jwt|session|authenticated|auth/i.test(
      message
    )
  ) {
    return "Your ACL login session expired. Sign out, sign in again, and retry.";
  }


  return (
    message ||
    "This device could not be registered for ACL notifications."
  );
}


/* =========================================================
   ENABLE NOTIFICATIONS
========================================================= */

async function enableNotifications() {
  if (
    state.busy
  ) {
    return;
  }


  if (
    isIosDevice() &&
    !isStandaloneMode()
  ) {
    setStatus(
      "Install ACL on your iPhone Home Screen first, then open the installed app and enable notifications.",
      "warning"
    );


    if (installButton) {
      installButton.hidden =
        false;
    }


    if (enableButton) {
      enableButton.hidden =
        true;
    }


    return;
  }


  if (!pushSupported()) {
    setStatus(
      "Push notifications are not supported by this browser.",
      "error"
    );


    return;
  }


  if (!VAPID_PUBLIC_KEY) {
    setStatus(
      "The ACL notification key is missing from config.js.",
      "error"
    );


    return;
  }


  if (
    Notification.permission ===
    "denied"
  ) {
    setStatus(
      isIosDevice()
        ? "Notifications are blocked. Open iPhone Settings, select ACL under Notifications, allow notifications, then reopen the installed app."
        : "Notifications are blocked. Open this browser's site permissions or your device notification settings and allow notifications for ACL.",
      "error"
    );


    if (enableButton) {
      enableButton.hidden =
        true;
    }


    return;
  }


  setBusy(
    true
  );


  setStatus(
    "Requesting notification permission…"
  );


  try {
    const permission =
      await Notification
        .requestPermission();


    if (
      permission !==
      "granted"
    ) {
      setStatus(
        permission ===
          "denied"
          ? "Notifications were blocked. You can change this later from browser settings."
          : "Notification permission was not granted.",
        permission ===
          "denied"
          ? "error"
          : "warning"
      );


      if (
        permission ===
          "denied" &&
        enableButton
      ) {
        enableButton.hidden =
          true;
      }


      return;
    }


    const registration =
      await getRegistration();


    let subscription =
      await registration
        .pushManager
        .getSubscription();


    if (!subscription) {
      subscription =
        await registration
          .pushManager
          .subscribe({
            userVisibleOnly:
              true,

            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY
              )
          });
    }


    state.subscription =
      subscription;


    await saveSubscription(
      subscription
    );


    localStorage.removeItem(
      REMIND_AFTER_KEY
    );


    sessionStorage.removeItem(
      SESSION_DISMISS_KEY
    );


    setStatus(
      "Notifications enabled successfully on this device.",
      "success"
    );


    window.dispatchEvent(
      new CustomEvent(
        "acl-notifications-enabled",
        {
          detail: {
            edition:
              selectedEdition,

            deviceType:
              deviceType()
          }
        }
      )
    );


    window.setTimeout(
      closePrompt,
      SUCCESS_CLOSE_DELAY_MS
    );
  } catch (
    error
  ) {
    console.error(
      "ACL NOTIFICATION ONBOARDING ERROR:",
      error
    );


    setStatus(
      subscriptionErrorMessage(
        error
      ),
      "error"
    );
  } finally {
    setBusy(
      false
    );
  }
}


/* =========================================================
   INSTALL APP
========================================================= */

async function installApp() {
  if (
    window.aclPwa
      ?.install
  ) {
    await window.aclPwa
      .install();


    return;
  }


  if (
    isIosDevice()
  ) {
    window.alert(
      "On iPhone or iPad:\n\n" +
      "1. Open ACL in Safari.\n" +
      "2. Tap Share.\n" +
      "3. Tap Add to Home Screen.\n" +
      "4. Open the installed ACL app."
    );


    return;
  }


  window.alert(
    "Open your browser menu and choose Install App or Add to Home Screen."
  );
}


/* =========================================================
   SHOULD SHOW
========================================================= */

async function shouldShowPrompt() {
  if (
    !modal ||
    promptRecentlyDismissed()
  ) {
    return false;
  }


  if (!pushSupported()) {
    return false;
  }


  if (
    Notification.permission ===
    "denied"
  ) {
    return true;
  }


  if (
    isIosDevice() &&
    !isStandaloneMode()
  ) {
    return true;
  }


  const registration =
    await getRegistration();


  const subscription =
    await registration
      .pushManager
      .getSubscription();


  if (!subscription) {
    return true;
  }


  state.subscription =
    subscription;


  try {
    await saveSubscription(
      subscription
    );


    return false;
  } catch (
    error
  ) {
    console.warn(
      "ACL PUSH SUBSCRIPTION SYNC ERROR:",
      error
    );


    return true;
  }
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeNotificationOnboarding() {
  if (!modal) {
    return;
  }


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getUser();


    if (
      error ||
      !data?.user
    ) {
      return;
    }


    state.user =
      data.user;


    modal.setAttribute(
      "aria-hidden",
      "true"
    );


    const shouldShow =
      await shouldShowPrompt();


    if (!shouldShow) {
      return;
    }


    if (
      Notification.permission ===
      "denied"
    ) {
      if (enableButton) {
        enableButton.hidden =
          true;
      }


      if (installButton) {
        installButton.hidden =
          true;
      }


      setStatus(
        isIosDevice()
          ? "Notifications are blocked. Open iPhone Settings, select ACL under Notifications, and allow notifications."
          : "Notifications are blocked. Allow them from your browser or device notification settings.",
        "error"
      );
    } else if (
      isIosDevice() &&
      !isStandaloneMode()
    ) {
      if (installButton) {
        installButton.hidden =
          false;
      }


      if (enableButton) {
        enableButton.hidden =
          true;
      }


      setStatus(
        "On iPhone, install ACL on the Home Screen before enabling notifications.",
        "warning"
      );
    } else {
      if (installButton) {
        installButton.hidden =
          true;
      }


      if (enableButton) {
        enableButton.hidden =
          false;
      }


      setStatus(
        ""
      );
    }


    state.openTimer =
      window.setTimeout(
        () => {
          state.openTimer =
            null;


          openPrompt();
        },
        PROMPT_DELAY_MS
      );
  } catch (
    error
  ) {
    console.warn(
      "ACL NOTIFICATION PROMPT INITIALIZATION ERROR:",
      error
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

enableButton
  ?.addEventListener(
    "click",
    enableNotifications
  );


laterButton
  ?.addEventListener(
    "click",
    dismissPrompt
  );


closeButton
  ?.addEventListener(
    "click",
    dismissPrompt
  );


installButton
  ?.addEventListener(
    "click",
    installApp
  );


backdrop
  ?.addEventListener(
    "click",
    dismissPrompt
  );


modal
  ?.addEventListener(
    "click",
    (
      event
    ) => {
      event.stopPropagation();
    }
  );


document.addEventListener(
  "keydown",
  (
    event
  ) => {
    if (
      event.key ===
        "Escape" &&
      !modal?.hidden &&
      !state.busy
    ) {
      dismissPrompt();
    }
  }
);


window.addEventListener(
  "acl-app-installed",
  () => {
    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }


    if (
      isIosDevice() &&
      !isStandaloneMode()
    ) {
      return;
    }


    if (installButton) {
      installButton.hidden =
        true;
    }


    if (enableButton) {
      enableButton.hidden =
        false;
    }


    setStatus(
      "ACL is installed. You can now enable notifications.",
      "success"
    );
  }
);


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeNotificationOnboarding,
    {
      once:
        true
    }
  );
} else {
  void initializeNotificationOnboarding();
}
