// web/sw-push.js
// El service worker que recibe los avisos. Vive fuera de la pagina: sigue
// escuchando aunque el cliente haya cerrado el navegador, y por eso un aviso
// llega aunque no tenga la web abierta.
//
// OJO: este archivo NO cachea nada ni intercepta peticiones. Solo notifica.
// Si algun dia se le anade cache, hay que pensarlo aparte -- un service worker
// que cachea mal deja a los clientes viendo una version vieja del sitio.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
    let d = {};
    try { d = evento.data ? evento.data.json() : {}; } catch (_) { d = {}; }

    const titulo = d.titulo || "Miami DJ Beat";
    const opciones = {
        body: d.mensaje || "",
        icon: "/assets/pwa/mdj-192.png",
        badge: "/assets/pwa/mdj-192.png",
        // La etiqueta agrupa: si llegan tres avisos del mismo evento, el
        // cliente ve uno actualizado y no tres seguidos.
        tag: d.tag || "mdj",
        renotify: true,
        data: { url: d.url || "/" },
    };
    evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    const destino = (evento.notification.data && evento.notification.data.url) || "/";
    evento.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abiertas) => {
            // Si ya tiene la web abierta, se reutiliza esa ventana en vez de
            // abrirle una tercera pestana igual.
            for (const c of abiertas) {
                if ("focus" in c) { c.navigate(destino); return c.focus(); }
            }
            return self.clients.openWindow(destino);
        }),
    );
});
