/* ============================================================================
 * vista-proyeccion.js
 * ----------------------------------------------------------------------------
 * PANTALLA "PROYECCIÓN" — cuánto tenés que pagar cada mes, de acá en adelante.
 *
 *   1) "Este mes"  -> una tarjeta arriba de todo. Si cargaste ingresos, la
 *      cifra grande es lo que TE QUEDA (entra − pagás), con una barra que
 *      muestra qué parte de los ingresos se llevan los gastos. Si no hay
 *      ingresos, la cifra grande es lo que pagás este mes. Es el ancla:
 *      dónde estás parado hoy.
 *
 *   2) "Lo que viene" -> una lista tranquila, un renglón por mes futuro:
 *      mes · total, y debajo el neto del mes con una mini barra que compara
 *      ese mes contra el más caro de la lista. Tocás un mes y se abre el
 *      desglose. Si el mes tiene muchos consumos, se muestra una preview y
 *      un botón para verlos todos en una ventana (modal).
 *
 * La lista llega hasta el último mes con cuotas o gastos fijos con fin. Los
 * fijos indefinidos aparecen en todos los meses pero no estiran la lista.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};
  window.Gastos.Vistas = window.Gastos.Vistas || {};

  var F = window.Gastos.Formato;
  var I = window.Gastos.Iconos;
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
          '<span class="vacio__icono" aria-hidden="true">' + I.svg("tendencia", 26) + '</span>' +
          '<div class="vacio__titulo">Todavía no hay nada para proyectar</div>' +
          '<p>Cargá tu primer gasto y acá vas a ver, mes a mes, cuánto tenés que ' +
          'pagar y cuánto te queda.</p>' +
          '<button type="button" class="boton boton--primario vacio__accion" data-ir-a="gastos">' +
            'Agregar mi primer gasto</button>' +
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

      // El mes más caro de lo que se muestra: es el 100% de las mini barras.
      var maxTotal = 0;
      futuros.forEach(function (f) { if (f.totales.ARS > maxTotal) maxTotal = f.totales.ARS; });

      html += '<div class="proy-lista">';
      futuros.forEach(function (fila) { html += filaMes(estado, fila, maxTotal); });
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

    // --- cuerpo de números ---
    //   Con ingresos: la cifra grande es el NETO (lo que te queda o te falta),
    //   y debajo una barra gastos/ingresos + la leyenda con los dos montos.
    //   Sin ingresos: la cifra grande es el total que pagás este mes.
    var cuerpo;
    if (hayIngresos) {
      var negativo = bal.ARS.neto < 0;

      // Qué porcentaje de los ingresos se llevan los gastos (tope 100 para
      // la barra; el texto accesible sí dice el número real).
      var pctReal = bal.ARS.ingresos > 0 ? Math.round(bal.ARS.gastos / bal.ARS.ingresos * 100) : 100;
      var pctBarra = Math.min(100, Math.max(0, pctReal));
      var textoBarra = bal.ARS.ingresos <= 0
        ? "Este mes no tenés ingresos cargados"
        : negativo
          ? "Los gastos del mes superan tus ingresos (" + pctReal + "%)"
          : "Los gastos del mes son el " + pctReal + "% de tus ingresos";

      cuerpo =
        '<div class="ahora__cifra monto ' + (negativo ? 'ahora__cifra--negativo' : 'ahora__cifra--positivo') + '">' +
          F.monedaHTML(Math.abs(bal.ARS.neto), "ARS") +
        '</div>' +
        '<p class="ahora__bajada">' +
          (negativo ? 'te faltan para cubrir los gastos del mes' : 'te quedan después de pagar todo') +
        '</p>' +
        '<div class="barra' + (negativo ? ' barra--negativa' : '') + '" role="img" ' +
          'aria-label="' + F.escapar(textoBarra) + '">' +
          '<span class="barra__relleno" style="--pct:' + pctBarra + '"></span>' +
        '</div>' +
        '<div class="ahora__leyenda">' +
          '<span>Gastos <span class="monto">' + F.moneda(bal.ARS.gastos, "ARS") + '</span></span>' +
          '<span>Ingresos <span class="monto">' + F.moneda(bal.ARS.ingresos, "ARS") + '</span></span>' +
        '</div>';
    } else {
      cuerpo =
        '<div class="ahora__cifra monto">' + F.monedaHTML(fila.totales.ARS, "ARS") + '</div>' +
        '<p class="ahora__bajada">vas a pagar este mes</p>';
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
      // "Este mes  [septiembre 2026]" (la píldora la capitaliza el CSS)
      '<div class="ahora__eyebrow">Este mes ' +
        '<span class="ahora__mes">' + F.escapar(F.nombreMes(fila.mes)) + '</span></div>' +
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
  //   maxTotal: el total (ARS) del mes más caro de la lista; es el 100% de
  //             la mini barra.
  function filaMes(estado, fila, maxTotal) {
    var abierta = !!abiertos[fila.mes];

    // Debajo del renglón "mes · total" va una línea de resumen:
    //   + $ neto   [===== mini barra =====]   [2 terminan]
    // y, si hubo gastos en dólares, una línea chica más abajo.
    // Todo son <span> (y no <div>) porque va DENTRO del botón del mes.

    // 1) Neto en pesos, SIEMPRE con signo (+ te queda / − te falta). Solo si
    //    hay ingresos cargados: sin ingresos el neto sería siempre negativo
    //    por definición y solo alarmaría de más.
    var negativo = false;
    var neto = "";
    if (Nucleo.hayIngresos(estado)) {
      var bal = Nucleo.balanceDeMes(estado, fila.mes);
      negativo = bal.ARS.neto < 0;
      neto =
        '<span class="proy-mes__neto monto ' + (negativo ? 'proy-mes__neto--negativo' : 'proy-mes__neto--positivo') + '">' +
          // el lector de pantalla escucha "Te quedan"/"Te faltan"; en pantalla se ve el signo
          '<span class="sr-only">' + (negativo ? "Te faltan " : "Te quedan ") + '</span>' +
          '<span aria-hidden="true">' + (negativo ? "− " : "+ ") + '</span>' +
          F.moneda(Math.abs(bal.ARS.neto), "ARS") +
        '</span>';
    }

    // 2) Mini barra: el total de este mes en relación al mes más caro.
    var pct = maxTotal > 0 ? Math.round(fila.totales.ARS / maxTotal * 100) : 0;
    var barra =
      '<span class="proy-mes__barra' + (negativo ? ' proy-mes__barra--negativa' : '') + '" aria-hidden="true">' +
        '<span class="proy-mes__barra-relleno" style="--pct:' + pct + '"></span>' +
      '</span>';

    // 3) Chip ámbar: cuántos pagos se terminan este mes.
    var chip = fila.terminan > 0
      ? '<span class="proy-mes__chip">' + fila.terminan + (fila.terminan === 1 ? " termina" : " terminan") + '</span>'
      : '';

    // 4) Dólares del mes (apunte chico, en su propia línea).
    var apunte = fila.totales.USD > 0
      ? '<span class="proy-mes__apunte monto">' + F.moneda(fila.totales.USD, "USD") + ' en gastos</span>'
      : '';

    // Nota: acá NO pasamos por F.escapar() porque ninguna de estas partes viene
    // de texto escrito por la persona (son plantillas fijas + números).
    var sub = '<span class="proy-mes__mini">' + neto + barra + chip + '</span>' + apunte;

    var extra = abierta
      ? '<div class="proy-mes__extra">' +
          '<div class="proy-desglose">' + desgloseHTML(estado, fila.mes, PREVIEW) + '</div>' +
        '</div>'
      : '';

    return '' +
    '<div class="proy-mes" data-mes="' + F.escapar(fila.mes) + '">' +
      // todo el bloque del mes es un solo botón: se toca en cualquier parte
      '<button type="button" class="proy-mes__fila" aria-expanded="' + abierta + '">' +
        '<span class="proy-mes__nombre">' + F.escapar(nombreMesRelativo(fila.mes)) + '</span>' +
        '<span class="proy-mes__cifra monto">' + F.moneda(fila.totales.ARS, "ARS") + '</span>' +
        '<span class="proy-mes__chevron" aria-hidden="true">' + I.svg("chevronDerecha", 16) + '</span>' +
        sub +
      '</button>' +
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
