// ネットワーク優先・失敗時はキャッシュ。更新がすぐ反映され、オフラインでも開ける。
const CACHE = 'hibi-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/date.js',
  'js/icons.js',
  'js/ui.js',
  'js/sheet.js',
  'js/links.js',
  'js/editors.js',
  'js/alarm.js',
  'js/todos.js',
  'js/views/todo.js',
  'js/views/today.js',
  'js/views/calendar.js',
  'js/views/diary.js',
  'js/views/settings.js',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
