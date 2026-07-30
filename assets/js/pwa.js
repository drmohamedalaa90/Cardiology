/* =========================================================
   ACL PWA REGISTRATION AND INSTALLATION
   Version: 2.0.0
========================================================= */

console.log(
  "ACL PWA v2.0.0 LOADED"
);


/* =========================================================
   STATE
========================================================= */

let deferredInstallPrompt =
  null;


let serviceWorkerRegistration =
  null;


let serviceWorkerReadyPromise =
  null;


let updateReloadPending =
  false;


let connectionBannerTimer =
  null;


/* =========================================================
   CONSTANTS
========================================================= */

const ACL_BASE_PATH =
  "/Cardiology/";


const ACL_SERVICE_WORKER_URL =
  `${ACL_BASE_PATH}service-worker.js`;


/* =========================================================
   PLATFORM
========================================================= */

function isRunningStandalone() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone ===
      true
  );
}


const isIosDevice =
  /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );


const isSafariBrowser =
  /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
    navigator.userAgent
  );


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


function installSection() {
  return byId(
    "pwaInstallSection"
  );
}


function installButton() {
  return byId(
    "installAclAppButton"
  );
}


function installStatus() {
  return byId(
    "pwaInstallStatus"
  );
}


/* =========================================================
   INSTALL UI
========================================================= */

function setInstallStatus(
  message = ""
) {
  const element =
    installStatus();


  if (element) {
    element.textContent =
      message;
  }
}


function setInstallButton({
  hidden,
  disabled,
  text
} = {}) {
  const button =
    installButton();


  if (!button) {
    return;
  }


  if (
    typeof hidden ===
    "boolean"
  ) {
    button.hidden =
      hidden;
  }


  if (
    typeof disabled ===
    "boolean"
  ) {
    button.disabled =
      disabled;
  }


  if (
    typeof text ===
      "string"
  ) {
    button.textContent =
      text;
  }
}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function createConnectionBanner() {
  let banner =
    byId(
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


function clearConnectionBannerTimer() {
  if (
    !connectionBannerTimer
  ) {
    return;
  }


  window.clearTimeout(
    connectionBannerTimer
  );


  connectionBannerTimer =
    null;
}


function updateConnectionStatus() {
  const banner =
    createConnectionBanner();


  clearConnectionBannerTimer();


  if (
    !navigator.onLine
  ) {
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


  connectionBannerTimer =
    window.setTimeout(
      () => {
        banner.hidden =
          true;


        connectionBannerTimer =
          null;
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


/* =========================================================
   UPDATE NOTICE
========================================================= */

function removeAppUpdateNotice() {
  byId(
    "aclUpdateNotice"
  )?.remove();
}


function showAppUpdateNotice(
  registration
) {
  if (
    byId(
      "aclUpdateNotice"
    ) ||
    !registration?.waiting
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


  byId(
    "applyAclUpdate"
  )
    ?.addEventListener(
      "click",
      (
        event
      ) => {
        const button =
          event.currentTarget;


        if (
          updateReloadPending
        ) {
          return;
        }


        const waitingWorker =
          registration.waiting;


        if (
          !waitingWorker
        ) {
          button.textContent =
            "Update unavailable";


          button.disabled =
            true;


          return;
        }


        updateReloadPending =
          true;


        button.disabled =
          true;


        button.textContent =
          "Updating…";


        waitingWorker.postMessage({
          type:
            "SKIP_WAITING"
        });
      }
    );
}


/* =========================================================
   SERVICE WORKER EVENTS
========================================================= */

if (
  "serviceWorker" in
  navigator
) {
  navigator.serviceWorker
    .addEventListener(
      "controllerchange",
      () => {
        if (
          !updateReloadPending
        ) {
          return;
        }


        updateReloadPending =
          false;


        removeAppUpdateNotice();


        const refreshedUrl =
          new URL(
            window.location.href
          );


        refreshedUrl.searchParams.set(
          "acl_refresh",
          Date.now()
            .toString()
        );


        window.location.replace(
          refreshedUrl.toString()
        );
      }
    );


  navigator.serviceWorker
    .addEventListener(
      "message",
      (
        event
      ) => {
        const message =
          event.data &&
          typeof event.data ===
            "object"
            ? event.data
            : {};


        if (
          message.type ===
          "ACL_SERVICE_WORKER_ACTIVATED"
        ) {
          console.log(
            "ACL service worker activated:",
            message.version ||
            message.cacheName ||
            "latest"
          );
        }


        if (
          message.type ===
          "ACL_CACHE_CLEARED"
        ) {
          console.log(
            "ACL cache rebuilt:",
            message.cacheName ||
            "current cache"
          );
        }
      }
    );
}


/* =========================================================
   SERVICE WORKER REGISTRATION
========================================================= */

async function registerServiceWorker() {
  if (
    !(
      "serviceWorker" in
      navigator
    )
  ) {
    throw new Error(
      "Service workers are not supported by this browser."
    );
  }


  if (
    serviceWorkerRegistration
  ) {
    return serviceWorkerRegistration;
  }


  serviceWorkerRegistration =
    await navigator
      .serviceWorker
      .register(
        ACL_SERVICE_WORKER_URL,
        {
          scope:
            ACL_BASE_PATH,

          updateViaCache:
            "none"
        }
      );


  console.log(
    "ACL PWA registered:",
    serviceWorkerRegistration
      .scope
  );


  if (
    serviceWorkerRegistration
      .waiting &&
    navigator.serviceWorker
      .controller
  ) {
    showAppUpdateNotice(
      serviceWorkerRegistration
    );
  }


  serviceWorkerRegistration
    .addEventListener(
      "updatefound",
      () => {
        const installingWorker =
          serviceWorkerRegistration
            .installing;


        if (
          !installingWorker
        ) {
          return;
        }


        installingWorker
          .addEventListener(
            "statechange",
            () => {
              if (
                installingWorker
                  .state ===
                  "installed" &&
                navigator
                  .serviceWorker
                  .controller &&
                serviceWorkerRegistration
                  .waiting
              ) {
                showAppUpdateNotice(
                  serviceWorkerRegistration
                );
              }
            }
          );
      }
    );


  serviceWorkerRegistration
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


  return serviceWorkerRegistration;
}


function getServiceWorkerRegistration() {
  if (
    serviceWorkerReadyPromise
  ) {
    return serviceWorkerReadyPromise;
  }


  serviceWorkerReadyPromise =
    (async () => {
      await registerServiceWorker();


      return navigator
        .serviceWorker
        .ready;
    })()
      .then(
        (
          registration
        ) => {
          serviceWorkerRegistration =
            registration;


          return registration;
        }
      )
      .catch(
        (
          error
        ) => {
          serviceWorkerReadyPromise =
            null;


          serviceWorkerRegistration =
            null;


          throw error;
        }
      );


  window.aclServiceWorkerReady =
    serviceWorkerReadyPromise;


  return serviceWorkerReadyPromise;
}


/* =========================================================
   IOS INSTALL INSTRUCTIONS
========================================================= */

function showIosInstallInstructions() {
  window.alert(
    "To install ACL on iPhone or iPad:\n\n" +
    "1. Open ACL in Safari.\n" +
    "2. Tap the Share button.\n" +
    "3. Scroll down.\n" +
    "4. Tap Add to Home Screen.\n" +
    "5. Tap Add.\n\n" +
    "Open the installed ACL app before enabling notifications."
  );
}


/* =========================================================
   INSTALL APP
========================================================= */

async function requestAppInstall() {
  if (
    isRunningStandalone()
  ) {
    setInstallStatus(
      "ACL is already installed on this device."
    );


    setInstallButton({
      hidden:
        true
    });


    return {
      outcome:
        "already-installed"
    };
  }


  if (
    isIosDevice
  ) {
    showIosInstallInstructions();


    setInstallStatus(
      "Use Safari → Share → Add to Home Screen."
    );


    return {
      outcome:
        "instructions"
    };
  }


  if (
    !deferredInstallPrompt
  ) {
    setInstallStatus(
      "Use your browser menu and choose Install App or Add to Home Screen."
    );


    return {
      outcome:
        "unavailable"
    };
  }


  setInstallButton({
    disabled:
      true,

    text:
      "Opening installer…"
  });


  const promptEvent =
    deferredInstallPrompt;


  deferredInstallPrompt =
    null;


  try {
    await promptEvent
      .prompt();


    const choice =
      await promptEvent
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
        "Installation was cancelled. You can continue in the browser."
      );
    }


    return choice;
  } catch (
    error
  ) {
    console.error(
      "ACL INSTALL ERROR:",
      error
    );


    setInstallStatus(
      "The app could not be installed. Try the browser menu."
    );


    return {
      outcome:
        "error",

      error
    };
  } finally {
    setInstallButton({
      disabled:
        false,

      text:
        "Install ACL App"
    });
  }
}


/* =========================================================
   INSTALL EVENTS
========================================================= */

window.addEventListener(
  "beforeinstallprompt",
  (
    event
  ) => {
    event.preventDefault();


    deferredInstallPrompt =
      event;


    const section =
      installSection();


    if (section) {
      section.hidden =
        false;
    }


    setInstallButton({
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


    window.dispatchEvent(
      new CustomEvent(
        "acl-install-available"
      )
    );
  }
);


window.addEventListener(
  "appinstalled",
  () => {
    deferredInstallPrompt =
      null;


    document.body.classList.add(
      "acl-running-standalone"
    );


    setInstallButton({
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
   INSTALL BUTTON
========================================================= */

function bindInstallButton() {
  const button =
    installButton();


  if (
    !button ||
    button.dataset
      .aclInstallBound ===
      "true"
  ) {
    return;
  }


  button.dataset
    .aclInstallBound =
      "true";


  button.addEventListener(
    "click",
    () => {
      void requestAppInstall();
    }
  );


  if (
    isRunningStandalone()
  ) {
    setInstallButton({
      hidden:
        true
    });


    setInstallStatus(
      "ACL is already installed on this device."
    );


    return;
  }


  if (
    isIosDevice &&
    isSafariBrowser
  ) {
    setInstallButton({
      hidden:
        false,

      disabled:
        false,

      text:
        "How to install on iPhone"
    });


    setInstallStatus(
      "Use Safari → Share → Add to Home Screen."
    );


    return;
  }


  setInstallButton({
    hidden:
      false,

    disabled:
      false,

    text:
      "Install ACL App"
  });
}


/* =========================================================
   START
========================================================= */

function startPwa() {
  bindInstallButton();


  if (
    !navigator.onLine
  ) {
    updateConnectionStatus();
  }


  getServiceWorkerRegistration()
    .catch(
      (
        error
      ) => {
        console.warn(
          "ACL service worker registration failed:",
          error
        );
      }
    );
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startPwa,
    {
      once:
        true
    }
  );
} else {
  startPwa();
}


/* =========================================================
   GLOBAL PWA API
========================================================= */

window.aclPwa = {
  getRegistration:
    getServiceWorkerRegistration,

  install:
    requestAppInstall,

  isInstalled:
    isRunningStandalone,

  isIos:
    () =>
      isIosDevice,

  installAvailable:
    () =>
      Boolean(
        deferredInstallPrompt
      ),

  showIosInstructions:
    showIosInstallInstructions
};
