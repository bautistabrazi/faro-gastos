/* ============================================================================
 * nube.js
 * ----------------------------------------------------------------------------
 * Sincronización opcional con Supabase.
 *
 * Cómo funciona, en criollo:
 *   - Si NO hay configuración (js/config.js vacío) o la página se abrió como
 *     archivo local (file://), este módulo se "apaga": disponible() devuelve
 *     false y la app corre 100% local.
 *   - Si SÍ hay configuración, la app pide iniciar sesión con email + contraseña
 *     (o crear una cuenta si todavía no existe).
 *   - Los datos se guardan como UN solo JSON por usuario en la tabla `estados`
 *     (ver supabase/schema.sql). Es simple a propósito: no hay tablas separadas.
 *
 * Este archivo NO toca el DOM. Solo habla con Supabase y con localStorage
 * (a través de Almacenamiento). La orquestación (mostrar el login, etc.) la
 * hace app.js.
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};

  var cliente = null;      // el cliente de Supabase, una vez creado
  var listo = false;       // ¿ya se llamó a iniciar()?

  /* ------------------------------------------------------------------
   * disponible()
   * ¿Se puede usar la nube? Solo si:
   *   - hay url + anonKey en config.js
   *   - existe la librería de Supabase (se carga por CDN en index.html)
   *   - la página NO se abrió como archivo local (file://)
   * ---------------------------------------------------------------- */
  function disponible() {
    var cfg = window.GASTOS_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return false;
    if (typeof window.supabase === "undefined" || !window.supabase.createClient) return false;
    if (window.location.protocol === "file:") return false;
    return true;
  }

  /* ------------------------------------------------------------------
   * iniciar()
   * Crea el cliente de Supabase. Hay que llamarlo una vez, al arranque,
   * y solo si disponible() dio true.
   * ---------------------------------------------------------------- */
  function iniciar() {
    if (listo) return;
    var cfg = window.GASTOS_CONFIG;
    cliente = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    listo = true;
  }

  /* ------------------------------------------------------------------
   * sesion()
   * Devuelve una promesa con la sesión actual (o null si no hay).
   * ---------------------------------------------------------------- */
  function sesion() {
    if (!cliente) return Promise.resolve(null);
    return cliente.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session) || null;
    });
  }

  /* ------------------------------------------------------------------
   * emailActual()
   * El email del usuario logueado, o "" si no hay sesión.
   * ---------------------------------------------------------------- */
  function emailActual() {
    return sesion().then(function (s) {
      return (s && s.user && s.user.email) || "";
    });
  }

  /* ------------------------------------------------------------------
   * registrarse(email, password)
   * Crea una cuenta nueva. Si el proyecto de Supabase tiene "Confirm email"
   * activado, la cuenta queda creada pero SIN sesión hasta que se confirme
   * por mail (usar sesion() para saber si ya quedó logueado). Se rechaza
   * con un Error legible si el email ya existe o la contraseña es débil.
   * ---------------------------------------------------------------- */
  function registrarse(email, password) {
    if (!cliente) return Promise.reject(new Error("La nube no está configurada."));
    return cliente.auth.signUp({ email: email, password: password }).then(function (r) {
      if (r.error) throw new Error(traducirError(r.error.message));
      return true;
    });
  }

  /* ------------------------------------------------------------------
   * iniciarSesion(email, password)
   * Inicia sesión con email + contraseña. Se rechaza con un Error legible
   * si las credenciales no son válidas.
   * ---------------------------------------------------------------- */
  function iniciarSesion(email, password) {
    if (!cliente) return Promise.reject(new Error("La nube no está configurada."));
    return cliente.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
      if (r.error) throw new Error(traducirError(r.error.message));
      return true;
    });
  }

  /* ------------------------------------------------------------------
   * salir()
   * Cierra la sesión.
   * ---------------------------------------------------------------- */
  function salir() {
    if (!cliente) return Promise.resolve();
    return cliente.auth.signOut();
  }

  /* ------------------------------------------------------------------
   * alCambiarSesion(callback)
   * Llama a callback(evento, sesion) cuando el usuario entra o sale
   * (por ejemplo justo después de iniciarSesion()).
   * ---------------------------------------------------------------- */
  function alCambiarSesion(callback) {
    if (!cliente) return;
    cliente.auth.onAuthStateChange(function (evento, sesion) {
      callback(evento, sesion);
    });
  }

  /* ------------------------------------------------------------------
   * cargar()
   * Trae el JSON de datos del usuario desde la tabla `estados`.
   * Devuelve una promesa con:
   *   { datos: <objeto o null>, actualizado: <ISO o null> }
   * ---------------------------------------------------------------- */
  function cargar() {
    if (!cliente) return Promise.resolve({ datos: null, actualizado: null });
    return sesion().then(function (s) {
      if (!s) return { datos: null, actualizado: null };
      return cliente
        .from("estados")
        .select("datos, actualizado")
        .eq("user_id", s.user.id)
        .maybeSingle()
        .then(function (r) {
          if (r.error) throw new Error(r.error.message);
          if (!r.data) return { datos: null, actualizado: null };
          return { datos: r.data.datos, actualizado: r.data.actualizado };
        });
    });
  }

  /* ------------------------------------------------------------------
   * guardar(estado)
   * Sube el JSON completo del estado (upsert: crea o pisa la fila del
   * usuario). Devuelve una promesa; si falla, se rechaza (pero el dato
   * local ya está a salvo, así que no es grave).
   * ---------------------------------------------------------------- */
  function guardar(estado) {
    if (!cliente) return Promise.reject(new Error("Sin cliente"));
    return sesion().then(function (s) {
      if (!s) throw new Error("Sin sesión");
      return cliente.from("estados").upsert({
        user_id: s.user.id,
        datos: estado,
        actualizado: new Date().toISOString(),
      }).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        return true;
      });
    });
  }

  // --- guardar con "debounce": junta varios guardados seguidos en uno solo,
  //     para no pegarle a Supabase en cada tecla ---
  var timerGuardado = null;
  function guardarPronto(estado, alTerminar) {
    clearTimeout(timerGuardado);
    timerGuardado = setTimeout(function () {
      guardar(estado)
        .then(function () { if (alTerminar) alTerminar(null); })
        .catch(function (err) { if (alTerminar) alTerminar(err); });
    }, 1200);
  }

  /* ------------------------------------------------------------------
   * Auxiliar: mensajes de error más entendibles.
   * ---------------------------------------------------------------- */
  function traducirError(msg) {
    msg = String(msg || "");
    if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Esperá unos minutos.";
    if (/invalid email/i.test(msg)) return "Ese email no parece válido.";
    if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
    if (/already registered|already.*exists/i.test(msg)) return "Ya existe una cuenta con ese email. Iniciá sesión.";
    if (/password.*(at least|should be|weak)/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/email not confirmed/i.test(msg)) return "Confirmá tu email (te mandamos un enlace) antes de entrar.";
    return "Algo falló. " + msg;
  }

  /* ================================================================*/
  window.Gastos.Nube = {
    disponible: disponible,
    iniciar: iniciar,
    sesion: sesion,
    emailActual: emailActual,
    registrarse: registrarse,
    iniciarSesion: iniciarSesion,
    salir: salir,
    alCambiarSesion: alCambiarSesion,
    cargar: cargar,
    guardar: guardar,
    guardarPronto: guardarPronto,
  };
})();
