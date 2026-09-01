/* ============================================================================
 * vista-gastos.js
 * ----------------------------------------------------------------------------
 * PANTALLA "GASTOS" — el registro. Tiene dos partes:
 *
 *   1) Alta rápida (arriba): un formulario chico para cargar un gasto en
 *      segundos. Solo "qué" y "cuánto" están a la vista; el resto (fecha,
 *      moneda, tarjeta, categoría) está plegado detrás de "más ▾".
 *
 *   2) La lista (abajo): todos los gastos cargados, del más nuevo al más viejo,
 *      con botones Editar y Borrar en cada uno.
 *
 * El mismo formulario sirve para AGREGAR y para EDITAR. Cuando se está
 * editando, la variable `editandoId` guarda el id del gasto en cuestión.
 *
 * Se anota en Gastos.Vistas.gastos con un método montar(contenedor, ctx).
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};
  window.Gastos.Vistas = window.Gastos.Vistas || {};

  var F = window.Gastos.Formato;
  var Nucleo = window.Gastos.Nucleo;
  var Almacenamiento = window.Gastos.Almacenamiento;

  /* ------------------------------------------------------------------
   * Estado LOCAL de esta pantalla (se conserva entre redibujados,
   * porque el archivo se carga una sola vez).
   * ---------------------------------------------------------------- */
  var editandoId = null;       // id del gasto que se está editando, o null
  var tipoActual = "unico";    // "unico" | "cuotas" | "fijo"
  var avanzadoAbierto = false; // ¿está desplegado el panel "más"?
  var filtroTexto = "";        // lo escrito en el buscador del registro
  var registroExpandido = false; // ¿se están mostrando TODOS los gastos, o solo los últimos 3?

  var TOPE_REGISTRO = 3;       // cuántos gastos se ven antes de "Ver todos"

  /* ==================================================================
   * MONTAR: dibuja toda la pantalla y engancha los eventos.
   * ================================================================*/
  function montar(contenedor, ctx) {
    var estado = window.Gastos.App.estado;

    // Si la pantalla recién se abre (no es un simple refresco), volvemos el
    // formulario a "modo agregar" y plegamos el panel "más".
    if (ctx && ctx.primeraCarga) {
      editandoId = null;
      avanzadoAbierto = false;
      registroExpandido = false;
    }

    // La plantilla siempre se dibuja con "Único" y "ARS" marcados. Si no estamos
    // editando, alineamos la variable con eso para que no haya desajuste visual.
    if (!editandoId) tipoActual = "unico";

    // La animación de entrada (.surge) solo cuando la pantalla recién se abre,
    // NO en cada redibujado (si no, todo "salta" cada vez que agregás un gasto).
    var anim = ctx && ctx.primeraCarga ? " surge" : "";

    contenedor.innerHTML =
      '<div class="vista-raiz' + anim + '">' +
        plantillaAlta(estado) +
        plantillaLista(estado) +
      '</div>';

    engancharAlta(contenedor, estado);
    engancharLista(contenedor);
    engancharBuscador(contenedor);

    // Si veníamos de tocar "Editar", cargamos ese gasto en el formulario.
    if (editandoId) {
      var g = Nucleo.buscarPorId(estado.gastos, editandoId);
      if (g) {
        cargarEnFormulario(contenedor, g);
      } else {
        editandoId = null; // el gasto ya no existe
      }
    }
  }

  /* ==================================================================
   * PLANTILLA: formulario de alta rápida
   * ================================================================*/
  function plantillaAlta(estado) {
    var opcionesMedio = '<option value="">— sin tarjeta / medio —</option>';
    estado.medios.forEach(function (m) {
      opcionesMedio += '<option value="' + F.escapar(m.id) + '">' + F.escapar(m.nombre) + '</option>';
    });

    var opcionesCategoria = '<option value="">— sin categoría —</option>';
    estado.categorias.forEach(function (c) {
      opcionesCategoria += '<option value="' + F.escapar(c.id) + '">' + F.escapar(c.nombre) + '</option>';
    });

    var hoy = new Date();
    var hoyISO = hoy.getFullYear() + "-" +
      String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
      String(hoy.getDate()).padStart(2, "0");

    return '' +
    '<form class="tarjeta alta" id="form-gasto" autocomplete="off">' +
      '<h2 class="alta__titulo" id="alta-titulo">Agregar gasto</h2>' +

      // --- fila principal: descripción + monto ---
      '<div class="alta__principal">' +
        '<div class="campo alta__descripcion">' +
          '<label class="campo__etiqueta" for="gasto-descripcion">Qué compraste</label>' +
          '<input type="text" id="gasto-descripcion" required maxlength="80" placeholder="Ej: Zapatillas" />' +
        '</div>' +
        '<div class="campo alta__monto">' +
          '<label class="campo__etiqueta" for="gasto-monto" id="gasto-monto-etiqueta">Monto</label>' +
          '<input type="text" inputmode="decimal" id="gasto-monto" required placeholder="0" />' +
        '</div>' +
      '</div>' +
      '<p class="campo__ayuda" id="gasto-ayuda" hidden></p>' +

      '<div class="alta__division"></div>' +

      // --- tipo de gasto ---
      '<div class="campo">' +
        '<span class="campo__etiqueta">Cómo se paga</span>' +
        '<div class="segmentado segmentado--ancho" id="gasto-tipo" role="tablist">' +
          '<button type="button" class="segmentado__opcion segmentado__opcion--activo" data-tipo="unico">Único</button>' +
          '<button type="button" class="segmentado__opcion" data-tipo="cuotas">En cuotas</button>' +
          '<button type="button" class="segmentado__opcion" data-tipo="fijo">Fijo</button>' +
        '</div>' +
      '</div>' +

      // --- campo extra según el tipo (cuotas / hasta) ---
      '<div class="alta__extra" id="gasto-extra" hidden>' +
        '<div class="campo" id="campo-cuotas" hidden>' +
          '<label class="campo__etiqueta" for="gasto-cuotas">Cantidad de cuotas</label>' +
          '<input type="number" id="gasto-cuotas" min="1" max="120" step="1" value="12" />' +
          // al editar un gasto en cuotas, acá se muestra cuánto llevás pagado
          '<p class="campo__progreso" id="gasto-progreso" hidden></p>' +
        '</div>' +
        '<div class="campo" id="campo-hasta" hidden>' +
          '<label class="campo__etiqueta" for="gasto-hasta">Hasta (opcional)</label>' +
          '<input type="month" id="gasto-hasta" />' +
          '<span class="campo__ayuda">Dejalo vacío si no tiene fecha de fin.</span>' +
        '</div>' +
      '</div>' +

      // --- panel "más": fecha, moneda, tarjeta, categoría ---
      '<div class="alta__avanzado" id="gasto-avanzado" hidden>' +
        '<div class="campo-fila">' +
          '<div class="campo">' +
            '<label class="campo__etiqueta" for="gasto-fecha">Fecha de compra</label>' +
            '<input type="date" id="gasto-fecha" value="' + hoyISO + '" />' +
          '</div>' +
          '<div class="campo">' +
            '<span class="campo__etiqueta">Moneda</span>' +
            '<div class="segmentado segmentado--ancho" id="gasto-moneda">' +
              '<button type="button" class="segmentado__opcion segmentado__opcion--activo" data-moneda="ARS">ARS</button>' +
              '<button type="button" class="segmentado__opcion" data-moneda="USD">USD</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="campo">' +
          '<label class="campo__etiqueta" for="gasto-medio">Tarjeta / medio</label>' +
          '<select id="gasto-medio">' + opcionesMedio + '</select>' +
        '</div>' +
        '<div class="campo">' +
          '<label class="campo__etiqueta" for="gasto-categoria">Categoría</label>' +
          '<select id="gasto-categoria">' + opcionesCategoria + '</select>' +
        '</div>' +
      '</div>' +

      // --- pie: "más" + botones ---
      '<div class="alta__pie">' +
        '<button type="button" class="boton boton--fantasma" id="gasto-mas">más ▾</button>' +
        '<div style="display:flex; gap:8px;">' +
          '<button type="button" class="boton boton--secundario" id="gasto-cancelar" hidden>Cancelar</button>' +
          '<button type="submit" class="boton boton--primario" id="gasto-enviar">Agregar gasto</button>' +
        '</div>' +
      '</div>' +
    '</form>';
  }

  /* ==================================================================
   * PLANTILLA: la lista de gastos cargados
   * ================================================================*/
  function plantillaLista(estado) {
    var gastos = Nucleo.gastosOrdenados(estado);

    if (gastos.length === 0) {
      return '' +
      '<section style="margin-top:32px;">' +
        '<div class="vacio">' +
          '<div class="vacio__titulo">Todavía no cargaste nada</div>' +
          '<p>Agregá tu primer gasto con el formulario de arriba.</p>' +
        '</div>' +
      '</section>';
    }

    var filas = gastos.map(function (g) { return filaGastoHTML(g, estado); }).join("");

    return '' +
    '<section style="margin-top:32px;">' +
      '<h2 class="pantalla__titulo" style="font-size:var(--txt-lg);">' +
        'Registro <span class="monto" id="registro-cuenta" style="color:var(--grafito); font-size:var(--txt-sm);">' + gastos.length + '</span>' +
      '</h2>' +
      '<p class="pantalla__bajada">Lo más nuevo primero. Se muestran los últimos ' +
        TOPE_REGISTRO + '; el resto está a un clic.</p>' +
      '<input type="search" id="gasto-buscar" class="buscador" placeholder="Buscar en el registro…" ' +
        'value="' + F.escapar(filtroTexto) + '" />' +
      '<div class="gasto-lista">' + filas + '</div>' +
      '<button type="button" class="boton boton--fantasma lista-vermas" id="registro-vermas" hidden></button>' +
      '<p class="lista-sin-resultados" id="registro-sin-resultados" hidden>Nada coincide con la búsqueda.</p>' +
    '</section>';
  }

  // Una fila de la lista.
  function filaGastoHTML(g, estado) {
    var medio = Nucleo.buscarPorId(estado.medios, g.medioId);
    var categoria = Nucleo.buscarPorId(estado.categorias, g.categoriaId);

    // línea secundaria: "12 cuotas de $X · total $Y — 15 ago 2026 · Visa · Calzado"
    var meta = Nucleo.resumenDeGasto(g) + " — " + F.fechaCorta(g.fecha);
    if (medio) meta += " · " + F.escapar(medio.nombre);
    if (categoria) meta += " · " + F.escapar(categoria.nombre);

    var chipMoneda = g.moneda === "USD"
      ? ' <span class="gasto-item__moneda">USD</span>'
      : "";

    var editando = g.id === editandoId;

    // texto por el que se puede buscar esta fila (descripción + medio + categoría)
    var buscable = (g.descripcion + " " +
      (medio ? medio.nombre : "") + " " +
      (categoria ? categoria.nombre : "")).toLowerCase();

    return '' +
    '<div class="gasto-item' + (editando ? ' gasto-item--editando' : '') + '" data-id="' + F.escapar(g.id) + '" ' +
      'data-buscar="' + F.escapar(buscable) + '">' +
      '<div class="gasto-item__cuerpo">' +
        '<div class="gasto-item__descripcion">' + F.escapar(g.descripcion) + chipMoneda + '</div>' +
        '<div class="gasto-item__meta">' + meta + '</div>' +
      '</div>' +
      '<div class="gasto-item__monto">' + F.moneda(g.monto, g.moneda) + '</div>' +
      '<div class="gasto-item__acciones">' +
        '<button class="boton boton--mini" data-accion="editar" type="button">Editar</button>' +
        '<button class="boton boton--mini boton--peligro" data-accion="borrar" type="button">Borrar</button>' +
      '</div>' +
    '</div>';
  }

  /* ==================================================================
   * EVENTOS del formulario de alta
   * ================================================================*/
  function engancharAlta(contenedor, estado) {
    var form = contenedor.querySelector("#form-gasto");
    var inputMonto = contenedor.querySelector("#gasto-monto");
    var inputCuotas = contenedor.querySelector("#gasto-cuotas");

    // --- segmentado "Cómo se paga" ---
    var grupoTipo = contenedor.querySelector("#gasto-tipo");
    grupoTipo.addEventListener("click", function (e) {
      var op = e.target.closest("[data-tipo]");
      if (!op) return;
      tipoActual = op.getAttribute("data-tipo");
      marcarActivo(grupoTipo, op);
      actualizarSegunTipo(contenedor);
    });

    // --- segmentado "Moneda" ---
    var grupoMoneda = contenedor.querySelector("#gasto-moneda");
    grupoMoneda.addEventListener("click", function (e) {
      var op = e.target.closest("[data-moneda]");
      if (op) marcarActivo(grupoMoneda, op);
    });

    // --- toggle "más ▾" ---
    var botonMas = contenedor.querySelector("#gasto-mas");
    botonMas.addEventListener("click", function () {
      avanzadoAbierto = !avanzadoAbierto;
      aplicarAvanzado(contenedor);
    });
    aplicarAvanzado(contenedor); // aplica el estado guardado

    // --- formateo del monto en vivo (pone los puntos de miles al tipear) ---
    inputMonto.addEventListener("input", function () {
      window.Gastos.App.formatearInputMonto(inputMonto);
      actualizarAyuda(contenedor);
    });
    inputCuotas.addEventListener("input", function () { actualizarAyuda(contenedor); });

    // --- cancelar edición ---
    contenedor.querySelector("#gasto-cancelar").addEventListener("click", function () {
      editandoId = null;
      window.Gastos.App.render();
    });

    // --- enviar (agregar o guardar edición) ---
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      enviar(contenedor, estado);
    });

    // aplicar el tipo actual (por si venimos de una edición)
    actualizarSegunTipo(contenedor);
  }

  // Muestra/oculta el campo de cuotas o el de "hasta", y adapta la etiqueta y la
  // ayuda del monto según el tipo elegido.
  function actualizarSegunTipo(contenedor) {
    var extra = contenedor.querySelector("#gasto-extra");
    var campoCuotas = contenedor.querySelector("#campo-cuotas");
    var campoHasta = contenedor.querySelector("#campo-hasta");
    var etiquetaMonto = contenedor.querySelector("#gasto-monto-etiqueta");

    campoCuotas.hidden = tipoActual !== "cuotas";
    campoHasta.hidden = tipoActual !== "fijo";
    extra.hidden = tipoActual === "unico";

    if (tipoActual === "cuotas") etiquetaMonto.textContent = "Valor de la cuota";
    else if (tipoActual === "fijo") etiquetaMonto.textContent = "Monto por mes";
    else etiquetaMonto.textContent = "Monto";

    actualizarAyuda(contenedor);
  }

  // La ayuda gris: solo tiene sentido en "cuotas" -> muestra el total.
  function actualizarAyuda(contenedor) {
    var ayuda = contenedor.querySelector("#gasto-ayuda");
    if (tipoActual !== "cuotas") { ayuda.hidden = true; return; }

    var monto = F.parsearMonto(contenedor.querySelector("#gasto-monto").value);
    var cuotas = parseInt(contenedor.querySelector("#gasto-cuotas").value, 10);
    var moneda = monedaElegida(contenedor);

    if (isFinite(monto) && monto > 0 && isFinite(cuotas) && cuotas > 0) {
      ayuda.innerHTML = "= " +
        '<span class="monto">' + F.moneda(monto * cuotas, moneda) + "</span>" +
        " en total (" + cuotas + " cuotas)";
      ayuda.hidden = false;
    } else {
      ayuda.hidden = true;
    }
  }

  // Muestra u oculta el panel "más" y cambia el texto del botón.
  function aplicarAvanzado(contenedor) {
    contenedor.querySelector("#gasto-avanzado").hidden = !avanzadoAbierto;
    contenedor.querySelector("#gasto-mas").textContent = avanzadoAbierto ? "menos ▴" : "más ▾";
  }

  /* ==================================================================
   * ENVIAR el formulario: valida y agrega/edita el gasto.
   * ================================================================*/
  function enviar(contenedor, estado) {
    var App = window.Gastos.App;

    var descripcion = contenedor.querySelector("#gasto-descripcion").value.trim();
    var monto = F.parsearMonto(contenedor.querySelector("#gasto-monto").value);

    if (descripcion === "") {
      App.aviso("Poné una descripción", "peligro");
      contenedor.querySelector("#gasto-descripcion").focus();
      return;
    }
    if (!isFinite(monto) || monto <= 0) {
      App.aviso("El monto no es válido", "peligro");
      contenedor.querySelector("#gasto-monto").focus();
      return;
    }

    // Armamos el objeto del gasto.
    var gasto = {
      id: editandoId || Almacenamiento.nuevoId("g"),
      descripcion: descripcion,
      monto: monto,
      moneda: monedaElegida(contenedor),
      tipo: tipoActual,
      fecha: contenedor.querySelector("#gasto-fecha").value ||
        Nucleo.mesActual() + "-01",
      medioId: contenedor.querySelector("#gasto-medio").value || null,
      categoriaId: contenedor.querySelector("#gasto-categoria").value || null,
    };

    if (tipoActual === "cuotas") {
      var c = parseInt(contenedor.querySelector("#gasto-cuotas").value, 10);
      gasto.cuotas = isFinite(c) && c >= 1 ? c : 1;
    }
    if (tipoActual === "fijo") {
      gasto.hasta = contenedor.querySelector("#gasto-hasta").value || null;
    }

    if (editandoId) {
      // Reemplazamos el gasto existente (conservando su posición).
      var i = indiceDe(estado.gastos, editandoId);
      if (i !== -1) estado.gastos[i] = gasto;
      editandoId = null;
      App.aviso("Gasto actualizado", "ok");
    } else {
      estado.gastos.push(gasto);
      App.aviso("Gasto agregado", "ok");
    }

    App.guardar(); // persiste + redibuja
  }

  /* ==================================================================
   * EVENTOS de la lista (Editar / Borrar) — con delegación.
   * ================================================================*/
  function engancharLista(contenedor) {
    var lista = contenedor.querySelector(".gasto-lista");
    if (!lista) return;

    lista.addEventListener("click", function (e) {
      var boton = e.target.closest("[data-accion]");
      if (!boton) return;

      var fila = boton.closest(".gasto-item");
      var id = fila.getAttribute("data-id");
      var accion = boton.getAttribute("data-accion");

      if (accion === "editar") {
        editandoId = id;
        avanzadoAbierto = true;        // al editar mostramos todos los campos
        window.Gastos.App.render();
        // llevamos el formulario a la vista
        var form = contenedor.querySelector("#form-gasto");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (accion === "borrar") {
        var estado = window.Gastos.App.estado;
        var g = Nucleo.buscarPorId(estado.gastos, id);
        var nombre = g ? g.descripcion : "este gasto";
        if (window.confirm('¿Borrar "' + nombre + '"? No se puede deshacer.')) {
          var i = indiceDe(estado.gastos, id);
          if (i !== -1) estado.gastos.splice(i, 1);
          if (editandoId === id) editandoId = null;
          window.Gastos.App.aviso("Gasto borrado");
          window.Gastos.App.guardar();
        }
      }
    });
  }

  /* ==================================================================
   * REGISTRO: buscador + "ver todos".
   * Se maneja mostrando/ocultando filas, SIN redibujar toda la pantalla
   * (así el cursor no se pierde mientras escribís). Reglas:
   *   - Sin búsqueda y sin expandir: se ven las primeras TOPE_REGISTRO.
   *   - Si buscás: se ven todas las que coinciden (se ignora el tope).
   *   - Si tocás "Ver todos": se ven todas.
   * ================================================================*/
  function engancharBuscador(contenedor) {
    var input = contenedor.querySelector("#gasto-buscar");
    var verMas = contenedor.querySelector("#registro-vermas");

    if (input) {
      input.addEventListener("input", function () {
        filtroTexto = input.value;
        aplicarVistaRegistro(contenedor);
      });
    }
    if (verMas) {
      verMas.addEventListener("click", function () {
        registroExpandido = !registroExpandido;
        aplicarVistaRegistro(contenedor);
      });
    }

    aplicarVistaRegistro(contenedor);
  }

  function aplicarVistaRegistro(contenedor) {
    var termino = filtroTexto.trim().toLowerCase();
    var buscando = termino !== "";
    var filas = contenedor.querySelectorAll(".gasto-item");

    var coinciden = 0;   // cuántas matchean la búsqueda
    var mostradas = 0;   // cuántas quedan visibles

    for (var i = 0; i < filas.length; i++) {
      var matchea = !buscando ||
        (filas[i].getAttribute("data-buscar") || "").indexOf(termino) !== -1;
      if (matchea) coinciden++;

      // El tope de 3 solo aplica cuando NO estás buscando y NO expandiste.
      var dentroDelTope = buscando || registroExpandido || mostradas < TOPE_REGISTRO;
      var visible = matchea && dentroDelTope;
      filas[i].hidden = !visible;
      if (visible) mostradas++;
    }

    // Botón "Ver todos / Ver menos"
    var verMas = contenedor.querySelector("#registro-vermas");
    if (verMas) {
      var hayMas = !buscando && filas.length > TOPE_REGISTRO;
      verMas.hidden = !hayMas;
      verMas.textContent = registroExpandido
        ? "Ver menos"
        : "Ver los " + filas.length + " gastos";
    }

    // Contador del título ("9" o "3 de 9")
    var cuenta = contenedor.querySelector("#registro-cuenta");
    if (cuenta) {
      cuenta.textContent = buscando ? coinciden + " de " + filas.length : String(filas.length);
    }

    var sinResultados = contenedor.querySelector("#registro-sin-resultados");
    if (sinResultados) sinResultados.hidden = !(buscando && coinciden === 0);
  }

  /* ==================================================================
   * Cargar un gasto existente en el formulario (modo edición).
   * ================================================================*/
  function cargarEnFormulario(contenedor, g) {
    contenedor.querySelector("#alta-titulo").textContent = "Editar gasto";
    contenedor.querySelector("#gasto-enviar").textContent = "Guardar cambios";
    contenedor.querySelector("#gasto-cancelar").hidden = false;

    contenedor.querySelector("#gasto-descripcion").value = g.descripcion;
    contenedor.querySelector("#gasto-monto").value = F.numero(g.monto);
    contenedor.querySelector("#gasto-fecha").value = g.fecha;

    // tipo
    tipoActual = g.tipo;
    var grupoTipo = contenedor.querySelector("#gasto-tipo");
    marcarActivo(grupoTipo, grupoTipo.querySelector('[data-tipo="' + g.tipo + '"]'));

    // moneda
    var grupoMoneda = contenedor.querySelector("#gasto-moneda");
    marcarActivo(grupoMoneda, grupoMoneda.querySelector('[data-moneda="' + (g.moneda || "ARS") + '"]'));

    if (g.tipo === "cuotas") contenedor.querySelector("#gasto-cuotas").value = g.cuotas || 1;
    if (g.tipo === "fijo") contenedor.querySelector("#gasto-hasta").value = g.hasta || "";

    if (g.medioId) contenedor.querySelector("#gasto-medio").value = g.medioId;
    if (g.categoriaId) contenedor.querySelector("#gasto-categoria").value = g.categoriaId;

    // progreso de las cuotas (solo si es un gasto en cuotas)
    var progreso = contenedor.querySelector("#gasto-progreso");
    var p = Nucleo.progresoCuotas(g);
    if (p && p.pagadas > 0) {
      progreso.textContent = "Vas por la cuota " + p.proxima + " de " + p.total + ". " +
        "Pagaste " + F.moneda(p.montoPagado, p.moneda) + " · " +
        "te falta " + F.moneda(p.montoRestante, p.moneda) + ".";
      progreso.hidden = false;
    } else {
      progreso.hidden = true;
    }

    aplicarAvanzado(contenedor);
    actualizarSegunTipo(contenedor);
  }

  /* ==================================================================
   * AUXILIARES chiquitos
   * ================================================================*/

  // Marca visualmente una opción de un segmentado y desmarca las demás.
  function marcarActivo(grupo, opcion) {
    if (!grupo || !opcion) return;
    var todas = grupo.querySelectorAll(".segmentado__opcion");
    for (var i = 0; i < todas.length; i++) {
      todas[i].classList.toggle("segmentado__opcion--activo", todas[i] === opcion);
    }
  }

  function monedaElegida(contenedor) {
    var activo = contenedor.querySelector("#gasto-moneda .segmentado__opcion--activo");
    return activo && activo.getAttribute("data-moneda") === "USD" ? "USD" : "ARS";
  }

  function indiceDe(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return i;
    return -1;
  }

  /* ================================================================*/
  window.Gastos.Vistas.gastos = { montar: montar };
})();
