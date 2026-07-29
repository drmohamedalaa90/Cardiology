/* =========================================================
   ACL PWA SERVICE WORKER
   Version: 1.12.0
========================================================= */

const CACHE_NAME =
  "acl-pwa-v1.12.0";


const CACHE_PREFIX =
  "acl-pwa-";


const BASE_PATH =
  "/Cardiology";


const OFFLINE_PAGE =
  `${BASE_PATH}/offline.html`;


const DEFAULT_NOTIFICATION_URL =
  `${BASE_PATH}/notifications.html`;


const DEFAULT_NOTIFICATION_ICON =
  `${BASE_PATH}/assets/images/acl-icon-192.png`;


const DEFAULT_NOTIFICATION_BADGE =
  `${BASE_PATH}/assets/images/acl-icon-192.png`;


const CORE_FILES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/login.html`,
  `${BASE_PATH}/pathways.html`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/assets/css/main.css`,
  `${BASE_PATH}/assets/images/acl-icon-192.png`,
  `${BASE_PATH}/assets/images/acl-icon-512.png`,
  `${BASE_PATH}/assets/images/acl-icon-maskable-512.png`
];


/* =========================================================
   HELPERS
========================================================= */

function safeNotificationUrl(
  value
) {
  try {
    const url =
      new URL(
        value ||
        DEFAULT_NOTIFICATION_URL,
        self.location.origin
      );


    if (
      url.origin !==
      self.location.origin
    ) {
      return DEFAULT_NOTIFICATION_URL;
    }


    if (
      !url.pathname.startsWith(
        `${BASE_PATH}/`
      ) &&
      url.pathname !==
        `${BASE_PATH}/`
    ) {
      return DEFAULT_NOTIFICATION_URL;
    }


    return (
      `${url.pathname}` +
      `${url.search}` +
      `${url.hash}`
    );
  } catch (error) {
    console.warn(
      "ACL INVALID NOTIFICATION URL:",
      value,
      error
    );


    return DEFAULT_NOTIFICATION_URL;
  }
}


function normalizePushPayload(
  event
) {
  const fallbackPayload = {
    title:
      "Alexandria Cardiology League",

    body:
      "You have a new ACL notification.",

    icon:
      DEFAULT_NOTIFICATION_ICON,

    badge:
      DEFAULT_NOTIFICATION_BADGE,

    url:
      DEFAULT_NOTIFICATION_URL,

    tag:
      `acl-${Date.now()}`,

    type:
      "system",

    edition:
      null,

    requireInteraction:
      false,

    silent:
      false,

    actions:
      []
  };


  if (!event.data) {
    return fallbackPayload;
  }


  try {
    const parsed =
      event.data.json();


    if (
      parsed &&
      typeof parsed ===
      "object"
    ) {
      return {
        ...fallbackPayload,
        ...parsed,

        data: {
          ...(
            parsed.data ||
            {}
          )
        }
      };
    }
  } catch (jsonError) {
    try {
      const text =
        event.data.text();


      if (text) {
        return {
          ...fallbackPayload,
          body:
            text
        };
      }
    } catch (textError) {
      console.warn(
        "ACL PUSH PAYLOAD ERROR:",
        jsonError,
        textError
      );
    }
  }


  return fallbackPayload;
}


function normalizeActions(
  actions
) {
  if (
    !Array.isArray(
      actions
    )
  ) {
    return [];
  }


  return actions
    .filter(
      (action) =>
        action &&
        typeof action ===
          "object" &&
        action.action &&
        action.title
    )
    .slice(
      0,
      2
    )
    .map(
      (action) => ({
        action:
          String(
            action.action
          ),

        title:
          String(
            action.title
          ),

        icon:
          action.icon
            ? String(
                action.icon
              )
            : undefined
      })
    );
}


async function cacheCoreFiles() {
  const cache =
    await caches.open(
      CACHE_NAME
    );


  for (
    const file of
    CORE_FILES
  ) {
    try {
      await cache.add(
        file
      );
    } catch (error) {
      console.warn(
        "ACL CACHE SKIPPED:",
        file,
        error
      );
    }
  }
}


async function broadcastToClients(
  message
) {
  const clientList =
    await self.clients.matchAll({
      type:
        "window",

      includeUncontrolled:
        true
    });


  for (
    const client of
    clientList
  ) {
    client.postMessage(
      message
    );
  }
}


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      cacheCoreFiles()
    );


    self.skipWaiting();
  }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      Promise.all([
        caches
          .keys()
          .then(
            (
              cacheNames
            ) =>
              Promise.all(
                cacheNames
                  .filter(
                    (
                      cacheName
                    ) =>
                      cacheName.startsWith(
                        CACHE_PREFIX
                      ) &&
                      cacheName !==
                        CACHE_NAME
                  )
                  .map(
                    (
                      cacheName
                    ) =>
                      caches.delete(
                        cacheName
                      )
                  )
              )
          ),

        self.clients.claim()
      ])
    );
  }
);


/* =========================================================
   MESSAGES
========================================================= */

self.addEventListener(
  "message",
  (event) => {
    const message =
      event.data ||
      {};


    if (
      message.type ===
      "SKIP_WAITING"
    ) {
      self.skipWaiting();


      return;
    }


    if (
      message.type ===
      "CLEAR_ACL_CACHE"
    ) {
      event.waitUntil(
        caches
          .keys()
          .then(
            (
              cacheNames
            ) =>
              Promise.all(
                cacheNames
                  .filter(
                    (
                      cacheName
                    ) =>
                      cacheName.startsWith(
                        CACHE_PREFIX
                      )
                  )
                  .map(
                    (
                      cacheName
                    ) =>
                      caches.delete(
                        cacheName
                      )
                  )
              )
          )
      );


      return;
    }


    if (
      message.type ===
      "SHOW_NOTIFICATION"
    ) {
      const payload =
        message.payload ||
        {};


      const notificationUrl =
        safeNotificationUrl(
          payload.url ||
          payload.data?.url
        );


      event.waitUntil(
        self.registration
          .showNotification(
            payload.title ||
            "Alexandria Cardiology League",
            {
              body:
                payload.body ||
                "You have a new ACL notification.",

              icon:
                payload.icon ||
                DEFAULT_NOTIFICATION_ICON,

              badge:
                payload.badge ||
                DEFAULT_NOTIFICATION_BADGE,

              image:
                payload.image ||
                undefined,

              tag:
                payload.tag ||
                `acl-${Date.now()}`,

              renotify:
                Boolean(
                  payload.renotify
                ),

              requireInteraction:
                Boolean(
                  payload.requireInteraction
                ),

              silent:
                Boolean(
                  payload.silent
                ),

              vibrate:
                Array.isArray(
                  payload.vibrate
                )
                  ? payload.vibrate
                  : [
                      150,
                      80,
                      150
                    ],

              actions:
                normalizeActions(
                  payload.actions
                ),

              data: {
                ...(
                  payload.data ||
                  {}
                ),

                url:
                  notificationUrl
              }
            }
          )
      );
    }
  }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;


    if (
      request.method !==
      "GET"
    ) {
      return;
    }


    const requestUrl =
      new URL(
        request.url
      );


    /*
     * Ignore requests outside the ACL website.
     */

    if (
      requestUrl.origin !==
      self.location.origin
    ) {
      return;
    }


    /*
     * Ignore requests outside /Cardiology/.
     */

    if (
      !requestUrl.pathname.startsWith(
        `${BASE_PATH}/`
      ) &&
      requestUrl.pathname !==
        `${BASE_PATH}/`
    ) {
      return;
    }


    /*
     * Never cache API or authentication traffic.
     */

    if (
      requestUrl.hostname.includes(
        "supabase"
      ) ||
      requestUrl.pathname.includes(
        "/rest/v1/"
      ) ||
      requestUrl.pathname.includes(
        "/auth/v1/"
      ) ||
      requestUrl.pathname.includes(
        "/functions/v1/"
      ) ||
      requestUrl.pathname.includes(
        "/storage/v1/"
      )
    ) {
      return;
    }


    /*
     * HTML navigation:
     * network first, cached page second,
     * offline page last.
     */

    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        fetch(
          request
        )
          .then(
            async (
              response
            ) => {
              if (
                response &&
                response.ok
              ) {
                const cache =
                  await caches.open(
                    CACHE_NAME
                  );


                await cache.put(
                  request,
                  response.clone()
                );
              }


              return response;
            }
          )
          .catch(
            async () => {
              const cachedPage =
                await caches.match(
                  request
                );


              if (cachedPage) {
                return cachedPage;
              }


              const offlinePage =
                await caches.match(
                  OFFLINE_PAGE
                );


              if (offlinePage) {
                return offlinePage;
              }


              return new Response(
                "ACL is currently offline.",
                {
                  status:
                    503,

                  headers: {
                    "Content-Type":
                      "text/plain; charset=utf-8"
                  }
                }
              );
            }
          )
      );


      return;
    }


    /*
     * Static files:
     * cached response first, network second.
     */

    event.respondWith(
      caches
        .match(
          request
        )
        .then(
          async (
            cachedResponse
          ) => {
            if (cachedResponse) {
              return cachedResponse;
            }


            try {
              const networkResponse =
                await fetch(
                  request
                );


              if (
                networkResponse &&
                networkResponse.ok
              ) {
                const cache =
                  await caches.open(
                    CACHE_NAME
                  );


                await cache.put(
                  request,
                  networkResponse.clone()
                );
              }


              return networkResponse;
            } catch (error) {
              console.warn(
                "ACL STATIC FETCH FAILED:",
                request.url,
                error
              );


              throw error;
            }
          }
        )
    );
  }
);


/* =========================================================
   PUSH NOTIFICATIONS
========================================================= */

self.addEventListener(
  "push",
  (event) => {
    const payload =
      normalizePushPayload(
        event
      );


    const notificationUrl =
      safeNotificationUrl(
        payload.url ||
        payload.action_url ||
        payload.data?.url
      );


    const notificationOptions = {
      body:
        payload.body ||
        payload.message ||
        "You have a new ACL notification.",

      icon:
        payload.icon ||
        DEFAULT_NOTIFICATION_ICON,

      badge:
        payload.badge ||
        DEFAULT_NOTIFICATION_BADGE,

      image:
        payload.image ||
        undefined,

      tag:
        payload.tag ||
        payload.notification_id ||
        `acl-${Date.now()}`,

      renotify:
        Boolean(
          payload.renotify
        ),

      requireInteraction:
        Boolean(
          payload.requireInteraction
        ),

      silent:
        Boolean(
          payload.silent
        ),

      vibrate:
        Array.isArray(
          payload.vibrate
        )
          ? payload.vibrate
          : [
              150,
              80,
              150
            ],

      timestamp:
        Number.isFinite(
          Number(
            payload.timestamp
          )
        )
          ? Number(
              payload.timestamp
            )
          : Date.now(),

      actions:
        normalizeActions(
          payload.actions
        ),

      data: {
        ...(
          payload.data ||
          {}
        ),

        url:
          notificationUrl,

        defaultUrl:
          notificationUrl,

        notificationId:
          payload.notification_id ||
          payload.id ||
          null,

        edition:
          payload.edition ||
          null,

        type:
          payload.type ||
          payload.notification_type ||
          "system",

        actionUrls:
          payload.action_urls &&
          typeof payload.action_urls ===
            "object"
            ? payload.action_urls
            : {}
      }
    };


    event.waitUntil(
      Promise.all([
        self.registration
          .showNotification(
            payload.title ||
            "Alexandria Cardiology League",
            notificationOptions
          ),

        broadcastToClients({
          type:
            "ACL_PUSH_RECEIVED",

          payload: {
            title:
              payload.title ||
              "Alexandria Cardiology League",

            body:
              notificationOptions.body,

            url:
              notificationUrl,

            notificationId:
              notificationOptions.data
                .notificationId
          }
        })
      ])
    );
  }
);


/* =========================================================
   NOTIFICATION CLICK
========================================================= */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();


    const notificationData =
      event.notification.data ||
      {};


    const actionUrls =
      notificationData.actionUrls &&
      typeof notificationData.actionUrls ===
        "object"
        ? notificationData.actionUrls
        : {};


    const selectedActionUrl =
      event.action &&
      actionUrls[
        event.action
      ]
        ? actionUrls[
            event.action
          ]
        : null;


    const targetPath =
      safeNotificationUrl(
        selectedActionUrl ||
        notificationData.url ||
        notificationData.defaultUrl
      );


    const targetUrl =
      new URL(
        targetPath,
        self.location.origin
      ).href;


    event.waitUntil(
      self.clients
        .matchAll({
          type:
            "window",

          includeUncontrolled:
            true
        })
        .then(
          async (
            clientList
          ) => {
            for (
              const client of
              clientList
            ) {
              try {
                const clientUrl =
                  new URL(
                    client.url
                  );


                if (
                  clientUrl.origin ===
                  self.location.origin &&
                  "focus" in client
                ) {
                  await client.focus();


                  if (
                    "navigate" in client
                  ) {
                    await client.navigate(
                      targetUrl
                    );
                  }


                  return client;
                }
              } catch (error) {
                console.warn(
                  "ACL CLIENT NAVIGATION ERROR:",
                  error
                );
              }
            }


            if (
              self.clients.openWindow
            ) {
              return self.clients.openWindow(
                targetUrl
              );
            }


            return null;
          }
        )
    );
  }
);


/* =========================================================
   NOTIFICATION CLOSED
========================================================= */

self.addEventListener(
  "notificationclose",
  (event) => {
    const notificationData =
      event.notification.data ||
      {};


    event.waitUntil(
      broadcastToClients({
        type:
          "ACL_NOTIFICATION_CLOSED",

        notificationId:
          notificationData.notificationId ||
          null
      })
    );
  }
);


/* =========================================================
   PUSH SUBSCRIPTION CHANGE
========================================================= */

self.addEventListener(
  "pushsubscriptionchange",
  (event) => {
    event.waitUntil(
      broadcastToClients({
        type:
          "ACL_PUSH_SUBSCRIPTION_CHANGED",

        message:
          "The push subscription changed and should be registered again."
      })
    );
  }
);
