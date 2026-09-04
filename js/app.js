/* ============================================================================
 * app.js
 * ----------------------------------------------------------------------------
 * El COORDINADOR. Es el último script que se carga y el que "enciende" la app.
 *
 * Qué hace:
 *   - Guarda en memoria el estado (todos los datos) mientras la app está abierta.
 *   - Sabe qué pantalla está activa y la dibuja (delegando en los vista-*.js).
 *   - Ofrece a las pantallas un puñado de herramientas comunes:
 *       App.estado        -> los datos actuales
 *       App.guardar()     -> persiste en disco y vuelve a dibujar
 *       App.irA(nombre)   -> cambia de pantalla
 *       App.render()      -> redibuja la pantalla activa
 *       App.aviso(txt)    -> muestra el mensajito flotante
 *
 * Cada archivo vista-*.js se "anota" en Gastos.Vistas con un método montar().
 * ==========================================================================*/

(function () {
  "use strict";

  window.Gastos = window.Gastos || {};
  window.Gastos.Vistas = window.Gastos.Vistas || {};

  var Almacenamiento = window.Gastos.Almacenamiento;

  // Pantallas válidas y su orden. El nombre coincide con data-pantalla en el
  // HTML y con la clave dentro de Gastos.Vistas.
  var PANTALLAS = ["gastos", "ingresos", "proyeccion", "ajustes"];

  // ¿Este estado tiene algo cargado? (para no pisar datos de la nube con un
  // estado local recién inicializado, ni al revés).
  function tieneContenido(datos) {
    if (!datos || typeof datos !== "object") return false;
    return (Array.isArray(datos.gastos) && datos.gastos.length > 0) ||
      (Array.isArray(datos.ingresos) && datos.ingresos.length > 0) ||
      (Array.isArray(datos.medios) && datos.medios.length > 0);
  }

  var App = {
    estado: null,            // se llena en iniciar()
    pantalla: "proyeccion",  // pantalla activa (la app abre en Proyección)

    // referencias al DOM que usamos seguido (se llenan en iniciar())
    _contenedor: null,
    _nav: null,
    _aviso: null,
    _avisoTimeoutId: null,

    // ¿estamos usando la nube (Supabase)? y ¿hay sesión iniciada?
    _modoNube: false,
    _sesionActiva: false,

    /* ------------------------------------------------------------------
     * iniciar()
     * Punto de entrada. Lo llama el listener de DOMContentLoaded (abajo).
     * ---------------------------------------------------------------- */
    iniciar: function () {
      this._contenedor = document.getElementById("contenido");
      this._nav = document.getElementById("nav");
      this._aviso = document.getElementById("aviso");

      // 1. Cargamos los datos locales (cache instantánea; si hay nube, después
      //    se reemplazan por los de la nube).
      this.estado = Almacenamiento.cargar();

      // 2. Nav + botón de tema (siempre).
      var self = this;
      this._nav.addEventListener("click", function (evento) {
        var boton = evento.target.closest("[data-pantalla]");
        if (boton) self.irA(boton.getAttribute("data-pantalla"));
      });
      this._temaToggle = document.getElementById("tema-toggle");
      if (this._temaToggle) {
        this._temaToggle.addEventListener("click", function () {
          window.Gastos.Tema.alternar();
          self._pintarTemaToggle();
          self.render();
        });
        this._pintarTemaToggle();
      }

      // 3. ¿Nube o modo local?
      var Nube = window.Gastos.Nube;
      var pidioLocal = false;
      try { pidioLocal = window.localStorage.getItem("gastos-sin-nube") === "1"; } catch (e) {}

      if (!Nube || !Nube.disponible() || pidioLocal) {
        // Modo local: arranca directo, como toda la vida.
        this._modoNube = false;
        this._arrancarApp();
        return;
      }

      // Modo nube: pedimos login antes de mostrar la app.
      this._modoNube = true;
      Nube.iniciar();
      Nube.alCambiarSesion(function (evento) {
        if (evento === "SIGNED_IN") self._trasLogin();
        if (evento === "SIGNED_OUT") { self._sesionActiva = false; self._mostrarLogin(); }
      });
      Nube.sesion().then(function (s) {
        if (s) self._trasLogin();
        else self._mostrarLogin();
      });
    },

    // Pone en el botón de tema el ícono del modo que se está viendo ahora.
    _pintarTemaToggle: function () {
      if (!this._temaToggle) return;
      this._temaToggle.textContent = window.Gastos.Tema.esOscuroAhora() ? "☾" : "☀";
    },

    /* ------------------------------------------------------------------
     * _arrancarApp()
     * Muestra la interfaz normal (nav + pantalla). Se llama en modo local
     * directo, y en modo nube después de sincronizar.
     * ---------------------------------------------------------------- */
    _arrancarApp: function () {
      document.body.classList.remove("sin-sesion");
      this.irA("proyeccion");
    },

    /* ------------------------------------------------------------------
     * _trasLogin()
     * Hay sesión. Traemos los datos de la nube, los combinamos con lo local
     * y arrancamos la app.
     * ---------------------------------------------------------------- */
    _trasLogin: function () {
      var self = this;
      if (self._sesionActiva) return; // evitar hacerlo dos veces
      self._sesionActiva = true;

      self._contenedor.innerHTML = '<p class="cargando">Sincronizando tus datos…</p>';

      window.Gastos.Nube.cargar().then(function (r) {
        if (r.datos && tieneContenido(r.datos)) {
          // La nube manda: usamos sus datos.
          self.estado = Almacenamiento.normalizar(r.datos);
          Almacenamiento.guardar(self.estado);
        } else {
          // La nube está vacía: subimos lo que haya en este dispositivo.
          window.Gastos.Nube.guardar(self.estado).catch(function () {});
        }
        self._arrancarApp();
      }).catch(function (err) {
        console.warn("No se pudo sincronizar; sigo con los datos locales:", err);
        self.aviso("No se pudo sincronizar. Sigo con los datos de este dispositivo.", "peligro");
        self._arrancarApp();
      });
    },

    /* ------------------------------------------------------------------
     * _mostrarLogin(modo)
     * Pantalla de inicio de sesión (email + contraseña). Ocupa toda la
     * pantalla y oculta la navegación.
     *   modo: "entrar" (default) o "crear" (formulario de cuenta nueva).
     * ---------------------------------------------------------------- */
    _mostrarLogin: function (modo) {
      modo = modo === "crear" ? "crear" : "entrar";
      var self = this;
      document.body.classList.add("sin-sesion");
      this.cerrarModal();

      this._contenedor.innerHTML =
        '<div class="login surge">' +
          '<div class="login__marca">Faro</div>' +
          '<p class="login__bajada">' + (modo === "crear"
            ? "Creá una cuenta para sincronizar tus gastos entre el celular y la compu."
            : "Iniciá sesión para sincronizar tus gastos entre el celular y la compu.") +
          '</p>' +
          '<form id="login-form" autocomplete="on">' +
            '<input type="email" id="login-email" required placeholder="tu@email.com" ' +
              'autocomplete="email" class="login__input" />' +
            '<input type="password" id="login-password" required minlength="6" placeholder="Contraseña" ' +
              'autocomplete="' + (modo === "crear" ? "new-password" : "current-password") + '" ' +
              'class="login__input" />' +
            '<button type="submit" class="boton boton--primario login__boton" id="login-enviar">' +
              (modo === "crear" ? "Crear cuenta" : "Iniciar sesión") + '</button>' +
          '</form>' +
          '<p class="login__estado" id="login-estado" hidden></p>' +
          '<button type="button" class="boton boton--fantasma login__cambiar" id="login-cambiar-modo">' +
            (modo === "crear" ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Creá una") +
          '</button>' +
          '<button type="button" class="boton boton--fantasma login__local" id="login-sin-cuenta">' +
            'Seguir sin cuenta (solo en este dispositivo)</button>' +
        '</div>';

      var form = this._contenedor.querySelector("#login-form");
      var estado = this._contenedor.querySelector("#login-estado");
      var boton = this._contenedor.querySelector("#login-enviar");
      var textoBoton = modo === "crear" ? "Crear cuenta" : "Iniciar sesión";

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = self._contenedor.querySelector("#login-email").value.trim();
        var password = self._contenedor.querySelector("#login-password").value;
        if (!email || !password) return;

        estado.hidden = true;
        boton.disabled = true;
        boton.textContent = modo === "crear" ? "Creando…" : "Entrando…";

        var Nube = window.Gastos.Nube;
        var accion = modo === "crear" ? Nube.registrarse(email, password) : Nube.iniciarSesion(email, password);

        accion.then(function () {
          return Nube.sesion();
        }).then(function (s) {
          if (s) return; // hay sesión: alCambiarSesion ya disparó _trasLogin()
          // (solo pasa al crear cuenta con "Confirm email" activado en Supabase)
          estado.textContent = "Cuenta creada. Confirmá tu email (te mandamos un enlace) y después iniciá sesión.";
          estado.className = "login__estado login__estado--ok";
          estado.hidden = false;
          boton.disabled = false;
          boton.textContent = textoBoton;
        }).catch(function (err) {
          estado.textContent = err.message || "Algo falló.";
          estado.className = "login__estado login__estado--error";
          estado.hidden = false;
          boton.disabled = false;
          boton.textContent = textoBoton;
        });
      });

      this._contenedor.querySelector("#login-cambiar-modo").addEventListener("click", function () {
        self._mostrarLogin(modo === "crear" ? "entrar" : "crear");
      });

      this._contenedor.querySelector("#login-sin-cuenta").addEventListener("click", function () {
        try { window.localStorage.setItem("gastos-sin-nube", "1"); } catch (e) {}
        window.location.reload();
      });
    },

    /* ------------------------------------------------------------------
     * cerrarSesion()  -> la usa Ajustes
     * ---------------------------------------------------------------- */
    cerrarSesion: function () {
      var self = this;
      window.Gastos.Nube.salir().then(function () {
        self._sesionActiva = false;
        self._mostrarLogin();
      });
    },

    /* ------------------------------------------------------------------
     * irA(nombre)
     * Cambia la pantalla activa y la dibuja desde cero.
     * ---------------------------------------------------------------- */
    irA: function (nombre) {
      if (PANTALLAS.indexOf(nombre) === -1) nombre = "proyeccion";
      this.pantalla = nombre;

      // marcar el botón activo en la nav
      var botones = this._nav.querySelectorAll(".nav__item");
      for (var i = 0; i < botones.length; i++) {
        var activo = botones[i].getAttribute("data-pantalla") === nombre;
        botones[i].classList.toggle("nav__item--activo", activo);
        if (activo) botones[i].setAttribute("aria-current", "page");
        else botones[i].removeAttribute("aria-current");
      }

      // dibujar (con primeraCarga = true: la pantalla recién se abre)
      this._dibujar(true);
      window.scrollTo(0, 0);
    },

    /* ------------------------------------------------------------------
     * render()
     * Redibuja la pantalla activa SIN cambiar de pantalla. Se usa después
     * de modificar datos para reflejar el cambio.
     * ---------------------------------------------------------------- */
    render: function () {
      this._dibujar(false);
    },

    // función interna compartida por irA() y render()
    _dibujar: function (primeraCarga) {
      if (primeraCarga) this.cerrarModal(); // al cambiar de pantalla, cerrar modal
      var vista = window.Gastos.Vistas[this.pantalla];
      this._contenedor.innerHTML = "";
      if (vista && typeof vista.montar === "function") {
        vista.montar(this._contenedor, { primeraCarga: primeraCarga });
      } else {
        this._contenedor.textContent = "No se encontró la pantalla “" + this.pantalla + "”.";
      }
    },

    /* ------------------------------------------------------------------
     * guardar()
     * Persiste el estado actual en el localStorage y redibuja. Si el
     * guardado falla (disco lleno, almacenamiento bloqueado), avisa.
     * ---------------------------------------------------------------- */
    guardar: function () {
      var ok = Almacenamiento.guardar(this.estado);
      if (!ok) {
        this.aviso("No se pudo guardar en este navegador", "peligro");
      }
      // Si hay sesión en la nube, subimos el cambio (con un pequeño retardo,
      // para juntar varios cambios seguidos en un solo envío).
      if (this._modoNube && this._sesionActiva) {
        var self = this;
        window.Gastos.Nube.guardarPronto(this.estado, function (err) {
          if (err) console.warn("No se pudo subir a la nube (se reintenta al próximo cambio):", err);
        });
      }
      this.render();
    },

    // ¿En qué modo está la sincronización? Lo usa Ajustes para mostrar el estado.
    infoSync: function () {
      if (!this._modoNube) {
        var pidioLocal = false;
        try { pidioLocal = window.localStorage.getItem("gastos-sin-nube") === "1"; } catch (e) {}
        return { modo: pidioLocal ? "local-elegido" : "local" };
      }
      return { modo: this._sesionActiva ? "nube" : "nube-sin-sesion" };
    },

    // Reactivar la sincronización (si antes se eligió "seguir sin cuenta").
    activarSync: function () {
      try { window.localStorage.removeItem("gastos-sin-nube"); } catch (e) {}
      window.location.reload();
    },

    /* ------------------------------------------------------------------
     * aviso(texto, tipo)
     * Muestra el mensajito flotante abajo y lo esconde solo a los 2,5 s.
     *   tipo: undefined (neutro) | "ok" | "peligro"
     * ---------------------------------------------------------------- */
    aviso: function (texto, tipo) {
      var el = this._aviso;
      el.textContent = texto;
      el.className = "aviso" + (tipo ? " aviso--" + tipo : "");
      el.hidden = false;

      // reiniciamos la animación de entrada
      el.style.animation = "none";
      void el.offsetWidth;      // forzar "reflow" para que la animación reinicie
      el.style.animation = "";

      clearTimeout(this._avisoTimeoutId);
      this._avisoTimeoutId = setTimeout(function () { el.hidden = true; }, 2500);
    },

    /* ------------------------------------------------------------------
     * modal(titulo, htmlContenido)
     * Abre una ventana centrada por encima de todo. Se cierra con la X, con
     * un clic en el fondo oscuro o con la tecla Escape.
     *   htmlContenido: string de HTML (¡ya escapado por quien llama!)
     * ---------------------------------------------------------------- */
    modal: function (titulo, htmlContenido) {
      this.cerrarModal(); // por las dudas, cerramos cualquiera anterior

      var self = this;
      var fondo = document.createElement("div");
      fondo.className = "modal";
      fondo.innerHTML =
        '<div class="modal__panel" role="dialog" aria-modal="true" aria-label="' +
          String(titulo).replace(/"/g, "&quot;") + '">' +
          '<div class="modal__cabeza">' +
            '<h2 class="modal__titulo">' + titulo + '</h2>' +
            '<button type="button" class="modal__cerrar" aria-label="Cerrar">✕</button>' +
          '</div>' +
          '<div class="modal__cuerpo">' + htmlContenido + '</div>' +
        '</div>';

      fondo.addEventListener("click", function (e) {
        // clic en el fondo (no en el panel) o en la X => cerrar
        if (e.target === fondo || e.target.closest(".modal__cerrar")) self.cerrarModal();
      });

      this._modal = fondo;
      this._modalEsc = function (e) { if (e.key === "Escape") self.cerrarModal(); };
      document.addEventListener("keydown", this._modalEsc);

      document.body.appendChild(fondo);
      document.body.style.overflow = "hidden"; // que no scrollee el fondo
    },

    cerrarModal: function () {
      if (this._modalEsc) {
        document.removeEventListener("keydown", this._modalEsc);
        this._modalEsc = null;
      }
      if (this._modal && this._modal.parentNode) {
        this._modal.parentNode.removeChild(this._modal);
      }
      this._modal = null;
      document.body.style.overflow = "";
    },

    /* ------------------------------------------------------------------
     * formatearInputMonto(input)
     * Reescribe el valor de un <input type="text"> de monto poniéndole los
     * puntos de miles mientras se tipea, y trata de dejar el cursor donde
     * estaba. Lo usan las pantallas Gastos e Ingresos.
     * ---------------------------------------------------------------- */
    formatearInputMonto: function (input) {
      var F = window.Gastos.Formato;
      var crudo = input.value;
      var caret = input.selectionStart == null ? crudo.length : input.selectionStart;
      var digitosAntes = crudo.slice(0, caret).replace(/\D/g, "").length;

      var fmt = F.miles(crudo);
      if (fmt === crudo) return;
      input.value = fmt;

      var pos = 0, vistos = 0;
      while (pos < fmt.length && vistos < digitosAntes) {
        if (fmt.charAt(pos) >= "0" && fmt.charAt(pos) <= "9") vistos++;
        pos++;
      }
      try { input.setSelectionRange(pos, pos); } catch (e) { /* algunos navegadores */ }
    },
  };

  window.Gastos.App = App;

  // Arrancamos cuando el HTML terminó de parsearse.
  document.addEventListener("DOMContentLoaded", function () {
    App.iniciar();
  });
})();
