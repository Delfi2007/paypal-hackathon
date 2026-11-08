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
