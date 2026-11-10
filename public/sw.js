// Service worker: shows Kitty's push notifications and opens the right page on click.
self.addEventListener("push", (event) => {
  let data = { title: "Kitty", body: "", href: "/app" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { href: data.href || "/app" },
      tag: data.href,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(href); return c.focus(); }
      return self.clients.openWindow(href);
    }),
  );
});

// Installable app shell: pages always come from the network (money data must be live);
// if the network is down, show a small offline page instead of a browser error.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(() => new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f7ff;color:#14183a;text-align:center"><div><h1>You are offline</h1><p>Kitty needs a connection to move real money safely. Try again when you are back online.</p></div>',
      { headers: { "Content-Type": "text/html" } },
    )),
  );
});
