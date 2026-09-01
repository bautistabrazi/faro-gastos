/* ============================================================================
 * almacenamiento.js
 * ----------------------------------------------------------------------------
 * La ÚNICA parte de la app que habla con el localStorage del navegador.
 * Si algún día cambiamos dónde se guardan los datos (un archivo, una base, la
 * nube), solo se toca este archivo.
 *
 * Responsabilidades:
 *   - cargar()   -> leer los datos guardados (o crear unos vacíos la 1ª vez)
 *   - guardar()  -> escribir los datos
 *   - exportar() -> bajar un archivo .json de respaldo
 *   - importar() -> leer un archivo .json de respaldo
 *   - normalizar() -> "sanear" datos: si el JSON está roto o incompleto, lo
 *                     arreglamos para que la app no explote.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};

  // Clave con la que se guarda TODO en el localStorage. El "-v1" nos deja subir
  // la versión en el futuro sin pisar datos viejos si hiciera falta migrar.
  var CLAVE = "gastos-app-v1";

  // Número de versión del formato de datos. Se guarda dentro del JSON.
  // v2: se agregaron los ingresos y sus categorías. Los respaldos v1 se abren
  //     igual (normalizar() les completa lo que falta).
  var VERSION = 2;

  // Categorías de GASTOS con las que arranca la app la primera vez. Son
  // opcionales: la persona puede borrarlas o agregar las suyas desde Ajustes.
  var CATEGORIAS_INICIALES = [
    "Supermercado", "Comida", "Transporte", "Servicios",
    "Salud", "Ocio", "Suscripciones", "Otros",
  ];

  // Categorías de INGRESOS iniciales (sueldo, alquiler que cobrás, etc.).
  var CATEGORIAS_INGRESO_INICIALES = [
    "Sueldo", "Freelance", "Alquiler", "Reintegros", "Intereses", "Otros",
  ];

  /* ----------------------------------------------------------------------
   * estadoInicial()
   * La forma "vacía" de los datos. Es lo que se usa la primera vez que se
   * abre la app o si el respaldo está irrecuperable.
   * -------------------------------------------------------------------- */
  function estadoInicial() {
    return {
      version: VERSION,
      medios: [],       // tarjetas / medios de pago (ver más abajo la forma)
      categorias: CATEGORIAS_INICIALES.map(function (nombre) {
        return { id: nuevoId("c"), nombre: nombre };
      }),
      categoriasIngreso: CATEGORIAS_INGRESO_INICIALES.map(function (nombre) {
        return { id: nuevoId("ci"), nombre: nombre };
      }),
      gastos: [],
      ingresos: [],     // sueldos y otras entradas de plata (ver forma abajo)
    };
  }

  /* ----------------------------------------------------------------------
   * nuevoId(prefijo)
   * Genera un identificador único y corto, tipo "g_lm3k9f2a".
   * Mezcla la hora actual (en base 36) con un poco de azar para que no se
   * repitan aunque se creen dos en el mismo milisegundo.
   * -------------------------------------------------------------------- */
  function nuevoId(prefijo) {
    var hora = Date.now().toString(36);
    var azar = Math.random().toString(36).slice(2, 7);
    return (prefijo || "id") + "_" + hora + azar;
  }

  /* ----------------------------------------------------------------------
   * normalizar(datos)
   * Recibe cualquier cosa (lo que había en localStorage, un archivo importado)
   * y devuelve un estado con la forma correcta garantizada. Todo lo que no
   * entienda, lo descarta en silencio.
   * -------------------------------------------------------------------- */
  function normalizar(datos) {
    var base = estadoInicial();
    if (!datos || typeof datos !== "object") return base;

    var salida = {
      version: VERSION,
      medios: [],
      categorias: [],
      categoriasIngreso: [],
      gastos: [],
      ingresos: [],
    };

    // --- Medios de pago ---
    if (Array.isArray(datos.medios)) {
      datos.medios.forEach(function (m) {
        if (!m || typeof m !== "object") return;
        if (typeof m.nombre !== "string" || m.nombre.trim() === "") return;
        salida.medios.push({
          id: typeof m.id === "string" ? m.id : nuevoId("m"),
          nombre: m.nombre.trim(),
          color: typeof m.color === "string" ? m.color : "#2438E0",
        });
      });
    }

    // --- Categorías de gastos y de ingresos ---
    salida.categorias = normalizarCategorias(datos.categorias, "c");
    if (salida.categorias.length === 0) salida.categorias = base.categorias;

    salida.categoriasIngreso = normalizarCategorias(datos.categoriasIngreso, "ci");
    if (salida.categoriasIngreso.length === 0) salida.categoriasIngreso = base.categoriasIngreso;

    // --- Gastos --- (la parte más importante de validar)
    if (Array.isArray(datos.gastos)) {
      datos.gastos.forEach(function (g) {
        var limpio = normalizarGasto(g);
        if (limpio) salida.gastos.push(limpio);
      });
    }

    // --- Ingresos ---
    if (Array.isArray(datos.ingresos)) {
      datos.ingresos.forEach(function (i) {
        var limpio = normalizarIngreso(i);
        if (limpio) salida.ingresos.push(limpio);
      });
    }

    return salida;
  }

  /* ----------------------------------------------------------------------
   * normalizarCategorias(arr, prefijo)
   * Limpia una lista de categorías. Acepta objetos {id, nombre} y también
   * strings sueltos (respaldos viejos). Devuelve un array de {id, nombre}.
   * -------------------------------------------------------------------- */
  function normalizarCategorias(arr, prefijo) {
    var salida = [];
    if (!Array.isArray(arr)) return salida;
    arr.forEach(function (c) {
      if (typeof c === "string" && c.trim() !== "") {
        salida.push({ id: nuevoId(prefijo), nombre: c.trim() });
      } else if (c && typeof c === "object" && typeof c.nombre === "string" && c.nombre.trim() !== "") {
        salida.push({
          id: typeof c.id === "string" ? c.id : nuevoId(prefijo),
          nombre: c.nombre.trim(),
        });
      }
    });
    return salida;
  }

  /* ----------------------------------------------------------------------
   * normalizarGasto(g)
   * Valida y limpia UN gasto. Devuelve el gasto saneado o null si es basura
   * (sin descripción, sin monto válido, con un tipo desconocido, etc.).
   * -------------------------------------------------------------------- */
  function normalizarGasto(g) {
    if (!g || typeof g !== "object") return null;

    var descripcion = typeof g.descripcion === "string" ? g.descripcion.trim() : "";
    if (descripcion === "") return null;

    var monto = Number(g.monto);
    if (!isFinite(monto) || monto <= 0) return null;

    var tipo = g.tipo;
    if (tipo !== "unico" && tipo !== "cuotas" && tipo !== "fijo") return null;

    // La fecha tiene que verse como "YYYY-MM-DD".
    var fecha = typeof g.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.fecha)
      ? g.fecha
      : null;
    if (!fecha) return null;

    var limpio = {
      id: typeof g.id === "string" ? g.id : nuevoId("g"),
      descripcion: descripcion,
      monto: monto,
      moneda: g.moneda === "USD" ? "USD" : "ARS",
      tipo: tipo,
      fecha: fecha,
      medioId: typeof g.medioId === "string" ? g.medioId : null,
      categoriaId: typeof g.categoriaId === "string" ? g.categoriaId : null,
    };

    if (tipo === "cuotas") {
      var cuotas = parseInt(g.cuotas, 10);
      limpio.cuotas = isFinite(cuotas) && cuotas >= 1 ? cuotas : 1;
    }

    if (tipo === "fijo") {
      // "hasta" es opcional. Si viene, tiene que verse como "YYYY-MM".
      if (typeof g.hasta === "string" && /^\d{4}-\d{2}$/.test(g.hasta)) {
        limpio.hasta = g.hasta;
      } else {
        limpio.hasta = null;
      }
    }

    return limpio;
  }

  /* ----------------------------------------------------------------------
   * normalizarIngreso(i)
   * Valida y limpia UN ingreso. Devuelve el ingreso saneado o null si es
   * basura. Un ingreso es más simple que un gasto: no tiene cuotas ni medio.
   *
   * MODELO DE UN INGRESO:
   *   {
   *     id, descripcion, monto, moneda ("ARS" | "USD"),
   *     tipo ("unico" | "fijo"),
   *     fecha ("YYYY-MM-DD"),
   *     hasta ("YYYY-MM" | null)   // solo tipo "fijo"
   *     categoriaId ("ci_..." | null)
   *   }
   * -------------------------------------------------------------------- */
  function normalizarIngreso(i) {
    if (!i || typeof i !== "object") return null;

    var descripcion = typeof i.descripcion === "string" ? i.descripcion.trim() : "";
    if (descripcion === "") return null;

    var monto = Number(i.monto);
    if (!isFinite(monto) || monto <= 0) return null;

    var tipo = i.tipo === "fijo" ? "fijo" : "unico"; // solo esos dos

    var fecha = typeof i.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.fecha)
      ? i.fecha
      : null;
    if (!fecha) return null;

    var limpio = {
      id: typeof i.id === "string" ? i.id : nuevoId("i"),
      descripcion: descripcion,
      monto: monto,
      moneda: i.moneda === "USD" ? "USD" : "ARS",
      tipo: tipo,
      fecha: fecha,
      categoriaId: typeof i.categoriaId === "string" ? i.categoriaId : null,
    };

    if (tipo === "fijo") {
      limpio.hasta = (typeof i.hasta === "string" && /^\d{4}-\d{2}$/.test(i.hasta))
        ? i.hasta
        : null;
    }

    return limpio;
  }

  /* ----------------------------------------------------------------------
   * cargar()
   * Lee el estado del localStorage. Si no hay nada, o está roto, devuelve el
   * estado inicial (y no rompe la app).
   * -------------------------------------------------------------------- */
  function cargar() {
    try {
      var texto = window.localStorage.getItem(CLAVE);
      if (!texto) return estadoInicial();
      return normalizar(JSON.parse(texto));
    } catch (error) {
      // JSON roto, localStorage deshabilitado, etc. Avisamos por consola para
      // poder depurar, pero seguimos con datos vacíos.
      console.warn("No se pudo cargar el estado guardado:", error);
      return estadoInicial();
    }
  }

  /* ----------------------------------------------------------------------
   * guardar(estado)
   * Escribe el estado en el localStorage. Devuelve true si salió bien.
   * -------------------------------------------------------------------- */
  function guardar(estado) {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(estado));
      return true;
    } catch (error) {
      // Suele pasar si el disco/cuota está lleno o si el navegador bloquea el
      // almacenamiento (modo incógnito muy restrictivo).
      console.error("No se pudo guardar:", error);
      return false;
    }
  }

  /* ----------------------------------------------------------------------
   * exportar(estado)
   * Arma un archivo .json con todos los datos y dispara la descarga.
   * El nombre incluye la fecha local: "gastos-2026-08-31.json".
   * -------------------------------------------------------------------- */
  function exportar(estado) {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var nombre = "gastos-" + d.getFullYear() + "-" + mm + "-" + dd + ".json";

    var contenido = JSON.stringify(estado, null, 2); // "null, 2" = indentado y legible
    var blob = new Blob([contenido], { type: "application/json" });
    var url = URL.createObjectURL(blob);

    var enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    // Liberamos la URL temporal después de un ratito.
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ----------------------------------------------------------------------
   * importar(archivo)
   * Recibe un File (el que elige la persona en el input de tipo "file") y
   * devuelve una Promesa que se resuelve con el estado ya normalizado.
   * Si el archivo no es un JSON válido, la promesa se rechaza.
   * -------------------------------------------------------------------- */
  function importar(archivo) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onload = function () {
        try {
          var datos = JSON.parse(lector.result);
          resolver(normalizar(datos));
        } catch (error) {
          rechazar(new Error("El archivo no es un JSON válido."));
        }
      };
      lector.onerror = function () {
        rechazar(new Error("No se pudo leer el archivo."));
      };
      lector.readAsText(archivo);
    });
  }

  /* ==========================================================================
   * EXPORTACIÓN del módulo.
   * ========================================================================*/
  window.Gastos.Almacenamiento = {
    CLAVE: CLAVE,
    VERSION: VERSION,
    estadoInicial: estadoInicial,
    nuevoId: nuevoId,
    normalizar: normalizar,
    normalizarGasto: normalizarGasto,
    normalizarIngreso: normalizarIngreso,
    cargar: cargar,
    guardar: guardar,
    exportar: exportar,
    importar: importar,
  };
})();
