/* ============================================================================
 * vista-ingresos.js
 * ----------------------------------------------------------------------------
 * PANTALLA "INGRESOS" — las entradas de plata (sueldo, alquiler que cobrás,
 * changas, reintegros, etc.).
 *
 * Es una versión más simple de la pantalla Gastos: un ingreso no tiene cuotas
 * ni medio de pago. Solo puede ser:
 *   - "Único": entró una vez (un aguinaldo, una venta puntual).
 *   - "Fijo":  entra todos los meses (el sueldo), opcionalmente hasta un mes.
 *
 * Igual que en Gastos: arriba un alta rápida, abajo la lista con Editar/Borrar.
 * Reutiliza las mismas clases de CSS que Gastos (.alta, .campo, .gasto-item...).
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};
  window.Gastos.Vistas = window.Gastos.Vistas || {};

  var F = window.Gastos.Formato;
  var I = window.Gastos.Iconos;
  var Nucleo = window.Gastos.Nucleo;
  var Almacenamiento = window.Gastos.Almacenamiento;

  // Estado local de la pantalla (se conserva entre redibujados).
  var editandoId = null;
  var tipoActual = "fijo";     // por defecto "fijo": lo más común es el sueldo
  var avanzadoAbierto = false;
  var recienAgregadoId = null; // id del ingreso recién agregado (para el "destello" de su fila)

  /* ==================================================================
   * MONTAR
   * ================================================================*/
  function montar(contenedor, ctx) {
    var estado = window.Gastos.App.estado;

    if (ctx && ctx.primeraCarga) {
      editandoId = null;
      avanzadoAbierto = false;
    }
    if (!editandoId) tipoActual = "fijo";

    var anim = ctx && ctx.primeraCarga ? " surge" : "";
    contenedor.innerHTML =
      '<div class="vista-raiz' + anim + '">' +
        '<h1 class="pantalla__titulo">Ingresos</h1>' +
        plantillaAlta(estado) +
        plantillaLista(estado) +
      '</div>';

    // el destello de la fila nueva se muestra una sola vez
    recienAgregadoId = null;

    engancharAlta(contenedor, estado);
    engancharLista(contenedor);

    if (editandoId) {
      var ing = Nucleo.buscarPorId(estado.ingresos, editandoId);
      if (ing) cargarEnFormulario(contenedor, ing);
      else editandoId = null;
    }
  }

  /* ==================================================================
   * PLANTILLA: alta rápida
   * ================================================================*/
  function plantillaAlta(estado) {
    var opcionesCategoria = '<option value="">— sin categoría —</option>';
    estado.categoriasIngreso.forEach(function (c) {
      opcionesCategoria += '<option value="' + F.escapar(c.id) + '">' + F.escapar(c.nombre) + '</option>';
    });

    var hoy = new Date();
    var hoyISO = hoy.getFullYear() + "-" +
      String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
      String(hoy.getDate()).padStart(2, "0");

    return '' +
    '<form class="tarjeta alta" id="form-ingreso" autocomplete="off">' +
      '<h2 class="alta__titulo" id="ingreso-alta-titulo">Agregar ingreso</h2>' +

      '<div class="alta__principal">' +
        '<div class="campo alta__descripcion">' +
          '<label class="campo__etiqueta" for="ingreso-descripcion">De qué es</label>' +
          '<input type="text" id="ingreso-descripcion" required maxlength="80" placeholder="Ej: Sueldo" />' +
        '</div>' +
        '<div class="campo alta__monto">' +
          '<label class="campo__etiqueta" for="ingreso-monto">Monto</label>' +
          '<input type="text" inputmode="decimal" id="ingreso-monto" required placeholder="0" />' +
        '</div>' +
      '</div>' +

      '<div class="alta__division"></div>' +

      '<div class="campo">' +
        '<span class="campo__etiqueta">Cada cuánto entra</span>' +
        '<div class="segmentado segmentado--ancho" id="ingreso-tipo">' +
          '<button type="button" class="segmentado__opcion" data-tipo="unico">Una vez</button>' +
          '<button type="button" class="segmentado__opcion segmentado__opcion--activo" data-tipo="fijo">Todos los meses</button>' +
        '</div>' +
      '</div>' +

      '<div class="alta__avanzado" id="ingreso-avanzado" hidden>' +
        '<div class="campo-fila">' +
          '<div class="campo">' +
            '<label class="campo__etiqueta" for="ingreso-fecha">Fecha</label>' +
            '<input type="date" id="ingreso-fecha" value="' + hoyISO + '" />' +
          '</div>' +
          '<div class="campo">' +
            '<span class="campo__etiqueta">Moneda</span>' +
            '<div class="segmentado segmentado--ancho" id="ingreso-moneda">' +
              '<button type="button" class="segmentado__opcion segmentado__opcion--activo" data-moneda="ARS">ARS</button>' +
              '<button type="button" class="segmentado__opcion" data-moneda="USD">USD</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="campo" id="ingreso-campo-hasta" hidden>' +
          '<label class="campo__etiqueta" for="ingreso-hasta">Hasta (opcional)</label>' +
          '<input type="month" id="ingreso-hasta" />' +
          '<span class="campo__ayuda">Dejalo vacío si no tiene fecha de fin.</span>' +
        '</div>' +
        '<div class="campo">' +
          '<label class="campo__etiqueta" for="ingreso-categoria">Categoría</label>' +
          '<select id="ingreso-categoria">' + opcionesCategoria + '</select>' +
        '</div>' +
      '</div>' +

      '<div class="alta__pie">' +
        // "Más opciones": el texto y aria-expanded los actualiza aplicarAvanzado()
        '<button type="button" class="boton boton--fantasma boton-mas" id="ingreso-mas" ' +
          'aria-expanded="false" aria-controls="ingreso-avanzado">' +
          '<span class="boton-mas__texto">Más opciones</span>' + I.svg("chevronAbajo", 16) +
        '</button>' +
        '<div class="acciones">' +
          '<button type="button" class="boton boton--secundario" id="ingreso-cancelar" hidden>Cancelar</button>' +
          '<button type="submit" class="boton boton--primario" id="ingreso-enviar">Agregar ingreso</button>' +
        '</div>' +
      '</div>' +
    '</form>';
  }

  /* ==================================================================
   * PLANTILLA: la lista
   * ================================================================*/
  function plantillaLista(estado) {
    var ingresos = Nucleo.ingresosOrdenados(estado);

    if (ingresos.length === 0) {
      return '' +
      '<section class="seccion">' +
        '<div class="vacio">' +
          '<span class="vacio__icono" aria-hidden="true">' + I.svg("ingreso", 26) + '</span>' +
          '<div class="vacio__titulo">Todavía no cargaste ingresos</div>' +
          '<p>Agregá tu sueldo u otra entrada de plata con el formulario de arriba. ' +
          'Sirve para ver, en la Proyección, cuánto te queda cada mes.</p>' +
        '</div>' +
      '</section>';
    }

    var filas = ingresos.map(function (i) { return filaIngresoHTML(i, estado); }).join("");

    return '' +
    '<section class="seccion">' +
      '<h2 class="titulo-seccion">' +
        'Registro <span class="contador">' + ingresos.length + '</span>' +
      '</h2>' +
      '<p class="pantalla__bajada">Lo más nuevo primero.</p>' +
      '<div class="gasto-lista">' + filas + '</div>' +
    '</section>';
  }

  function filaIngresoHTML(ing, estado) {
    var categoria = Nucleo.buscarPorId(estado.categoriasIngreso, ing.categoriaId);

    var meta = Nucleo.resumenDeIngreso(ing) + " — " + F.fechaCorta(ing.fecha);
    if (categoria) meta += " · " + F.escapar(categoria.nombre);

    var chipMoneda = ing.moneda === "USD"
      ? ' <span class="gasto-item__moneda">USD</span>'
      : "";

    var editando = ing.id === editandoId;
    var nuevo = ing.id === recienAgregadoId;

    return '' +
    '<div class="gasto-item' + (editando ? ' gasto-item--editando' : '') + (nuevo ? ' gasto-item--nuevo' : '') +
      '" data-id="' + F.escapar(ing.id) + '">' +
      // avatar verde con las iniciales del ingreso (no tienen medio de pago)
      '<span class="gasto-item__avatar gasto-item__avatar--ingreso" aria-hidden="true">' +
        F.escapar(F.iniciales(ing.descripcion)) + '</span>' +
      '<div class="gasto-item__cuerpo">' +
        '<div class="gasto-item__descripcion">' + F.escapar(ing.descripcion) + chipMoneda + '</div>' +
        '<div class="gasto-item__meta">' + meta + '</div>' +
      '</div>' +
      '<div class="gasto-item__monto gasto-item__monto--positivo monto">+ ' + F.moneda(ing.monto, ing.moneda) + '</div>' +
      // botones solo-ícono: el aria-label dice qué hacen y sobre qué ingreso
      '<div class="gasto-item__acciones">' +
        '<button class="boton-icono" data-accion="editar" type="button" ' +
          'aria-label="Editar ' + F.escapar(ing.descripcion) + '" title="Editar">' + I.svg("lapiz", 18) + '</button>' +
        '<button class="boton-icono boton-icono--peligro" data-accion="borrar" type="button" ' +
          'aria-label="Borrar ' + F.escapar(ing.descripcion) + '" title="Borrar">' + I.svg("papelera", 18) + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ==================================================================
   * EVENTOS del formulario
   * ================================================================*/
  function engancharAlta(contenedor, estado) {
    var form = contenedor.querySelector("#form-ingreso");
    var inputMonto = contenedor.querySelector("#ingreso-monto");

    var grupoTipo = contenedor.querySelector("#ingreso-tipo");
    grupoTipo.addEventListener("click", function (e) {
      var op = e.target.closest("[data-tipo]");
      if (!op) return;
      tipoActual = op.getAttribute("data-tipo");
      marcarActivo(grupoTipo, op);
      actualizarSegunTipo(contenedor);
    });

    var grupoMoneda = contenedor.querySelector("#ingreso-moneda");
    grupoMoneda.addEventListener("click", function (e) {
      var op = e.target.closest("[data-moneda]");
      if (op) marcarActivo(grupoMoneda, op);
    });

    var botonMas = contenedor.querySelector("#ingreso-mas");
    botonMas.addEventListener("click", function () {
      avanzadoAbierto = !avanzadoAbierto;
      aplicarAvanzado(contenedor);
    });
    aplicarAvanzado(contenedor);

    inputMonto.addEventListener("input", function () {
      window.Gastos.App.formatearInputMonto(inputMonto);
    });

    contenedor.querySelector("#ingreso-cancelar").addEventListener("click", function () {
      editandoId = null;
      window.Gastos.App.render();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      enviar(contenedor, estado);
    });

    actualizarSegunTipo(contenedor);
  }

  // El campo "hasta" solo tiene sentido para los ingresos fijos.
  function actualizarSegunTipo(contenedor) {
    contenedor.querySelector("#ingreso-campo-hasta").hidden = tipoActual !== "fijo";
  }

  // Muestra u oculta el panel "más" y actualiza el botón: su texto y
  // aria-expanded (el CSS usa aria-expanded para girar la flechita).
  function aplicarAvanzado(contenedor) {
    contenedor.querySelector("#ingreso-avanzado").hidden = !avanzadoAbierto;
    var boton = contenedor.querySelector("#ingreso-mas");
    boton.setAttribute("aria-expanded", String(avanzadoAbierto));
    boton.querySelector(".boton-mas__texto").textContent = avanzadoAbierto ? "Menos opciones" : "Más opciones";
  }

  /* ==================================================================
   * ENVIAR
   * ================================================================*/
  function enviar(contenedor, estado) {
    var App = window.Gastos.App;

    var descripcion = contenedor.querySelector("#ingreso-descripcion").value.trim();
    var monto = F.parsearMonto(contenedor.querySelector("#ingreso-monto").value);

    if (descripcion === "") {
      App.aviso("Poné una descripción", "peligro");
      contenedor.querySelector("#ingreso-descripcion").focus();
      return;
    }
    if (!isFinite(monto) || monto <= 0) {
      App.aviso("El monto no es válido", "peligro");
      contenedor.querySelector("#ingreso-monto").focus();
      return;
    }

    var ingreso = {
      id: editandoId || Almacenamiento.nuevoId("i"),
      descripcion: descripcion,
      monto: monto,
      moneda: monedaElegida(contenedor),
      tipo: tipoActual,
      fecha: contenedor.querySelector("#ingreso-fecha").value || Nucleo.mesActual() + "-01",
      categoriaId: contenedor.querySelector("#ingreso-categoria").value || null,
    };
    if (tipoActual === "fijo") {
      ingreso.hasta = contenedor.querySelector("#ingreso-hasta").value || null;
    }

    if (editandoId) {
      var i = indiceDe(estado.ingresos, editandoId);
      if (i !== -1) estado.ingresos[i] = ingreso;
      editandoId = null;
      App.aviso("Ingreso actualizado", "ok");
    } else {
      estado.ingresos.push(ingreso);
      recienAgregadoId = ingreso.id; // para que su fila "destelle" al redibujar
      App.aviso("Ingreso agregado", "ok");
    }

    App.guardar();
  }

  /* ==================================================================
   * EVENTOS de la lista
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
      var estado = window.Gastos.App.estado;

      if (accion === "editar") {
        editandoId = id;
        avanzadoAbierto = true;
        window.Gastos.App.render();
        var form = contenedor.querySelector("#form-ingreso");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (accion === "borrar") {
        var ing = Nucleo.buscarPorId(estado.ingresos, id);
        var nombre = ing ? ing.descripcion : "este ingreso";
        if (window.confirm('¿Borrar "' + nombre + '"? No se puede deshacer.')) {
          var i = indiceDe(estado.ingresos, id);
          if (i !== -1) estado.ingresos.splice(i, 1);
          if (editandoId === id) editandoId = null;
          window.Gastos.App.aviso("Ingreso borrado");
          window.Gastos.App.guardar();
        }
      }
    });
  }

  /* ==================================================================
   * Cargar un ingreso en el formulario (edición)
   * ================================================================*/
  function cargarEnFormulario(contenedor, ing) {
    contenedor.querySelector("#ingreso-alta-titulo").textContent = "Editar ingreso";
    contenedor.querySelector("#ingreso-enviar").textContent = "Guardar cambios";
    contenedor.querySelector("#ingreso-cancelar").hidden = false;

    contenedor.querySelector("#ingreso-descripcion").value = ing.descripcion;
    contenedor.querySelector("#ingreso-monto").value = F.numero(ing.monto);
    contenedor.querySelector("#ingreso-fecha").value = ing.fecha;

    tipoActual = ing.tipo;
    var grupoTipo = contenedor.querySelector("#ingreso-tipo");
    marcarActivo(grupoTipo, grupoTipo.querySelector('[data-tipo="' + ing.tipo + '"]'));

    var grupoMoneda = contenedor.querySelector("#ingreso-moneda");
    marcarActivo(grupoMoneda, grupoMoneda.querySelector('[data-moneda="' + (ing.moneda || "ARS") + '"]'));

    if (ing.tipo === "fijo") contenedor.querySelector("#ingreso-hasta").value = ing.hasta || "";
    if (ing.categoriaId) contenedor.querySelector("#ingreso-categoria").value = ing.categoriaId;

    aplicarAvanzado(contenedor);
    actualizarSegunTipo(contenedor);
  }

  /* ==================================================================
   * AUXILIARES
   * ================================================================*/
  function marcarActivo(grupo, opcion) {
    if (!grupo || !opcion) return;
    var todas = grupo.querySelectorAll(".segmentado__opcion");
    for (var i = 0; i < todas.length; i++) {
      todas[i].classList.toggle("segmentado__opcion--activo", todas[i] === opcion);
    }
  }

  function monedaElegida(contenedor) {
    var activo = contenedor.querySelector("#ingreso-moneda .segmentado__opcion--activo");
    return activo && activo.getAttribute("data-moneda") === "USD" ? "USD" : "ARS";
  }

  function indiceDe(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return i;
    return -1;
  }

  /* ================================================================*/
  window.Gastos.Vistas.ingresos = { montar: montar };
})();
