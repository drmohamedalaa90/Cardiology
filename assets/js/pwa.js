/* =========================================================
   ACL PWA REGISTRATION AND INSTALLATION
========================================================= */

let deferredInstallPrompt =
  null;
/* =========================================================
   CONNECTION STATUS
========================================================= */

function createConnectionBanner() {
  let banner =
    document.getElementById(
      "aclConnectionBanner"
    );


  if (banner) {
    return banner;
  }


  banner =
    document.createElement(
      "div"
    );


  banner.id =
    "aclConnectionBanner";


  banner.className =
    "acl-connection-banner";


  banner.setAttribute(
    "role",
    "status"
  );


  banner.setAttribute(
    "aria-live",
    "polite"
  );


  banner.hidden =
    true;


  document.body.appendChild(
    banner
  );


  return banner;
}


function updateConnectionStatus() {
  const banner =
    createConnectionBanner();


  if (!navigator.onLine) {
    banner.textContent =
      "You are offline. Saved pages remain available, but new progress cannot synchronize.";

    banner.classList.add(
      "offline"
    );

    banner.classList.remove(
      "online"
    );

    banner.hidden =
      false;

    return;
  }


  banner.textContent =
    "Connection restored.";

  banner.classList.remove(
    "offline"
  );

  banner.classList.add(
    "online"
  );

  banner.hidden =
    false;


  window.setTimeout(
    () => {
      banner.hidden =
        true;
    },
    2500
  );
}


window.addEventListener(
  "offline",
  updateConnectionStatus
);


window.addEventListener(
  "online",
  updateConnectionStatus
);


if (!navigator.onLine) {
  updateConnectionStatus();
}

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

const runningStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone ===
    true;

function setInstallStatus(
  message = ""
) {
  if (installStatus) {
    installStatus.textContent =
      message;
  }
}
const isIosDevice =
  /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );


const isSafariBrowser =
  /^((?!chrome|android|crios|fxios).)*safari/i.test(
    navigator.userAgent
  );


if (
  isIosDevice &&
  isSafariBrowser &&
  !runningStandalone
) {
  if (installSection) {
    installSection.hidden =
      false;
  }


  if (installButton) {
    installButton.textContent =
      "How to install on iPhone";


    installButton.addEventListener(
      "click",
      () => {
        window.alert(
          "To install ACL on iPhone:\n\n" +
          "1. Tap the Safari Share button.\n" +
          "2. Scroll down.\n" +
          "3. Tap Add to Home Screen.\n" +
          "4. Tap Add."
        );
      },
      {
        once: true
      }
    );
  }


  setInstallStatus(
    "On iPhone, use Safari → Share → Add to Home Screen."
  );
}

function showAppUpdateNotice(
  registration
) {
  if (
    document.getElementById(
      "aclUpdateNotice"
    )
  ) {
    return;
  }


  const notice =
    document.createElement(
      "section"
    );


  notice.id =
    "aclUpdateNotice";


  notice.className =
    "acl-update-notice";


  notice.innerHTML = `
    <div>
      <strong>
        A new ACL version is available
      </strong>

      <span>
        Refresh to receive the latest improvements.
      </span>
    </div>

    <button
      id="applyAclUpdate"
      type="button"
    >
      Update now
    </button>
  `;


  document.body.appendChild(
    notice
  );


document
  .getElementById(
    "applyAclUpdate"
  )
  ?.addEventListener(
    "click",
    async (event) => {
      const button =
        event.currentTarget;


      button.disabled =
        true;


      button.textContent =
        "Updating…";


      try {
        await registration.update();


        if (
          registration.waiting
        ) {
          registration.waiting
            .postMessage({
              type:
                "SKIP_WAITING"
            });
        }


        const cacheNames =
          await caches.keys();


        await Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(
                  "acl-pwa-"
                )
            )
            .map(
              (cacheName) =>
                caches.delete(
                  cacheName
                )
            )
        );


        const refreshedUrl =
          new URL(
            window.location.href
          );


        refreshedUrl.searchParams.set(
          "acl_refresh",
          Date.now().toString()
        );


        window.location.replace(
          refreshedUrl.toString()
        );
      } catch (error) {
        console.error(
          "ACL APP UPDATE ERROR:",
          error
        );


        button.disabled =
          false;


        button.textContent =
          "Reload manually";
      }
    }
  );
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
registration.addEventListener(
  "updatefound",
  () => {
    const installingWorker =
      registration.installing;


    if (!installingWorker) {
      return;
    }


    installingWorker.addEventListener(
      "statechange",
      () => {
        if (
          installingWorker.state ===
            "installed" &&
          navigator.serviceWorker.controller
        ) {
          showAppUpdateNotice(
            registration
          );
        }
      }
    );
  }
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

    if (installButton) {
      installButton.hidden =
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

if (runningStandalone) {
  if (installSection) {
    installSection.hidden =
      true;
  }

  if (installButton) {
    installButton.hidden =
      true;
  }

  setInstallStatus(
    ""
  );

  document.body.classList.add(
    "acl-running-standalone"
  );
}
