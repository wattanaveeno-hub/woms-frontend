/* ENTECH service worker — push notifications + PWA */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "ENTECH", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "ENTECH แจ้งเตือน", {
      body: data.body || "",
      tag: data.tag || "woms",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) {
            try { await c.navigate(url); } catch (e) { /* ignore */ }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

/* ---- แคชหน้าเว็บแบบ network-first เพื่อให้แอปบนมือถือเปิดได้แม้สัญญาณไม่ดี ---- */
const CACHE = "woms-shell-v2";

// เครื่อง dev (localhost): ไม่แคชเลย ไฟล์ /_next/static ตอน dev ไม่มี hash ในชื่อ
// ถ้าแคชไว้ กด F5 แล้วจะได้โค้ดเก่ากลับมา
const IS_DEV_HOST = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

// ลบแคชเวอร์ชันเก่าทิ้งเมื่อ service worker ตัวใหม่เริ่มทำงาน
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE || IS_DEV_HOST).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (IS_DEV_HOST) return; // dev: ให้เบราว์เซอร์โหลดจาก dev server ตรง ๆ
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ไม่แตะ API ปลายทางอื่น

  // หน้าเว็บ: ลองออนไลน์ก่อน ถ้าไม่ได้ค่อยใช้แคชล่าสุด
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          return cached || caches.match("/m") || Response.error();
        }
      })()
    );
    return;
  }

  // ไฟล์ static ของแอป: ใช้แคชก่อนเพื่อให้เปิดไว
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      })()
    );
  }
});
