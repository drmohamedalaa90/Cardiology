/* =========================================================
   ACL PWA REGISTRATION AND INSTALLATION
========================================================= */

let deferredInstallPrompt =
  null;


const installSection =
  document.getElementById(
    "pwaInstallSection"
  );


const installButton =
  document.getElementById(
    "installAclAppButton"
  );


const installStatus =
  document.getElementById(
    "pwaInstallStatus"
  );


function setInstallStatus(
  message = ""
) {
  if (installStatus) {
    installStatus.textContent =
      message;
  }
}


/* =========================================================
   SERVICE WORKER
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

        setInstallStatus(
          "App installation is temporarily unavailable."
        );
      }
    }
  );
}


/* =========================================================
   INSTALL PROMPT
========================================================= */

window.addEventListener(
  "beforeinstallprompt",
  (event) => {
    event.preventDefault();

    deferredInstallPrompt =
      event;

    if (installSection) {
      installSection.hidden =
        false;
    }

    setInstallStatus(
      "ACL can now be installed on this device."
    );
  }
);


installButton
  ?.addEventListener(
    "click",
    async () => {
      if (!deferredInstallPrompt) {
        setInstallStatus(
          "Use your browser menu and choose Install App or Add to Home Screen."
        );

        return;
      }

      installButton.disabled =
        true;

      installButton.textContent =
        "Opening installer…";

      try {
        await deferredInstallPrompt
          .prompt();

        const choice =
          await deferredInstallPrompt
            .userChoice;

        if (
          choice.outcome ===
          "accepted"
        ) {
          setInstallStatus(
            "ACL installation started."
          );
        } else {
          setInstallStatus(
            "Installation was cancelled."
          );
        }
      } catch (error) {
        console.error(
          "ACL INSTALL ERROR:",
          error
        );

        setInstallStatus(
          "The app could not be installed. Try the browser menu."
        );
      } finally {
        deferredInstallPrompt =
          null;

        installButton.disabled =
          false;

        installButton.textContent =
          "Install ACL App";
      }
    }
  );


/* =========================================================
   INSTALL COMPLETED
========================================================= */

window.addEventListener(
  "appinstalled",
  () => {
    deferredInstallPrompt =
      null;

    if (installSection) {
      installSection.hidden =
        true;
    }

    setInstallStatus(
      "ACL has been installed successfully."
    );
  }
);


/* =========================================================
   ALREADY RUNNING AS AN APP
========================================================= */

const runningStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone ===
    true;


if (runningStandalone) {
  if (installSection) {
    installSection.hidden =
      true;
  }

  setInstallStatus(
    "You are using the installed ACL app."
  );
}
