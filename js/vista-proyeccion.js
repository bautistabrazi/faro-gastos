/* ============================================================================
 * vista-proyeccion.js
 * ----------------------------------------------------------------------------
 * PANTALLA "PROYECCIÓN" — cuánto tenés que pagar cada mes, de acá en adelante.
 *
 *   1) "Este mes"  -> una tarjeta arriba de todo. Si cargaste ingresos, muestra
 *      la cuenta del mes: entra − pagás = te queda. Si no, muestra solo lo que
 *      pagás este mes en grande. Es el ancla: dónde estás parado hoy.
 *
 *   2) "Lo que viene" -> una lista tranquila, un renglón por mes futuro:
 *      mes ·············· total. Tocás un mes y se abre el desglose. Si el mes
 *      tiene muchos consumos, se muestra una preview y un botón para verlos
 *      todos en una ventana (modal).
 *
 * La lista llega hasta el último mes con cuotas o gastos fijos con fin. Los
 * fijos indefinidos aparecen en todos los meses pero no estiran la lista.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};
  window.Gastos.Vistas = window.Gastos.Vistas || {};

  var F = window.Gastos.Formato;
  var Nucleo = window.Gastos.Nucleo;

  // Cuántos consumos se muestran "inline" al abrir un mes antes de pasar a modal.
  var PREVIEW = 5;

  // Qué meses están desplegados. Se conserva entre redibujados.
  var abiertos = {};

  // Horizonte de la lista "Lo que viene": cuántos meses mostrar.
  //   "6" | "12" | "24" | "todo"
  var horizonte = "6";
  var HORIZONTES = [
    { valor: "6", texto: "6 meses" },
    { valor: "12", texto: "1 año" },
    { valor: "24", texto: "2 años" },
    { valor: "todo", texto: "Todo" },
  ];

  /* ==================================================================
   * MONTAR
   * ================================================================*/
  function montar(contenedor, ctx) {
    var estado = window.Gastos.App.estado;

    var anim = ctx && ctx.primeraCarga ? " surge" : "";

    var html =
      '<div class="proy-raiz' + anim + '">' +
      '<h1 class="pantalla__titulo">Proyección</h1>' +
      '<p class="pantalla__bajada">Cuánto vas a pagar cada mes, de acá en adelante. ' +
        'Tocá un mes para ver qué lo compone.</p>';

    // Sin gastos no hay nada que proyectar: mostramos un estado vacío con un
    // botón que lleva directo a cargar el primer gasto.
    if (!estado.gastos || estado.gastos.length === 0) {
      html +=
        '<div class="vacio">' +
          '<div class="vacio__titulo">Todavía no hay nada para proyectar</div>' +
          '<p>Cargá tu primer gasto y acá vas a ver, mes a mes, cuánto tenés que ' +
          'pagar y cuánto te queda.</p>' +
          '<button type="button" class="boton boton--primario" data-ir-a="gastos" ' +
            'style="margin-top:var(--esp-4);">Agregar mi primer gasto</button>' +
        '</div></div>';
      contenedor.innerHTML = html;
      enganchar(contenedor);
      return;
    }

    var filas = Nucleo.proyeccion(estado);
    var esteMes = filas[0];
    var futurosTodos = filas.slice(1);

    // el "pico" y la deuda se calculan siempre sobre TODO, no sobre lo filtrado
    html += tarjetaEsteMes(estado, esteMes, futurosTodos);
    html += bloqueDeuda(estado);

    if (futurosTodos.length > 0) {
      // recortamos la lista según el horizonte elegido
      var futuros = horizonte === "todo"
        ? futurosTodos
        : futurosTodos.slice(0, parseInt(horizonte, 10));

      html += '<div class="proy-seccion-fila">' +
        '<h2 class="proy-seccion">Lo que viene</h2>' +
        segmentoHorizonte() +
      '</div>';

      html += '<div class="proy-lista">';
      futuros.forEach(function (fila) { html += filaMes(estado, fila); });
      html += '</div>';

      if (futuros.length < futurosTodos.length) {
        html += '<p class="proy-nota-horizonte">Mostrando ' + futuros.length + ' de ' +
          futurosTodos.length + ' meses. La deuda total de arriba cuenta todos.</p>';
      }
    }

    html += '</div>';
    contenedor.innerHTML = html;

    enganchar(contenedor);
  }

  /* ==================================================================
   * BLOQUE "CUOTAS PENDIENTES" (la deuda total, sin desglosar)
   * ================================================================*/
  function bloqueDeuda(estado) {
    var deuda = Nucleo.deudaEnCuotas(estado);
    if (deuda.ARS <= 0 && deuda.USD <= 0) return "";

    var partes = [];
    if (deuda.ARS > 0) partes.push('<span class="monto">' + F.moneda(deuda.ARS, "ARS") + '</span>');
    if (deuda.USD > 0) partes.push('<span class="monto">' + F.moneda(deuda.USD, "USD") + '</span>');

    return '<div class="proy-deuda">' +
      '<span class="proy-deuda__etiqueta">Cuotas pendientes</span>' +
      '<span class="proy-deuda__monto">' + partes.join(" · ") + '</span>' +
    '</div>';
  }

  // El selector de horizonte (6 meses / 1 año / 2 años / Todo).
  function segmentoHorizonte() {
    var ops = HORIZONTES.map(function (h) {
      var activo = h.valor === horizonte ? " segmentado__opcion--activo" : "";
      return '<button type="button" class="segmentado__opcion' + activo + '" ' +
        'data-horizonte="' + h.valor + '">' + h.texto + '</button>';
    }).join("");
    return '<div class="segmentado segmentado--chico" id="proy-horizonte">' + ops + '</div>';
  }

  /* ==================================================================
   * TARJETA "ESTE MES"
   * ================================================================*/
  function tarjetaEsteMes(estado, fila, futuros) {
    var abierta = !!abiertos[fila.mes];
    var hayIngresos = Nucleo.hayIngresos(estado);
    var bal = Nucleo.balanceDeMes(estado, fila.mes);

    // --- cuerpo de números: con ingresos = la cuenta; sin ingresos = el total ---
    var cuerpo;
    if (hayIngresos) {
      var netoClase = bal.ARS.neto < 0 ? " ahora-neto--negativo" : " ahora-neto--positivo";
      cuerpo =
        '<div class="ahora-cuenta">' +
          '<div class="ahora-cuenta__linea"><span>Ingresos</span>' +
            '<span class="monto">' + F.moneda(bal.ARS.ingresos, "ARS") + '</span></div>' +
          '<div class="ahora-cuenta__linea"><span>Gastos del mes</span>' +
            '<span class="monto">− ' + F.moneda(bal.ARS.gastos, "ARS") + '</span></div>' +
        '</div>' +
        '<div class="ahora-neto' + netoClase + '">' +
          '<span>' + (bal.ARS.neto < 0 ? 'Te falta' : 'Te queda') + '</span>' +
          '<span class="monto">' + F.moneda(bal.ARS.neto, "ARS") + '</span>' +
        '</div>';
    } else {
      cuerpo = '<div class="ahora__cifra monto">' + F.moneda(fila.totales.ARS, "ARS") + '</div>';
    }

    // --- línea de dólares (solo si hubo movimiento en USD este mes) ---
    var usd = "";
    if (bal.USD.ingresos > 0 || bal.USD.gastos > 0) {
      if (hayIngresos && bal.USD.ingresos > 0) {
        usd = '<div class="ahora__usd">Dólares: entra ' + F.moneda(bal.USD.ingresos, "USD") +
          ', pagás ' + F.moneda(bal.USD.gastos, "USD") +
          ' → ' + (bal.USD.neto < 0 ? 'faltan ' : 'quedan ') + F.moneda(Math.abs(bal.USD.neto), "USD") + '</div>';
      } else {
        usd = '<div class="ahora__usd monto">+ ' + F.moneda(bal.USD.gastos, "USD") + ' en gastos</div>';
      }
    }

    // --- meta: "9 consumos · 2 terminan este mes" ---
    var meta = fila.items + (fila.items === 1 ? ' consumo' : ' consumos');
    if (fila.terminan > 0) {
      meta += '<span class="ahora__punto"></span>' +
        fila.terminan + (fila.terminan === 1 ? ' termina este mes' : ' terminan este mes');
    }

    // --- línea "pico": el/los mes/es más caro/s que se vienen ---
    // Si varios meses empatan en el máximo, se listan todos ("septiembre y octubre").
    var pico = '';
    var maxARS = 0;
    futuros.forEach(function (f) {
      var v = Math.round(f.totales.ARS * 100);
      if (v > maxARS) maxARS = v;
    });
    if (maxARS > 0) {
      var mesesPico = futuros
        .filter(function (f) { return Math.round(f.totales.ARS * 100) === maxARS; })
        .map(function (f) { return nombreMesRelativo(f.mes); });

      var varios = mesesPico.length > 1;
      pico = '<div class="ahora__pico">' +
        (varios ? 'Los meses más pesados que vienen son ' : 'El mes más pesado que viene es ') +
        '<strong>' + F.escapar(unirNombres(mesesPico)) + '</strong> · ' +
        '<span class="monto">' + F.moneda(maxARS / 100, "ARS") + '</span></div>';
    }

    // --- ver / ocultar el desglose ---
    var toggle = '';
    var desglose = '';
    if (fila.items > 0) {
      toggle = '<button type="button" class="ahora__toggle" data-mes="' + F.escapar(fila.mes) + '" ' +
        'aria-expanded="' + abierta + '">' +
        (abierta ? 'Ocultar consumos' : 'Ver los ' + fila.items + (fila.items === 1 ? ' consumo' : ' consumos')) +
        '</button>';
      if (abierta) {
        desglose = '<div class="proy-desglose">' + desgloseHTML(estado, fila.mes, PREVIEW) + '</div>';
      }
    }

    return '' +
    '<article class="ahora">' +
      '<div class="ahora__eyebrow">Este mes · ' + F.escapar(F.nombreMes(fila.mes)) + '</div>' +
      cuerpo +
      usd +
      '<div class="ahora__meta">' + meta + '</div>' +
      pico +
      toggle +
      desglose +
    '</article>';
  }

  /* ==================================================================
   * UN RENGLÓN DE "LO QUE VIENE"
   * ================================================================*/
  function filaMes(estado, fila) {
    var abierta = !!abiertos[fila.mes];

    var subPartes = [];
    if (fila.totales.USD > 0) subPartes.push("+ " + F.moneda(fila.totales.USD, "USD"));
    if (fila.terminan > 0) {
      subPartes.push(fila.terminan + (fila.terminan === 1 ? " pago termina" : " pagos terminan"));
    }
    var sub = subPartes.length
      ? '<div class="proy-mes__sub">' + F.escapar(subPartes.join("  ·  ")) + '</div>'
      : '';

    var extra = abierta
      ? '<div class="proy-mes__extra">' +
          '<div class="proy-desglose">' + desgloseHTML(estado, fila.mes, PREVIEW) + '</div>' +
        '</div>'
      : '';

    return '' +
    '<div class="proy-mes" data-mes="' + F.escapar(fila.mes) + '">' +
      '<button type="button" class="proy-mes__fila" aria-expanded="' + abierta + '">' +
        '<span class="proy-mes__nombre">' + F.escapar(nombreMesRelativo(fila.mes)) + '</span>' +
        '<span class="proy-mes__puntos"></span>' +
        '<span class="proy-mes__cifra monto">' + F.moneda(fila.totales.ARS, "ARS") + '</span>' +
        '<span class="proy-mes__chevron" aria-hidden="true">›</span>' +
      '</button>' +
      sub +
      extra +
    '</div>';
  }

  /* ==================================================================
   * DESGLOSE de un mes.
   *   limite: cuántas filas mostrar como máximo. Si hay más, agrega un botón
   *           "+ N consumos más" que abre la lista completa en un modal.
   *           Pasá Infinity para que muestre todo (lo usa el modal).
   * ================================================================*/
  function desgloseHTML(estado, mes, limite) {
    var detalle = Nucleo.detalleDeMes(estado, mes);
    if (detalle.length === 0) return '<p class="proy-vacio">Sin pagos este mes.</p>';

    var muestra = isFinite(limite) ? detalle.slice(0, limite) : detalle;
    var html = muestra.map(function (d) { return lineaHTML(d, mes); }).join("");

    var ocultos = detalle.length - muestra.length;
    if (ocultos > 0) {
      html += '<button type="button" class="proy-desglose__mas" data-ver-mes="' + F.escapar(mes) + '">' +
        '+ ' + ocultos + (ocultos === 1 ? ' consumo más' : ' consumos más') + ' — ver todo</button>';
    }
    return html;
  }

  function lineaHTML(d, mes) {
    var esUltimo = Nucleo.ultimoMesDe(d.gasto) === mes;

    // La CUOTA se muestra como "chip" bien visible (es el dato que más se busca
    // al leer el resumen). El "fijo" queda como texto liviano.
    var tagHTML = "";
    if (d.gasto.tipo === "cuotas") {
      tagHTML = '<span class="proy-linea__cuota' + (esUltimo ? ' proy-linea__cuota--fin' : '') + '">' +
        F.escapar("cuota " + d.cuota) + (esUltimo ? ' · última' : '') + '</span>';
    } else if (d.gasto.tipo === "fijo") {
      tagHTML = '<span class="proy-linea__fijo' + (esUltimo ? ' proy-linea__fijo--fin' : '') + '">' +
        (esUltimo ? "fijo · último" : "fijo") + '</span>';
    }

    var medioHTML = d.medio
      ? '<span class="proy-linea__medio">' + F.escapar(d.medio.nombre) + '</span>'
      : '';

    return '' +
    '<div class="proy-linea">' +
      '<span class="proy-linea__nombre">' + F.escapar(d.gasto.descripcion) + medioHTML + '</span>' +
      tagHTML +
      '<span class="proy-linea__monto monto">' + F.moneda(d.monto, d.moneda) + '</span>' +
    '</div>';
  }

  /* ==================================================================
   * EVENTOS
   * ================================================================*/
  function enganchar(contenedor) {
    var raiz = contenedor.querySelector(".proy-raiz");
    if (!raiz) return;

    raiz.addEventListener("click", function (e) {
      // ir a otra pantalla (botón del estado vacío)
      var irA = e.target.closest("[data-ir-a]");
      if (irA) { window.Gastos.App.irA(irA.getAttribute("data-ir-a")); return; }

      // 0) cambiar el horizonte de la lista (6 meses / 1 año / ...)
      var opHorizonte = e.target.closest("[data-horizonte]");
      if (opHorizonte) {
        horizonte = opHorizonte.getAttribute("data-horizonte");
        window.Gastos.App.render();
        return;
      }

      // 1) "ver todo" -> abrir el modal con el desglose completo del mes
      var verTodo = e.target.closest("[data-ver-mes]");
      if (verTodo) {
        var m = verTodo.getAttribute("data-ver-mes");
        var estado = window.Gastos.App.estado;
        var tot = Nucleo.totalesDeMes(estado, m);
        var titulo = F.escapar(capitalizar(F.nombreMes(m))) + " · " + F.moneda(tot.ARS, "ARS");
        window.Gastos.App.modal(titulo,
          '<div class="proy-desglose proy-desglose--modal">' + desgloseHTML(estado, m, Infinity) + '</div>');
        return;
      }

      // 2) tocar un mes (o el toggle de la tarjeta) -> abrir/cerrar el desglose
      var disparador = e.target.closest(".ahora__toggle, .proy-mes__fila");
      if (!disparador) return;

      var mes = disparador.getAttribute("data-mes") ||
        (disparador.closest("[data-mes]") && disparador.closest("[data-mes]").getAttribute("data-mes"));
      if (!mes) return;

      if (abiertos[mes]) delete abiertos[mes];
      else abiertos[mes] = true;

      window.Gastos.App.render();
    });
  }

  /* ==================================================================
   * AUXILIARES
   * ================================================================*/

  // "septiembre 2026" -> "septiembre" (si es de este año); "enero 2027" si no.
  function nombreMesRelativo(mes) {
    var anioActual = Nucleo.mesActual().slice(0, 4);
    var nombre = F.nombreMes(mes);
    return mes.slice(0, 4) === anioActual ? nombre.replace(" " + anioActual, "") : nombre;
  }

  function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // ["sep"] -> "sep" ; ["sep","oct"] -> "sep y oct" ;
  // ["sep","oct","nov"] -> "sep, oct y nov" ;
  // más de 3 -> "sep, oct y 4 meses más"
  function unirNombres(arr) {
    if (arr.length === 0) return "";
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + " y " + arr[1];
    if (arr.length === 3) return arr[0] + ", " + arr[1] + " y " + arr[2];
    return arr[0] + ", " + arr[1] + " y " + (arr.length - 2) + " meses más";
  }

  /* ================================================================*/
  window.Gastos.Vistas.proyeccion = { montar: montar };
})();
