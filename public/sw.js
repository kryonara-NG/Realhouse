const CACHE = "reelhouse-shell-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(hit => hit || caches.match("/index.html"))));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/#/home";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list => {
    const existing=list.find(c => "focus" in c);
    if(existing){existing.postMessage({type:"REELHOUSE_NOTIFICATION_CLICK",url:target});return existing.focus();}
    return clients.openWindow(target);
  }));
});
