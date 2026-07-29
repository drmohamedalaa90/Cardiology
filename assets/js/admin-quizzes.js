/* =========================================================
   ACL PWA REGISTRATION AND INSTALLATION
   Version: 1.7.0
========================================================= */

const ACL_BASE_PATH =
  "/Cardiology";


const ACL_SERVICE_WORKER_URL =
  `${ACL_BASE_PATH}/service-worker.js`;


const ACL_SERVICE_WORKER_SCOPE =
  `${ACL_BASE_PATH}/`;


let deferredInstallPrompt =
  null;


let serviceWorkerRegistration =
  null;


let controllerReloadPending =
  false;


/* =========================================================
   DEVICE AND DISPLAY STATE
========================================================= */

const isIosDevice =
  /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );


const isSafariBrowser =
  /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
    navigator.userAgent
  );


const runningStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone ===
    true;


/* =========================================================
   PAGE ELEMENTS
========================================================= */

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


/* =========================================================
   HELPERS
========================================================= */

function setInstallStatus(
  message = ""
) {
  if (installStatus) {
    installStatus.textContent =
      message;
  }
}


function setInstallButtonState({
  hidden = false,
  disabled = false,
  text = "Install ACL App"
} = {}) {
  if (!installButton) {
    return;
  }


  installButton.hidden =
    hidden;


  installButton.disabled =
    disabled;


  installButton.textContent =
    text;
}


function exposeRegistration(
  registration
) {
  serviceWorkerRegistration =
    registration;


  window.aclServiceWorkerRegistration =
    registration;


  window.dispatchEvent(
    new CustomEvent(
      "acl-service-worker-ready",
      {
        detail: {
          registration
        }
      }
    )
  );


  return registration;
}


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


/* =========================================================
   UPDATE NOTICE
========================================================= */

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


  notice.setAttribute(
    "role",
    "status"
  );


  notice.setAttribute(
    "aria-live",
    "polite"
  );


  notice.innerHTML = `
    <div>
      <strong>
        A new ACL version is available
      </strong>

      <span>
        Update now to receive the latest improvements.
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
      async (
        event
      ) => {
        const button =
          event.currentTarget;


        button.disabled =
          true;


        button.textContent =
          "Updating…";


        try {
          await registration.update();


          const waitingWorker =
            registration.waiting;


          if (waitingWorker) {
            waitingWorker.postMessage({
              type:
                "SKIP_WAITING"
            });


            return;
          }


          const installingWorker =
            registration.installing;


          if (installingWorker) {
            installingWorker.addEventListener(
              "statechange",
              () => {
                if (
                  installingWorker.state ===
                  "installed"
                ) {
                  installingWorker.postMessage({
                    type:
                      "SKIP_WAITING"
                  });
                }
              }
            );


            return;
          }


          window.location.reload();
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
   SERVICE WORKER MESSAGES
========================================================= */

function handleServiceWorkerMessage(
  event
) {
  const message =
    event.data ||
    {};


  if (
    message.type ===
    "ACL_PUSH_RECEIVED"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "acl-push-received",
        {
          detail:
            message.payload ||
            {}
        }
      )
    );


    return;
  }


  if (
    message.type ===
    "ACL_PUSH_SUBSCRIPTION_CHANGED"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "acl-push-subscription-changed",
        {
          detail:
            message
        }
      )
    );


    return;
  }


  if (
    message.type ===
    "ACL_NOTIFICATION_CLOSED"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "acl-notification-closed",
        {
          detail:
            message
        }
      )
    );
  }
}


/* =========================================================
   REGISTER SERVICE WORKER
========================================================= */

async function registerAclServiceWorker() {
  if (
    !(
      "serviceWorker" in
      navigator
    )
  ) {
    setInstallStatus(
      "This browser does not support installation or background notifications."
    );


    return null;
  }


  try {
    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage
    );


    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        if (
          controllerReloadPending
        ) {
          return;
        }


        controllerReloadPending =
          true;


        window.location.reload();
      }
    );


    const registration =
      await navigator.serviceWorker.register(
        ACL_SERVICE_WORKER_URL,
        {
          scope:
            ACL_SERVICE_WORKER_SCOPE,

          updateViaCache:
            "none"
        }
      );


    exposeRegistration(
      registration
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
              navigator.serviceWorker
                .controller
            ) {
              showAppUpdateNotice(
                registration
              );
            }
          }
        );
      }
    );


    if (registration.waiting) {
      showAppUpdateNotice(
        registration
      );
    }


    registration
      .update()
      .catch(
        (
          error
        ) => {
          console.warn(
            "ACL PWA update check failed:",
            error
          );
        }
      );


    const readyRegistration =
      await navigator.serviceWorker.ready;


    exposeRegistration(
      readyRegistration
    );


    return readyRegistration;
  } catch (error) {
    console.error(
      "ACL PWA registration failed:",
      error
    );


    setInstallStatus(
      "App installation and background notifications are temporarily unavailable."
    );


    return null;
  }
}


const serviceWorkerReadyPromise =
  registerAclServiceWorker();


window.aclServiceWorkerReady =
  serviceWorkerReadyPromise;


/* =========================================================
   INSTALL INSTRUCTIONS
========================================================= */

function showIosInstallInstructions() {
  window.alert(
    "To install ACL on iPhone or iPad:\n\n" +
    "1. Open ACL in Safari.\n" +
    "2. Tap the Share button.\n" +
    "3. Scroll down and tap Add to Home Screen.\n" +
    "4. Tap Add.\n" +
    "5. Open ACL from the new Home Screen icon."
  );
}


async function handleInstallButtonClick() {
  if (
    isIosDevice &&
    isSafariBrowser &&
    !runningStandalone
  ) {
    showIosInstallInstructions();


    return;
  }


  if (!deferredInstallPrompt) {
    setInstallStatus(
      "Open your browser menu and choose Install App or Add to Home Screen."
    );


    return;
  }


  setInstallButtonState({
    disabled:
      true,

    text:
      "Opening installer…"
  });


  try {
    await deferredInstallPrompt.prompt();


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


    setInstallButtonState({
      disabled:
        false,

      text:
        "Install ACL App"
    });
  }
}


/* =========================================================
   IOS INSTALL DISPLAY
========================================================= */

if (
  isIosDevice &&
  isSafariBrowser &&
  !runningStandalone
) {
  if (installSection) {
    installSection.hidden =
      false;
  }


  setInstallButtonState({
    text:
      "How to install on iPhone"
  });


  setInstallStatus(
    "On iPhone, install ACL from Safari before enabling push notifications."
  );
}


/* =========================================================
   BROWSER INSTALL PROMPT
========================================================= */

window.addEventListener(
  "beforeinstallprompt",
  (
    event
  ) => {
    event.preventDefault();


    deferredInstallPrompt =
      event;


    if (installSection) {
      installSection.hidden =
        false;
    }


    setInstallButtonState({
      hidden:
        false,

      disabled:
        false,

      text:
        "Install ACL App"
    });


    setInstallStatus(
      "ACL can now be installed on this device."
    );
  }
);


installButton
  ?.addEventListener(
    "click",
    handleInstallButtonClick
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


    setInstallButtonState({
      hidden:
        true
    });


    setInstallStatus(
      "ACL has been installed successfully."
    );


    window.dispatchEvent(
      new CustomEvent(
        "acl-app-installed"
      )
    );
  }
);


/* =========================================================
   STANDALONE MODE
========================================================= */

if (runningStandalone) {
  if (installSection) {
    installSection.hidden =
      true;
  }


  setInstallButtonState({
    hidden:
      true
  });


  setInstallStatus(
    ""
  );


  document.body.classList.add(
    "acl-running-standalone"
  );
}


/* =========================================================
   PUBLIC PWA API
========================================================= */

window.aclPwa = {
  basePath:
    ACL_BASE_PATH,

  serviceWorkerUrl:
    ACL_SERVICE_WORKER_URL,

  serviceWorkerScope:
    ACL_SERVICE_WORKER_SCOPE,

  isIosDevice,

  isSafariBrowser,

  isStandalone:
    runningStandalone,

  async getRegistration() {
    if (serviceWorkerRegistration) {
      return serviceWorkerRegistration;
    }


    return serviceWorkerReadyPromise;
  },

  async checkForUpdate() {
    const registration =
      await this.getRegistration();


    if (!registration) {
      return false;
    }


    await registration.update();


    return true;
  },

  async clearCache() {
    const registration =
      await this.getRegistration();


    const worker =
      registration?.active ||
      navigator.serviceWorker
        .controller;


    worker?.postMessage({
      type:
        "CLEAR_ACL_CACHE"
    });
  },

  async showLocalNotification(
    payload = {}
  ) {
    const registration =
      await this.getRegistration();


    if (!registration) {
      throw new Error(
        "The ACL service worker is unavailable."
      );
    }


    const worker =
      registration.active ||
      navigator.serviceWorker
        .controller;


    if (!worker) {
      throw new Error(
        "The ACL service worker is not active yet."
      );
    }


    worker.postMessage({
      type:
        "SHOW_NOTIFICATION",

      payload
    });
  }
};
