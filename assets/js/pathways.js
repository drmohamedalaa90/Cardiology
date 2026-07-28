import {
  protectAndRender
} from "./session-ui.js?v=2.8.0";


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
