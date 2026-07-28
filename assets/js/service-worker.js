/* =========================================================
   ACL PWA SERVICE WORKER
========================================================= */
const ACL_CACHE_VERSION =
  "acl-shell-v1.0.1";

const ACL_APP_SHELL = [
  "/",
  "/index.html",
  "/login.html",
  "/pathways.html",
  "/modules.html",
  "/profile.html",
  "/progress.html",
  "/settings.html",
  "/offline.html",
  "/manifest.json",
  "/assets/css/main.css",
  "/assets/css/auth.css"
];


/* =========================================================
   INSTALL
========================================================= */

event.waitUntil(
  caches
    .open(
      ACL_CACHE_VERSION
    )
    .then(
      async (cache) => {
        for (
          const resource of
          ACL_APP_SHELL
        ) {
          try {
            await cache.add(
              resource
            );
          } catch (error) {
            console.warn(
              "ACL PWA could not pre-cache:",
              resource,
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
      caches
        .keys()
        .then(
          (cacheNames) =>
            Promise.all(
              cacheNames
                .filter(
                  (cacheName) =>
                    cacheName !==
                    ACL_CACHE_VERSION
                )
                .map(
                  (cacheName) =>
                    caches.delete(
                      cacheName
                    )
                )
            )
        )
    );

    self.clients.claim();
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
     * Do not cache Supabase/API requests.
     */

    if (
      requestUrl.hostname.includes(
        "supabase"
      )
    ) {
      return;
    }


    /*
     * HTML navigation:
     * Try network first, then cached page, then offline page.
     */

    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        fetch(request)
          .then(
            (response) => {
              const copy =
                response.clone();

              caches
                .open(
                  ACL_CACHE_VERSION
                )
                .then(
                  (cache) =>
                    cache.put(
                      request,
                      copy
                    )
                );

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
                "/offline.html"
              )
          )
      );

      return;
    }


    /*
     * Static files:
     * Use cache first, then network.
     */

    event.respondWith(
      caches
        .match(
          request
        )
        .then(
          (cachedResponse) =>
            cachedResponse ||
            fetch(request)
              .then(
                (response) => {
                  if (
                    !response ||
                    response.status !==
                      200
                  ) {
                    return response;
                  }

                  const copy =
                    response.clone();

                  caches
                    .open(
                      ACL_CACHE_VERSION
                    )
                    .then(
                      (cache) =>
                        cache.put(
                          request,
                          copy
                        )
                    );

                  return response;
                }
              )
        )
    );
  }
);
