/* Service Worker：讓網站可以離線刷題，並確保不會卡在舊版本。
 *
 * 快取策略刻意分兩種：
 *   HTML（題庫本體）：網路優先 → 有網路一定拿到最新版，沒網路才用快取。
 *                      這是關鍵，否則改了題目學生手機還在用舊的。
 *   圖示等靜態資源：   快取優先 → 這些很少變動，直接用快取比較快。
 *   /api/*：           完全不快取 → 排行榜與統計必須即時。
 *
 * 版本號改變時會清掉所有舊快取。每次要發布新版題庫就把 VERSION 加一。
 */
const VERSION = "v1";
const CACHE = "worksafe-" + VERSION;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).catch(() => { /* 個別檔案失敗不擋安裝 */ }))
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
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 外部資源不攔截
  if (url.pathname.startsWith("/api/")) return;      // API 一律走網路，不快取

  const isHTML = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // 網路優先：確保拿得到最新題庫；斷網才回快取
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // 其他靜態資源：快取優先
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
