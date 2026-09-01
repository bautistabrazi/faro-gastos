/* ============================================================================
 * tema.js
 * ----------------------------------------------------------------------------
 * Maneja el tema visual: "claro", "oscuro" o "auto" (según el sistema).
 *
 * La elección se guarda aparte de los datos de gastos, en su propia clave de
 * localStorage ("gastos-tema"), porque es una preferencia del dispositivo, no
 * un dato para respaldar.
 *
 * OJO: el primer "pintado" del tema lo hace un script chiquito dentro de
 * index.html (para que no haya parpadeo). Este archivo se encarga del resto:
 * leer el valor actual y cambiarlo desde Ajustes.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};

  var CLAVE = "gastos-tema";
  var VALIDOS = ["auto", "claro", "oscuro"];

  /* leer() -> devuelve "auto" | "claro" | "oscuro" (nunca null) */
  function leer() {
    try {
      var v = window.localStorage.getItem(CLAVE);
      return VALIDOS.indexOf(v) !== -1 ? v : "auto";
    } catch (e) {
      return "auto";
    }
  }

  /* aplicar(valor) -> lo guarda y lo refleja en el atributo data-theme de <html> */
  function aplicar(valor) {
    if (VALIDOS.indexOf(valor) === -1) valor = "auto";

    try { window.localStorage.setItem(CLAVE, valor); } catch (e) { /* sin problema */ }

    var html = document.documentElement;
    if (valor === "claro") html.setAttribute("data-theme", "light");
    else if (valor === "oscuro") html.setAttribute("data-theme", "dark");
    else html.removeAttribute("data-theme"); // "auto" => manda el sistema

    // Actualizamos también el color de la barra del navegador en el celular.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var oscuro = valor === "oscuro" ||
        (valor === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", oscuro ? "#141317" : "#FCFCFE");
    }
  }

  /* esOscuroAhora() -> true/false: qué se está viendo en este momento,
     resolviendo "auto" contra la preferencia del sistema. */
  function esOscuroAhora() {
    var v = leer();
    if (v === "oscuro") return true;
    if (v === "claro") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  /* alternar() -> cambia entre claro y oscuro de forma explícita (deja de ser
     "auto"). Lo usa el botón rápido de la cabecera. */
  function alternar() {
    aplicar(esOscuroAhora() ? "claro" : "oscuro");
  }

  window.Gastos.Tema = {
    leer: leer,
    aplicar: aplicar,
    esOscuroAhora: esOscuroAhora,
    alternar: alternar,
  };
})();
