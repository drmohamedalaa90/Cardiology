import {
  protectAndRender
} from "./session-ui.js?v=4.0.0";


/* =========================================================
   ACL PATHWAY SELECTION
========================================================= */

(async () => {
  const profile =
    await protectAndRender(
      "login.html"
    );


  if (!profile) {
    return;
  }


  document.body.classList.add(
    "pathways-ready"
  );
})();


/* =========================================================
   REMEMBER SELECTED EDITION
========================================================= */

document
  .querySelectorAll(
    "[data-edition]"
  )
  .forEach(
    (pathwayControl) => {
      pathwayControl.addEventListener(
        "click",
        (event) => {
          const edition =
            pathwayControl.dataset
              .edition;


          if (
            edition !== "basic" &&
            edition !== "expert"
          ) {
            return;
          }


          event.preventDefault();


          localStorage.setItem(
            "aclSelectedEdition",
            edition
          );


          window.location.href =
            `modules.html?edition=${edition}`;
        }
      );
    }
  );
