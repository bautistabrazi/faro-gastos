/* ============================================================================
 * tema.js
 * ----------------------------------------------------------------------------
 * Maneja el tema visual: "claro", "oscuro" o "auto" (según el sistema).
 *
 * La elección se guarda aparte de los datos de gastos, en su propia clave de
 * localStorage ("gastos-tema"), porque es una preferencia del dispositivo, no
 * un dato para respaldar.
 *
 * OJO: el primer "pintado" del tema lo hace js/tema-inicial.js (en <head>,
 * para que no haya parpadeo). Este archivo se encarga del resto: leer el
 * valor actual, cambiarlo desde Ajustes y seguir al sistema en "auto".
 *
 * Regla: data-theme en <html> SIEMPRE queda en "light" o "dark" (el "auto" se
 * resuelve acá, en JS). Así el CSS tiene una sola definición del tema oscuro.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};

  var CLAVE = "gastos-tema";
  var VALIDOS = ["auto", "claro", "oscuro"];

  // Consulta del sistema operativo: "¿está en modo oscuro?"
  var consultaOscuro = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  /* leer() -> devuelve "auto" | "claro" | "oscuro" (nunca null) */
  function leer() {
    try {
      var v = window.localStorage.getItem(CLAVE);
      return VALIDOS.indexOf(v) !== -1 ? v : "auto";
    } catch (e) {
      return "auto";
    }
  }

  /* resolverOscuro(valor) -> true si ese valor, hoy, se ve en oscuro.
     "auto" se resuelve contra la preferencia del sistema. */
  function resolverOscuro(valor) {
    if (valor === "oscuro") return true;
    if (valor === "claro") return false;
    return !!(consultaOscuro && consultaOscuro.matches);
  }

  /* pintar(valor) -> refleja el valor en <html data-theme> y en la barra del
     navegador del celular, SIN guardarlo. */
  function pintar(valor) {
    var html = document.documentElement;
    html.setAttribute("data-theme", resolverOscuro(valor) ? "dark" : "light");

    // Color de la barra del navegador: lo leemos directo del CSS (variable
    // --fondo), así si cambia la paleta no hay que acordarse de tocar acá.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var fondo = window.getComputedStyle(html).getPropertyValue("--fondo").trim();
      if (fondo) meta.setAttribute("content", fondo);
    }

    // Avisamos al resto de la app (p. ej. el botón sol/luna de la cabecera)
    // que el tema cambió, por si tiene que actualizar su ícono.
    document.dispatchEvent(new CustomEvent("faro:tema"));
  }

  /* aplicar(valor) -> lo guarda y lo refleja en pantalla */
  function aplicar(valor) {
    if (VALIDOS.indexOf(valor) === -1) valor = "auto";
    try { window.localStorage.setItem(CLAVE, valor); } catch (e) { /* sin problema */ }
    pintar(valor);
  }

  /* esOscuroAhora() -> true/false: qué se está viendo en este momento,
     resolviendo "auto" contra la preferencia del sistema. */
  function esOscuroAhora() {
    return resolverOscuro(leer());
  }

  /* alternar() -> cambia entre claro y oscuro de forma explícita (deja de ser
     "auto"). Lo usa el botón rápido de la cabecera. */
  function alternar() {
    aplicar(esOscuroAhora() ? "claro" : "oscuro");
  }

  // En "auto", si el sistema cambia de claro a oscuro (o al revés) con la app
  // abierta, la seguimos en vivo. (addListener es el nombre viejo, para Safari
  // anteriores a la versión 14.)
  if (consultaOscuro) {
    var alCambiarSistema = function () { if (leer() === "auto") pintar("auto"); };
    if (consultaOscuro.addEventListener) consultaOscuro.addEventListener("change", alCambiarSistema);
    else if (consultaOscuro.addListener) consultaOscuro.addListener(alCambiarSistema);
  }

  // Al cargar el CSS ya se puede leer --fondo: repintamos una vez para que el
  // meta theme-color quede con el valor exacto del CSS.
  window.addEventListener("load", function () { pintar(leer()); });

  window.Gastos.Tema = {
    leer: leer,
    aplicar: aplicar,
    esOscuroAhora: esOscuroAhora,
    alternar: alternar,
  };
})();
