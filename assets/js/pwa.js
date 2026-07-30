/* =========================================================
   ACL PWA REGISTRATION AND INSTALLATION
   Version: 1.8.0
========================================================= */

console.log(
  "ACL PWA v1.8.0 LOADED"
);


let deferredInstallPrompt =
  null;


let serviceWorkerRegistration =
  null;


let serviceWorkerReadyPromise =
  null;


/* =========================================================
   PLATFORM
========================================================= */

const runningStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone ===
    true;


const isIosDevice =
  /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );


const isSafariBrowser =
  /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
    navigator.userAgent
  );


/* =========================================================
   ELEMENTS
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
   INSTALL STATUS
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


function setInstallButton(
  {
    hidden,
    disabled,
    text
  } = {}
) {
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


  if (text) {
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
    byId(
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


  byId(
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


          if (
            registration.waiting
          ) {
            registration.waiting
              .postMessage({
                type:
                  "SKIP_WAITING"
              });
          }


          if (
            "caches" in
            window
          ) {
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
          }


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
        } catch (
          error
        ) {
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
        "/Cardiology/service-worker.js",
        {
          scope:
            "/Cardiology/"
        }
      );


  console.log(
    "ACL PWA registered:",
    serviceWorkerRegistration.scope
  );


  serviceWorkerRegistration
    .addEventListener(
      "updatefound",
      () => {
        const installingWorker =
          serviceWorkerRegistration
            .installing;


        if (!installingWorker) {
          return;
        }


        installingWorker
          .addEventListener(
            "statechange",
            () => {
              if (
                installingWorker.state ===
                  "installed" &&
                navigator.serviceWorker
                  .controller
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
    })();


  window.aclServiceWorkerReady =
    serviceWorkerReadyPromise;


  return serviceWorkerReadyPromise;
}


if (
  "serviceWorker" in
  navigator
) {
  window.addEventListener(
    "load",
    () => {
      void getServiceWorkerRegistration()
        .catch(
          (
            error
          ) => {
            console.error(
              "ACL PWA registration failed:",
              error
            );


            setInstallStatus(
              "App installation is temporarily unavailable."
            );
          }
        );
    },
    {
      once:
        true
    }
  );
}


/* =========================================================
   IOS INSTRUCTIONS
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
    runningStandalone
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
        "Installation was cancelled. You can continue in the browser."
      );
    }


    deferredInstallPrompt =
      null;


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
   BUTTON BINDING
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
    requestAppInstall
  );


  if (
    runningStandalone
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

    text:
      "Install ACL App"
  });
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    bindInstallButton,
    {
      once:
        true
    }
  );
} else {
  bindInstallButton();
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
    () =>
      runningStandalone,

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
