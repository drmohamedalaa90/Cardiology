<!doctype html>

<html lang="en">

<head>

  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta
    name="referrer"
    content="strict-origin-when-cross-origin"
  >

  <meta
    id="notificationsThemeColor"
    name="theme-color"
    content="#123f72"
  >

  <title>
    Notifications | Alexandria Cardiology League
  </title>


  <link
    rel="stylesheet"
    href="assets/css/main.css?v=5.0.1"
  >


  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>


  <script>
    (() => {
      const parameters =
        new URLSearchParams(
          window.location.search
        );


      const requestedEdition =
        String(
          parameters.get("edition") || ""
        )
          .trim()
          .toLowerCase();


      const storedEdition =
        String(
          localStorage.getItem(
            "aclSelectedEdition"
          ) || ""
        )
          .trim()
          .toLowerCase();


      const edition =
        requestedEdition === "basic" ||
        requestedEdition === "expert"
          ? requestedEdition
          : storedEdition === "basic" ||
            storedEdition === "expert"
            ? storedEdition
            : "expert";


      localStorage.setItem(
        "aclSelectedEdition",
        edition
      );


      document.documentElement.classList.add(
        edition === "basic"
          ? "acl-notifications-basic"
          : "acl-notifications-expert"
      );


      if (!parameters.get("edition")) {
        const updatedUrl =
          new URL(
            window.location.href
          );


        updatedUrl.searchParams.set(
          "edition",
          edition
        );


        window.history.replaceState(
          {},
          "",
          updatedUrl
        );
      }
    })();
  </script>


  <style>
    :root {
      --notifications-primary: #123f72;
      --notifications-secondary: #176aa1;
      --notifications-soft: #eaf5ff;
      --notifications-soft-2: #f7fbff;
      --notifications-accent: #ffc928;
      --notifications-success: #168067;
      --notifications-danger: #b33443;
      --notifications-warning: #b97a00;
      --notifications-text: #17324d;
      --notifications-muted: #687d90;
      --notifications-border: #d9e6f2;
      --notifications-card: #ffffff;
      --notifications-shadow:
        0 18px 45px
        rgba(18, 63, 114, 0.12);
    }


    html.acl-notifications-basic {
      --notifications-primary: #105541;
      --notifications-secondary: #168067;
      --notifications-soft: #eaf8f2;
      --notifications-soft-2: #f8fcfa;
      --notifications-text: #173e34;
      --notifications-shadow:
        0 18px 45px
        rgba(16, 85, 65, 0.12);
    }


    * {
      box-sizing: border-box;
    }


    html,
    body {
      min-height: 100%;
    }


    body {
      margin: 0;
      padding-top: 92px;

      color:
        var(--notifications-text);

      background:
        radial-gradient(
          circle at 10% 6%,
          rgba(255, 201, 40, 0.13),
          transparent 24rem
        ),
        radial-gradient(
          circle at 92% 8%,
          color-mix(
            in srgb,
            var(--notifications-secondary) 12%,
            transparent
          ),
          transparent 28rem
        ),
        linear-gradient(
          145deg,
          #ffffff,
          var(--notifications-soft)
        );
    }


    button,
    select,
    input {
      font: inherit;
    }


    .topbar.acl-header-pending {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }


    .topbar.acl-unified-header {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }


    .notifications-shell {
      width:
        min(
          1120px,
          calc(100% - 28px)
        );

      margin: 0 auto;
      padding: 30px 0 60px;
    }


    /* =====================================================
       HERO
    ===================================================== */

    .notifications-hero {
      position: relative;
      overflow: hidden;

      padding:
        clamp(
          28px,
          5vw,
          48px
        );

      border-radius: 28px;

      color: #ffffff;

      background:
        linear-gradient(
          125deg,
          var(--notifications-primary),
          var(--notifications-secondary)
        );

      box-shadow:
        var(--notifications-shadow);
    }


    .notifications-hero::after {
      content: "🔔";

      position: absolute;
      top: 50%;
      right: 5%;

      transform:
        translateY(-50%)
        rotate(-8deg);

      opacity: 0.11;

      font-size:
        clamp(
          110px,
          20vw,
          220px
        );

      pointer-events: none;
    }


    .notifications-hero-content {
      position: relative;
      z-index: 1;

      max-width: 760px;
    }


    .notifications-hero-top {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }


    .notifications-kicker,
    .notifications-edition-badge {
      display: inline-flex;
      align-items: center;

      min-height: 31px;
      padding: 7px 12px;

      border:
        1px solid
        rgba(255, 255, 255, 0.3);

      border-radius: 999px;

      color: #ffffff;

      background:
        rgba(255, 255, 255, 0.12);

      font-size: 0.74rem;
      font-weight: 900;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }


    .notifications-edition-badge {
      background:
        rgba(255, 255, 255, 0.21);
    }


    .notifications-hero h1 {
      margin: 15px 0 10px;

      color: #ffffff;

      font-size:
        clamp(
          2.3rem,
          6vw,
          4rem
        );

      line-height: 1;
    }


    .notifications-hero p {
      margin: 0;

      color:
        rgba(255, 255, 255, 0.88);

      font-size:
        clamp(
          0.98rem,
          2vw,
          1.08rem
        );

      line-height: 1.65;
    }


    /* =====================================================
       PUSH NOTIFICATION CARD
    ===================================================== */

    .push-card {
      display: grid;

      grid-template-columns:
        minmax(0, 1fr)
        auto;

      gap: 18px;
      align-items: center;

      margin-top: 20px;
      padding: 21px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 20px;

      background:
        rgba(255, 255, 255, 0.98);

      box-shadow:
        0 12px 30px
        rgba(18, 63, 114, 0.07);
    }


    .push-card-title {
      display: flex;
      align-items: flex-start;
      gap: 13px;
    }


    .push-card-icon {
      display: grid;
      place-items: center;

      width: 50px;
      min-width: 50px;
      height: 50px;

      border-radius: 15px;

      color: #ffffff;

      background:
        linear-gradient(
          135deg,
          var(--notifications-primary),
          var(--notifications-secondary)
        );

      font-size: 1.25rem;
    }


    .push-card h2 {
      margin: 0;

      color:
        var(--notifications-primary);

      font-size: 1.15rem;
    }


    .push-card p {
      margin: 6px 0 0;

      color:
        var(--notifications-muted);

      font-size: 0.84rem;
      line-height: 1.55;
    }


    .push-status-line {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;

      margin-top: 11px;
    }


    .push-status-badge {
      display: inline-flex;
      align-items: center;

      min-height: 28px;
      padding: 5px 10px;

      border-radius: 999px;

      color:
        var(--notifications-primary);

      background:
        var(--notifications-soft);

      font-size: 0.69rem;
      font-weight: 900;
      text-transform: uppercase;
    }


    .push-status-badge.enabled {
      color: #ffffff;

      background:
        var(--notifications-success);
    }


    .push-status-badge.blocked {
      color: #ffffff;

      background:
        var(--notifications-danger);
    }


    .push-status-badge.warning {
      color: #765000;

      background: #fff0bf;
    }


    .push-device-label {
      color:
        var(--notifications-muted);

      font-size: 0.74rem;
    }


    .push-actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 9px;
    }


    /* =====================================================
       SUMMARY
    ===================================================== */

    .notifications-summary {
      display: grid;

      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );

      gap: 16px;
      margin-top: 20px;
    }


    .notifications-summary-card {
      padding: 20px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 19px;

      background:
        rgba(255, 255, 255, 0.97);

      box-shadow:
        0 12px 30px
        rgba(18, 63, 114, 0.07);
    }


    .notifications-summary-card span {
      display: block;

      color:
        var(--notifications-muted);

      font-size: 0.76rem;
      font-weight: 850;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }


    .notifications-summary-card strong {
      display: block;
      margin-top: 9px;

      color:
        var(--notifications-primary);

      font-size: 2.2rem;
      font-weight: 950;
      line-height: 1;
    }


    /* =====================================================
       CONTROLS
    ===================================================== */

    .notifications-toolbar {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;

      margin-top: 20px;
      padding: 17px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 19px;

      background:
        rgba(255, 255, 255, 0.96);

      box-shadow:
        0 12px 30px
        rgba(18, 63, 114, 0.07);
    }


    .notifications-filters {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 11px;
    }


    .notifications-field {
      display: grid;
      gap: 6px;
    }


    .notifications-field label {
      color:
        var(--notifications-muted);

      font-size: 0.72rem;
      font-weight: 850;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }


    .notifications-field select {
      min-width: 155px;
      min-height: 43px;
      padding: 9px 12px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 11px;

      color:
        var(--notifications-text);

      background: #ffffff;

      font-weight: 750;
    }


    .notifications-toolbar-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 9px;
    }


    .notifications-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      min-height: 43px;
      padding: 9px 15px;

      border: 0;
      border-radius: 11px;

      cursor: pointer;

      font-weight: 900;
    }


    .notifications-button-primary {
      color: #ffffff;

      background:
        linear-gradient(
          135deg,
          var(--notifications-primary),
          var(--notifications-secondary)
        );
    }


    .notifications-button-secondary {
      border:
        1px solid
        var(--notifications-border);

      color:
        var(--notifications-primary);

      background: #ffffff;
    }


    .notifications-button-danger {
      border: 1px solid #f0c6cc;

      color:
        var(--notifications-danger);

      background: #fff5f6;
    }


    .notifications-button:disabled {
      cursor: wait;
      opacity: 0.65;
    }


    /* =====================================================
       STATUS
    ===================================================== */

    .notifications-status {
      margin-top: 15px;
      padding: 14px 16px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 13px;

      color:
        var(--notifications-muted);

      background: #ffffff;

      font-weight: 750;
    }


    .notifications-status.error {
      border-color: #f0c6cc;

      color:
        var(--notifications-danger);

      background: #fff5f6;
    }


    .notifications-status.success {
      border-color: #bfe7d6;

      color:
        var(--notifications-success);

      background: #f2fbf7;
    }


    .notifications-status.warning {
      border-color: #f4d8a2;

      color:
        var(--notifications-warning);

      background: #fffaf0;
    }


    /* =====================================================
       LIST
    ===================================================== */

    .notifications-list {
      display: grid;
      gap: 13px;

      margin-top: 18px;
    }


    .notification-item {
      position: relative;

      display: grid;

      grid-template-columns:
        auto
        minmax(0, 1fr)
        auto;

      gap: 15px;
      align-items: flex-start;

      padding: 18px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 18px;

      background:
        rgba(255, 255, 255, 0.98);

      box-shadow:
        0 10px 28px
        rgba(18, 63, 114, 0.06);
    }


    .notification-item.unread {
      border-color:
        color-mix(
          in srgb,
          var(--notifications-secondary) 40%,
          white
        );

      background:
        linear-gradient(
          145deg,
          #ffffff,
          var(--notifications-soft-2)
        );
    }


    .notification-item.unread::before {
      content: "";

      position: absolute;
      top: 16px;
      left: 0;

      width: 4px;
      height:
        calc(100% - 32px);

      border-radius:
        0 6px 6px 0;

      background:
        var(--notifications-secondary);
    }


    .notification-icon {
      display: grid;
      place-items: center;

      width: 46px;
      min-width: 46px;
      height: 46px;

      border-radius: 14px;

      color: #ffffff;

      background:
        linear-gradient(
          135deg,
          var(--notifications-primary),
          var(--notifications-secondary)
        );

      font-size: 1.12rem;
    }


    .notification-heading {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }


    .notification-heading h2 {
      margin: 0;

      color:
        var(--notifications-primary);

      font-size: 1rem;
    }


    .notification-unread-badge {
      display: inline-flex;
      align-items: center;

      padding: 4px 8px;

      border-radius: 999px;

      color: #ffffff;

      background:
        var(--notifications-secondary);

      font-size: 0.65rem;
      font-weight: 900;
      text-transform: uppercase;
    }


    .notification-content p {
      margin: 7px 0 0;

      color:
        var(--notifications-muted);

      font-size: 0.88rem;
      line-height: 1.55;
    }


    .notification-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;

      margin-top: 10px;

      color:
        var(--notifications-muted);

      font-size: 0.74rem;
    }


    .notification-category {
      display: inline-flex;
      align-items: center;

      padding: 5px 9px;

      border-radius: 999px;

      color:
        var(--notifications-primary);

      background:
        var(--notifications-soft);

      font-weight: 850;
      text-transform: capitalize;
    }


    .notification-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 7px;
    }


    .notification-action {
      min-height: 36px;
      padding: 7px 11px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 10px;

      color:
        var(--notifications-primary);

      background: #ffffff;

      cursor: pointer;

      font-size: 0.75rem;
      font-weight: 850;
      text-decoration: none;
    }


    .notification-action-danger {
      color:
        var(--notifications-danger);
    }


    /* =====================================================
       EMPTY AND FOOTER
    ===================================================== */

    .notifications-empty {
      margin-top: 18px;
      padding: 50px 20px;

      border:
        1px dashed
        var(--notifications-border);

      border-radius: 20px;

      color:
        var(--notifications-muted);

      background:
        rgba(255, 255, 255, 0.9);

      text-align: center;
    }


    .notifications-empty-icon {
      display: grid;
      place-items: center;

      width: 66px;
      height: 66px;

      margin: 0 auto 14px;

      border-radius: 20px;

      color: #ffffff;

      background:
        linear-gradient(
          135deg,
          var(--notifications-primary),
          var(--notifications-secondary)
        );

      font-size: 1.6rem;
    }


    .notifications-empty h2 {
      margin: 0;

      color:
        var(--notifications-primary);
    }


    .notifications-empty p {
      margin: 8px 0 0;
      line-height: 1.55;
    }


    .notifications-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;

      margin-top: 22px;
    }


    .notifications-footer p {
      margin: 0;

      color:
        var(--notifications-muted);

      font-size: 0.76rem;
    }


    .notifications-footer-links {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }


    .notifications-footer-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      min-height: 40px;
      padding: 8px 13px;

      border:
        1px solid
        var(--notifications-border);

      border-radius: 10px;

      color:
        var(--notifications-primary);

      background: #ffffff;

      font-size: 0.78rem;
      font-weight: 850;
      text-decoration: none;
    }


    [hidden] {
      display: none !important;
    }


    @media (max-width: 760px) {
      body {
        padding-top: 82px;
      }


      .notifications-shell {
        width:
          min(
            calc(100% - 18px),
            1120px
          );

        padding-top: 18px;
      }


      .push-card {
        grid-template-columns: 1fr;
      }


      .push-actions {
        justify-content: flex-start;
      }


      .notifications-summary {
        grid-template-columns: 1fr;
      }


      .notifications-toolbar {
        align-items: stretch;
        flex-direction: column;
      }


      .notifications-filters {
        display: grid;
        grid-template-columns: 1fr;
      }


      .notifications-field select {
        width: 100%;
        min-width: 0;
      }


      .notifications-toolbar-actions {
        width: 100%;
      }


      .notifications-toolbar-actions button {
        flex: 1;
      }


      .notification-item {
        grid-template-columns:
          auto
          minmax(0, 1fr);
      }


      .notification-actions {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }


    @media (max-width: 480px) {
      .push-actions,
      .notifications-toolbar-actions {
        display: grid;
        grid-template-columns: 1fr;
      }


      .push-actions button,
      .notifications-toolbar-actions button {
        width: 100%;
      }


      .notification-item {
        grid-template-columns: 1fr;
      }


      .notification-actions {
        grid-column: auto;
      }
    }
  </style>

</head>


<body>

  <header class="topbar acl-header-pending">

    <a
      class="brand brand-link"
      href="pathways.html"
      aria-label="Alexandria Cardiology League"
    >
      Alexandria Cardiology League
    </a>


    <nav aria-label="Main navigation">

      <a
        id="userChip"
        class="user-chip"
        href="profile.html"
        aria-label="Open profile"
      ></a>

    </nav>

  </header>


  <main class="notifications-shell">

    <section class="notifications-hero">

      <div class="notifications-hero-content">

        <div class="notifications-hero-top">

          <span class="notifications-kicker">
            ACL UPDATES
          </span>


          <span
            id="notificationsEditionBadge"
            class="notifications-edition-badge"
          >
            EDITION
          </span>

        </div>


        <h1>
          Notifications
        </h1>


        <p>
          Receive official ACL announcements, competition reminders,
          challenge invitations, module updates, and achievement alerts.
        </p>

      </div>

    </section>


    <section
      class="push-card"
      aria-labelledby="pushNotificationsTitle"
    >

      <div class="push-card-title">

        <div
          class="push-card-icon"
          aria-hidden="true"
        >
          🔔
        </div>


        <div>

          <h2 id="pushNotificationsTitle">
            Phone push notifications
          </h2>


          <p id="pushNotificationsDescription">
            Enable ACL alerts on this iPhone, Android phone, tablet,
            or computer.
          </p>


          <div class="push-status-line">

            <span
              id="pushStatusBadge"
              class="push-status-badge"
            >
              Checking…
            </span>


            <span
              id="pushDeviceLabel"
              class="push-device-label"
            ></span>

          </div>

        </div>

      </div>


      <div class="push-actions">

        <button
          id="enablePushNotifications"
          class="
            notifications-button
            notifications-button-primary
          "
          type="button"
        >
          Enable Notifications
        </button>


        <button
          id="testPushNotification"
          class="
            notifications-button
            notifications-button-secondary
          "
          type="button"
          hidden
        >
          Test Notification
        </button>


        <button
          id="disablePushNotifications"
          class="
            notifications-button
            notifications-button-danger
          "
          type="button"
          hidden
        >
          Disable
        </button>

      </div>

    </section>


    <section
      class="notifications-summary"
      aria-label="Notification summary"
    >

      <article class="notifications-summary-card">

        <span>
          Total notifications
        </span>

        <strong id="notificationsTotalCount">
          —
        </strong>

      </article>


      <article class="notifications-summary-card">

        <span>
          Unread
        </span>

        <strong id="notificationsUnreadCount">
          —
        </strong>

      </article>


      <article class="notifications-summary-card">

        <span>
          Challenge invitations
        </span>

        <strong id="notificationsChallengeCount">
          —
        </strong>

      </article>

    </section>


    <section
      class="notifications-toolbar"
      aria-label="Notification controls"
    >

      <div class="notifications-filters">

        <div class="notifications-field">

          <label for="notificationsReadFilter">
            Status
          </label>

          <select id="notificationsReadFilter">

            <option value="all">
              All notifications
            </option>

            <option value="unread">
              Unread only
            </option>

            <option value="read">
              Read only
            </option>

          </select>

        </div>


        <div class="notifications-field">

          <label for="notificationsTypeFilter">
            Type
          </label>

          <select id="notificationsTypeFilter">

            <option value="all">
              All types
            </option>

            <option value="challenge">
              Challenge
            </option>

            <option value="competition">
              Competition
            </option>

            <option value="module">
              Module
            </option>

            <option value="achievement">
              Achievement
            </option>

            <option value="announcement">
              Announcement
            </option>

            <option value="system">
              System
            </option>

          </select>

        </div>

      </div>


      <div class="notifications-toolbar-actions">

        <button
          id="markAllNotificationsRead"
          class="
            notifications-button
            notifications-button-secondary
          "
          type="button"
        >
          Mark all as read
        </button>


        <button
          id="refreshNotifications"
          class="
            notifications-button
            notifications-button-primary
          "
          type="button"
        >
          Refresh
        </button>

      </div>

    </section>


    <div
      id="notificationsStatus"
      class="notifications-status"
      role="status"
      aria-live="polite"
    >
      Loading notifications…
    </div>


    <section
      id="notificationsList"
      class="notifications-list"
      aria-label="Notifications"
    ></section>


    <section
      id="notificationsEmptyState"
      class="notifications-empty"
      hidden
    >

      <div
        class="notifications-empty-icon"
        aria-hidden="true"
      >
        ✉
      </div>


      <h2>
        No notifications found
      </h2>


      <p>
        New ACL updates, invitations, and achievements will appear here.
      </p>

    </section>


    <footer class="notifications-footer">

      <p>
        Notifications are private and visible only to your ACL account.
      </p>


      <div class="notifications-footer-links">

        <a
          id="notificationsModulesLink"
          class="notifications-footer-link"
          href="modules.html"
        >
          Modules
        </a>


        <a
          id="notificationsProgressLink"
          class="notifications-footer-link"
          href="progress.html"
        >
          My Progress
        </a>


        <a
          class="notifications-footer-link"
          href="pathways.html"
        >
          Switch Edition
        </a>

      </div>

    </footer>

  </main>


  <script
    type="module"
    src="assets/js/notifications.js?v=2.0.0"
  ></script>


  <script
    type="module"
    src="assets/js/pwa.js?v=1.7.0"
  ></script>

</body>

</html>
