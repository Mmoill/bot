// Service worker: web push display + click-through. No caching of /api.
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {title:'Desk', body:''};
  e.waitUntil(self.registration.showNotification(d.title, {body:d.body, data:{url:d.url}, icon:'/icons/icon-192.png'}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.notification.data && e.notification.data.url) e.waitUntil(clients.openWindow(e.notification.data.url));
});
