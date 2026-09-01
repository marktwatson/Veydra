// Service worker for web push notifications.
// Registered from src/lib/push.ts. Handles incoming push events and
// notification clicks (opens/focuses the app).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { body: event.data ? event.data.text() : "" };
    } catch (e2) {
      data = { body: "New notification" };
    }
  }

  // iOS/Safari's push implementation silently drops notifications whose
  // icon/badge isn't a real raster image (SVG is not supported there — the
  // showNotification() call can fail or no-op with zero visible error,
  // which is exactly the symptom of "send-push reports 201 ok but nothing
  // shows on the phone"). Use the PNG from the manifest instead of the SVG.
  const PNG_ICON =
    "https://vibe.filesafe.space/1785896143476160753/attachments/70e8de35-254d-4365-a8cc-fe2c6acdb517.png";

  const title = data.title || "Veydra";
  const options = {
    body: data.body || "",
    icon: data.icon || PNG_ICON,
    badge: data.badge || PNG_ICON,
    tag: data.tag || "veydra-notification",
    data: { url: data.url || "/" },
    requireInteraction: !!data.requireInteraction,
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      // Never let a bad icon/options silently swallow the notification —
      // retry with the safest possible payload so something always shows.
      console.error("[sw-push] showNotification failed, retrying plain:", err);
      return self.registration.showNotification(title, {
        body: options.body,
        tag: options.tag,
        data: options.data,
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if (targetUrl !== "/" && client.url.indexOf(targetUrl) === -1) {
            // navigate existing tab to the target if possible
            try {
              await client.navigate(targetUrl);
            } catch (e) {}
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
