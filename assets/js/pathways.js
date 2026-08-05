import {
  protectAndRender
} from "./session-ui.js?v=4.8.0";


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
   HELPERS
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


function saveSelectedEdition(
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
      "ACL EDITION STORAGE ERROR:",
      error
    );


    return false;
  }
}


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


  saveSelectedEdition(
    normalizedEdition
  );


  window.location.assign(
    moduleUrlForEdition(
      normalizedEdition
    )
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
    initializePathways,
    {
      once:
        true
    }
  );
} else {
  void initializePathways();
}
