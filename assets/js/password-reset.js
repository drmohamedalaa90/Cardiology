import {
  supabaseClient
} from "./supabase-client.js";


import {
  ACL_CONFIG
} from "./config.js?v=1.1.0";


console.log(
  "ACL PASSWORD RESET v1.6.0 LOADED"
);


/* =========================================================
   STATE
========================================================= */

const passwordResetState = {
  sendingRecoveryEmail: false,
  updatingPassword: false,
  redirecting: false,
  recoverySessionReady: false
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
   INPUT HELPERS
========================================================= */

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


function validPassword(
  value
) {
  return (
    typeof value ===
      "string" &&
    value.length >=
      8
  );
}


/* =========================================================
   URL HELPERS
========================================================= */

function applicationUrl(
  file
) {
  return new URL(
    file,
    `${window.location.origin}${ACL_CONFIG.siteBase}`
  ).toString();
}


function cleanRecoveryUrl() {
  const cleanedUrl =
    new URL(
      window.location.href
    );


  cleanedUrl.search =
    "";


  cleanedUrl.hash =
    "";


  window.history.replaceState(
    {},
    "",
    cleanedUrl
  );
}


/* =========================================================
   ERROR MESSAGES
========================================================= */

function friendlyPasswordResetError(
  error,
  fallbackMessage
) {
  const message =
    String(
      error?.message ||
      ""
    ).trim();


  if (
    /expired|invalid.*token|otp.*expired/i.test(
      message
    )
  ) {
    return "This recovery link is invalid or has expired. Request a new password-recovery email.";
  }


  if (
    /same password|different from the old password/i.test(
      message
    )
  ) {
    return "Choose a password that is different from your current password.";
  }


  if (
    /password should be at least|weak password/i.test(
      message
    )
  ) {
    return "The new password does not meet the minimum security requirements.";
  }


  if (
    /rate limit|too many requests/i.test(
      message
    )
  ) {
    return "Too many requests were made. Wait briefly, then try again.";
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
   FORGOT-PASSWORD REQUEST
========================================================= */

async function handleForgotPassword(
  event
) {
  event.preventDefault();


  if (
    passwordResetState
      .sendingRecoveryEmail
  ) {
    return;
  }


  setMessage(
    "forgotError"
  );


  setMessage(
    "forgotSuccess"
  );


  const email =
    normalizeEmail(
      byId(
        "recoveryEmail"
      )?.value
    );


  if (!email) {
    setMessage(
      "forgotError",
      "Enter your registered email address."
    );


    byId(
      "recoveryEmail"
    )
      ?.focus();


    return;
  }


  if (!validEmail(email)) {
    setMessage(
      "forgotError",
      "Enter a valid email address."
    );


    byId(
      "recoveryEmail"
    )
      ?.focus();


    return;
  }


  const submitButton =
    event.submitter ||
    event.currentTarget
      ?.querySelector(
        'button[type="submit"]'
      );


  passwordResetState
    .sendingRecoveryEmail =
      true;


  setSubmitButtonState(
    submitButton,
    {
      disabled:
        true,

      text:
        "Sending recovery link…"
    }
  );


  try {
    const {
      error
    } =
      await supabaseClient
        .auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo:
              applicationUrl(
                "reset-password.html"
              )
          }
        );


    if (error) {
      throw error;
    }


    setMessage(
      "forgotSuccess",
      "If an ACL account exists for this email, a recovery link has been sent. Check your inbox and spam folder."
    );


    event.currentTarget
      .reset();
  } catch (
    error
  ) {
    console.error(
      "ACL PASSWORD RECOVERY EMAIL ERROR:",
      error
    );


    setMessage(
      "forgotError",
      friendlyPasswordResetError(
        error,
        "The recovery email could not be sent."
      )
    );
  } finally {
    passwordResetState
      .sendingRecoveryEmail =
        false;


    setSubmitButtonState(
      submitButton,
      {
        disabled:
          false,

        text:
          "Send recovery link"
      }
    );
  }
}


/* =========================================================
   RECOVERY SESSION
========================================================= */

async function initializeRecoverySession() {
  const resetForm =
    byId(
      "resetForm"
    );


  if (!resetForm) {
    return;
  }


  setMessage(
    "resetError"
  );


  setMessage(
    "resetSuccess"
  );


  const currentUrl =
    new URL(
      window.location.href
    );


  const errorDescription =
    currentUrl.searchParams.get(
      "error_description"
    );


  if (errorDescription) {
    setMessage(
      "resetError",
      decodeURIComponent(
        errorDescription
      )
    );


    disableResetForm();


    return;
  }


  try {
    const code =
      currentUrl.searchParams.get(
        "code"
      );


    if (code) {
      const {
        error: exchangeError
      } =
        await supabaseClient
          .auth
          .exchangeCodeForSession(
            code
          );


      if (exchangeError) {
        throw exchangeError;
      }
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getSession();


    if (error) {
      throw error;
    }


    if (
      !data?.session
        ?.user
    ) {
      throw new Error(
        "This recovery link is invalid or has expired. Request a new one."
      );
    }


    passwordResetState
      .recoverySessionReady =
        true;


    cleanRecoveryUrl();


    byId(
      "newPassword"
    )
      ?.focus();
  } catch (
    error
  ) {
    console.error(
      "ACL RECOVERY SESSION ERROR:",
      error
    );


    setMessage(
      "resetError",
      friendlyPasswordResetError(
        error,
        "This recovery link is invalid or has expired. Request a new one."
      )
    );


    disableResetForm();
  }
}


function disableResetForm() {
  const form =
    byId(
      "resetForm"
    );


  if (!form) {
    return;
  }


  form
    .querySelectorAll(
      "input, button"
    )
    .forEach(
      (
        element
      ) => {
        element.disabled =
          true;
      }
    );
}


/* =========================================================
   UPDATE PASSWORD
========================================================= */

async function handleResetPassword(
  event
) {
  event.preventDefault();


  if (
    passwordResetState
      .updatingPassword ||
    passwordResetState
      .redirecting
  ) {
    return;
  }


  setMessage(
    "resetError"
  );


  setMessage(
    "resetSuccess"
  );


  const password =
    String(
      byId(
        "newPassword"
      )?.value ||
      ""
    );


  const confirmation =
    String(
      byId(
        "newPasswordConfirm"
      )?.value ||
      ""
    );


  if (!validPassword(password)) {
    setMessage(
      "resetError",
      "Password must contain at least 8 characters."
    );


    byId(
      "newPassword"
    )
      ?.focus();


    return;
  }


  if (
    password !==
    confirmation
  ) {
    setMessage(
      "resetError",
      "Passwords do not match."
    );


    byId(
      "newPasswordConfirm"
    )
      ?.focus();


    return;
  }


  const submitButton =
    event.submitter ||
    event.currentTarget
      ?.querySelector(
        'button[type="submit"]'
      );


  passwordResetState
    .updatingPassword =
      true;


  setSubmitButtonState(
    submitButton,
    {
      disabled:
        true,

      text:
        "Updating password…"
    }
  );


  try {
    if (
      !passwordResetState
        .recoverySessionReady
    ) {
      const {
        data,
        error
      } =
        await supabaseClient
          .auth
          .getSession();


      if (error) {
        throw error;
      }


      if (
        !data?.session
          ?.user
      ) {
        throw new Error(
          "This recovery link is invalid or has expired. Request a new one."
        );
      }


      passwordResetState
        .recoverySessionReady =
          true;
    }


    const {
      error
    } =
      await supabaseClient
        .auth
        .updateUser({
          password
        });


    if (error) {
      throw error;
    }


    setMessage(
      "resetSuccess",
      "Password changed successfully. Redirecting to sign in…"
    );


    event.currentTarget
      .reset();


    passwordResetState
      .redirecting =
        true;


    try {
      await supabaseClient
        .auth
        .signOut();
    } catch (
      signOutError
    ) {
      console.warn(
        "ACL POST-RESET SIGN OUT ERROR:",
        signOutError
      );
    }


    window.setTimeout(
      () => {
        window.location.replace(
          "login.html"
        );
      },
      1400
    );
  } catch (
    error
  ) {
    console.error(
      "ACL PASSWORD UPDATE ERROR:",
      error
    );


    setMessage(
      "resetError",
      friendlyPasswordResetError(
        error,
        "The password could not be updated."
      )
    );
  } finally {
    passwordResetState
      .updatingPassword =
        false;


    if (
      !passwordResetState
        .redirecting
    ) {
      setSubmitButtonState(
        submitButton,
        {
          disabled:
            false,

          text:
            "Update password"
        }
      );
    }
  }
}


/* =========================================================
   EVENTS
========================================================= */

byId(
  "forgotForm"
)
  ?.addEventListener(
    "submit",
    handleForgotPassword
  );


byId(
  "resetForm"
)
  ?.addEventListener(
    "submit",
    handleResetPassword
  );


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializePasswordReset() {
  await initializeRecoverySession();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void initializePasswordReset();
    },
    {
      once:
        true
    }
  );
} else {
  void initializePasswordReset();
}
