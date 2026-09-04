/* ============================================================================
 * registro-sw.js
 * ----------------------------------------------------------------------------
 * Registra sw.js (el Service Worker) para que la app se pueda instalar y
 * funcione offline. Ver sw.js para la lógica de cache.
 *
 * No hace falta ninguna configuración: funciona siempre que la página esté
 * servida por http/https (en file:// o si el navegador no soporta Service
 * Workers, simplemente no se registra y la app sigue andando igual, solo que
 * sin instalación ni offline).
 * ==========================================================================*/

(function () {
  "use strict";

  // ¿Este navegador soporta Service Workers? (todos los modernos sí; los muy
  // viejos, no, y ahí directamente no hacemos nada más).
  if (!("serviceWorker" in navigator)) return;

  // file:// no admite Service Workers (y tampoco tendría sentido: no hay
  // "red" de la que protegerse). Evita un error en consola al abrir así.
  if (window.location.protocol === "file:") return;

  // Esperamos a que la página termine de cargar para no competir por ancho
  // de banda con los recursos que la app necesita para mostrarse la primera vez.
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function (err) {
      // Si falla (por ejemplo, un proxy raro bloqueando /sw.js), no es grave:
      // la app funciona igual, solo que sin instalación ni cache offline.
      console.warn("No se pudo registrar el Service Worker:", err);
    });
  });
})();
