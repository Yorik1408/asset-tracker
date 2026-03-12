const CACHE_NAME = 'asset-tracker-v2.0';

self.addEventListener('install', (event) => {
  console.log('Service Worker установлен');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker активирован');
  event.waitUntil(self.clients.claim());
});

// Простая стратегия кэширования
self.addEventListener('fetch', (event) => {
  // Пропускаем API запросы
  if (event.request.url.includes('/api/') || event.request.url.includes(':8000')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      // Если сеть недоступна, возвращаем основную страницу
      return caches.match('/');
    })
  );
});
