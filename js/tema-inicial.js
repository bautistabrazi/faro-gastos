/* ============================================================================
 * tema-inicial.js
 * ----------------------------------------------------------------------------
 * Se carga en <head>, ANTES de pintar la página: lee el tema elegido
 * ("claro" / "oscuro" / "auto") y lo aplica en <html> y en la barra del
 * navegador (meta theme-color), para que no haya un "parpadeo" de color al
 * abrir la app.
 *
 * Está en un archivo aparte (y no inline en index.html) a propósito: así el
 * Content-Security-Policy de vercel.json puede exigir que TODO el JavaScript
 * venga de un archivo con script-src 'self', sin tener que permitir
 * 'unsafe-inline' (que debilita bastante esa protección).
 * ==========================================================================*/

(function () {
  "use strict";

  try {
    var elegido = localStorage.getItem("gastos-tema"); // puede ser null
    var oscuro = elegido === "oscuro" ||
      (elegido !== "claro" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (elegido === "claro") document.documentElement.setAttribute("data-theme", "light");
    else if (elegido === "oscuro") document.documentElement.setAttribute("data-theme", "dark");
    // si es "auto" o null: no tocamos data-theme y manda el sistema operativo

    if (oscuro) document.querySelector('meta[name="theme-color"]').setAttribute("content", "#141317");
  } catch (e) { /* localStorage bloqueado: seguimos con el tema del sistema */ }
})();
