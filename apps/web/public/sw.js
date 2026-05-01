const ICON = "/brand/kwin-favicon-256.png";
const BADGE = "/brand/kwin-favicon-32.png";

self.addEventListener("push", (e) => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: "kwin", body: e.data.text(), type: "notification", url: "/" };
  }

  e.waitUntil(
    self.registration.showNotification(data.title || "kwin", {
      body: data.body || data.message || "",
      icon: ICON,
      badge: BADGE,
      tag: data.type || "kwin-notification",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const existing = list.find((c) => "focus" in c);
        if (existing) {
          existing.navigate(url);
          return existing.focus();
        }
        return clients.openWindow(url);
      })
  );
});
