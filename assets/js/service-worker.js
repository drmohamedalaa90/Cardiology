/* =========================================================
   ACL PWA SERVICE WORKER
========================================================= */
const ACL_CACHE_VERSION =
  "acl-shell-v1.1.0";


const ACL_BASE =
  "/Cardiology";


const ACL_APP_SHELL = [
  `${ACL_BASE}/`,
  `${ACL_BASE}/index.html`,
  `${ACL_BASE}/login.html`,
  `${ACL_BASE}/pathways.html`,
  `${ACL_BASE}/modules.html`,
  `${ACL_BASE}/profile.html`,
  `${ACL_BASE}/progress.html`,
  `${ACL_BASE}/settings.html`,
  `${ACL_BASE}/offline.html`,
  `${ACL_BASE}/manifest.json`,
  `${ACL_BASE}/assets/css/main.css`,
  `${ACL_BASE}/assets/css/auth.css`,
  `${ACL_BASE}/assets/images/acl-icon.svg`
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
  `${ACL_BASE}/offline.html`
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
