/* ============================================================================
 * nucleo.js
 * ----------------------------------------------------------------------------
 * El "cerebro" de la app: todos los cálculos sobre los gastos.
 *
 * Reglas de este archivo:
 *   - NO toca el DOM (nada de document.*).
 *   - NO toca el localStorage.
 *   - Solo recibe datos y devuelve datos.
 *
 * Gracias a eso, el día que llevemos la app al celular, este archivo se puede
 * reutilizar tal cual.
 *
 * ----------------------------------------------------------------------------
 * MODELO DE UN GASTO (así se guarda cada uno):
 *
 *   {
 *     id:          "g_abc123",       // identificador único
 *     descripcion: "Zapatillas",
 *     monto:       45000,            // valor de UNA ocurrencia (ver abajo)
 *     moneda:      "ARS",            // "ARS" o "USD"
 *     tipo:        "cuotas",         // "unico" | "cuotas" | "fijo"
 *     fecha:       "2026-08-15",     // fecha de compra / primer mes que impacta
 *     cuotas:      12,               // solo si tipo === "cuotas"
 *     hasta:       "2027-06",        // solo si tipo === "fijo" (opcional, YYYY-MM)
 *     medioId:     "m_visa" | null,  // tarjeta / medio de pago (opcional)
 *     categoriaId: "c_calzado" | null
 *   }
 *
 * Qué significa "monto" según el tipo:
 *   - "unico":  se paga una sola vez, ese monto, en el mes de `fecha`.
 *   - "cuotas": se paga ESE monto cada mes, durante `cuotas` meses, arrancando en
 *               el mes de `fecha`. (Es "12 cuotas de $45.000", no el total.)
 *   - "fijo":   se paga ESE monto todos los meses, desde el mes de `fecha`, hasta
 *               `hasta` inclusive. Si no hay `hasta`, es indefinido.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};

  // Tope de seguridad: por más raros que sean los datos, la proyección nunca
  // mostrará más de estos meses hacia adelante (10 años).
  var MAX_MESES_PROYECCION = 120;

  /* ==========================================================================
   * 1. HERRAMIENTAS DE MESES
   * Trabajamos con meses como texto "YYYY-MM" (ej. "2026-08") porque es fácil de
   * leer y de ordenar. Para hacer cuentas (sumar meses, restar) lo pasamos a un
   * número entero absoluto con indiceMes().
   * ========================================================================*/

  // "2026-08-15" o "2026-08" -> "2026-08"
  function mesDe(fechaOMes) {
    return String(fechaOMes || "").slice(0, 7);
  }

  // "2026-08" -> 24316  (año * 12 + mes-0). Sirve para comparar y sumar meses.
  function indiceMes(mes) {
    var a = parseInt(String(mes).slice(0, 4), 10);
    var m = parseInt(String(mes).slice(5, 7), 10);
    if (!a || !m) return NaN;
    return a * 12 + (m - 1);
  }

  // 24316 -> "2026-08"  (la operación inversa de indiceMes)
  function mesDesdeIndice(indice) {
    var a = Math.floor(indice / 12);
    var m = (indice % 12) + 1;
    return a + "-" + (m < 10 ? "0" + m : String(m));
  }

  // El mes en el que estamos hoy, según la hora LOCAL de la compu (no UTC).
  function mesActual() {
    var d = new Date();
    var m = d.getMonth() + 1;
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : String(m));
  }

  /* ==========================================================================
   * 2. IMPACTO DE UN GASTO EN UN MES
   * ========================================================================*/

  /**
   * impactoEnMes(gasto, mes)
   * ¿Cuánta plata representa este gasto en ese mes puntual?
   * Devuelve un número (0 si ese mes el gasto no impacta).
   */
  function impactoEnMes(gasto, mes) {
    if (!gasto) return 0;

    var iMes = indiceMes(mes);
    var iInicio = indiceMes(mesDe(gasto.fecha));
    if (isNaN(iMes) || isNaN(iInicio)) return 0;

    // Antes de la compra nunca hay impacto.
    if (iMes < iInicio) return 0;

    var monto = Number(gasto.monto) || 0;

    if (gasto.tipo === "unico") {
      // Solo el mes exacto de la compra.
      return iMes === iInicio ? monto : 0;
    }

    if (gasto.tipo === "cuotas") {
      // Número de cuota que cae en este mes: 1 en el mes de compra, 2 al
      // siguiente, etc. Impacta mientras no pasemos la última.
      var totalCuotas = parseInt(gasto.cuotas, 10) || 1;
      var numeroCuota = iMes - iInicio + 1;
      return numeroCuota <= totalCuotas ? monto : 0;
    }

    if (gasto.tipo === "fijo") {
      // Todos los meses desde la fecha. Si hay "hasta", cortamos después.
      if (gasto.hasta) {
        var iHasta = indiceMes(gasto.hasta);
        if (!isNaN(iHasta) && iMes > iHasta) return 0;
      }
      return monto;
    }

    return 0;
  }

  /**
   * etiquetaCuota(gasto, mes)
   * Texto tipo "3/12" para mostrar en qué cuota va ese mes. Devuelve "" si el
   * gasto no es en cuotas o no impacta ese mes.
   */
  function etiquetaCuota(gasto, mes) {
    if (!gasto || gasto.tipo !== "cuotas") return "";
    var iMes = indiceMes(mes);
    var iInicio = indiceMes(mesDe(gasto.fecha));
    if (isNaN(iMes) || isNaN(iInicio)) return "";
    var numeroCuota = iMes - iInicio + 1;
    var total = parseInt(gasto.cuotas, 10) || 1;
    if (numeroCuota < 1 || numeroCuota > total) return "";
    return numeroCuota + "/" + total;
  }

  /**
   * ultimoMesDe(gasto)
   * El último mes "YYYY-MM" en que este gasto impacta. Para los fijos SIN fecha
   * de fin devuelve null (son indefinidos).
   */
  function ultimoMesDe(gasto) {
    var iInicio = indiceMes(mesDe(gasto.fecha));
    if (isNaN(iInicio)) return null;

    if (gasto.tipo === "unico") return mesDesdeIndice(iInicio);
    if (gasto.tipo === "cuotas") {
      var total = parseInt(gasto.cuotas, 10) || 1;
      return mesDesdeIndice(iInicio + total - 1);
    }
    if (gasto.tipo === "fijo") {
      if (gasto.hasta && !isNaN(indiceMes(gasto.hasta))) return mesDe(gasto.hasta);
      return null; // indefinido
    }
    return null;
  }

  /* ==========================================================================
   * 3. AGRUPAR Y SUMAR
   * ========================================================================*/

  /**
   * detalleDeMes(estado, mes)
   * Lista de todo lo que se paga en ese mes, ya "resuelto" (con el objeto del
   * medio y de la categoría enganchados para poder mostrar sus nombres).
   *
   * Devuelve un array de:
   *   { gasto, monto, moneda, cuota, medio, categoria }
   */
  function detalleDeMes(estado, mes) {
    var salida = [];
    var gastos = (estado && estado.gastos) || [];

    for (var i = 0; i < gastos.length; i++) {
      var g = gastos[i];
      var monto = impactoEnMes(g, mes);
      if (monto === 0) continue; // este mes no cuenta

      salida.push({
        gasto: g,
        monto: monto,
        moneda: g.moneda === "USD" ? "USD" : "ARS",
        cuota: etiquetaCuota(g, mes),
        medio: buscarPorId((estado && estado.medios) || [], g.medioId),
        categoria: buscarPorId((estado && estado.categorias) || [], g.categoriaId),
      });
    }

    // Ordenamos de mayor a menor monto: lo más pesado del mes primero.
    salida.sort(function (a, b) { return b.monto - a.monto; });
    return salida;
  }

  /**
   * totalesDeMes(estado, mes)
   * Cuánto se paga ese mes, separado por moneda (nunca convertimos USD a ARS).
   * Devuelve { ARS: number, USD: number }.
   */
  function totalesDeMes(estado, mes) {
    var total = { ARS: 0, USD: 0 };
    var detalle = detalleDeMes(estado, mes);
    for (var i = 0; i < detalle.length; i++) {
      total[detalle[i].moneda] += detalle[i].monto;
    }
    return total;
  }

  /* ==========================================================================
   * 3b. INGRESOS
   * Un ingreso solo puede ser "unico" o "fijo", así que impactoEnMes() (que ya
   * sabe manejar esos dos tipos) sirve tal cual para calcular su impacto mensual.
   * ========================================================================*/

  /**
   * detalleIngresosDeMes(estado, mes)
   * Lista de las entradas de plata de ese mes, con la categoría enganchada.
   * Devuelve un array de: { ingreso, monto, moneda, categoria }
   */
  function detalleIngresosDeMes(estado, mes) {
    var salida = [];
    var ingresos = (estado && estado.ingresos) || [];

    for (var i = 0; i < ingresos.length; i++) {
      var ing = ingresos[i];
      var monto = impactoEnMes(ing, mes);
      if (monto === 0) continue;

      salida.push({
        ingreso: ing,
        monto: monto,
        moneda: ing.moneda === "USD" ? "USD" : "ARS",
        categoria: buscarPorId((estado && estado.categoriasIngreso) || [], ing.categoriaId),
      });
    }

    salida.sort(function (a, b) { return b.monto - a.monto; });
    return salida;
  }

  /**
   * totalesIngresosDeMes(estado, mes) -> { ARS, USD }
   */
  function totalesIngresosDeMes(estado, mes) {
    var total = { ARS: 0, USD: 0 };
    var detalle = detalleIngresosDeMes(estado, mes);
    for (var i = 0; i < detalle.length; i++) {
      total[detalle[i].moneda] += detalle[i].monto;
    }
    return total;
  }

  /**
   * balanceDeMes(estado, mes)
   * El "¿me alcanza?" de un mes puntual: lo que entra menos lo que se paga ESE
   * mes (sin arrastrar saldos ni restar cuotas de meses futuros).
   * Devuelve:
   *   {
   *     ARS: { ingresos, gastos, neto },
   *     USD: { ingresos, gastos, neto }
   *   }
   */
  function balanceDeMes(estado, mes) {
    var ing = totalesIngresosDeMes(estado, mes);
    var gas = totalesDeMes(estado, mes);
    return {
      ARS: { ingresos: ing.ARS, gastos: gas.ARS, neto: ing.ARS - gas.ARS },
      USD: { ingresos: ing.USD, gastos: gas.USD, neto: ing.USD - gas.USD },
    };
  }

  /**
   * ingresosOrdenados(estado)
   * Todos los ingresos, del más nuevo al más viejo.
   */
  function ingresosOrdenados(estado) {
    var copia = ((estado && estado.ingresos) || []).slice();
    copia.sort(function (a, b) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
    return copia;
  }

  /**
   * resumenDeIngreso(ingreso) -> texto para la lista.
   */
  function resumenDeIngreso(ingreso) {
    var F = window.Gastos.Formato;
    if (ingreso.tipo === "fijo") {
      return ingreso.hasta ? "Fijo hasta " + F.mesCorto(ingreso.hasta) : "Fijo mensual";
    }
    return "Único";
  }

  /* ==========================================================================
   * 3c. CUOTAS: progreso y deuda
   * ========================================================================*/

  /**
   * progresoCuotas(gasto, mesRef)
   * Para un gasto en cuotas: cuántas van pagadas, cuántas faltan y la plata.
   * "Pagadas" = las cuotas cuyo mes ya pasó (antes del mes de referencia). La
   * cuota del mes en curso todavía cuenta como "por pagar".
   * Devuelve null si el gasto no es en cuotas.
   */
  function progresoCuotas(gasto, mesRef) {
    if (!gasto || gasto.tipo !== "cuotas") return null;

    var iRef = indiceMes(mesRef || mesActual());
    var iInicio = indiceMes(mesDe(gasto.fecha));
    var total = parseInt(gasto.cuotas, 10) || 1;
    var monto = Number(gasto.monto) || 0;

    var pagadas = Math.max(0, Math.min(total, iRef - iInicio));
    var restantes = total - pagadas;

    return {
      total: total,
      pagadas: pagadas,
      restantes: restantes,
      montoCuota: monto,
      montoPagado: monto * pagadas,
      montoRestante: monto * restantes,
      proxima: Math.min(total, pagadas + 1),
      moneda: gasto.moneda === "USD" ? "USD" : "ARS",
    };
  }

  /**
   * deudaEnCuotas(estado, mesRef) -> { ARS, USD }
   * Cuánta plata te falta pagar sumando TODAS las cuotas pendientes (no incluye
   * gastos fijos: esos los podés cancelar, no son una deuda).
   */
  function deudaEnCuotas(estado, mesRef) {
    var total = { ARS: 0, USD: 0 };
    var gastos = (estado && estado.gastos) || [];
    for (var i = 0; i < gastos.length; i++) {
      var p = progresoCuotas(gastos[i], mesRef);
      if (p) total[p.moneda] += p.montoRestante;
    }
    return total;
  }

  /**
   * proyeccion(estado)
   * El corazón de la pantalla "Proyección". Devuelve un renglón por mes, desde el
   * mes actual hasta el último mes en que quede algo por pagar.
   *
   * Devuelve un array de:
   *   {
   *     mes:      "2026-09",
   *     esActual: true/false,
   *     totales:  { ARS, USD },
   *     items:    número de gastos que caen ese mes,
   *     terminan: número de cuotas/fijos que se pagan por ÚLTIMA vez ese mes
   *   }
   */
  function proyeccion(estado) {
    var gastos = (estado && estado.gastos) || [];
    var desde = indiceMes(mesActual());

    // Buscamos hasta dónde llegar: el último mes de fin entre todos los gastos.
    // Los fijos indefinidos no estiran el horizonte (si no, sería infinito).
    var hasta = desde;
    for (var i = 0; i < gastos.length; i++) {
      var fin = ultimoMesDe(gastos[i]);
      if (fin) {
        var iFin = indiceMes(fin);
        if (!isNaN(iFin) && iFin > hasta) hasta = iFin;
      }
    }

    // Piso: si hay algún gasto recurrente (cuotas o fijo) mostramos al menos
    // 6 meses, aunque no haya ninguna fecha de fin (si no, los fijos
    // indefinidos se verían en un solo mes y la pantalla parecería vacía).
    var hayRecurrente = gastos.some(function (g) {
      return g.tipo === "cuotas" || g.tipo === "fijo";
    });
    if (hayRecurrente && hasta - desde < 5) hasta = desde + 5;

    // Techo de seguridad.
    if (hasta - desde > MAX_MESES_PROYECCION) hasta = desde + MAX_MESES_PROYECCION;

    var filas = [];
    for (var idx = desde; idx <= hasta; idx++) {
      var mes = mesDesdeIndice(idx);
      var detalle = detalleDeMes(estado, mes);

      var totales = { ARS: 0, USD: 0 };
      var terminan = 0;
      for (var j = 0; j < detalle.length; j++) {
        totales[detalle[j].moneda] += detalle[j].monto;
        var ultimo = ultimoMesDe(detalle[j].gasto);
        if (ultimo === mes) terminan++;
      }

      filas.push({
        mes: mes,
        esActual: idx === desde,
        totales: totales,
        items: detalle.length,
        terminan: terminan,
      });
    }
    return filas;
  }

  /* ==========================================================================
   * 4. VISTA "GASTOS" (la lista de lo que cargaste)
   * ========================================================================*/

  /**
   * gastosOrdenados(estado)
   * Todos los gastos, del más nuevo al más viejo (por fecha de compra, y como
   * desempate por el id que incluye la hora de creación).
   */
  function gastosOrdenados(estado) {
    var copia = ((estado && estado.gastos) || []).slice();
    copia.sort(function (a, b) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
    return copia;
  }

  /**
   * resumenDeGasto(gasto)
   * Una línea de texto que describe el gasto para la lista:
   *   - único:  "Pago único"
   *   - cuotas: "12 cuotas de $45.000  ·  total $540.000"
   *   - fijo:   "Fijo mensual" (o "Fijo hasta jun 2027")
   */
  function resumenDeGasto(gasto) {
    var F = window.Gastos.Formato;
    if (gasto.tipo === "unico") {
      return "Pago único";
    }
    if (gasto.tipo === "cuotas") {
      var total = (Number(gasto.monto) || 0) * (parseInt(gasto.cuotas, 10) || 1);
      return gasto.cuotas + " cuotas de " + F.moneda(gasto.monto, gasto.moneda) +
        "  ·  total " + F.moneda(total, gasto.moneda);
    }
    if (gasto.tipo === "fijo") {
      return gasto.hasta
        ? "Fijo hasta " + F.mesCorto(gasto.hasta)
        : "Fijo mensual";
    }
    return "";
  }

  /* ==========================================================================
   * 5. AUXILIARES
   * ========================================================================*/

  // Busca un elemento por su id dentro de una lista. Devuelve el objeto o null.
  function buscarPorId(lista, id) {
    if (!id) return null;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  // ¿Qué monedas hay realmente en uso? Siempre incluimos "ARS". Sirve para
  // mostrar u ocultar los totales en dólares.
  function monedasEnUso(estado) {
    var set = { ARS: true };
    var gastos = (estado && estado.gastos) || [];
    var ingresos = (estado && estado.ingresos) || [];
    for (var i = 0; i < gastos.length; i++) {
      if (gastos[i].moneda === "USD") set.USD = true;
    }
    for (var j = 0; j < ingresos.length; j++) {
      if (ingresos[j].moneda === "USD") set.USD = true;
    }
    return Object.keys(set);
  }

  // ¿Hay al menos un ingreso cargado? Sirve para mostrar/ocultar el bloque
  // "Te queda" en la tarjeta de la Proyección.
  function hayIngresos(estado) {
    return !!(estado && estado.ingresos && estado.ingresos.length > 0);
  }

  /* ==========================================================================
   * EXPORTACIÓN: lo que el resto de la app puede usar.
   * ========================================================================*/
  window.Gastos.Nucleo = {
    // meses
    mesDe: mesDe,
    indiceMes: indiceMes,
    mesDesdeIndice: mesDesdeIndice,
    mesActual: mesActual,
    // impacto
    impactoEnMes: impactoEnMes,
    etiquetaCuota: etiquetaCuota,
    ultimoMesDe: ultimoMesDe,
    // agregados
    detalleDeMes: detalleDeMes,
    totalesDeMes: totalesDeMes,
    proyeccion: proyeccion,
    // ingresos
    detalleIngresosDeMes: detalleIngresosDeMes,
    totalesIngresosDeMes: totalesIngresosDeMes,
    balanceDeMes: balanceDeMes,
    ingresosOrdenados: ingresosOrdenados,
    resumenDeIngreso: resumenDeIngreso,
    hayIngresos: hayIngresos,
    // cuotas
    progresoCuotas: progresoCuotas,
    deudaEnCuotas: deudaEnCuotas,
    // lista de gastos
    gastosOrdenados: gastosOrdenados,
    resumenDeGasto: resumenDeGasto,
    // auxiliares
    buscarPorId: buscarPorId,
    monedasEnUso: monedasEnUso,
  };
})();
