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
  "ACL NOTIFICATION ONBOARDING v1.0.0 LOADED"
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


/* =========================================================
   STATE
========================================================= */

const state = {
  user: null,
  registration: null,
  subscription: null,
  busy: false
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
    busy;


  if (enableButton) {
    enableButton.disabled =
      busy;


    enableButton.textContent =
      busy
        ? "Enabling…"
        : "Enable Notifications";
  }


  if (laterButton) {
    laterButton.disabled =
      busy;
  }


  if (closeButton) {
    closeButton.disabled =
      busy;
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
  if (!modal) {
    return;
  }


  modal.hidden =
    false;


  document.body.classList.add(
    "acl-notification-onboarding-open"
  );


  window.setTimeout(
    () => {
      enableButton
        ?.focus();
    },
    80
  );
}


function closePrompt() {
  if (!modal) {
    return;
  }


  modal.hidden =
    true;


  document.body.classList.remove(
    "acl-notification-onboarding-open"
  );
}


function dismissPrompt() {
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


  return (
    Number.isFinite(
      remindAfter
    ) &&
    remindAfter >
      Date.now()
  );
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
  const p256dh =
    subscription.getKey(
      "p256dh"
    );


  const auth =
    subscription.getKey(
      "auth"
    );


  const {
    error
  } =
    await supabaseClient
      .from(
        "push_subscriptions"
      )
      .upsert(
        {
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
        },
        {
          onConflict:
            "endpoint"
        }
      );


  if (error) {
    throw error;
  }
}


/* =========================================================
   ENABLE NOTIFICATIONS
========================================================= */

async function enableNotifications() {
  if (state.busy) {
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
      "Notifications are blocked. Open your browser or device settings and allow notifications for ACL.",
      "error"
    );


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
      "Notifications enabled successfully.",
      "success"
    );


    window.setTimeout(
      closePrompt,
      1100
    );
  } catch (
    error
  ) {
    console.error(
      "ACL NOTIFICATION ONBOARDING ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Notifications could not be enabled.",
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
    return false;
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


  if (subscription) {
    state.subscription =
      subscription;


    try {
      await saveSubscription(
        subscription
      );
    } catch (
      error
    ) {
      console.warn(
        "ACL PUSH SUBSCRIPTION SYNC ERROR:",
        error
      );
    }


    return false;
  }


  return true;
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


    const shouldShow =
      await shouldShowPrompt();


    if (!shouldShow) {
      return;
    }


    if (
      isIosDevice() &&
      !isStandaloneMode()
    ) {
      if (installButton) {
        installButton.hidden =
          false;
      }


      setStatus(
        "On iPhone, install ACL on the Home Screen before enabling notifications.",
        "warning"
      );
    }


    window.setTimeout(
      openPrompt,
      850
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


document
  .getElementById(
    "aclNotificationOnboardingBackdrop"
  )
  ?.addEventListener(
    "click",
    dismissPrompt
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
