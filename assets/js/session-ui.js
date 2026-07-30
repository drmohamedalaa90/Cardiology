import {
  supabaseClient
} from "./supabase-client.js";


console.log(
  "ACL SESSION UI v4.7.0 LOADED"
);


/* =========================================================
   CONSTANTS
========================================================= */

const ACL_VALID_EDITIONS =
  new Set([
    "basic",
    "expert"
  ]);


/* =========================================================
   PATH HELPERS
========================================================= */

function nestedPath(
  file
) {
  return window.location.pathname.includes(
    "/modules/"
  )
    ? `../../${file}`
    : file;
}


function isValidEdition(
  edition
) {
  return ACL_VALID_EDITIONS.has(
    String(
      edition ||
      ""
    )
      .trim()
      .toLowerCase()
  );
}


/* =========================================================
   ACTIVE EDITION
========================================================= */

function getActiveAclEdition() {
  const parameters =
    new URLSearchParams(
      window.location.search
    );


  const urlEdition =
    String(
      parameters.get(
        "edition"
      ) ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    isValidEdition(
      urlEdition
    )
  ) {
    localStorage.setItem(
      "aclSelectedEdition",
      urlEdition
    );


    return urlEdition;
  }


  const savedEdition =
    String(
      localStorage.getItem(
        "aclSelectedEdition"
      ) ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    isValidEdition(
      savedEdition
    )
  ) {
    return savedEdition;
  }


  return null;
}


/* =========================================================
   EDITION HELPERS
========================================================= */

export function resolveAclEdition({
  requireEdition = true,
  updateUrl = true
} = {}) {
  const parameters =
    new URLSearchParams(
      window.location.search
    );


  let edition =
    String(
      parameters.get(
        "edition"
      ) ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    !isValidEdition(
      edition
    )
  ) {
    edition =
      String(
        localStorage.getItem(
          "aclSelectedEdition"
        ) ||
        ""
      )
        .trim()
        .toLowerCase();
  }


  if (
    !isValidEdition(
      edition
    )
  ) {
    if (requireEdition) {
      window.location.replace(
        nestedPath(
          "pathways.html"
        )
      );
    }


    return null;
  }


  localStorage.setItem(
    "aclSelectedEdition",
    edition
  );


  document.body.classList.remove(
    "acl-theme-basic",
    "acl-theme-expert",
    "acl-neutral-auth-page"
  );


  document.body.classList.add(
    edition === "basic"
      ? "acl-theme-basic"
      : "acl-theme-expert"
  );


  if (
    updateUrl &&
    !parameters.get(
      "edition"
    )
  ) {
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


  return edition;
}


export function aclUrl(
  path,
  edition
) {
  const resolvedEdition =
    isValidEdition(
      edition
    )
      ? String(
          edition
        )
          .trim()
          .toLowerCase()
      : getActiveAclEdition();


  const url =
    new URL(
      path,
      window.location.href
    );


  if (
    resolvedEdition
  ) {
    url.searchParams.set(
      "edition",
      resolvedEdition
    );
  }


  if (
    url.origin ===
    window.location.origin
  ) {
    return (
      `${url.pathname}` +
      `${url.search}` +
      `${url.hash}`
    );
  }


  return url.toString();
}


function editionAwarePath(
  file
) {
  const path =
    nestedPath(
      file
    );


  if (
    file === "pathways.html" ||
    file === "login.html" ||
    file === "admin.html"
  ) {
    return path;
  }


  const edition =
    getActiveAclEdition();


  if (!edition) {
    return path;
  }


  return aclUrl(
    path,
    edition
  );
}


/* =========================================================
   SESSION
========================================================= */

export async function requireSession(
  relativeLogin = "login.html"
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getSession();


  if (
    error ||
    !data?.session
  ) {
    window.location.replace(
      nestedPath(
        relativeLogin
      )
    );


    return null;
  }


  return data.session;
}


/* =========================================================
   PROFILE
========================================================= */

export async function loadProfile() {
  const {
    data: sessionData,
    error: sessionError
  } =
    await supabaseClient
      .auth
      .getSession();


  if (sessionError) {
    throw sessionError;
  }


  const user =
    sessionData
      ?.session
      ?.user;


  if (!user) {
    return null;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "profiles"
      )
      .select(
        "*"
      )
      .eq(
        "id",
        user.id
      )
      .single();


  if (error) {
    throw error;
  }


  const metadata =
    user.user_metadata ||
    {};


  const displayName =
    data?.display_name ||
    data?.full_name ||
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    data?.username ||
    user.email ||
    "ACL User";


  return {
    ...data,

    email:
      user.email,

    display_name:
      displayName,

    full_name:
      data?.full_name ||
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      displayName,

    avatar_url:
      data?.avatar_url ||
      metadata.avatar_url ||
      metadata.picture ||
      metadata.photo_url ||
      ""
  };
}


/* =========================================================
   USER CHIP
========================================================= */

export function renderUserChip(
  profile
) {
  const chip =
    document.getElementById(
      "userChip"
    );


  if (
    !chip ||
    !profile
  ) {
    return;
  }


  const displayName =
    profile.display_name ||
    profile.full_name ||
    profile.username ||
    "ACL User";


  const initials =
    displayName
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
    "U";


  chip.href =
    editionAwarePath(
      "profile.html"
    );


  chip.innerHTML =
    profile.avatar_url
      ? `
        <img
          src="${profile.avatar_url}"
          alt=""
        >

        <span class="user-chip-copy">

          <span class="user-name">
            ${displayName}
          </span>

          <span class="edit-profile-link">
            / Edit profile
          </span>

        </span>
      `
      : `
        <span class="avatar-placeholder">
          ${initials}
        </span>

        <span class="user-chip-copy">

          <span class="user-name">
            ${displayName}
          </span>

          <span class="edit-profile-link">
            / Edit profile
          </span>

        </span>
      `;
}


/* =========================================================
   ADMIN STATUS
========================================================= */

async function applyAdminStatus(
  profile
) {
  if (!profile) {
    return null;
  }


  try {
    const {
      data: rpcAdmin,
      error: rpcAdminError
    } =
      await supabaseClient
        .rpc(
          "acl_is_admin"
        );


    if (
      !rpcAdminError &&
      rpcAdmin === true
    ) {
      profile.role =
        "admin";

      profile.is_admin =
        true;


      return profile;
    }
  } catch (error) {
    console.warn(
      "Could not verify ACL administrator status:",
      error
    );
  }


  profile.is_admin =
    profile?.role ===
      "admin" ||
    profile?.role ===
      "administrator";


  if (
    profile.is_admin
  ) {
    profile.role =
      "admin";
  }


  return profile;
}


/* =========================================================
   PAGE PROTECTION
========================================================= */

export async function protectAndRender(
  relativeLogin = "login.html"
) {
  const session =
    await requireSession(
      relativeLogin
    );


  if (!session) {
    return null;
  }


  let profile =
    await loadProfile();


  if (!profile) {
    await supabaseClient
      .auth
      .signOut();


    window.location.replace(
      nestedPath(
        relativeLogin
      )
    );


    return null;
  }


  profile =
    await applyAdminStatus(
      profile
    );


  if (
    profile.account_status ===
    "suspended"
  ) {
    await supabaseClient
      .auth
      .signOut();


    window.alert(
      "This account has been suspended. Contact the ACL administrator."
    );


    window.location.replace(
      nestedPath(
        relativeLogin
      )
    );


    return null;
  }


  window.aclCurrentProfile =
    profile;


  renderUserChip(
    profile
  );


  buildUnifiedHeader();


  return profile;
}


/* =========================================================
   SIGN OUT
========================================================= */

export async function signOut() {
  await supabaseClient
    .auth
    .signOut();


  window.location.replace(
    nestedPath(
      "login.html"
    )
  );
}


window.aclSignOut =
  signOut;


/* =========================================================
   ICONS
========================================================= */

const iconSvgs = {
  menu: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16"/>
    </svg>
  `,

  close: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18"/>
    </svg>
  `,

  admin: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `,

  profile: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
      />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>
    </svg>
  `,

  settings: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      />
      <path
        d="M19.4 13.5c.1-.5.1-1 0-1.5l2-1.6-2-3.5-2.5 1a8 8 0 0 0-1.3-.8L15.2 4h-4l-.4 3.1c-.5.2-.9.5-1.3.8L7 6.9l-2 3.5L7 12c-.1.5-.1 1 0 1.5l-2 1.6 2 3.5 2.5-1c.4.3.8.6 1.3.8l.4 3.1h4l.4-3.1c.5-.2.9-.5 1.3-.8l2.5 1 2-3.5-2-1.6Z"
      />
    </svg>
  `,

  modules: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
    </svg>
  `,

  pathways: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 3v18"/>
      <path d="M12 8 6 4"/>
      <path d="M12 15 18 11"/>
      <path d="M6 4v5"/>
      <path d="M18 11v5"/>
    </svg>
  `,

  progress: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M4 19V9M10 19v-5M16 19V6M3 20h18"/>
    </svg>
  `,

  notifications: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
      />
      <path d="M10 21h4"/>
    </svg>
  `,

  contact: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />
      <path d="m4 7 8 6 8-6"/>
    </svg>
  `,

  signout: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>
    </svg>
  `
};


/* =========================================================
   HEADER LINKS
========================================================= */

function createHeaderLink({
  type,
  label,
  href,
  action,
  className = ""
}) {
  const element =
    typeof action ===
      "function"
      ? document.createElement(
          "button"
        )
      : document.createElement(
          "a"
        );


  if (
    element instanceof
    HTMLButtonElement
  ) {
    element.type =
      "button";
  }


  element.className =
    `acl-header-icon ${className}`.trim();


  element.title =
    label;


  element.setAttribute(
    "aria-label",
    label
  );


  element.innerHTML =
    iconSvgs[
      type
    ] ||
    "";


  if (
    href &&
    element instanceof
    HTMLAnchorElement
  ) {
    element.href =
      href;
  }


  if (
    typeof action ===
    "function"
  ) {
    element.addEventListener(
      "click",
      action
    );
  }


  return element;
}


/* =========================================================
   DRAWER ITEMS
========================================================= */

function createDrawerItem({
  type,
  label,
  href,
  action,
  admin = false
}) {
  const item =
    document.createElement(
      "button"
    );


  item.type =
    "button";


  item.className =
    `acl-drawer-item${
      admin
        ? " acl-drawer-admin-item"
        : ""
    }`;


  item.innerHTML = `
    <span class="acl-drawer-item-icon">
      ${iconSvgs[type] || ""}
    </span>

    <span class="acl-drawer-item-label">
      ${label}
    </span>
  `;


  item.addEventListener(
    "click",
    () => {
      closeAclDrawer();


      if (
        typeof action ===
        "function"
      ) {
        action();

        return;
      }


      if (href) {
        window.location.assign(
          href
        );
      }
    }
  );


  return item;
}


/* =========================================================
   DRAWER STATE
========================================================= */

function openAclDrawer() {
  document.body.classList.add(
    "acl-drawer-open"
  );


  document
    .querySelector(
      ".acl-side-drawer"
    )
    ?.setAttribute(
      "aria-hidden",
      "false"
    );


  document
    .querySelector(
      ".acl-drawer-overlay"
    )
    ?.setAttribute(
      "aria-hidden",
      "false"
    );
}


function closeAclDrawer() {
  document.body.classList.remove(
    "acl-drawer-open"
  );


  document
    .querySelector(
      ".acl-side-drawer"
    )
    ?.setAttribute(
      "aria-hidden",
      "true"
    );


  document
    .querySelector(
      ".acl-drawer-overlay"
    )
    ?.setAttribute(
      "aria-hidden",
      "true"
    );
}


/* =========================================================
   BRAND
========================================================= */

function createRollingBrand() {
  const brand =
    document.createElement(
      "a"
    );


  const edition =
    getActiveAclEdition();


  const editionLabel =
    edition === "basic"
      ? "THE BASIC EDITION"
      : "THE EXPERT EDITION";


  brand.className =
    `acl-unified-brand acl-${
      edition ||
      "expert"
    }-brand`;


  brand.href =
    editionAwarePath(
      "modules.html"
    );


  brand.setAttribute(
    "aria-label",
    `Alexandria Cardiology League ${editionLabel} home`
  );


  brand.innerHTML = `
    <span class="acl-brand-rolling-window">

      <span class="acl-brand-rolling-track">

        <span class="acl-brand-name acl-brand-short">
          ACL
        </span>

        <span class="acl-brand-name acl-brand-full">
          Alexandria Cardiology League
        </span>

      </span>

    </span>

    <span class="acl-brand-separator">
      ;
    </span>

    <strong class="acl-expert-edition acl-edition-title">
      ${editionLabel}
    </strong>
  `;


  return brand;
}


/* =========================================================
   SETTINGS
========================================================= */

function openAclSettings() {
  closeAclDrawer();


  window.location.assign(
    editionAwarePath(
      "settings.html"
    )
  );
}


/* =========================================================
   UNIFIED HEADER
========================================================= */

function buildUnifiedHeader() {
  const topbar =
    document.querySelector(
      ".topbar"
    );


  if (!topbar) {
    return;
  }


  const activeEdition =
    getActiveAclEdition();


  if (
    activeEdition
  ) {
    document.body.classList.remove(
      "acl-theme-basic",
      "acl-theme-expert",
      "acl-neutral-auth-page"
    );


    document.body.classList.add(
      activeEdition ===
        "basic"
        ? "acl-theme-basic"
        : "acl-theme-expert"
    );
  }


  const profile =
    window.aclCurrentProfile ||
    null;


  const oldNav =
    topbar.querySelector(
      "nav"
    );


  const isAdmin =
    Boolean(
      profile?.is_admin ||
      profile?.role ===
        "admin" ||
      profile?.role ===
        "administrator" ||
      oldNav?.querySelector(
        "#adminNavLink"
      )
    );


  topbar.classList.add(
    "acl-unified-header"
  );


  Array.from(
    topbar.children
  )
    .forEach(
      (child) => {
        if (
          !child.classList.contains(
            "acl-header-layout"
          )
        ) {
          child.hidden =
            true;


          child.setAttribute(
            "aria-hidden",
            "true"
          );
        }
      }
    );


  topbar
    .querySelector(
      ".acl-header-layout"
    )
    ?.remove();


  const layout =
    document.createElement(
      "div"
    );


  layout.className =
    "acl-header-layout";


  const left =
    document.createElement(
      "div"
    );


  left.className =
    "acl-header-left";


  const menuButton =
    document.createElement(
      "button"
    );


  menuButton.type =
    "button";


  menuButton.className =
    "acl-menu-button";


  menuButton.setAttribute(
    "aria-label",
    "Open navigation menu"
  );


  menuButton.innerHTML =
    iconSvgs.menu;


  menuButton.addEventListener(
    "click",
    openAclDrawer
  );


  left.appendChild(
    menuButton
  );


  const center =
    document.createElement(
      "div"
    );


  center.className =
    "acl-header-center";


  const iconNav =
    document.createElement(
      "nav"
    );


  iconNav.className =
    "acl-header-icon-nav";


  iconNav.setAttribute(
    "aria-label",
    "Quick navigation"
  );


  if (isAdmin) {
    iconNav.appendChild(
      createHeaderLink({
        type:
          "admin",

        label:
          "Administration",

        href:
          nestedPath(
            "admin.html"
          ),

        className:
          "acl-header-admin-icon"
      })
    );
  }


  iconNav.appendChild(
    createHeaderLink({
      type:
        "pathways",

      label:
        "Switch Edition",

      href:
        nestedPath(
          "pathways.html"
        )
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "modules",

      label:
        "Modules",

      href:
        editionAwarePath(
          "modules.html"
        )
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "progress",

      label:
        "My Progress",

      href:
        editionAwarePath(
          "progress.html"
        )
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "profile",

      label:
        "My Profile",

      href:
        editionAwarePath(
          "profile.html"
        )
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "settings",

      label:
        "Settings",

      action:
        openAclSettings
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "notifications",

      label:
        "Notifications",

      href:
        editionAwarePath(
          "notifications.html"
        ),

      className:
        "acl-header-notifications-icon"
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "contact",

      label:
        "Contact us",

      href:
        "mailto:drmohamedalaa90@gmail.com"
    })
  );


  iconNav.appendChild(
    createHeaderLink({
      type:
        "signout",

      label:
        "Sign out",

      action:
        signOut
    })
  );


  center.appendChild(
    createRollingBrand()
  );


  center.appendChild(
    iconNav
  );


  const right =
    document.createElement(
      "div"
    );


  right.className =
    "acl-header-right";


  right.setAttribute(
    "aria-hidden",
    "true"
  );


  layout.appendChild(
    left
  );


  layout.appendChild(
    center
  );


  layout.appendChild(
    right
  );


  topbar.appendChild(
    layout
  );


  buildDrawer(
    profile,
    isAdmin
  );
}


/* =========================================================
   DRAWER
========================================================= */

function buildDrawer(
  profile,
  isAdmin
) {
  document
    .querySelector(
      ".acl-side-drawer"
    )
    ?.remove();


  document
    .querySelector(
      ".acl-drawer-overlay"
    )
    ?.remove();


  const overlay =
    document.createElement(
      "button"
    );


  overlay.type =
    "button";


  overlay.className =
    "acl-drawer-overlay";


  overlay.setAttribute(
    "aria-label",
    "Close navigation menu"
  );


  overlay.setAttribute(
    "aria-hidden",
    "true"
  );


  overlay.addEventListener(
    "click",
    closeAclDrawer
  );


  const drawer =
    document.createElement(
      "aside"
    );


  drawer.className =
    "acl-side-drawer";


  drawer.setAttribute(
    "aria-hidden",
    "true"
  );


  const drawerHeader =
    document.createElement(
      "div"
    );


  drawerHeader.className =
    "acl-drawer-top";


  const identity =
    document.createElement(
      "div"
    );


  identity.className =
    "acl-drawer-identity";


  const avatar =
    document.createElement(
      "div"
    );


  avatar.className =
    "acl-drawer-avatar";


  const candidateName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.name ||
    profile?.username ||
    profile?.email ||
    "Signed-in user";


  const avatarUrl =
    profile?.avatar_url ||
    profile?.photo_url ||
    profile?.profile_photo_url ||
    profile?.image_url ||
    "";


  const initials =
    candidateName
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
    "U";


  function showInitials() {
    avatar.replaceChildren();


    avatar.textContent =
      initials;
  }


  if (avatarUrl) {
    const image =
      document.createElement(
        "img"
      );


    image.src =
      avatarUrl;


    image.alt =
      `${candidateName} profile photo`;


    image.addEventListener(
      "error",
      showInitials,
      {
        once:
          true
      }
    );


    avatar.appendChild(
      image
    );
  } else {
    showInitials();
  }


  const identityCopy =
    document.createElement(
      "div"
    );


  identityCopy.className =
    "acl-drawer-identity-copy";


  const nameElement =
    document.createElement(
      "strong"
    );


  nameElement.textContent =
    candidateName;


  const signedInElement =
    document.createElement(
      "span"
    );


  signedInElement.textContent =
    "Signed in";


  identityCopy.appendChild(
    nameElement
  );


  identityCopy.appendChild(
    signedInElement
  );


  identity.appendChild(
    avatar
  );


  identity.appendChild(
    identityCopy
  );


  const closeButton =
    document.createElement(
      "button"
    );


  closeButton.type =
    "button";


  closeButton.className =
    "acl-drawer-close";


  closeButton.setAttribute(
    "aria-label",
    "Close navigation menu"
  );


  closeButton.innerHTML =
    iconSvgs.close;


  closeButton.addEventListener(
    "click",
    closeAclDrawer
  );


  drawerHeader.appendChild(
    identity
  );


  drawerHeader.appendChild(
    closeButton
  );


  const divider =
    document.createElement(
      "div"
    );


  divider.className =
    "acl-drawer-divider";


  const menu =
    document.createElement(
      "nav"
    );


  menu.className =
    "acl-drawer-menu";


  if (isAdmin) {
    menu.appendChild(
      createDrawerItem({
        type:
          "admin",

        label:
          "Admin",

        href:
          nestedPath(
            "admin.html"
          ),

        admin:
          true
      })
    );
  }


  menu.appendChild(
    createDrawerItem({
      type:
        "settings",

      label:
        "Settings",

      action:
        openAclSettings
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "profile",

      label:
        "Edit profile",

      href:
        editionAwarePath(
          "profile.html"
        )
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "pathways",

      label:
        "Switch Edition",

      href:
        nestedPath(
          "pathways.html"
        )
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "modules",

      label:
        "Modules",

      href:
        editionAwarePath(
          "modules.html"
        )
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "progress",

      label:
        "My Progress",

      href:
        editionAwarePath(
          "progress.html"
        )
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "notifications",

      label:
        "Notifications",

      href:
        editionAwarePath(
          "notifications.html"
        )
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "contact",

      label:
        "Contact us",

      href:
        "mailto:drmohamedalaa90@gmail.com"
    })
  );


  menu.appendChild(
    createDrawerItem({
      type:
        "signout",

      label:
        "Sign out",

      action:
        signOut
    })
  );


  drawer.appendChild(
    drawerHeader
  );


  drawer.appendChild(
    divider
  );


  drawer.appendChild(
    menu
  );


  document.body.appendChild(
    overlay
  );


  document.body.appendChild(
    drawer
  );
}


/* =========================================================
   HEADER PROFILE HYDRATION
========================================================= */

let aclHeaderHydrationPromise =
  null;


async function hydrateHeaderProfile() {
  if (
    window.aclCurrentProfile
  ) {
    return window.aclCurrentProfile;
  }


  if (
    aclHeaderHydrationPromise
  ) {
    return aclHeaderHydrationPromise;
  }


  aclHeaderHydrationPromise =
    (async () => {
      try {
        let profile =
          await loadProfile();


        if (!profile) {
          return null;
        }


        profile =
          await applyAdminStatus(
            profile
          );


        window.aclCurrentProfile =
          profile;


        return profile;
      } catch (error) {
        console.warn(
          "Could not hydrate header profile:",
          error
        );


        return null;
      }
    })();


  return aclHeaderHydrationPromise;
}


/* =========================================================
   EDITION-AWARE EXISTING LINKS
========================================================= */

function updateEditionNavigation() {
  const edition =
    getActiveAclEdition();


  if (!edition) {
    return;
  }


  const editionPages =
    new Set([
      "modules.html",
      "progress.html",
      "profile.html",
      "settings.html",
      "notifications.html"
    ]);


  document
    .querySelectorAll(
      "a[href]"
    )
    .forEach(
      (link) => {
        const href =
          link.getAttribute(
            "href"
          );


        if (
          !href ||
          href.startsWith(
            "#"
          ) ||
          href.startsWith(
            "http"
          ) ||
          href.startsWith(
            "mailto:"
          ) ||
          href.startsWith(
            "tel:"
          )
        ) {
          return;
        }


        const url =
          new URL(
            href,
            window.location.href
          );


        const pageName =
          url.pathname
            .split(
              "/"
            )
            .pop();


        if (
          !editionPages.has(
            pageName
          )
        ) {
          return;
        }


        url.searchParams.set(
          "edition",
          edition
        );


        link.setAttribute(
          "href",
          (
            `${url.pathname}` +
            `${url.search}` +
            `${url.hash}`
          )
        );
      }
    );
}


/* =========================================================
   INITIALIZATION
========================================================= */

let navigationInitialized =
  false;


async function initializeNavigation() {
  await hydrateHeaderProfile();


  buildUnifiedHeader();


  updateEditionNavigation();


  if (
    navigationInitialized
  ) {
    return;
  }


  navigationInitialized =
    true;


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeAclDrawer();
      }
    }
  );
}


document.addEventListener(
  "DOMContentLoaded",
  initializeNavigation
);


if (
  document.readyState !==
  "loading"
) {
  void initializeNavigation();
}
