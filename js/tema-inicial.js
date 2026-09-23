/* ============================================================================
 * tema-inicial.js
 * ----------------------------------------------------------------------------
 * Se carga en <head>, ANTES de pintar la página: lee el tema elegido
 * ("claro" / "oscuro" / "auto") y lo aplica en <html> y en la barra del
 * navegador (meta theme-color), para que no haya un "parpadeo" de color al
 * abrir la app.
 *
 * IMPORTANTE: acá se resuelve también el "auto" (se mira la preferencia del
 * sistema) y SIEMPRE se deja puesto data-theme="light" o data-theme="dark".
 * Así base.css necesita una sola definición del tema oscuro, sin duplicarla
 * en un @media (prefers-color-scheme).
 *
 * Está en un archivo aparte (y no inline en index.html) a propósito: así el
 * Content-Security-Policy de vercel.json puede exigir que TODO el JavaScript
 * venga de un archivo con script-src 'self', sin tener que permitir
 * 'unsafe-inline' (que debilita bastante esa protección).
 * ==========================================================================*/

(function () {
  "use strict";

  // Color de fondo de cada tema (tiene que coincidir con --fondo de base.css).
  // Acá se escribe fijo porque este script corre ANTES de que cargue el CSS,
  // así que todavía no se puede leer la variable. Después, js/tema.js ya lo
  // lee directo del CSS con getComputedStyle.
  var FONDO_CLARO = "#F6F7FB";
  var FONDO_OSCURO = "#0E0F16";

  // ¿El sistema operativo está en modo oscuro? (false si no se puede saber)
  function sistemaOscuro() {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      return false;
    }
  }

  // Lo que eligió la persona en Ajustes (null si nunca eligió o si el
  // navegador bloquea localStorage).
  var elegido = null;
  try { elegido = localStorage.getItem("gastos-tema"); } catch (e) { /* seguimos con "auto" */ }

  // Resolvemos: "oscuro" fuerza oscuro, "claro" fuerza claro, cualquier otra
  // cosa ("auto" o null) sigue al sistema.
  var oscuro = elegido === "oscuro" || (elegido !== "claro" && sistemaOscuro());

  // Siempre dejamos el atributo puesto (claro u oscuro, nunca vacío).
  document.documentElement.setAttribute("data-theme", oscuro ? "dark" : "light");

  // Color de la barra del navegador en el celular.
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", oscuro ? FONDO_OSCURO : FONDO_CLARO);
})();
