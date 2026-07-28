/* =========================================================
   ACL PWA REGISTRATION
========================================================= */

if (
  "serviceWorker" in
  navigator
) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const registration =
          await navigator
            .serviceWorker
            .register(
              "/service-worker.js",
              {
                scope: "/"
              }
            );

        console.log(
          "ACL PWA service worker registered:",
          registration.scope
        );
      } catch (error) {
        console.error(
          "ACL PWA registration failed:",
          error
        );
      }
    }
  );
}
