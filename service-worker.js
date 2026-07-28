/* =========================================================
   ACL PWA SERVICE WORKER
========================================================= */

const CACHE_NAME =
  "acl-pwa-v1.3.0";


const BASE_PATH =
  "/Cardiology";


const OFFLINE_PAGE =
  `${BASE_PATH}/offline.html`;


const CORE_FILES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/login.html`,
  `${BASE_PATH}/pathways.html`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/assets/css/main.css`,
  `${BASE_PATH}/assets/images/acl-icon.svg`
];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(
          CACHE_NAME
        )
        .then(
          async (cache) => {
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
                  "ACL cache skipped:",
                  file,
                  error
                );
              }
            }
          }
        )
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
            (cacheNames) =>
              Promise.all(
                cacheNames
                  .filter(
                    (cacheName) =>
                      cacheName !==
                      CACHE_NAME
                  )
                  .map(
                    (cacheName) =>
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
   FORCE UPDATE
========================================================= */

self.addEventListener(
  "message",
  (event) => {
    if (
      event.data?.type ===
      "SKIP_WAITING"
    ) {
      self.skipWaiting();
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
     * Ignore requests outside this website.
     */

    if (
      requestUrl.origin !==
      self.location.origin
    ) {
      return;
    }


    /*
     * Ignore Supabase/API traffic.
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
      )
    ) {
      return;
    }


    /*
     * Page navigation:
     * network first, offline fallback.
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
            async (response) => {
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
            async () =>
              (
                await caches.match(
                  request
                )
              ) ||
              caches.match(
                OFFLINE_PAGE
              )
          )
      );

      return;
    }


    /*
     * Static assets:
     * cache first, then network.
     */

    event.respondWith(
      caches
        .match(
          request
        )
        .then(
          async (cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

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
          }
        )
    );
  }
);
