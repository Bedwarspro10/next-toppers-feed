// Firebase Cloud Messaging Service Worker
// Enables background push notifications for announcements

importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js");

// Firebase config will be injected at runtime if VAPID key is configured
// For now this service worker handles background message display

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.notification?.title ?? "📢 New Announcement — NextToppers";
    const body = data.notification?.body ?? "A new announcement has been posted!";
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/nexttoppers-logo.png",
        badge: "/nexttoppers-logo.png",
        tag: data.data?.id ?? "announcement",
        requireInteraction: false,
        data: { url: data.data?.url ?? "/" },
      })
    );
  } catch { /* ignore malformed push */ }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
