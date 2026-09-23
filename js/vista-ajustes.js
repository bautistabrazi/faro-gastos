/* ============================================================================
 * vista-ajustes.js
 * ----------------------------------------------------------------------------
 * PANTALLA "AJUSTES":
 *
 *   1) Tarjetas / medios de pago  -> crear, renombrar, borrar
 *   2) Categorías (gastos e ingresos)
 *   3) Sincronización             -> estado de la nube, cerrar sesión
 *   4) Datos                      -> exportar / importar respaldo, borrar todo
 *   5) Tema                       -> claro / automático / oscuro
 *
 * Al borrar un medio o una categoría, también se limpia esa referencia de los
 * gastos que la usaban (para que no queden "colgados").
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};
  window.Gastos.Vistas = window.Gastos.Vistas || {};

  var F = window.Gastos.Formato;
  var I = window.Gastos.Iconos;
  var Almacenamiento = window.Gastos.Almacenamiento;
  var Tema = window.Gastos.Tema;

  /* ==================================================================
   * MONTAR
   * ================================================================*/
  function montar(contenedor, ctx) {
    var estado = window.Gastos.App.estado;
    var temaActual = Tema.leer();

    // .surge solo al abrir la pantalla (no en cada redibujado).
    var anim = ctx && ctx.primeraCarga ? " surge" : "";

    contenedor.innerHTML =
      '<div class="ajustes-raiz' + anim + '">' +
      '<h1 class="pantalla__titulo">Ajustes</h1>' +
      '<p class="pantalla__bajada">Tarjetas, categorías, respaldo de tus datos y apariencia.</p>' +

      // Sincronización va PRIMERO a propósito: es donde vive "Cerrar sesión",
      // y con las categorías por defecto ya cargadas, si iba más abajo había
      // que scrollear bastante para encontrarlo (se reportó como "no hay
      // forma de cerrar sesión" cuando en realidad estaba, solo que escondido).
      bloqueSync() +
      bloqueMedios(estado) +
      bloqueCategorias(estado.categorias, {
        kind: "gasto",
        titulo: "Categorías de gastos",
        ayuda: "Opcionales. Para agrupar gastos parecidos.",
        placeholder: "Ej: Mascotas",
      }) +
      bloqueCategorias(estado.categoriasIngreso, {
        kind: "ingreso",
        titulo: "Categorías de ingresos",
        ayuda: "Opcionales. Para distinguir sueldo, alquiler, freelance, etc.",
        placeholder: "Ej: Dividendos",
      }) +
      bloqueDatos(estado) +
      bloqueTema(temaActual) +

      '</div>';

    enganchar(contenedor);
  }

  /* ==================================================================
   * BLOQUE: SINCRONIZACIÓN (nube)
   * ================================================================*/
  function bloqueSync() {
    var info = window.Gastos.App.infoSync();
    var cuerpo;
    // "Pastilla" de estado al lado del título: texto + variante de color.
    var estadoTexto = "Solo este dispositivo";
    var estadoClase = "";

    if (info.modo === "nube") {
      estadoTexto = "Conectado";
      estadoClase = " estado-sync--ok";
      cuerpo = '<p class="config-bloque__ayuda" id="sync-detalle">Sincronizando entre dispositivos…</p>' +
        '<div class="config-acciones">' +
          '<button class="boton boton--secundario" id="sync-salir" type="button">Cerrar sesión</button>' +
        '</div>';
    } else if (info.modo === "local-elegido") {
      cuerpo = '<p class="config-bloque__ayuda">Elegiste usar la app sin cuenta. Los datos ' +
        'viven solo en este dispositivo.</p>' +
        '<div class="config-acciones">' +
          '<button class="boton boton--secundario" id="sync-activar" type="button">Activar sincronización</button>' +
        '</div>';
    } else {
      // "local" (sin elegirlo a propósito): puede ser que esta app nunca
      // tuvo la nube configurada, O que la tiene pero no se pudo conectar
      // justo ahora (sin internet, CDN caído). Nube.diagnostico() distingue
      // los dos casos para no confundir "nunca configurado" con "temporal".
      var razon = window.Gastos.Nube ? window.Gastos.Nube.diagnostico() : "sin-config";
      if (razon === "sin-libreria") {
        estadoTexto = "Sin conexión";
        estadoClase = " estado-sync--atencion";
        cuerpo = '<p class="config-bloque__ayuda">No se pudo conectar con la nube en este momento. ' +
          'Revisá tu conexión a internet.</p>' +
          '<div class="config-acciones">' +
            '<button class="boton boton--secundario" id="sync-reintentar" type="button">Reintentar</button>' +
          '</div>';
      } else {
        cuerpo = '<p class="config-bloque__ayuda">Esta app corre en modo local: tus datos viven ' +
          'solo en este dispositivo.</p>';
      }
    }

    return '' +
    '<section class="config-bloque">' +
      '<div class="config-bloque__cabeza">' +
        '<h2 class="config-bloque__titulo">Sincronización</h2>' +
        '<span class="estado-sync' + estadoClase + '">' + estadoTexto + '</span>' +
      '</div>' +
      cuerpo +
    '</section>';
  }

  /* ==================================================================
   * BLOQUE 1: MEDIOS DE PAGO
   * ================================================================*/
  function bloqueMedios(estado) {
    var filas = estado.medios.map(function (m) {
      return '' +
      '<div class="chip-item" data-id="' + F.escapar(m.id) + '">' +
        // el puntito toma el color de la tarjeta vía la variable --cat
        '<span class="chip-item__color" aria-hidden="true" ' +
          'style="--cat:' + F.escapar(F.colorSeguro(m.color, "var(--acento)")) + '"></span>' +
        '<span class="chip-item__nombre">' + F.escapar(m.nombre) + '</span>' +
        botonesFila("medio", m.nombre) +
      '</div>';
    }).join("");

    if (!filas) filas = '<p class="config-bloque__ayuda">Todavía no agregaste ninguna.</p>';

    return '' +
    '<section class="config-bloque">' +
      '<h2 class="config-bloque__titulo">Tarjetas y medios de pago</h2>' +
      '<p class="config-bloque__ayuda">Opcionales. Sirven para etiquetar cada gasto y ver la proyección por tarjeta.</p>' +
      '<div class="chip-lista">' + filas + '</div>' +
      '<form class="campo-fila form-agregar" id="form-medio" autocomplete="off">' +
        '<div class="campo campo--sin-margen">' +
          '<label class="campo__etiqueta" for="medio-nombre">Nueva tarjeta / medio</label>' +
          '<input type="text" id="medio-nombre" maxlength="40" placeholder="Ej: Visa Santander" />' +
        '</div>' +
        '<div class="campo campo--sin-margen campo--color">' +
          '<label class="campo__etiqueta" for="medio-color">Color</label>' +
          '<input type="color" id="medio-color" class="input-color" value="#4F46E5" />' +
        '</div>' +
        '<button type="submit" class="boton boton--secundario">Agregar</button>' +
      '</form>' +
    '</section>';
  }

  /* ==================================================================
   * BLOQUE 2 y 3: CATEGORÍAS (mismo formato para gastos y para ingresos)
   *   opts.kind: "gasto" | "ingreso"  -> define los data-accion y los ids
   * ================================================================*/
  function bloqueCategorias(lista, opts) {
    var k = opts.kind; // "gasto" | "ingreso"
    var filas = (lista || []).map(function (c) {
      return '' +
      '<div class="chip-item" data-id="' + F.escapar(c.id) + '">' +
        '<span class="chip-item__nombre">' + F.escapar(c.nombre) + '</span>' +
        botonesFila("cat-" + k, c.nombre) +
      '</div>';
    }).join("");

    if (!filas) filas = '<p class="config-bloque__ayuda">Todavía no agregaste ninguna.</p>';

    return '' +
    '<section class="config-bloque">' +
      '<h2 class="config-bloque__titulo">' + F.escapar(opts.titulo) + '</h2>' +
      '<p class="config-bloque__ayuda">' + F.escapar(opts.ayuda) + '</p>' +
      '<div class="chip-lista">' + filas + '</div>' +
      '<form class="campo-fila form-agregar" data-form-cat="' + k + '" autocomplete="off">' +
        '<div class="campo campo--sin-margen">' +
          '<label class="campo__etiqueta" for="cat-nombre-' + k + '">Nueva categoría</label>' +
          '<input type="text" class="cat-nombre" id="cat-nombre-' + k + '" maxlength="40" ' +
            'placeholder="' + F.escapar(opts.placeholder) + '" />' +
        '</div>' +
        '<button type="submit" class="boton boton--secundario">Agregar</button>' +
      '</form>' +
    '</section>';
  }

  /* ------------------------------------------------------------------
   * botonesFila(tipo, nombre)
   * Los dos botones solo-ícono de cada fila (Renombrar = lápiz, Borrar =
   * papelera). "tipo" arma el data-accion que escucha enganchar():
   *   "medio"          -> renombrar-medio / borrar-medio
   *   "cat-gasto"      -> renombrar-cat-gasto / borrar-cat-gasto
   *   "cat-ingreso"    -> renombrar-cat-ingreso / borrar-cat-ingreso
   * El aria-label incluye el nombre, para que se entienda con lector de pantalla.
   * ---------------------------------------------------------------- */
  function botonesFila(tipo, nombre) {
    var n = F.escapar(nombre);
    return '' +
      '<button class="boton-icono" data-accion="renombrar-' + tipo + '" type="button" ' +
        'aria-label="Renombrar ' + n + '" title="Renombrar">' + I.svg("lapiz", 18) + '</button>' +
      '<button class="boton-icono boton-icono--peligro" data-accion="borrar-' + tipo + '" type="button" ' +
        'aria-label="Borrar ' + n + '" title="Borrar">' + I.svg("papelera", 18) + '</button>';
  }

  /* ==================================================================
   * BLOQUE 3: DATOS (respaldo)
   * ================================================================*/
  function bloqueDatos(estado) {
    var g = estado.gastos.length, i = estado.ingresos.length;
    return '' +
    '<section class="config-bloque">' +
      '<h2 class="config-bloque__titulo">Tus datos</h2>' +
      '<p class="config-bloque__ayuda">' +
        'Todo se guarda solo en este navegador (' + g + ' gasto' + (g === 1 ? '' : 's') +
        ', ' + i + ' ingreso' + (i === 1 ? '' : 's') + '). ' +
        'Descargá un respaldo cada tanto, sobre todo antes de limpiar el navegador o cambiar de compu.' +
      '</p>' +
      '<div class="config-acciones">' +
        '<button class="boton boton--secundario" id="datos-exportar" type="button">Exportar respaldo (.json)</button>' +
        '<button class="boton boton--secundario" id="datos-importar" type="button">Importar respaldo</button>' +
        '<button class="boton boton--fantasma boton--peligro" id="datos-borrar" type="button">Borrar todo</button>' +
      '</div>' +
      '<input type="file" id="datos-archivo" accept="application/json,.json" hidden />' +
    '</section>';
  }

  /* ==================================================================
   * BLOQUE 4: TEMA
   * ================================================================*/
  function bloqueTema(actual) {
    function op(valor, texto) {
      var activo = valor === actual ? ' segmentado__opcion--activo' : '';
      return '<button type="button" class="segmentado__opcion' + activo + '" data-tema="' + valor + '">' + texto + '</button>';
    }
    return '' +
    '<section class="config-bloque">' +
      '<h2 class="config-bloque__titulo">Tema</h2>' +
      '<p class="config-bloque__ayuda">"Automático" sigue lo que tenga configurado tu sistema.</p>' +
      '<div class="segmentado" id="config-tema">' +
        op("claro", "Claro") + op("auto", "Automático") + op("oscuro", "Oscuro") +
      '</div>' +
    '</section>';
  }

  /* ==================================================================
   * EVENTOS
   * ================================================================*/
  function enganchar(contenedor) {
    var App = window.Gastos.App;
    var estado = App.estado;

    // Enganchamos en .ajustes-raiz (se recrea en cada redibujado) y no en
    // `contenedor` (que es siempre el mismo #contenido).
    var raiz = contenedor.querySelector(".ajustes-raiz");

    /* --- sincronización: mostrar el email y conectar los botones --- */
    var syncDetalle = contenedor.querySelector("#sync-detalle");
    if (syncDetalle && window.Gastos.Nube) {
      window.Gastos.Nube.emailActual().then(function (email) {
        if (email) syncDetalle.textContent = "Conectado como " + email +
          ". Tus datos se sincronizan entre el celular y la compu.";
      });
    }

    /* --- clics (delegación para todos los botones de la pantalla) --- */
    raiz.addEventListener("click", function (e) {
      var boton = e.target.closest("[data-accion], [data-tema], #datos-exportar, #datos-importar, #datos-borrar, #sync-salir, #sync-activar, #sync-reintentar");
      if (!boton) return;

      // --- sincronización ---
      if (boton.id === "sync-salir") {
        if (window.confirm("¿Cerrar sesión? Los datos quedan guardados en la nube.")) App.cerrarSesion();
        return;
      }
      if (boton.id === "sync-reintentar") { window.location.reload(); return; }
      if (boton.id === "sync-activar") {
        // Aclaramos ANTES de recargar que esto no es un camino sin vuelta:
        // si tocaste esto por error, en la pantalla siguiente podés volver
        // a elegir "Seguir sin cuenta" y quedás exactamente como estabas.
        var seguro = window.confirm(
          "Esto va a pedirte iniciar sesión o crear una cuenta para sincronizar. " +
          "Si te arrepentís, en esa pantalla podés tocar \"Seguir sin cuenta\" para volver a usar la app como hasta ahora, sin perder nada. ¿Continuar?"
        );
        if (seguro) App.activarSync();
        return;
      }

      // --- tema ---
      if (boton.hasAttribute("data-tema")) {
        Tema.aplicar(boton.getAttribute("data-tema"));
        App.render();
        return;
      }

      // --- exportar / importar / borrar ---
      if (boton.id === "datos-exportar") { Almacenamiento.exportar(estado); return; }
      if (boton.id === "datos-importar") { contenedor.querySelector("#datos-archivo").click(); return; }
      if (boton.id === "datos-borrar") { borrarTodo(); return; }

      // --- acciones sobre medios / categorías ---
      var fila = boton.closest(".chip-item");
      if (!fila) return;
      var id = fila.getAttribute("data-id");
      var accion = boton.getAttribute("data-accion");

      if (accion === "renombrar-medio") renombrar(estado.medios, id, "la tarjeta / medio");
      if (accion === "borrar-medio") borrarMedio(id);
      if (accion === "renombrar-cat-gasto") renombrar(estado.categorias, id, "la categoría");
      if (accion === "borrar-cat-gasto") borrarCategoria("gasto", id);
      if (accion === "renombrar-cat-ingreso") renombrar(estado.categoriasIngreso, id, "la categoría de ingreso");
      if (accion === "borrar-cat-ingreso") borrarCategoria("ingreso", id);
    });

    /* --- alta de medio --- */
    contenedor.querySelector("#form-medio").addEventListener("submit", function (e) {
      e.preventDefault();
      var nombre = contenedor.querySelector("#medio-nombre").value.trim();
      var color = contenedor.querySelector("#medio-color").value || "#4F46E5";
      if (nombre === "") return;
      estado.medios.push({ id: Almacenamiento.nuevoId("m"), nombre: nombre, color: color });
      App.aviso("Medio agregado", "ok");
      App.guardar();
    });

    /* --- alta de categoría (gastos e ingresos, mismo formulario) --- */
    var formsCat = contenedor.querySelectorAll("[data-form-cat]");
    for (var fc = 0; fc < formsCat.length; fc++) {
      formsCat[fc].addEventListener("submit", function (e) {
        e.preventDefault();
        var kind = this.getAttribute("data-form-cat"); // "gasto" | "ingreso"
        var input = this.querySelector(".cat-nombre");
        var nombre = input.value.trim();
        if (nombre === "") return;
        if (kind === "ingreso") {
          estado.categoriasIngreso.push({ id: Almacenamiento.nuevoId("ci"), nombre: nombre });
        } else {
          estado.categorias.push({ id: Almacenamiento.nuevoId("c"), nombre: nombre });
        }
        App.aviso("Categoría agregada", "ok");
        App.guardar();
      });
    }

    /* --- importar respaldo (cuando se elige un archivo) --- */
    contenedor.querySelector("#datos-archivo").addEventListener("change", function (e) {
      var archivo = e.target.files && e.target.files[0];
      if (!archivo) return;
      Almacenamiento.importar(archivo).then(function (nuevoEstado) {
        if (!window.confirm("Esto reemplaza TODOS tus datos actuales por los del archivo. ¿Seguir?")) return;
        App.estado = nuevoEstado;
        App.aviso("Respaldo importado", "ok");
        App.guardar();
      }).catch(function (error) {
        App.aviso(error.message || "No se pudo importar", "peligro");
      });
      e.target.value = ""; // permitir volver a elegir el mismo archivo
    });
  }

  /* ==================================================================
   * ACCIONES
   * ================================================================*/

  // Renombra un elemento de una lista (medios o categorías) usando un prompt.
  function renombrar(lista, id, queCosa) {
    var App = window.Gastos.App;
    var item = null;
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) item = lista[i];
    if (!item) return;

    var nuevo = window.prompt("Nuevo nombre para " + queCosa + ":", item.nombre);
    if (nuevo === null) return;          // canceló
    nuevo = nuevo.trim();
    if (nuevo === "") return;

    item.nombre = nuevo;
    App.aviso("Nombre cambiado", "ok");
    App.guardar();
  }

  function borrarMedio(id) {
    var App = window.Gastos.App;
    var estado = App.estado;
    if (!window.confirm("¿Borrar este medio de pago? Los gastos que lo usaban quedan sin medio.")) return;

    estado.medios = estado.medios.filter(function (m) { return m.id !== id; });
    // limpiar la referencia en los gastos
    estado.gastos.forEach(function (g) { if (g.medioId === id) g.medioId = null; });

    App.aviso("Medio borrado");
    App.guardar();
  }

  function borrarCategoria(kind, id) {
    var App = window.Gastos.App;
    var estado = App.estado;
    if (!window.confirm("¿Borrar esta categoría? Los movimientos que la usaban quedan sin categoría.")) return;

    if (kind === "ingreso") {
      estado.categoriasIngreso = estado.categoriasIngreso.filter(function (c) { return c.id !== id; });
      estado.ingresos.forEach(function (i) { if (i.categoriaId === id) i.categoriaId = null; });
    } else {
      estado.categorias = estado.categorias.filter(function (c) { return c.id !== id; });
      estado.gastos.forEach(function (g) { if (g.categoriaId === id) g.categoriaId = null; });
    }

    App.aviso("Categoría borrada");
    App.guardar();
  }

  function borrarTodo() {
    var App = window.Gastos.App;
    if (!window.confirm("Esto borra TODOS los gastos, ingresos, medios y categorías de este navegador. ¿Seguro?")) return;
    if (!window.confirm("Última confirmación: no se puede deshacer. ¿Borrar todo?")) return;

    App.estado = Almacenamiento.estadoInicial();
    App.aviso("Todo borrado");
    App.guardar();
  }

  /* ================================================================*/
  window.Gastos.Vistas.ajustes = { montar: montar };
})();
