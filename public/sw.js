// Notifications du navigateur (formule Premium). Ce fichier ne met rien en
// cache : il ne sert qu'à afficher une notification reçue et à ouvrir la
// bonne page quand on la touche.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "AdminPilot", {
      body: data.body || "",
      icon: "/apple-icon",
      badge: "/apple-icon",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/alertes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/alertes", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
