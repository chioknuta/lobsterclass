/* LobsterClass service worker — offline support + install */
const CACHE = "lobsterclass-v6";
// "index.html" is the app on localhost and the landing page on the deployed site;
// "app.html" only exists on the deployed site. Added individually so one missing
// entry can't fail the whole install the way cache.addAll() would.
const SHELL = ["./", "index.html", "app.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];
const APP = "app.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept API calls or cross-origin requests
  if (url.origin !== location.origin) return;

  // Network-first for navigations so updates land; cache fallback for offline.
  // Each page is cached under its own URL — caching every navigation under one
  // key would make the last page you visited the offline copy of every page.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match(APP)))
    );
    return;
  }

  // Cache-first for same-origin assets (audio, seed, icons), fill cache on miss
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
    )
  );
});
