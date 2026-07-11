/// <reference lib="webworker" />
const sw = self as ServiceWorkerGlobalScope;

sw.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    sw.registration.showNotification(data.title || "s.chat", {
      body: data.body || "You have a new message",
      icon: "/convex.svg",
      badge: "/convex.svg",
      data: data.url || "/",
      actions: [{ action: "open", title: "Open" }],
    })
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    sw.clients.matchAll({ type: "window" }).then((clients) => {
      const url = event.notification.data || "/";
      for (const client of clients) {
        if (client.url.includes(sw.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return sw.clients.openWindow(url);
    })
  );
});
