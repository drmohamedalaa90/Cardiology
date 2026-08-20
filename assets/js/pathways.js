import {
  protectAndRender
} from "./session-ui.js?v=4.9.0";


console.log(
  "ACL PATHWAYS v2.2.0 LOADED"
);


/* =========================================================
   CONFIGURATION
========================================================= */

const VALID_EDITIONS =
  new Set([
    "basic",
    "expert"
  ]);


const EDITION_STORAGE_KEY =
  "aclSelectedEdition";


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


/* =========================================================
   EDITION HELPERS
========================================================= */

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


  return VALID_EDITIONS.has(
    edition
  )
    ? edition
    : "";
}


function readRememberedEdition() {
  try {
    return normalizeEdition(
      localStorage.getItem(
        EDITION_STORAGE_KEY
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL REMEMBERED EDITION READ ERROR:",
      error
    );


    return "";
  }
}


function clearRememberedEdition() {
  try {
    localStorage.removeItem(
      EDITION_STORAGE_KEY
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL REMEMBERED EDITION CLEAR ERROR:",
      error
    );
  }
}


function saveRememberedEdition(
  edition
) {
  try {
    localStorage.setItem(
      EDITION_STORAGE_KEY,
      edition
    );


    return true;
  } catch (
    error
  ) {
    console.warn(
      "ACL REMEMBERED EDITION WRITE ERROR:",
      error
    );


    return false;
  }
}


function readSessionEdition() {
  try {
    return normalizeEdition(
      sessionStorage.getItem(
        EDITION_STORAGE_KEY
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL SESSION EDITION READ ERROR:",
      error
    );


    return "";
  }
}


function clearSessionEdition() {
  try {
    sessionStorage.removeItem(
      EDITION_STORAGE_KEY
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL SESSION EDITION CLEAR ERROR:",
      error
    );
  }
}


function saveSessionEdition(
  edition
) {
  try {
    sessionStorage.setItem(
      EDITION_STORAGE_KEY,
      edition
    );


    return true;
  } catch (
    error
  ) {
    console.warn(
      "ACL SESSION EDITION WRITE ERROR:",
      error
    );


    return false;
  }
}


/* =========================================================
   PREFERENCE UI
========================================================= */

function rememberChoiceEnabled() {
  return Boolean(
    byId(
      "rememberEditionChoice"
    )
      ?.checked
  );
}


function setPreferenceStatus(
  message
) {
  const status =
    byId(
      "editionPreferenceStatus"
    );


  if (!status) {
    return;
  }


  status.textContent =
    message;
}


function initializePreferenceControl() {
  const checkbox =
    byId(
      "rememberEditionChoice"
    );


  if (!checkbox) {
    return;
  }


  const rememberedEdition =
    readRememberedEdition();


  checkbox.checked =
    Boolean(
      rememberedEdition
    );


  if (rememberedEdition) {
    setPreferenceStatus(
      `Your ${rememberedEdition} edition choice is remembered on this device.`
    );
  } else {
    setPreferenceStatus(
      "Your choice has not been saved permanently."
    );
  }


  checkbox.addEventListener(
    "change",
    () => {
      if (checkbox.checked) {
        const activeEdition =
          readSessionEdition();


        if (activeEdition) {
          saveRememberedEdition(
            activeEdition
          );


          setPreferenceStatus(
            `Your ${activeEdition} edition choice is now remembered on this device.`
          );


          return;
        }


        setPreferenceStatus(
          "Choose Basic or Expert Edition to save your preference."
        );


        return;
      }


      clearRememberedEdition();


      setPreferenceStatus(
        "Your choice will only remain active for this browser session."
      );
    }
  );
}


/* =========================================================
   NAVIGATION
========================================================= */

function moduleUrlForEdition(
  edition
) {
  const url =
    new URL(
      "modules.html",
      window.location.href
    );


  url.searchParams.set(
    "edition",
    edition
  );


  return url.toString();
}


function openEdition(
  edition
) {
  const normalizedEdition =
    normalizeEdition(
      edition
    );


  if (!normalizedEdition) {
    console.warn(
      "ACL INVALID EDITION:",
      edition
    );


    return;
  }


  saveSessionEdition(
    normalizedEdition
  );


  if (
    rememberChoiceEnabled()
  ) {
    saveRememberedEdition(
      normalizedEdition
    );


    setPreferenceStatus(
      `Your ${normalizedEdition} edition choice is remembered on this device.`
    );
  } else {
    clearRememberedEdition();


    setPreferenceStatus(
      `Your ${normalizedEdition} edition choice will remain active only for this browser session.`
    );
  }


  window.location.assign(
    moduleUrlForEdition(
      normalizedEdition
    )
  );
}


/* =========================================================
   PATHWAY CONTROLS
========================================================= */

function setPathwayControlsEnabled(
  enabled
) {
  document
    .querySelectorAll(
      "[data-edition]"
    )
    .forEach(
      (
        pathwayControl
      ) => {
        pathwayControl.setAttribute(
          "aria-disabled",
          enabled
            ? "false"
            : "true"
        );


        pathwayControl.classList.toggle(
          "pathway-disabled",
          !enabled
        );


        if (
          "disabled" in
          pathwayControl
        ) {
          pathwayControl.disabled =
            !enabled;
        }
      }
    );
}


function bindPathwayControls() {
  document
    .querySelectorAll(
      "[data-edition]"
    )
    .forEach(
      (
        pathwayControl
      ) => {
        if (
          pathwayControl.dataset
            .aclPathwayBound ===
          "true"
        ) {
          return;
        }


        pathwayControl.dataset
          .aclPathwayBound =
            "true";


        pathwayControl.addEventListener(
          "click",
          (
            event
          ) => {
            const edition =
              normalizeEdition(
                pathwayControl.dataset
                  .edition
              );


            if (!edition) {
              event.preventDefault();


              return;
            }


            event.preventDefault();


            openEdition(
              edition
            );
          }
        );


        pathwayControl.addEventListener(
          "keydown",
          (
            event
          ) => {
            if (
              event.key !==
                "Enter" &&
              event.key !==
                " "
            ) {
              return;
            }


            const edition =
              normalizeEdition(
                pathwayControl.dataset
                  .edition
              );


            if (!edition) {
              return;
            }


            event.preventDefault();


            openEdition(
              edition
            );
          }
        );
      }
    );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializePathways() {
  setPathwayControlsEnabled(
    false
  );


  try {
    const profile =
      await protectAndRender(
        "login.html"
      );


    if (!profile) {
      return;
    }


    initializePreferenceControl();


    bindPathwayControls();


    setPathwayControlsEnabled(
      true
    );


    document.body.classList.add(
      "pathways-ready"
    );
  } catch (
    error
  ) {
    console.error(
      "ACL PATHWAYS INITIALIZATION ERROR:",
      error
    );


    window.location.replace(
      "login.html"
    );
  }
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void initializePathways();
    },
    {
      once:
        true
    }
  );
} else {
  void initializePathways();
}
