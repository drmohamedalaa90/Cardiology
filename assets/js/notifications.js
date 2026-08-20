import {
  supabaseClient
} from "./supabase-client.js";


import {
  ACL_CONFIG
} from "./config.js?v=1.1.0";

import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.8.0";


console.log(
  "ACL NOTIFICATIONS v2.0.4 LOADED"
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


const state = {
  user: null,
  profile: null,
  notifications: [],
  filteredNotifications: [],
  pushSubscription: null,
  serviceWorkerRegistration: null
};


const el =
  (id) =>
    document.getElementById(
      id
    );


/* =========================================================
   ELEMENTS
========================================================= */

const notificationsList =
  el(
    "notificationsList"
  );


const emptyState =
  el(
    "notificationsEmptyState"
  );


const statusBox =
  el(
    "notificationsStatus"
  );


const readFilter =
  el(
    "notificationsReadFilter"
  );


const typeFilter =
  el(
    "notificationsTypeFilter"
  );


const refreshButton =
  el(
    "refreshNotifications"
  );


const markAllReadButton =
  el(
    "markAllNotificationsRead"
  );


const enablePushButton =
  el(
    "enablePushNotifications"
  );


const disablePushButton =
  el(
    "disablePushNotifications"
  );


const testPushButton =
  el(
    "testPushNotification"
  );


const pushStatusBadge =
  el(
    "pushStatusBadge"
  );


const pushDeviceLabel =
  el(
    "pushDeviceLabel"
  );


const pushDescription =
  el(
    "pushNotificationsDescription"
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
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[
        character
      ]
  );
}


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
    `notifications-status ${kind}`.trim();


  statusBox.hidden =
    !message;
}


function setButtonBusy(
  button,
  busy,
  busyText,
  normalText
) {
  if (!button) {
    return;
  }


  button.disabled =
    busy;


  button.textContent =
    busy
      ? busyText
      : normalText;
}


function normalizeType(
  value
) {
  const type =
    String(
      value ||
      "system"
    )
      .trim()
      .toLowerCase();


  return [
    "challenge",
    "competition",
    "module",
    "achievement",
    "announcement",
    "system"
  ].includes(
    type
  )
    ? type
    : "system";
}


function normalizeEdition(
  value
) {
  const edition =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  return edition === "basic" ||
    edition === "expert"
    ? edition
    : null;
}


function humanizeType(
  value
) {
  return normalizeType(
    value
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


function formatDateTime(
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


function relativeTime(
  value
) {
  if (!value) {
    return "";
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
    return "";
  }


  const difference =
    date.getTime() -
    Date.now();


  const minute =
    60 *
    1000;


  const hour =
    60 *
    minute;


  const day =
    24 *
    hour;


  const formatter =
    new Intl.RelativeTimeFormat(
      "en",
      {
        numeric:
          "auto"
      }
    );


  if (
    Math.abs(
      difference
    ) <
    hour
  ) {
    return formatter.format(
      Math.round(
        difference /
        minute
      ),
      "minute"
    );
  }


  if (
    Math.abs(
      difference
    ) <
    day
  ) {
    return formatter.format(
      Math.round(
        difference /
        hour
      ),
      "hour"
    );
  }


  return formatter.format(
    Math.round(
      difference /
      day
    ),
    "day"
  );
}


function notificationIcon(
  type
) {
  const icons = {
    challenge:
      "⚔️",

    competition:
      "🏆",

    module:
      "📚",

    achievement:
      "🎯",

    announcement:
      "📢",

    system:
      "⚙️"
  };


  return (
    icons[
      normalizeType(
        type
      )
    ] ||
    icons.system
  );
}


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


function deviceLabel() {
  const labels = {
    ios:
      "iPhone or iPad",

    android:
      "Android device",

    windows:
      "Windows computer",

    macos:
      "Mac computer",

    other:
      "This device"
  };


  return (
    labels[
      deviceType()
    ] ||
    labels.other
  );
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
      (character) =>
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
   EDITION DISPLAY
========================================================= */

function renderEdition() {
  const isBasic =
    selectedEdition ===
    "basic";


  const editionBadge =
    el(
      "notificationsEditionBadge"
    );


  if (editionBadge) {
    editionBadge.textContent =
      isBasic
        ? "BASIC EDITION"
        : "EXPERT EDITION";
  }


  const themeColor =
    el(
      "notificationsThemeColor"
    );


  if (themeColor) {
    themeColor.content =
      isBasic
        ? "#105541"
        : "#123f72";
  }


  const modulesLink =
    el(
      "notificationsModulesLink"
    );


  const progressLink =
    el(
      "notificationsProgressLink"
    );


  if (modulesLink) {
    modulesLink.href =
      aclUrl(
        "modules.html",
        selectedEdition
      );
  }


  if (progressLink) {
    progressLink.href =
      aclUrl(
        "progress.html",
        selectedEdition
      );
  }


  document.title =
    `${
      isBasic
        ? "Basic"
        : "Expert"
    } Edition Notifications | ACL`;


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
   SAFE NOTIFICATION URL
========================================================= */

function notificationActionUrl(
  notification
) {
  const rawUrl =
    String(
      notification?.action_url ||
      notification?.link_url ||
      notification?.target_url ||
      ""
    ).trim();


  if (!rawUrl) {
    return "";
  }


  try {
    const url =
      new URL(
        rawUrl,
        window.location.href
      );


    if (
      url.origin !==
      window.location.origin
    ) {
      return "";
    }


    url.searchParams.set(
      "edition",
      selectedEdition
    );


    return (
      `${url.pathname}` +
      `${url.search}` +
      `${url.hash}`
    );
  } catch (error) {
    console.warn(
      "INVALID NOTIFICATION URL:",
      rawUrl,
      error
    );


    return "";
  }
}


/* =========================================================
   PUSH SUPPORT
========================================================= */

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


async function getServiceWorkerRegistration() {
  if (
    state.serviceWorkerRegistration
  ) {
    return state.serviceWorkerRegistration;
  }


  if (
    window.aclPwa?.getRegistration
  ) {
    state.serviceWorkerRegistration =
      await window.aclPwa
        .getRegistration();


    return state.serviceWorkerRegistration;
  }


  if (
    window.aclServiceWorkerReady
  ) {
    state.serviceWorkerRegistration =
      await window
        .aclServiceWorkerReady;


    return state.serviceWorkerRegistration;
  }


  state.serviceWorkerRegistration =
    await navigator.serviceWorker.ready;


  return state.serviceWorkerRegistration;
}


function renderPushStatus(
  status,
  message = ""
) {
  if (!pushStatusBadge) {
    return;
  }


  pushStatusBadge.className =
    "push-status-badge";


  if (
    status ===
    "enabled"
  ) {
    pushStatusBadge.textContent =
      "Enabled";


    pushStatusBadge.classList.add(
      "enabled"
    );


    if (enablePushButton) {
      enablePushButton.hidden =
        true;
    }


    if (disablePushButton) {
      disablePushButton.hidden =
        false;
    }


    if (testPushButton) {
      testPushButton.hidden =
        false;
    }
  } else if (
    status ===
    "blocked"
  ) {
    pushStatusBadge.textContent =
      "Blocked";


    pushStatusBadge.classList.add(
      "blocked"
    );


    if (enablePushButton) {
      enablePushButton.hidden =
        true;
    }


    if (disablePushButton) {
      disablePushButton.hidden =
        true;
    }


    if (testPushButton) {
      testPushButton.hidden =
        true;
    }
  } else if (
    status ===
    "unsupported"
  ) {
    pushStatusBadge.textContent =
      "Unsupported";


    pushStatusBadge.classList.add(
      "warning"
    );


    if (enablePushButton) {
      enablePushButton.hidden =
        true;
    }


    if (disablePushButton) {
      disablePushButton.hidden =
        true;
    }


    if (testPushButton) {
      testPushButton.hidden =
        true;
    }
  } else if (
    status ===
    "installation-required"
  ) {
    pushStatusBadge.textContent =
      "Install required";


    pushStatusBadge.classList.add(
      "warning"
    );


    if (enablePushButton) {
      enablePushButton.hidden =
        false;


      enablePushButton.textContent =
        "Installation Instructions";
    }


    if (disablePushButton) {
      disablePushButton.hidden =
        true;
    }


    if (testPushButton) {
      testPushButton.hidden =
        true;
    }
  } else {
    pushStatusBadge.textContent =
      "Not enabled";


    if (enablePushButton) {
      enablePushButton.hidden =
        false;


      enablePushButton.textContent =
        "Enable Notifications";
    }


    if (disablePushButton) {
      disablePushButton.hidden =
        true;
    }


    if (testPushButton) {
      testPushButton.hidden =
        true;
    }
  }


  if (pushDeviceLabel) {
    pushDeviceLabel.textContent =
      message ||
      deviceLabel();
  }
}


/* =========================================================
   PUSH SUBSCRIPTION DATABASE
========================================================= */

async function savePushSubscription(
  subscription
) {
  if (!state.user?.id) {
    throw new Error(
      "Your ACL login session is not available. Sign out, sign in again, then retry."
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
      "PUSH SUBSCRIPTION DATABASE ERROR:",
      {
        message:
          error.message,

        code:
          error.code,

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
async function deactivatePushSubscription(
  endpoint
) {
  if (
    !endpoint ||
    !state.user
  ) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "push_subscriptions"
      )
      .update({
        is_active:
          false,

        updated_at:
          new Date()
            .toISOString()
      })
      .eq(
        "endpoint",
        endpoint
      )
      .eq(
        "user_id",
        state.user.id
      );


  if (error) {
    console.warn(
      "PUSH DEACTIVATION DATABASE ERROR:",
      error
    );
  }
}


/* =========================================================
   CHECK PUSH STATUS
========================================================= */

async function checkPushStatus() {
  if (!pushSupported()) {
    renderPushStatus(
      "unsupported",
      "Push notifications are not supported by this browser."
    );


    if (pushDescription) {
      pushDescription.textContent =
        "Use a modern browser or install the ACL app on your phone.";
    }


    return;
  }


  if (
    isIosDevice() &&
    !isStandaloneMode()
  ) {
    renderPushStatus(
      "installation-required",
      "On iPhone, add ACL to the Home Screen first."
    );


    if (pushDescription) {
      pushDescription.textContent =
        "Open ACL in Safari, tap Share, choose Add to Home Screen, then open the installed ACL app.";
    }


    return;
  }


    if (
    Notification.permission ===
    "denied"
  ) {
    renderPushStatus(
      "blocked",
      "Permission is blocked for this device."
    );


    if (pushDescription) {
      pushDescription.textContent =
        isIosDevice()
          ? "Open iPhone Settings, find ACL under Notifications, and allow notifications. Then reopen the installed ACL app."
          : "Open this browser's site permissions or your device notification settings and allow notifications for ACL.";
    }


    setStatus(
      "Notifications are blocked in browser or device settings.",
      "warning"
    );


    return;
  }


  try {
    const registration =
      await getServiceWorkerRegistration();


    const subscription =
      await registration
        .pushManager
        .getSubscription();


    state.pushSubscription =
      subscription;


    if (subscription) {
      renderPushStatus(
        "enabled",
        `${deviceLabel()} is registered.`
      );


      try {
        await savePushSubscription(
          subscription
        );
      } catch (error) {
        console.warn(
          "PUSH DATABASE SYNC ERROR:",
          error
        );
      }
    } else {
      renderPushStatus(
        "disabled",
        deviceLabel()
      );
    }
  } catch (error) {
    console.error(
      "PUSH STATUS ERROR:",
      error
    );


    renderPushStatus(
      "disabled",
      "Press Enable Notifications to continue."
    );
  }
}


/* =========================================================
   ENABLE PUSH
========================================================= */

async function enablePushNotifications() {
  if (
    isIosDevice() &&
    !isStandaloneMode()
  ) {
    window.alert(
      "To enable ACL notifications on iPhone:\n\n" +
      "1. Open ACL in Safari.\n" +
      "2. Tap the Share button.\n" +
      "3. Tap Add to Home Screen.\n" +
      "4. Open ACL from the Home Screen.\n" +
      "5. Open Notifications and press Enable Notifications."
    );


    return;
  }


  if (!pushSupported()) {
    setStatus(
      "This browser does not support push notifications.",
      "error"
    );


    return;
  }


  if (!VAPID_PUBLIC_KEY) {
    setStatus(
      "The ACL VAPID public key is missing from config.js.",
      "warning"
    );


    return;
  }


  setButtonBusy(
    enablePushButton,
    true,
    "Enabling…",
    "Enable Notifications"
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
      if (
        permission ===
        "denied"
      ) {
        renderPushStatus(
          "blocked",
          "Permission was blocked."
        );


        setStatus(
          "Notification permission was blocked. Enable it from your browser or device settings.",
          "error"
        );
      } else {
        setStatus(
          "Notification permission was not granted.",
          "warning"
        );
      }


      return;
    }


    const registration =
      await getServiceWorkerRegistration();


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


    state.pushSubscription =
      subscription;


    try {
      await savePushSubscription(
        subscription
      );
    } catch (
      databaseError
    ) {
      console.error(
        "PUSH SUBSCRIPTION SAVE ERROR:",
        databaseError
      );


      renderPushStatus(
        "enabled",
        `${deviceLabel()} has browser permission, but ACL registration is incomplete.`
      );


      const errorCode =
        String(
          databaseError?.code ||
          ""
        ).trim();


      const errorMessage =
        String(
          databaseError?.message ||
          databaseError?.details ||
          "Unknown database error."
        ).trim();


      let userMessage =
        `Notification permission was enabled, but this device could not be registered with ACL: ${errorMessage}`;


      if (
        errorCode ===
        "42501"
      ) {
        userMessage =
          "Notification permission was enabled, but Supabase rejected the device registration. Sign out, sign in again, and retry. If it continues, review the push_subscriptions RLS policies.";
      } else if (
        errorCode ===
        "42P01"
      ) {
        userMessage =
          "The push_subscriptions database table could not be found.";
      } else if (
        errorCode ===
        "23505"
      ) {
        userMessage =
          "This browser subscription already exists but could not be updated. Refresh the page and try again.";
      } else if (
        /jwt|session|authenticated|auth/i.test(
          errorMessage
        )
      ) {
        userMessage =
          "Your ACL login session expired. Sign out, sign in again, then enable notifications.";
      }


      setStatus(
        userMessage,
        "error"
      );


      return;
    }


    renderPushStatus(
      "enabled",
      `${deviceLabel()} is registered.`
    );


    setStatus(
      "Push notifications enabled successfully on this device.",
      "success"
    );
  } catch (error) {
    console.error(
      "ENABLE PUSH ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Push notifications could not be enabled.",
      "error"
    );
  } finally {
    setButtonBusy(
      enablePushButton,
      false,
      "Enabling…",
      "Enable Notifications"
    );
  }
}


/* =========================================================
   DISABLE PUSH
========================================================= */

async function disablePushNotifications() {
  if (
    !state.pushSubscription
  ) {
    await checkPushStatus();


    return;
  }


  const confirmed =
    window.confirm(
      "Disable ACL push notifications on this device?"
    );


  if (!confirmed) {
    return;
  }


  setButtonBusy(
    disablePushButton,
    true,
    "Disabling…",
    "Disable"
  );


  try {
    const endpoint =
      state.pushSubscription
        .endpoint;


    await deactivatePushSubscription(
      endpoint
    );


    await state.pushSubscription
      .unsubscribe();


    state.pushSubscription =
      null;


    renderPushStatus(
      "disabled",
      deviceLabel()
    );


    setStatus(
      "Push notifications disabled on this device.",
      "success"
    );
  } catch (error) {
    console.error(
      "DISABLE PUSH ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Push notifications could not be disabled.",
      "error"
    );
  } finally {
    setButtonBusy(
      disablePushButton,
      false,
      "Disabling…",
      "Disable"
    );
  }
}


/* =========================================================
   TEST NOTIFICATION
========================================================= */

async function testPushNotification() {
  setButtonBusy(
    testPushButton,
    true,
    "Sending…",
    "Test Notification"
  );


  try {
    if (
      Notification.permission !==
      "granted"
    ) {
      throw new Error(
        "Notification permission has not been granted."
      );
    }


    const registration =
      await getServiceWorkerRegistration();


    await registration
      .showNotification(
        "ACL Notifications Enabled",
        {
          body:
            "This device is ready to receive Alexandria Cardiology League updates.",

          icon:
            "/Cardiology/assets/images/acl-icon-192.png",

          badge:
            "/Cardiology/assets/images/acl-icon-192.png",

          tag:
            "acl-notification-test",

          data: {
            url:
              aclUrl(
                "notifications.html",
                selectedEdition
              )
          }
        }
      );


    setStatus(
      "Test notification sent successfully.",
      "success"
    );
  } catch (error) {
    console.error(
      "TEST NOTIFICATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "The test notification could not be displayed.",
      "error"
    );
  } finally {
    setButtonBusy(
      testPushButton,
      false,
      "Sending…",
      "Test Notification"
    );
  }
}


/* =========================================================
   LOAD IN-SITE NOTIFICATIONS
========================================================= */

async function loadNotifications() {
  if (!state.user) {
    return;
  }


  setStatus(
    "Loading notifications…"
  );


  setButtonBusy(
    refreshButton,
    true,
    "Refreshing…",
    "Refresh"
  );


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "notifications"
        )
        .select(
          "*"
        )
        .eq(
          "user_id",
          state.user.id
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    state.notifications =
      (
        data ||
        []
      ).filter(
        (notification) => {
          const notificationEdition =
            normalizeEdition(
              notification.edition
            );


          return (
            !notificationEdition ||
            notificationEdition ===
              selectedEdition
          );
        }
      );


    applyFilters();


    setStatus(
      ""
    );
  } catch (error) {
    console.error(
      "NOTIFICATIONS LOAD ERROR:",
      error
    );


    state.notifications =
      [];


    state.filteredNotifications =
      [];


    renderNotifications();
    renderSummary();


    setStatus(
      error?.code ===
        "42P01"
        ? "The notifications database table has not been created yet."
        : error.message ||
          "Notifications could not be loaded.",
      "error"
    );
  } finally {
    setButtonBusy(
      refreshButton,
      false,
      "Refreshing…",
      "Refresh"
    );
  }
}


/* =========================================================
   FILTERS AND SUMMARY
========================================================= */

function setCount(
  id,
  value
) {
  const target =
    el(
      id
    );


  if (target) {
    target.textContent =
      String(
        Number(
          value ||
          0
        )
      );
  }
}


function applyFilters() {
  const selectedReadFilter =
    readFilter?.value ||
    "all";


  const selectedTypeFilter =
    typeFilter?.value ||
    "all";


  state.filteredNotifications =
    state.notifications.filter(
      (notification) => {
        const isRead =
          Boolean(
            notification.is_read ||
            notification.read_at
          );


        const matchesRead =
          selectedReadFilter ===
            "all" ||
          (
            selectedReadFilter ===
              "read" &&
            isRead
          ) ||
          (
            selectedReadFilter ===
              "unread" &&
            !isRead
          );


        const notificationType =
          normalizeType(
            notification.notification_type ||
            notification.type
          );


        const matchesType =
          selectedTypeFilter ===
            "all" ||
          notificationType ===
            selectedTypeFilter;


        return (
          matchesRead &&
          matchesType
        );
      }
    );


  renderNotifications();
  renderSummary();
}


function renderSummary() {
  const unreadCount =
    state.notifications.filter(
      (notification) =>
        !notification.is_read &&
        !notification.read_at
    ).length;


  const challengeCount =
    state.notifications.filter(
      (notification) =>
        normalizeType(
          notification.notification_type ||
          notification.type
        ) ===
        "challenge"
    ).length;


  setCount(
    "notificationsTotalCount",
    state.notifications.length
  );


  setCount(
    "notificationsUnreadCount",
    unreadCount
  );


  setCount(
    "notificationsChallengeCount",
    challengeCount
  );


  if (markAllReadButton) {
    markAllReadButton.disabled =
      unreadCount ===
      0;
  }
}


/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotifications() {
  if (
    !notificationsList ||
    !emptyState
  ) {
    return;
  }


  if (
    !state.filteredNotifications.length
  ) {
    notificationsList.innerHTML =
      "";


    emptyState.hidden =
      false;


    return;
  }


  emptyState.hidden =
    true;


  notificationsList.innerHTML =
    state.filteredNotifications
      .map(
        notificationHtml
      )
      .join(
        ""
      );
}


function notificationHtml(
  notification
) {
  const notificationType =
    normalizeType(
      notification.notification_type ||
      notification.type
    );


  const isRead =
    Boolean(
      notification.is_read ||
      notification.read_at
    );


  const actionUrl =
    notificationActionUrl(
      notification
    );


  return `
    <article
      class="
        notification-item
        ${
          isRead
            ? "read"
            : "unread"
        }
      "
      data-notification-id="${escapeHtml(
        notification.id
      )}"
    >

      <div
        class="notification-icon"
        aria-hidden="true"
      >
        ${notificationIcon(
          notificationType
        )}
      </div>


      <div class="notification-content">

        <div class="notification-heading">

          <h2>
            ${escapeHtml(
              notification.title ||
              humanizeType(
                notificationType
              )
            )}
          </h2>


          ${
            !isRead
              ? `
                <span class="notification-unread-badge">
                  New
                </span>
              `
              : ""
          }

        </div>


        <p>
          ${escapeHtml(
            notification.message ||
            "You have a new ACL notification."
          )}
        </p>


        <div class="notification-meta">

          <span class="notification-category">
            ${escapeHtml(
              humanizeType(
                notificationType
              )
            )}
          </span>


          <span
            title="${escapeHtml(
              formatDateTime(
                notification.created_at
              )
            )}"
          >
            ${escapeHtml(
              relativeTime(
                notification.created_at
              ) ||
              formatDateTime(
                notification.created_at
              )
            )}
          </span>

        </div>

      </div>


      <div class="notification-actions">

        ${
          actionUrl
            ? `
              <a
                class="notification-action"
                href="${escapeHtml(
                  actionUrl
                )}"
                data-open-notification="${escapeHtml(
                  notification.id
                )}"
              >
                Open
              </a>
            `
            : ""
        }


        ${
          !isRead
            ? `
              <button
                class="notification-action"
                type="button"
                data-mark-notification-read="${escapeHtml(
                  notification.id
                )}"
              >
                Mark read
              </button>
            `
            : ""
        }


        <button
          class="
            notification-action
            notification-action-danger
          "
          type="button"
          data-delete-notification="${escapeHtml(
            notification.id
          )}"
        >
          Delete
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   UPDATE IN-SITE NOTIFICATIONS
========================================================= */

async function markNotificationRead(
  notificationId
) {
  const notification =
    state.notifications.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          notificationId
        )
    );


  if (
    !notification ||
    notification.is_read ||
    notification.read_at
  ) {
    return;
  }


  const readAt =
    new Date()
      .toISOString();


  const {
    error
  } =
    await supabaseClient
      .from(
        "notifications"
      )
      .update({
        is_read:
          true,

        read_at:
          readAt
      })
      .eq(
        "id",
        notificationId
      )
      .eq(
        "user_id",
        state.user.id
      );


  if (error) {
    throw error;
  }


  notification.is_read =
    true;


  notification.read_at =
    readAt;


  applyFilters();
}


async function markAllNotificationsRead() {
  const unreadIds =
    state.notifications
      .filter(
        (notification) =>
          !notification.is_read &&
          !notification.read_at
      )
      .map(
        (notification) =>
          notification.id
      );


  if (!unreadIds.length) {
    return;
  }


  setButtonBusy(
    markAllReadButton,
    true,
    "Updating…",
    "Mark all as read"
  );


  try {
    const readAt =
      new Date()
        .toISOString();


    const {
      error
    } =
      await supabaseClient
        .from(
          "notifications"
        )
        .update({
          is_read:
            true,

          read_at:
            readAt
        })
        .eq(
          "user_id",
          state.user.id
        )
        .in(
          "id",
          unreadIds
        );


    if (error) {
      throw error;
    }


    state.notifications.forEach(
      (notification) => {
        if (
          unreadIds.includes(
            notification.id
          )
        ) {
          notification.is_read =
            true;


          notification.read_at =
            readAt;
        }
      }
    );


    applyFilters();


    setStatus(
      "All notifications marked as read.",
      "success"
    );
  } catch (error) {
    setStatus(
      error.message ||
      "Notifications could not be updated.",
      "error"
    );
  } finally {
    setButtonBusy(
      markAllReadButton,
      false,
      "Updating…",
      "Mark all as read"
    );


    renderSummary();
  }
}


async function deleteNotification(
  notificationId
) {
  if (
    !window.confirm(
      "Delete this notification?"
    )
  ) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "notifications"
      )
      .delete()
      .eq(
        "id",
        notificationId
      )
      .eq(
        "user_id",
        state.user.id
      );


  if (error) {
    throw error;
  }


  state.notifications =
    state.notifications.filter(
      (notification) =>
        String(
          notification.id
        ) !==
        String(
          notificationId
        )
    );


  applyFilters();


  setStatus(
    "Notification deleted.",
    "success"
  );
}


/* =========================================================
   EVENTS
========================================================= */

enablePushButton
  ?.addEventListener(
    "click",
    enablePushNotifications
  );


disablePushButton
  ?.addEventListener(
    "click",
    disablePushNotifications
  );


testPushButton
  ?.addEventListener(
    "click",
    testPushNotification
  );


readFilter
  ?.addEventListener(
    "change",
    applyFilters
  );


typeFilter
  ?.addEventListener(
    "change",
    applyFilters
  );


refreshButton
  ?.addEventListener(
    "click",
    loadNotifications
  );


markAllReadButton
  ?.addEventListener(
    "click",
    markAllNotificationsRead
  );


document.addEventListener(
  "click",
  async (
    event
  ) => {
    const readButton =
      event.target.closest(
        "[data-mark-notification-read]"
      );


    if (readButton) {
      try {
        await markNotificationRead(
          readButton.dataset
            .markNotificationRead
        );
      } catch (error) {
        setStatus(
          error.message ||
          "The notification could not be updated.",
          "error"
        );
      }


      return;
    }


    const deleteButton =
      event.target.closest(
        "[data-delete-notification]"
      );


    if (deleteButton) {
      try {
        await deleteNotification(
          deleteButton.dataset
            .deleteNotification
        );
      } catch (error) {
        setStatus(
          error.message ||
          "The notification could not be deleted.",
          "error"
        );
      }


      return;
    }


    const openLink =
      event.target.closest(
        "[data-open-notification]"
      );


    if (openLink) {
      try {
        await markNotificationRead(
          openLink.dataset
            .openNotification
        );
      } catch (error) {
        console.warn(
          "OPEN NOTIFICATION ERROR:",
          error
        );
      }
    }
  }
);


/* =========================================================
   INITIALIZATION
========================================================= */

async function startNotificationsPage() {
  try {
    renderEdition();


    const profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
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
        "Please sign in to view notifications."
      );
    }


    state.user =
      data.user;


    state.profile =
      profile;


    if (pushDeviceLabel) {
      pushDeviceLabel.textContent =
        deviceLabel();
    }


    await Promise.allSettled([
      loadNotifications(),
      checkPushStatus()
    ]);
  } catch (error) {
    console.error(
      "NOTIFICATIONS INITIALIZATION ERROR:",
      error
    );


    renderPushStatus(
      "disabled",
      "Press Enable Notifications to continue."
    );


    setStatus(
      error.message ||
      "Notifications could not be initialized.",
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
    startNotificationsPage,
    {
      once:
        true
    }
  );
} else {
  void startNotificationsPage();
}
