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
              "/Cardiology/service-worker.js",
              {
                scope:
                  "/Cardiology/"
              }
            );

        console.log(
          "ACL PWA registered:",
          registration.scope
        );


        registration
          .update()
          .catch(
            (error) => {
              console.warn(
                "ACL PWA update check failed:",
                error
              );
            }
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
