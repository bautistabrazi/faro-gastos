/* ============================================================================
 * sw.js — Service Worker de Faro
 * ----------------------------------------------------------------------------
 * Lo que permite instalar la app y que funcione sin internet una vez que se
 * cargó una vez. Dos estrategias de cache, según el tipo de archivo:
 *
 *   - "network-first" para el HTML/CSS/JS propios de la app: siempre intenta
 *     traer la versión más nueva de internet primero, y solo si falla (sin
 *     conexión) usa la que quedó guardada. Así, si subimos un cambio, se ve
 *     apenas hay señal, y no queda "pegado" a una versión vieja.
 *   - "cache-first" para cosas externas que casi no cambian (las tipografías
 *     de Google Fonts): si ya está guardada, se usa directo (más rápido y
 *     funciona offline), y si no, se busca en internet y se guarda para la
 *     próxima. La librería de Supabase ya NO es externa (ver
 *     js/vendor/supabase.js) — al ser del mismo origen, sigue la rama
 *     "network-first" de acá abajo, como el resto del código propio.
 *
 * Los pedidos a la API de Supabase (autenticación, guardar/traer datos) NO se
 * tocan acá: van directo a internet, sin pasar por ningún cache. Si fallan
 * por estar offline, es js/nube.js quien se hace cargo (la app sigue andando
 * con los datos locales).
 *
 * IMPORTANTE: si cambiás los archivos de la lista PRECARGA, o subís el "?v="
 * de index.html, subí también CACHE_VERSION acá abajo. Si no, los navegadores
 * que ya instalaron la app pueden seguir viendo una versión vieja cacheada.
 * ==========================================================================*/

"use strict";

var CACHE_VERSION = "faro-v10";

// Archivos que se guardan apenas se instala el Service Worker, para que la
// app abra offline incluso la primera vez que se instala sin conexión previa.
// Tienen que coincidir con lo que pide index.html (mismo "?v=").
var PRECARGA = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/tema-inicial.js?v=16",
  "./js/vendor/supabase.js?v=16",
  "./css/base.css?v=16",
  "./css/componentes.css?v=16",
  "./css/layout.css?v=16",
  "./js/config.js?v=16",
  "./js/formato.js?v=16",
  "./js/nucleo.js?v=16",
  "./js/almacenamiento.js?v=16",
  "./js/iconos.js?v=16",
  "./js/tema.js?v=16",
  "./js/nube.js?v=16",
  "./js/vista-gastos.js?v=16",
  "./js/vista-ingresos.js?v=16",
  "./js/vista-proyeccion.js?v=16",
  "./js/vista-ajustes.js?v=16",
  "./js/app.js?v=16",
  "./assets/icono.svg",
  "./assets/icono-192.png",
  "./assets/icono-512.png",
  "./assets/icono-maskable-192.png",
  "./assets/icono-maskable-512.png",
  "./assets/apple-touch-icon.png",
];

/* ------------------------------------------------------------------
 * install
 * Se dispara una sola vez, cuando el navegador ve un sw.js nuevo (o el
 * primero). Descarga y guarda todo PRECARGA en un cache con el nombre de
 * esta versión. skipWaiting() hace que el SW nuevo tome control apenas
 * termine, sin esperar a que se cierren todas las pestañas viejas.
 * ---------------------------------------------------------------- */
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // {cache: "reload"} para no traer estos archivos desde el cache HTTP
      // del navegador: queremos la versión de red posta al instalar.
      return cache.addAll(PRECARGA.map(function (url) {
        return new Request(url, { cache: "reload" });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ------------------------------------------------------------------
 * activate
 * Se dispara cuando este SW pasa a estar activo. Borra los caches de
 * versiones anteriores (CACHE_VERSION viejos) para no acumular basura, y
 * clients.claim() para que tome control de las pestañas ya abiertas sin
 * necesidad de recargarlas manualmente.
 * ---------------------------------------------------------------- */
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres
          .filter(function (nombre) { return nombre !== CACHE_VERSION; })
          .map(function (nombre) { return caches.delete(nombre); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ------------------------------------------------------------------
 * esApiDeSupabase(url)
 * true si el pedido es contra el backend de Supabase (autenticación o
 * guardar/traer datos): esos nunca se cachean, van siempre a internet.
 * ---------------------------------------------------------------- */
function esApiDeSupabase(url) {
  return /\.supabase\.co$/.test(url.hostname);
}

/* ------------------------------------------------------------------
 * redNegocioCache(pedido)
 * Estrategia "network-first": intenta buscar en internet; si responde bien,
 * guarda una copia en el cache y la devuelve. Si la red falla (sin
 * conexión), devuelve lo que haya en el cache; si tampoco hay nada, se
 * propaga el error (no hay mucho más para hacer).
 * ---------------------------------------------------------------- */
function redPrimeroCache(pedido) {
  return fetch(pedido).then(function (respuesta) {
    var copia = respuesta.clone(); // el body de una Response solo se puede leer una vez
    caches.open(CACHE_VERSION).then(function (cache) { cache.put(pedido, copia); });
    return respuesta;
  }).catch(function () {
    return caches.match(pedido).then(function (enCache) {
      if (enCache) return enCache;
      throw new Error("Sin red y sin cache para " + pedido.url);
    });
  });
}

/* ------------------------------------------------------------------
 * cachePrimeroRed(pedido)
 * Estrategia "cache-first": si ya está guardado, lo devuelve directo (ni
 * pasa por la red). Si no está, lo busca en internet, lo guarda para la
 * próxima, y lo devuelve.
 * ---------------------------------------------------------------- */
function cachePrimeroRed(pedido) {
  return caches.match(pedido).then(function (enCache) {
    if (enCache) return enCache;
    return fetch(pedido).then(function (respuesta) {
      var copia = respuesta.clone();
      caches.open(CACHE_VERSION).then(function (cache) { cache.put(pedido, copia); });
      return respuesta;
    });
  });
}

/* ------------------------------------------------------------------
 * fetch
 * Se dispara en CADA pedido que hace la página (HTML, CSS, JS, fuentes,
 * llamadas a Supabase, etc.). Acá decidimos, según el tipo de pedido, con
 * cuál de las dos estrategias de arriba responder.
 * ---------------------------------------------------------------- */
self.addEventListener("fetch", function (evento) {
  var pedido = evento.request;
  var url = new URL(pedido.url);

  // Solo nos metemos con GET: los POST/PATCH/etc. (login, guardar datos)
  // tienen que ir directo a la red, tal cual, sin pasar por ningún cache.
  if (pedido.method !== "GET") return;

  // Los pedidos a Supabase (auth + datos) tampoco se tocan: siempre a la red.
  if (esApiDeSupabase(url)) return;

  // El resto de este mismo sitio (HTML, CSS, JS propios): network-first, para
  // que los cambios que subimos se vean apenas haya señal.
  if (url.origin === self.location.origin) {
    evento.respondWith(redPrimeroCache(pedido));
    return;
  }

  // Todo lo externo que llega hasta acá (hoy: solo Google Fonts): cache-first,
  // porque casi no cambia y así funciona offline una vez que se cargó la
  // primera vez.
  evento.respondWith(cachePrimeroRed(pedido));
});
