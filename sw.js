const CACHE = 'operation-clinic-v80-clean-recovery';

const STATIC = [
  './',
  './index.html',
  './app.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/supabase-client.js',
  './js/auth.js',
  './js/core.js',
  './js/dashboard.js',
  './js/schedules.js',
  './js/patients.js',
  './js/appointments.js',
  './js/booking-workflow-hotfix.js',
  './js/clinical.js',
  './js/referrals.js',
  './js/notifications.js',
  './js/push-notifications.js',
  './js/finance.js',
  './js/logistics.js',
  './js/attendance.js',
  './js/admin.js',
  './js/reports.js',
  './js/pwa.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/alaa-clinic-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (
    !request.url.startsWith('http://') &&
    !request.url.startsWith('https://')
  ) {
    return;
  }

  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    return;
  }

  if (
    url.pathname.endsWith('/book.html') ||
    url.pathname.endsWith('/directions.html') ||
    url.pathname.endsWith('/js/public-booking-time-guard.js')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'opaque'
        ) {
          return response;
        }

        const copy = response.clone();

        event.waitUntil(
          caches.open(CACHE)
            .then(cache => cache.put(request, copy))
            .catch(error => {
              console.warn('Cache write skipped:', error);
            })
        );

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        if (request.mode === 'navigate') {
          return await caches.match('./index.html');
        }

        throw new Error('Network unavailable');
      })
  );
});

self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'Clinic notification',
      body: event.data?.text() || ''
    };
  }

  const icon = new URL(
    'assets/alaa-clinic-logo.png',
    self.registration.scope
  ).href;

  const tag =
    data.tag ||
    (
      data.appointmentId
        ? `booking-${data.appointmentId}`
        : 'clinic-notification'
    );

  event.waitUntil((async () => {
    const existing =
      await self.registration.getNotifications({ tag });

    existing.forEach(notification => notification.close());

    await self.registration.showNotification(
      data.title || 'Clinic notification',
      {
        body: data.body || '',
        icon,
        badge: icon,
        tag,
        renotify: false,
        data: {
          url: data.url || 'app.html',
          appointmentId: data.appointmentId || null,
          threadId: data.threadId || null,
          type: data.type || null
        }
      }
    );
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || 'app.html',
    self.registration.scope
  ).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(async windows => {
      for (const client of windows) {
        if ('navigate' in client) {
          try {
            await client.navigate(targetUrl);
          } catch (error) {
            console.warn(
              'Notification navigation failed',
              error
            );
          }

          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
