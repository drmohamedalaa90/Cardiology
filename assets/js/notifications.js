import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender,
  resolveAclEdition,
  aclUrl
} from "./session-ui.js?v=4.6.0";


console.log(
  "ACL NOTIFICATIONS v1.0.0 LOADED"
);


/* =========================================================
   PAGE STATE
========================================================= */

const selectedEdition =
  resolveAclEdition();


const state = {
  user: null,
  profile: null,
  notifications: [],
  filteredNotifications: []
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


/* =========================================================
   TEXT HELPERS
========================================================= */

function escapeHtml(
  value = ""
) {
  return String(
    value
  ).replace(
    /[&<>'"]/g,
    (character) =>
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


  const validTypes =
    new Set([
      "challenge",
      "competition",
      "module",
      "achievement",
      "announcement",
      "system"
    ]);


  return validTypes.has(
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


  return (
    edition ===
      "basic" ||
    edition ===
      "expert"
  )
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


  const differenceMilliseconds =
    date.getTime() -
    Date.now();


  const absoluteMilliseconds =
    Math.abs(
      differenceMilliseconds
    );


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
    absoluteMilliseconds <
    hour
  ) {
    return formatter.format(
      Math.round(
        differenceMilliseconds /
        minute
      ),
      "minute"
    );
  }


  if (
    absoluteMilliseconds <
    day
  ) {
    return formatter.format(
      Math.round(
        differenceMilliseconds /
        hour
      ),
      "hour"
    );
  }


  return formatter.format(
    Math.round(
      differenceMilliseconds /
      day
    ),
    "day"
  );
}


/* =========================================================
   STATUS
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
    `notifications-status ${kind}`.trim();


  statusBox.hidden =
    !message;
}


/* =========================================================
   EDITION DISPLAY
========================================================= */

function renderEdition() {
  const isBasic =
    selectedEdition ===
    "basic";


  document.body.classList.remove(
    "acl-theme-basic",
    "acl-theme-expert"
  );


  document.body.classList.add(
    isBasic
      ? "acl-theme-basic"
      : "acl-theme-expert"
  );


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
   NOTIFICATION ICONS
========================================================= */

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


/* =========================================================
   SAFE ACTION LINK
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
    )
      .trim();


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
   LOAD NOTIFICATIONS
========================================================= */

async function loadNotifications() {
  if (!state.user) {
    return;
  }


  setStatus(
    "Loading notifications…"
  );


  if (refreshButton) {
    refreshButton.disabled =
      true;


    refreshButton.textContent =
      "Refreshing…";
  }


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "notifications"
        )
        .select(`
          id,
          user_id,
          title,
          message,
          notification_type,
          type,
          edition,
          is_read,
          read_at,
          action_url,
          link_url,
          target_url,
          metadata,
          created_at,
          updated_at
        `)
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


          /*
           * Global notifications without an edition appear
           * in both pathways.
           */

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


    if (
      error?.code ===
        "42P01" ||
      String(
        error?.message ||
        ""
      )
        .toLowerCase()
        .includes(
          "notifications"
        )
    ) {
      setStatus(
        "The notifications database table has not been created yet.",
        "error"
      );
    } else {
      setStatus(
        error.message ||
        "Notifications could not be loaded.",
        "error"
      );
    }
  } finally {
    if (refreshButton) {
      refreshButton.disabled =
        false;


      refreshButton.textContent =
        "Refresh";
    }
  }
}


/* =========================================================
   FILTER NOTIFICATIONS
========================================================= */

function applyFilters() {
  const selectedReadFilter =
    readFilter
      ?.value ||
    "all";


  const selectedTypeFilter =
    typeFilter
      ?.value ||
    "all";


  state.filteredNotifications =
    state.notifications.filter(
      (notification) => {
        const isRead =
          Boolean(
            notification.is_read ||
            notification.read_at
          );


        const matchesReadStatus =
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
          matchesReadStatus &&
          matchesType
        );
      }
    );


  renderNotifications();
  renderSummary();
}


/* =========================================================
   RENDER SUMMARY
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


/* =========================================================
   NOTIFICATION HTML
========================================================= */

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


  const title =
    notification.title ||
    humanizeType(
      notificationType
    );


  const message =
    notification.message ||
    "You have a new ACL notification.";


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
              title
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
            message
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
   MARK ONE AS READ
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


/* =========================================================
   MARK ALL AS READ
========================================================= */

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


  if (markAllReadButton) {
    markAllReadButton.disabled =
      true;


    markAllReadButton.textContent =
      "Updating…";
  }


  setStatus(
    "Marking notifications as read…"
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
    console.error(
      "MARK ALL NOTIFICATIONS ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Notifications could not be updated.",
      "error"
    );
  } finally {
    if (markAllReadButton) {
      markAllReadButton.textContent =
        "Mark all as read";


      renderSummary();
    }
  }
}


/* =========================================================
   DELETE NOTIFICATION
========================================================= */

async function deleteNotification(
  notificationId
) {
  const confirmed =
    window.confirm(
      "Delete this notification?"
    );


  if (!confirmed) {
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
   DELEGATED CLICK EVENTS
========================================================= */

document.addEventListener(
  "click",
  async (event) => {
    const readButton =
      event.target.closest(
        "[data-mark-notification-read]"
      );


    if (readButton) {
      const notificationId =
        readButton.dataset
          .markNotificationRead;


      readButton.disabled =
        true;


      try {
        await markNotificationRead(
          notificationId
        );
      } catch (error) {
        console.error(
          "MARK NOTIFICATION READ ERROR:",
          error
        );


        setStatus(
          error.message ||
          "The notification could not be updated.",
          "error"
        );


        readButton.disabled =
          false;
      }


      return;
    }


    const deleteButton =
      event.target.closest(
        "[data-delete-notification]"
      );


    if (deleteButton) {
      const notificationId =
        deleteButton.dataset
          .deleteNotification;


      deleteButton.disabled =
        true;


      try {
        await deleteNotification(
          notificationId
        );
      } catch (error) {
        console.error(
          "DELETE NOTIFICATION ERROR:",
          error
        );


        setStatus(
          error.message ||
          "The notification could not be deleted.",
          "error"
        );


        deleteButton.disabled =
          false;
      }


      return;
    }


    const openLink =
      event.target.closest(
        "[data-open-notification]"
      );


    if (openLink) {
      const notificationId =
        openLink.dataset
          .openNotification;


      try {
        await markNotificationRead(
          notificationId
        );
      } catch (error) {
        console.warn(
          "OPEN NOTIFICATION READ ERROR:",
          error
        );
      }
    }
  }
);


/* =========================================================
   FILTER EVENTS
========================================================= */

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


/* =========================================================
   START PAGE
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


    await loadNotifications();
  } catch (error) {
    console.error(
      "NOTIFICATIONS INITIALIZATION ERROR:",
      error
    );


    setStatus(
      error.message ||
      "Notifications could not be initialized.",
      "error"
    );
  }
}


void startNotificationsPage();
