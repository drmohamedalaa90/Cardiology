import {
  supabaseClient
} from "./supabase-client.js";


import {
  ACL_CONFIG
} from "./config.js";


/* =========================================================
   ELEMENT HELPERS
========================================================= */

const byId =
  (id) =>
    document.getElementById(
      id
    );


function setMessage(
  id,
  message = ""
) {
  const element =
    byId(
      id
    );


  if (element) {
    element.textContent =
      message;
  }
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


function normalizeEgyptWhatsapp(
  value
) {
  let raw =
    String(
      value ||
      ""
    )
      .replace(
        /[^0-9+]/g,
        ""
      );


  if (
    raw.startsWith(
      "+20"
    )
  ) {
    raw =
      `0${raw.slice(3)}`;
  }


  if (
    raw.startsWith(
      "0020"
    )
  ) {
    raw =
      `0${raw.slice(4)}`;
  }


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
   POST-AUTH DESTINATION
========================================================= */

function getSavedEdition() {
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
    savedEdition === "basic" ||
    savedEdition === "expert"
  ) {
    return savedEdition;
  }


  return null;
}


function getPostLoginDestination(
  isAdmin = false
) {
  /*
   * Administrators retain direct access to
   * the administration dashboard.
   */

  if (isAdmin) {
    return "admin.html";
  }


  const savedEdition =
    getSavedEdition();


  /*
   * Returning user:
   * reopen the last selected pathway.
   */

  if (savedEdition) {
    return (
      `modules.html?edition=${savedEdition}`
    );
  }


  /*
   * First-time user or no remembered pathway:
   * choose an edition first.
   */

  return "pathways.html";
}


/* =========================================================
   AUTHENTICATION PANELS
========================================================= */

function showPanel(
  panel
) {
  const signIn =
    panel ===
    "signin";


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
      !signIn;
  }


  if (registerForm) {
    registerForm.hidden =
      signIn;
  }


  signInTab
    ?.classList
    .toggle(
      "active",
      signIn
    );


  registerTab
    ?.classList
    .toggle(
      "active",
      !signIn
    );


  history.replaceState(
    null,
    "",
    signIn
      ? "login.html"
      : "login.html#register"
  );
}


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


if (
  location.hash ===
  "#register"
) {
  showPanel(
    "register"
  );
}


/* =========================================================
   SIGN IN
========================================================= */

byId(
  "signInForm"
)
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      setMessage(
        "signInError"
      );


      setMessage(
        "signInSuccess"
      );


      const identifier =
        byId(
          "identifier"
        )
          ?.value
          ?.trim() ||
        "";


      const password =
        byId(
          "loginPassword"
        )
          ?.value ||
        "";


      const submitButton =
        event.submitter;


      if (submitButton) {
        submitButton.disabled =
          true;

        submitButton.textContent =
          "Signing in…";
      }


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
          throw error;
        }


        if (
          !data?.session
            ?.access_token ||
          !data?.session
            ?.refresh_token
        ) {
          throw new Error(
            data?.error ||
            "Invalid username/email or password."
          );
        }


        const {
          error: sessionError
        } =
          await supabaseClient
            .auth
            .setSession({
              access_token:
                data.session
                  .access_token,

              refresh_token:
                data.session
                  .refresh_token
            });


        if (sessionError) {
          throw sessionError;
        }


        const {
          data: isAdmin,
          error: adminError
        } =
          await supabaseClient
            .rpc(
              "acl_is_admin"
            );


        const userIsAdmin =
          !adminError &&
          isAdmin === true;


        setMessage(
          "signInSuccess",
          "Signed in successfully. Opening your ACL platform…"
        );


        window.location.replace(
          getPostLoginDestination(
            userIsAdmin
          )
        );
      } catch (error) {
        console.error(
          "SIGN IN ERROR:",
          error
        );


        setMessage(
          "signInError",
          error.message ||
          "Could not sign in."
        );
      } finally {
        if (submitButton) {
          submitButton.disabled =
            false;

          submitButton.textContent =
            "Sign in";
        }
      }
    }
  );


/* =========================================================
   CREATE ACCOUNT
========================================================= */

byId(
  "registerForm"
)
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();


      setMessage(
        "registerError"
      );


      setMessage(
        "registerSuccess"
      );


      const fullName =
        byId(
          "name"
        )
          ?.value
          ?.trim() ||
        "";


      const username =
        normalizeUsername(
          byId(
            "username"
          )
            ?.value
        );


      const email =
        byId(
          "email"
        )
          ?.value
          ?.trim()
          ?.toLowerCase() ||
        "";


      const whatsapp =
        normalizeEgyptWhatsapp(
          byId(
            "whatsapp"
          )
            ?.value
        );


      const position =
        (
          byId(
            "position"
          ) ||
          byId(
            "academicYear"
          )
        )
          ?.value
          ?.trim() ||
        "";


      const institution =
        byId(
          "institution"
        )
          ?.value
          ?.trim() ||
        "";


      const password =
        byId(
          "registerPassword"
        )
          ?.value ||
        "";


      const confirmation =
        byId(
          "confirmPassword"
        )
          ?.value ||
        "";


      if (
        !fullName ||
        !email ||
        !whatsapp ||
        !position ||
        !institution
      ) {
        setMessage(
          "registerError",
          "Please complete all required fields."
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
          "Username must be 3–30 characters using letters, numbers, dots or underscores."
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
        event.submitter;


      if (submitButton) {
        submitButton.disabled =
          true;

        submitButton.textContent =
          "Creating account…";
      }


      try {
        const {
          data: taken,
          error: usernameCheckError
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
            .maybeSingle();


        if (
          usernameCheckError
        ) {
          throw usernameCheckError;
        }


        if (taken) {
          throw new Error(
            "This username is already taken."
          );
        }


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
                  `${window.location.origin}${ACL_CONFIG.siteBase}confirm.html`,

                data: {
                  full_name:
                    fullName,

                  display_name:
                    fullName,

                  username,

                  whatsapp,

                  position,

                  institution
                }
              }
            });


        if (error) {
          throw error;
        }


        /*
         * Email confirmation is still required.
         */

        if (!data.session) {
          setMessage(
            "registerSuccess",
            "Account created. Open the confirmation email, confirm your address, then return to sign in."
          );


          event.target.reset();


          return;
        }


        /*
         * When confirmation is disabled and Supabase
         * creates a session immediately, always send a
         * newly registered user to pathway selection.
         */

        localStorage.removeItem(
          "aclSelectedEdition"
        );


        window.location.replace(
          "pathways.html"
        );
      } catch (error) {
        console.error(
          "REGISTER ERROR:",
          error
        );


        setMessage(
          "registerError",
          error.message ||
          "Could not create account."
        );
      } finally {
        if (submitButton) {
          submitButton.disabled =
            false;

          submitButton.textContent =
            "Create account";
        }
      }
    }
  );
