import {
  supabaseClient
} from "./supabase-client.js";


import {
  ACL_CONFIG
} from "./config.js?v=1.1.0";


console.log(
  "ACL AUTH v3.1.0 LOADED"
);


/* =========================================================
   CONSTANTS
========================================================= */

const VALID_EDITIONS =
  new Set([
    "basic",
    "expert"
  ]);


const EDITION_STORAGE_KEY =
  "aclSelectedEdition";


const authState = {
  signingIn: false,
  registering: false,
  redirecting: false
};


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


function setMessage(
  id,
  message = ""
) {
  const element =
    byId(
      id
    );


  if (!element) {
    return;
  }


  element.textContent =
    message;


  element.hidden =
    !message;
}


function clearSignInMessages() {
  setMessage(
    "signInError"
  );


  setMessage(
    "signInSuccess"
  );
}


function clearRegisterMessages() {
  setMessage(
    "registerError"
  );


  setMessage(
    "registerSuccess"
  );
}


function setSubmitButtonState(
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

function normalizeUsername(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
}


function validUsername(
  value
) {
  return /^[a-z0-9._]{3,30}$/
    .test(
      value
    );
}


function normalizeEmail(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
}


function validEmail(
  value
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      value
    );
}


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
   STORAGE
========================================================= */

function getSavedEdition() {
  try {
    const savedEdition =
      String(
        localStorage.getItem(
          EDITION_STORAGE_KEY
        ) ||
        ""
      )
        .trim()
        .toLowerCase();


    return VALID_EDITIONS.has(
      savedEdition
    )
      ? savedEdition
      : null;
  } catch (
    error
  ) {
    console.warn(
      "ACL EDITION STORAGE READ ERROR:",
      error
    );


    return null;
  }
}


function clearSavedEdition() {
  try {
    localStorage.removeItem(
      EDITION_STORAGE_KEY
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL EDITION STORAGE CLEAR ERROR:",
      error
    );
  }
}


/* =========================================================
   POST-AUTH DESTINATION
========================================================= */

function getPostLoginDestination(
  isAdmin = false
) {
  if (isAdmin) {
    return "admin.html";
  }


  const savedEdition =
    getSavedEdition();


  if (savedEdition) {
    return (
      `modules.html?edition=${encodeURIComponent(
        savedEdition
      )}`
    );
  }


  return "pathways.html";
}


function redirectTo(
  destination
) {
  if (
    authState.redirecting
  ) {
    return;
  }


  authState.redirecting =
    true;


  window.location.replace(
    destination
  );
}


/* =========================================================
   ERROR HELPERS
========================================================= */

async function readFunctionError(
  error
) {
  const fallbackMessage =
    error?.message ||
    "The sign-in request failed.";


  const context =
    error?.context;


  if (
    !context ||
    typeof context.json !==
      "function"
  ) {
    return fallbackMessage;
  }


  try {
    const payload =
      await context.json();


    return (
      payload?.error ||
      payload?.message ||
      fallbackMessage
    );
  } catch (
    parseError
  ) {
    console.warn(
      "ACL FUNCTION ERROR RESPONSE COULD NOT BE PARSED:",
      parseError
    );


    return fallbackMessage;
  }
}


function friendlyAuthError(
  error,
  fallbackMessage
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
    return "Invalid username, email, or password.";
  }


  if (
    /email not confirmed/i.test(
      message
    )
  ) {
    return "Confirm your email address before signing in.";
  }


  if (
    /user already registered/i.test(
      message
    )
  ) {
    return "An account already exists with this email address.";
  }


  if (
    /password should be at least/i.test(
      message
    )
  ) {
    return "Password does not meet the minimum security requirements.";
  }


  if (
    /rate limit|too many requests/i.test(
      message
    )
  ) {
    return "Too many attempts were made. Wait briefly, then try again.";
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
    fallbackMessage
  );
}


/* =========================================================
   AUTHENTICATION PANELS
========================================================= */

function showPanel(
  panel,
  {
    updateHistory = true,
    focusField = true
  } = {}
) {
  const showSignIn =
    panel !==
    "register";


  const signInForm =
    byId(
      "signInForm"
    );


  const registerForm =
    byId(
      "registerForm"
    );


  const signInTab =
    byId(
      "signInTab"
    );


  const registerTab =
    byId(
      "registerTab"
    );


  if (signInForm) {
    signInForm.hidden =
      !showSignIn;


    signInForm.setAttribute(
      "aria-hidden",
      showSignIn
        ? "false"
        : "true"
    );
  }


  if (registerForm) {
    registerForm.hidden =
      showSignIn;


    registerForm.setAttribute(
      "aria-hidden",
      showSignIn
        ? "true"
        : "false"
    );
  }


  signInTab
    ?.classList
    .toggle(
      "active",
      showSignIn
    );


  registerTab
    ?.classList
    .toggle(
      "active",
      !showSignIn
    );


  signInTab
    ?.setAttribute(
      "aria-selected",
      showSignIn
        ? "true"
        : "false"
    );


  registerTab
    ?.setAttribute(
      "aria-selected",
      showSignIn
        ? "false"
        : "true"
    );


  signInTab
    ?.setAttribute(
      "tabindex",
      showSignIn
        ? "0"
        : "-1"
    );


  registerTab
    ?.setAttribute(
      "tabindex",
      showSignIn
        ? "-1"
        : "0"
    );


  if (updateHistory) {
    const updatedUrl =
      new URL(
        window.location.href
      );


    updatedUrl.hash =
      showSignIn
        ? ""
        : "register";


    window.history.replaceState(
      null,
      "",
      updatedUrl
    );
  }


  if (focusField) {
    window.setTimeout(
      () => {
        byId(
          showSignIn
            ? "identifier"
            : "name"
        )
          ?.focus();
      },
      50
    );
  }
}


function initializePanel() {
  showPanel(
    window.location.hash ===
      "#register"
      ? "register"
      : "signin",
    {
      updateHistory:
        false,

      focusField:
        false
    }
  );
}


/* =========================================================
   ADMIN CHECK
========================================================= */

async function currentUserIsAdmin() {
  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .rpc(
          "acl_is_admin"
        );


    return (
      !error &&
      data ===
        true
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL ADMIN CHECK ERROR:",
      error
    );


    return false;
  }
}


/* =========================================================
   EXISTING SESSION
========================================================= */

async function redirectExistingSession() {
  try {
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
      return;
    }


    const isAdmin =
      await currentUserIsAdmin();


    redirectTo(
      getPostLoginDestination(
        isAdmin
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL EXISTING SESSION CHECK ERROR:",
      error
    );
  }
}


/* =========================================================
   SIGN IN
========================================================= */

async function handleSignIn(
  event
) {
  event.preventDefault();


  if (
    authState.signingIn ||
    authState.redirecting
  ) {
    return;
  }


  clearSignInMessages();


  const identifier =
    String(
      byId(
        "identifier"
      )?.value ||
      ""
    ).trim();


  const password =
    String(
      byId(
        "loginPassword"
      )?.value ||
      ""
    );


  if (
    !identifier ||
    !password
  ) {
    setMessage(
      "signInError",
      "Enter your username or email and password."
    );


    return;
  }


  const submitButton =
    event.submitter ||
    event.currentTarget
      ?.querySelector(
        'button[type="submit"]'
      );


  authState.signingIn =
    true;


  setSubmitButtonState(
    submitButton,
    {
      disabled:
        true,

      text:
        "Signing in…"
    }
  );


  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .functions
        .invoke(
          "username-login",
          {
            body: {
              identifier,
              password
            }
          }
        );


    if (error) {
      const functionMessage =
        await readFunctionError(
          error
        );


      throw new Error(
        functionMessage
      );
    }


    if (
      data?.error
    ) {
      throw new Error(
        data.error
      );
    }


    const accessToken =
      data?.session
        ?.access_token;


    const refreshToken =
      data?.session
        ?.refresh_token;


    if (
      !accessToken ||
      !refreshToken
    ) {
      throw new Error(
        "Invalid username, email, or password."
      );
    }


    const {
      error: sessionError
    } =
      await supabaseClient
        .auth
        .setSession({
          access_token:
            accessToken,

          refresh_token:
            refreshToken
        });


    if (sessionError) {
      throw sessionError;
    }


    const isAdmin =
      await currentUserIsAdmin();


    setMessage(
      "signInSuccess",
      "Signed in successfully. Opening your ACL platform…"
    );


    redirectTo(
      getPostLoginDestination(
        isAdmin
      )
    );
  } catch (
    error
  ) {
    console.error(
      "ACL SIGN IN ERROR:",
      error
    );


    setMessage(
      "signInError",
      friendlyAuthError(
        error,
        "Could not sign in."
      )
    );
  } finally {
    authState.signingIn =
      false;


    if (
      !authState.redirecting
    ) {
      setSubmitButtonState(
        submitButton,
        {
          disabled:
            false,

          text:
            "Sign in"
        }
      );
    }
  }
}


/* =========================================================
   USERNAME AVAILABILITY
========================================================= */

async function usernameIsTaken(
  username
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "profiles"
      )
      .select(
        "id"
      )
      .ilike(
        "username",
        username
      )
      .limit(
        1
      );


  if (error) {
    /*
     * Some RLS configurations intentionally prevent
     * public profile searches. In that case, continue
     * to Supabase sign-up and allow the database's
     * unique username constraint to provide protection.
     */

    if (
      error.code ===
        "42501" ||
      /row-level security|permission denied/i.test(
        error.message ||
        ""
      )
    ) {
      console.warn(
        "ACL USERNAME PRECHECK BLOCKED BY RLS:",
        error
      );


      return false;
    }


    throw error;
  }


  return (
    Array.isArray(
      data
    ) &&
    data.length >
      0
  );
}


/* =========================================================
   CREATE ACCOUNT
========================================================= */

async function handleRegistration(
  event
) {
  event.preventDefault();


  if (
    authState.registering ||
    authState.redirecting
  ) {
    return;
  }


  clearRegisterMessages();


  const fullName =
    String(
      byId(
        "name"
      )?.value ||
      ""
    ).trim();


  const username =
    normalizeUsername(
      byId(
        "username"
      )?.value
    );


  const email =
    normalizeEmail(
      byId(
        "email"
      )?.value
    );


  const whatsapp =
    normalizeEgyptWhatsapp(
      byId(
        "whatsapp"
      )?.value
    );


  const position =
    String(
      (
        byId(
          "position"
        ) ||
        byId(
          "academicYear"
        )
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


  const password =
    String(
      byId(
        "registerPassword"
      )?.value ||
      ""
    );


  const confirmation =
    String(
      byId(
        "confirmPassword"
      )?.value ||
      ""
    );


  if (
    !fullName ||
    !username ||
    !email ||
    !whatsapp ||
    !position ||
    !institution ||
    !password ||
    !confirmation
  ) {
    setMessage(
      "registerError",
      "Please complete all required fields."
    );


    return;
  }


  if (
    fullName.length <
      2 ||
    fullName.length >
      100
  ) {
    setMessage(
      "registerError",
      "Enter a valid full name."
    );


    return;
  }


  if (
    !validUsername(
      username
    )
  ) {
    setMessage(
      "registerError",
      "Username must be 3–30 characters using letters, numbers, dots, or underscores."
    );


    return;
  }


  if (
    !validEmail(
      email
    )
  ) {
    setMessage(
      "registerError",
      "Enter a valid email address."
    );


    return;
  }


  if (!whatsapp) {
    setMessage(
      "registerError",
      "Enter a valid Egyptian WhatsApp number, such as +201XXXXXXXXX."
    );


    return;
  }


  if (
    institution.length >
    150
  ) {
    setMessage(
      "registerError",
      "Institution must be 150 characters or fewer."
    );


    return;
  }


  if (
    password.length <
    8
  ) {
    setMessage(
      "registerError",
      "Password must contain at least 8 characters."
    );


    return;
  }


  if (
    password !==
    confirmation
  ) {
    setMessage(
      "registerError",
      "Passwords do not match."
    );


    return;
  }


  const submitButton =
    event.submitter ||
    event.currentTarget
      ?.querySelector(
        'button[type="submit"]'
      );


  authState.registering =
    true;


  setSubmitButtonState(
    submitButton,
    {
      disabled:
        true,

      text:
        "Creating account…"
    }
  );


  try {
    const taken =
      await usernameIsTaken(
        username
      );


    if (taken) {
      throw new Error(
        "This username is already taken."
      );
    }


    const confirmationUrl =
      new URL(
        "confirm.html",
        `${window.location.origin}${ACL_CONFIG.siteBase}`
      )
        .toString();


    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .signUp({
          email,
          password,

          options: {
            emailRedirectTo:
              confirmationUrl,

            data: {
              full_name:
                fullName,

              display_name:
                fullName,

              username,

              whatsapp,

              phone_e164:
                whatsapp,

              position,

              institution
            }
          }
        });


    if (error) {
      throw error;
    }


    if (
      !data?.user
    ) {
      throw new Error(
        "The account could not be created."
      );
    }


    if (!data.session) {
      setMessage(
        "registerSuccess",
        "Account created. Open the confirmation email, confirm your address, then return here to sign in."
      );


      event.currentTarget
        .reset();


      window.setTimeout(
        () => {
          showPanel(
            "signin"
          );


          setMessage(
            "signInSuccess",
            "Your account was created. Confirm your email, then sign in."
          );
        },
        1800
      );


      return;
    }


    clearSavedEdition();


    setMessage(
      "registerSuccess",
      "Account created successfully. Opening pathway selection…"
    );


    redirectTo(
      "pathways.html"
    );
  } catch (
    error
  ) {
    console.error(
      "ACL REGISTER ERROR:",
      error
    );


    const message =
      friendlyAuthError(
        error,
        "Could not create account."
      );


    setMessage(
      "registerError",
      /duplicate key|username.*unique|profiles_username/i.test(
        message
      )
        ? "This username is already taken."
        : message
    );
  } finally {
    authState.registering =
      false;


    if (
      !authState.redirecting
    ) {
      setSubmitButtonState(
        submitButton,
        {
          disabled:
            false,

          text:
            "Create account"
        }
      );
    }
  }
}


/* =========================================================
   EVENTS
========================================================= */

byId(
  "signInTab"
)
  ?.addEventListener(
    "click",
    () => {
      showPanel(
        "signin"
      );
    }
  );


byId(
  "registerTab"
)
  ?.addEventListener(
    "click",
    () => {
      showPanel(
        "register"
      );
    }
  );


byId(
  "signInTab"
)
  ?.addEventListener(
    "keydown",
    (
      event
    ) => {
      if (
        event.key ===
        "ArrowRight"
    ) {
      event.preventDefault();


      showPanel(
        "register"
      );


      byId(
        "registerTab"
      )
        ?.focus();
    }
  );


byId(
  "registerTab"
)
  ?.addEventListener(
    "keydown",
    (
      event
    ) => {
      if (
        event.key ===
        "ArrowLeft"
    ) {
      event.preventDefault();


      showPanel(
        "signin"
      );


      byId(
        "signInTab"
      )
        ?.focus();
    }
  );


byId(
  "signInForm"
)
  ?.addEventListener(
    "submit",
    handleSignIn
  );


byId(
  "registerForm"
)
  ?.addEventListener(
    "submit",
    handleRegistration
  );


window.addEventListener(
  "hashchange",
  () => {
    showPanel(
      window.location.hash ===
        "#register"
        ? "register"
        : "signin",
      {
        updateHistory:
          false
      }
    );
  }
);


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAuthPage() {
  initializePanel();


  setMessage(
    "signInError"
  );


  setMessage(
    "signInSuccess"
  );


  setMessage(
    "registerError"
  );


  setMessage(
    "registerSuccess"
  );


  await redirectExistingSession();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void initializeAuthPage();
    },
    {
      once:
        true
    }
  );
} else {
  void initializeAuthPage();
}
