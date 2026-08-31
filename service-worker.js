// =============================================================
// SERVICE WORKER: CACHE OFFLINE DO NEXT7
// =============================================================
// Sempre que arquivos importantes mudarem, altere o nome do cache.
// Isso força a instalação da versão nova nos celulares.
const CACHE_NAME = "next7-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/db.js",
  "./assets/js/app.js",
  "./assets/images/icon.svg",
];

// Instalação: guarda a estrutura principal do app no aparelho.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove versões antigas do cache.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Navegação: tenta buscar a versão nova; se estiver offline, usa o cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
