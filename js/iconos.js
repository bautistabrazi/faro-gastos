/* ============================================================================
 * iconos.js
 * ----------------------------------------------------------------------------
 * Los íconos de la app, como SVG "inline" (dibujados con código, sin archivos
 * de imagen ni librerías externas: así respetamos el Content-Security-Policy
 * de vercel.json y funcionan offline).
 *
 * Estilo "Lucide": trazo de 2px, puntas redondeadas, grilla de 24x24.
 *
 * Uso desde las vistas:
 *   var I = window.Gastos.Iconos;
 *   I.svg("lapiz")        -> el SVG en tamaño por defecto (18px)
 *   I.svg("chevronAbajo", 16)
 *
 * Todos llevan aria-hidden="true": son decorativos. El botón que los contiene
 * es el que tiene que tener un aria-label con el texto ("Editar", "Cerrar"...).
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};

  // El "dibujo" (contenido interno del <svg>) de cada ícono, por nombre.
  var TRAZOS = {
    // lápiz: editar / renombrar
    lapiz: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    // papelera: borrar
    papelera: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    // flechitas
    chevronAbajo: '<path d="m6 9 6 6 6-6"/>',
    chevronDerecha: '<path d="m9 18 6-6-6-6"/>',
    // cruz: cerrar
    cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    // sol y luna: botón de tema
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    // lupa: buscador
    lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    // ticket: estado vacío de Gastos
    ticket: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    // flecha arriba en círculo: Ingresos
    ingreso: '<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>',
    // tendencia: Proyección
    tendencia: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  };

  /* svg(nombre, tamanio) -> string con el <svg> listo para meter en un
     template de HTML. Si el nombre no existe, devuelve "" (no rompe nada). */
  function svg(nombre, tamanio) {
    var trazo = TRAZOS[nombre];
    if (!trazo) return "";
    var t = tamanio || 18; // tamaño en px (ancho = alto)
    return '<svg class="icono icono--' + nombre + '" width="' + t + '" height="' + t + '" ' +
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      trazo + '</svg>';
  }

  window.Gastos.Iconos = { svg: svg };
})();
