/* ============================================================================
 * formato.js
 * ----------------------------------------------------------------------------
 * Funciones de "presentación": convierten datos crudos (números, fechas, texto)
 * en cadenas listas para mostrar en pantalla.
 *
 * No tocan el DOM ni el localStorage. Son funciones puras: si les das lo mismo,
 * devuelven lo mismo. Eso las hace fáciles de probar y de reutilizar el día que
 * pasemos la app al celular.
 *
 * Todo queda colgado de window.Gastos.Formato para no ensuciar el espacio global.
 * ==========================================================================*/

(function () {
  "use strict";

  // Si el objeto Gastos todavía no existe, lo creamos. Cada archivo hace esto
  // mismo, así no importa el orden en que se carguen (siempre que formato.js vaya
  // antes que quien lo use).
  window.Gastos = window.Gastos || {};

  // Guardamos los formateadores de moneda ya creados en un "cache", porque crear
  // un Intl.NumberFormat es una operación relativamente cara y la lista de gastos
  // puede llamar a moneda() muchas veces. La clave del cache es, por ejemplo,
  // "ARS-0" (pesos, sin decimales) o "USD-2" (dólares, con dos decimales).
  var cacheMoneda = {};

  function formateador(codigo, decimales) {
    var clave = codigo + "-" + decimales;
    if (!cacheMoneda[clave]) {
      cacheMoneda[clave] = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: codigo === "USD" ? "USD" : "ARS",
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      });
    }
    return cacheMoneda[clave];
  }

  // Nombres de meses en español, para nombreMes().
  var MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];

  var MESES_CORTOS = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];

  var Formato = {

    /* ----------------------------------------------------------------------
     * moneda(numero, codigo)
     * Devuelve el número formateado como plata, p. ej. "$ 45.000" o "US$ 12,50".
     *   numero  -> cantidad (number). Si viene algo raro, se trata como 0.
     *   codigo  -> "ARS" (por defecto) o "USD".
     * -------------------------------------------------------------------- */
    moneda: function (numero, codigo) {
      var n = typeof numero === "number" && isFinite(numero) ? numero : 0;

      // ¿Tiene parte decimal? Comparamos los centavos contra 0. Multiplicamos por
      // 100 y redondeamos para esquivar los errores de coma flotante de JS
      // (0.1 + 0.2 no da exactamente 0.3).
      var tieneDecimales = Math.round(n * 100) % 100 !== 0;
      return formateador(codigo === "USD" ? "USD" : "ARS", tieneDecimales ? 2 : 0).format(n);
    },

    /* ----------------------------------------------------------------------
     * numero(valor)
     * Formatea un número "pelado" con separador de miles ("45.000"), sin símbolo
     * de moneda. Útil para campos de edición y para totales sueltos.
     * -------------------------------------------------------------------- */
    numero: function (valor) {
      var n = typeof valor === "number" && isFinite(valor) ? valor : 0;
      var tieneDecimales = Math.round(n * 100) % 100 !== 0;
      return new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: tieneDecimales ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(n);
    },

    /* ----------------------------------------------------------------------
     * parsearMonto(texto)
     * Lo contrario de numero(): toma lo que el usuario escribió en el campo de
     * monto ("175.500", "45.000,50", "$ 45 000") y devuelve un number, o NaN si
     * no se entiende nada.
     *
     * Regla es-AR, sin ambigüedad: la COMA es el único separador decimal; el
     * PUNTO siempre es separador de miles (aunque haya uno solo). Esto es
     * importante porque el campo se formatea solo mientras se tipea: si escribís
     * "175500" ves "175.500", y eso tiene que leerse 175500, no 175,5.
     * -------------------------------------------------------------------- */
    parsearMonto: function (texto) {
      if (typeof texto !== "string") {
        return typeof texto === "number" ? texto : NaN;
      }
      var limpio = texto.trim().replace(/[^\d.,-]/g, ""); // dejo solo dígitos , . -
      if (limpio === "") return NaN;

      // Los puntos SIEMPRE se van (son miles). La primera coma pasa a ser el
      // punto decimal; las comas siguientes se descartan.
      limpio = limpio.replace(/\./g, "");
      var primeraComa = limpio.indexOf(",");
      if (primeraComa !== -1) {
        limpio = limpio.slice(0, primeraComa) + "." +
          limpio.slice(primeraComa + 1).replace(/,/g, "");
      }

      var n = parseFloat(limpio);
      return isFinite(n) ? n : NaN;
    },

    /* ----------------------------------------------------------------------
     * miles(texto)
     * Toma lo que la persona va escribiendo en el campo de monto y lo devuelve
     * con los puntos de miles puestos, en vivo:
     *   "45000"      -> "45.000"
     *   "1500000"    -> "1.500.000"
     *   "45000,5"    -> "45.000,5"
     *   "12.500,75"  -> "12.500,75"
     * Solo agrupa la parte entera; la coma (decimal) y hasta 2 decimales se
     * respetan. No convierte a número: es solo cosmético para el input.
     * -------------------------------------------------------------------- */
    miles: function (texto) {
      var s = String(texto == null ? "" : texto).replace(/[^\d,]/g, "");
      if (s === "") return "";

      // La primera coma separa entero de decimales; las demás se descartan.
      var coma = s.indexOf(",");
      var entero, decimales;
      if (coma === -1) {
        entero = s;
        decimales = null;
      } else {
        entero = s.slice(0, coma);
        decimales = s.slice(coma + 1).replace(/,/g, "").slice(0, 2);
      }

      // Sacamos ceros a la izquierda ("007" -> "7"), pero dejamos un "0" solo.
      entero = entero.replace(/^0+(?=\d)/, "");
      if (entero === "") entero = decimales !== null ? "0" : "";

      // Punto cada 3 dígitos desde la derecha.
      entero = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

      return decimales !== null ? entero + "," + decimales : entero;
    },

    /* ----------------------------------------------------------------------
     * fechaCorta(iso)
     * "2026-08-15" -> "15 ago 2026". Pensada para la lista de gastos.
     * Ojo: parseamos a mano para no depender de la zona horaria (new Date con
     * "2026-08-15" se interpreta como medianoche UTC y en Argentina puede
     * "retroceder" un día).
     * -------------------------------------------------------------------- */
    fechaCorta: function (iso) {
      if (typeof iso !== "string" || iso.length < 10) return "";
      var a = iso.slice(0, 4);
      var m = parseInt(iso.slice(5, 7), 10);
      var d = parseInt(iso.slice(8, 10), 10);
      if (!m || !d) return "";
      return d + " " + (MESES_CORTOS[m - 1] || "?") + " " + a;
    },

    /* ----------------------------------------------------------------------
     * nombreMes(mesYYYYMM)
     * "2026-09" -> "septiembre 2026". Para los títulos de la proyección.
     * -------------------------------------------------------------------- */
    nombreMes: function (mes) {
      if (typeof mes !== "string" || mes.length < 7) return "";
      var a = mes.slice(0, 4);
      var m = parseInt(mes.slice(5, 7), 10);
      if (!m) return "";
      return (MESES[m - 1] || "?") + " " + a;
    },

    /* ----------------------------------------------------------------------
     * mesCorto(mesYYYYMM)
     * "2026-09" -> "sep 26". Versión compacta para la tira de proyección.
     * -------------------------------------------------------------------- */
    mesCorto: function (mes) {
      if (typeof mes !== "string" || mes.length < 7) return "";
      var a = mes.slice(2, 4);
      var m = parseInt(mes.slice(5, 7), 10);
      if (!m) return "";
      return (MESES_CORTOS[m - 1] || "?") + " " + a;
    },

    /* ----------------------------------------------------------------------
     * escapar(texto)
     * Convierte caracteres peligrosos en entidades HTML para que, al insertar
     * texto del usuario con innerHTML, no se pueda "colar" código (< script >,
     * comillas que rompen atributos, etc.).
     *
     * Regla de oro del proyecto: TODO dato escrito por la persona que se meta en
     * un template de HTML pasa antes por acá.
     * -------------------------------------------------------------------- */
    escapar: function (texto) {
      return String(texto == null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
  };

  window.Gastos.Formato = Formato;
})();
