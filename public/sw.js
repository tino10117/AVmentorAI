// ═══════════════════════════════════════════════════════════════
// AVAI Service Worker — v1.0
//
// Hace 3 cosas:
// 1. Cachea los assets estáticos (CSS, JS, íconos) para que la app
//    cargue al instante después de la primera vez.
// 2. Funciona offline: si no hay internet, sirve lo cacheado.
// 3. Se actualiza solo cuando subís una versión nueva.
//
// IMPORTANTE: NO cachea las llamadas a /api/* porque siempre
// queremos los datos frescos del servidor.
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = "avai-v1.0.0";
const CACHE_NAME = `avai-${CACHE_VERSION}`;

// Assets críticos que se cachean en la instalación
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/js/app.js",
  "/js/ui.js",
  "/js/auth-extra.js",
  "/js/admin-extra.js",
  "/js/lessons.js",
  "/js/voice.js",
  "/js/mercadopago-ui.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.json",
];

// ─── INSTALACIÓN: precachear assets ─────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando AVAI v" + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cacheamos en paralelo, ignorando los que fallen (por si algún archivo no existe aún)
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn("[SW] No se pudo cachear:", url);
            })
          )
        );
      })
      .then(() => self.skipWaiting()) // Activar el SW nuevo al toque
  );
});

// ─── ACTIVACIÓN: borrar caches viejas ───────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activando AVAI v" + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("avai-") && name !== CACHE_NAME)
          .map((name) => {
            console.log("[SW] Borrando cache vieja:", name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Tomar control de todas las pestañas
  );
});

// ─── FETCH: estrategia de cache ─────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🚫 NO cachear:
  // - Llamadas a APIs (queremos datos frescos siempre)
  // - Requests que no son GET (POST, PATCH, etc)
  // - Peticiones a otros dominios (OpenAI, MercadoPago, etc)
  if (
    url.pathname.startsWith("/api/") ||
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return; // Dejar que el navegador maneje normal
  }

  // 📱 Para navegación HTML: Network-first (siempre intentar fresco)
  // Si falla (offline), servir del cache
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Guardar copia en cache para próxima vez
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          // Sin internet: servir del cache
          return caches.match(request).then((cached) => cached || caches.match("/"));
        })
    );
    return;
  }

  // 💎 Para assets estáticos (CSS, JS, imágenes): Cache-first
  // Más rápido y ahorra datos
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Devolver del cache + actualizar en background (stale-while-revalidate)
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
            }
          })
          .catch(() => {});
        return cached;
      }

      // No está en cache: ir a la red y cachear
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Si es una imagen y no hay red, devolver placeholder
          if (request.destination === "image") {
            return new Response("", { status: 404 });
          }
          throw new Error("Sin conexión");
        });
    })
  );
});

// ─── MENSAJE: forzar actualización desde la app ─────────────────
self.addEventListener("message", (event) => {
  if (event.data?.action === "skipWaiting") {
    self.skipWaiting();
  }
});
