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
          await navigator.serviceWorker.register(
            "/Cardiology/service-worker.js",
            {
              scope:
                "/Cardiology/"
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
