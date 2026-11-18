// Service Worker（build.py が public/sw.js に出力）
// ・ゲーム本体は「ネット優先・つながらなければ保存済みを使う」→ 更新がすぐ反映され、圏外でも遊べる
// ・three.js・フォント・アイコンは保存済みを優先（読み込みを速く）
// ・/api/（購入・復元）は保存しない
const CACHE = "gh-__VERSION__";
const PRE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "__THREE__"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok && url.origin === location.origin && url.pathname === "/") { const c = r.clone(); caches.open(CACHE).then((k) => k.put("/", c)); }
      return r;
    }).catch(() => caches.match("/")));
    return;
  }
  const sameAsset = url.origin === location.origin && /^\/(icons\/|manifest\.webmanifest|ogp\.png)/.test(url.pathname);
  const cdn = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!sameAsset && !cdn) return;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); }
    return r;
  })));
});
