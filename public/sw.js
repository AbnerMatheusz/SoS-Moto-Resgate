// SOS Moto Resgate - Service Worker
const CACHE_NAME = 'sos-moto-v1';
const URLS_TO_CACHE = ['/', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Ignore cache.addAll errors for missing files
      return cache.addAll(URLS_TO_CACHE).catch(err => console.warn('Cache addAll warning:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🚨 SOS Moto Resgate';
  const options = {
    body: data.body || 'Nova solicitação de guincho!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'sos-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/dashboard',
    },
    actions: [
      { action: 'open', title: '📋 Ver Solicitação' },
      { action: 'close', title: 'Dispensar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Basic fetch handler (network first)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;
            
      // Se for navegação, tentar retornar a página inicial
      if (event.request.mode === 'navigate') {
        const homeCache = await caches.match('/');
        if (homeCache) return homeCache;
      }
      
      return Response.error();
    })
  );
});
