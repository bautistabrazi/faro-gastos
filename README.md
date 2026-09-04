# Faro · Control de gastos

Registro personal de gastos. Cargás cada consumo (pago único, en cuotas o gasto
fijo), tu sueldo y demás ingresos, y en la pantalla **Proyección** ves cuánto
tenés que pagar mes a mes y cuánto te queda este mes después de pagar todo.

HTML, CSS y JavaScript puro, sin framework ni paso de compilación. Funciona de
dos maneras:

- **Local (por defecto):** abrís `index.html` y listo. Los datos viven solo en
  ese navegador. No hay servidor ni cuenta.
- **Con sincronización (opcional):** si completás `js/config.js` con un proyecto
  de Supabase, la app pide iniciar sesión con tu email y sincroniza los datos
  entre el celular y la compu. Ver *"Publicar en internet"* más abajo.

> El nombre del proyecto es **Faro**; la carpeta en disco quedó como `Gastos`.
> Podés renombrarla sin problema (todas las rutas internas son relativas).

---

## Cómo se usa

1. Abrí `index.html` haciendo doble clic (se abre en tu navegador).
2. En **Gastos** cargás lo que compraste. El registro muestra los **últimos 3**;
   "Ver los N gastos" abre la lista completa, y el buscador filtra sobre todos.
   Al **editar** un gasto en cuotas ves cuánto llevás pagado y cuánto falta.
3. En **Ingresos** cargás el sueldo y cualquier otra entrada de plata.
4. En **Proyección** mirás lo que viene mes a mes:
   - La tarjeta "Este mes" muestra **ingresos − gastos = te queda**.
   - Abajo, **"Cuotas pendientes"**: el total que te falta pagar sumando todas
     las cuotas (los gastos fijos no cuentan como deuda: se pueden cancelar).
   - La lista "Lo que viene" tiene un filtro de horizonte (**6 meses / 1 año /
     2 años / Todo**) para no scrollear de más. La deuda de arriba siempre
     cuenta todos los meses, esté filtrada la lista o no.
   - La tarjeta avisa cuál es el mes más pesado que viene; si hay varios meses
     empatados los lista ("septiembre y octubre").
   - Tocás un mes para ver el desglose; la **cuota** de cada consumo se muestra
     como un recuadro resaltado ("cuota 3/12"). Si tiene muchos consumos se abre
     una ventana con la lista completa.
5. En **Ajustes** administrás tarjetas y categorías, elegís el tema y
   **descargás un respaldo**.

> **Importante (modo local):** los datos viven en *este* navegador y *esta*
> compu. Si limpiás los datos del navegador, cambiás de máquina o de navegador,
> se pierden. Conviene entrar cada tanto a **Ajustes → Exportar respaldo**.
> Con la sincronización activada esto deja de ser un problema, pero un respaldo
> nunca está de más.

---

## Los tres tipos de gasto

| Tipo         | Qué significa                                                        | Qué ponés en "Monto"        |
|--------------|---------------------------------------------------------------------|-----------------------------|
| **Único**    | Se paga una sola vez, el mes de la compra.                          | El precio total.            |
| **En cuotas**| Se paga en varios meses iguales, arrancando el mes de la compra.   | El valor de **una** cuota.  |
| **Fijo**     | Se paga todos los meses (un servicio, una suscripción).            | El valor mensual.           |

- En **cuotas**, aparece un campo para la cantidad de cuotas y, debajo del monto,
  una ayuda te muestra el total ("= $540.000 en total").
- En **fijo**, podés poner una fecha "hasta" (opcional) si sabés cuándo se corta.

Un **ingreso** es más simple: solo puede ser **Una vez** (un aguinaldo, una venta
puntual) o **Todos los meses** (el sueldo), y no tiene cuotas ni medio de pago.

---

## Estructura de archivos

```
Gastos/
├── index.html               Punto de entrada. Carga los CSS y los JS en orden.
├── manifest.webmanifest      Datos para instalarla como app en el celular.
├── sw.js                     Service Worker: cache offline (ver js/registro-sw.js).
├── vercel.json               Config del hosting (cache de js/css sin guardar).
├── .gitignore
├── README.md                 Este archivo.
│
├── supabase/
│   └── schema.sql            SQL para crear la tabla de sincronización.
│
├── assets/
│   ├── icono.svg             Ícono de la app (un faro). Favicon y manifest.
│   ├── icono-maskable.svg    Misma imagen, a sangre completa, para Android/iOS
│   │                         (ver PNGs derivados abajo).
│   ├── icono-192.png / icono-512.png                    PNGs del ícono normal.
│   ├── icono-maskable-192.png / icono-maskable-512.png  PNGs "maskable".
│   └── apple-touch-icon.png  Ícono para "Agregar a inicio" en iPhone.
│
├── css/                      ESTILOS  (se cargan en este orden)
│   ├── base.css             Variables de color/tipografía (los "tokens"),
│   │                        tema claro/oscuro, reset. Para cambiar el look,
│   │                        casi siempre se toca acá.
│   ├── componentes.css      Las piezas: botones, formularios, el selector
│   │                        Único/Cuotas/Fijo, las filas de la lista, el
│   │                        buscador, la tarjeta "Este mes", la lista de
│   │                        proyección, el aviso flotante y el modal.
│   └── layout.css           La estructura general: cabecera, navegación
│                            (barra abajo en el celular), la columna central.
│
└── js/                      LÓGICA  (se cargan en este orden)
    ├── config.js             Claves de Supabase. Vacío = modo 100% local.
    ├── formato.js            Formatea plata, fechas y texto. Parsea montos.
    ├── nucleo.js             EL CEREBRO. Todos los cálculos: en qué meses
    │                         impacta cada gasto/ingreso, la proyección, el
    │                         balance del mes (te queda), el progreso y la deuda
    │                         de las cuotas. No toca la pantalla.
    ├── almacenamiento.js     Guardado LOCAL (localStorage). Cargar, guardar,
    │                         exportar e importar respaldos, y "sanear" datos.
    ├── tema.js               Tema claro / oscuro / automático.
    ├── nube.js               Sincronización OPCIONAL con Supabase (login por
    │                         email + guardar/traer el JSON del usuario).
    ├── vista-gastos.js       Pantalla "Gastos": alta rápida + registro + buscador.
    ├── vista-ingresos.js     Pantalla "Ingresos": alta rápida + lista.
    ├── vista-proyeccion.js   Pantalla "Proyección": tarjeta "Este mes" + deuda
    │                         + lista de meses + desglose (con modal si son muchos).
    ├── vista-ajustes.js      Pantalla "Ajustes".
    ├── app.js                EL COORDINADOR. Se carga último. Estado en memoria,
    │                         login (si hay nube), navegación, modal, y las
    │                         herramientas comunes para las pantallas.
    └── registro-sw.js        Instala el Service Worker (sw.js) para que la
                              app se pueda usar offline e instalar.
```

### Cómo se conecta todo

- Todo cuelga de un único objeto global: `window.Gastos`.
  - `Gastos.Formato`, `Gastos.Nucleo`, `Gastos.Almacenamiento`, `Gastos.Tema`
  - `Gastos.App` — el coordinador
  - `Gastos.Vistas.gastos` / `.ingresos` / `.proyeccion` / `.ajustes` — cada pantalla
- Cada pantalla expone un método `montar(contenedor, ctx)` que:
  1. arma el HTML y lo mete en la columna central,
  2. engancha los eventos (clics, envío de formularios).
- Cuando algo cambia (agregás un gasto, borrás, importás un respaldo) se llama a
  `Gastos.App.guardar()`, que **persiste** en el navegador y **vuelve a dibujar**
  la pantalla activa.

### El modelo de datos (lo que se guarda)

Una sola clave en `localStorage`: **`gastos-app-v1`** (el nombre de la clave no
cambió; adentro `version` es **2** desde que se agregaron los ingresos). Forma:

```js
{
  version: 2,
  medios: [ { id, nombre, color } ],          // tarjetas / medios de pago
  categorias: [ { id, nombre } ],             // categorías de gastos
  categoriasIngreso: [ { id, nombre } ],      // categorías de ingresos
  gastos: [
    {
      id, descripcion, monto, moneda,          // "ARS" | "USD"
      tipo,                                     // "unico" | "cuotas" | "fijo"
      fecha,                                    // "YYYY-MM-DD"
      cuotas,                                   // solo tipo "cuotas"
      hasta,                                    // solo tipo "fijo" (opcional, "YYYY-MM")
      medioId, categoriaId                      // opcionales (pueden ser null)
    }
  ],
  ingresos: [
    {
      id, descripcion, monto, moneda,          // "ARS" | "USD"
      tipo,                                     // "unico" | "fijo"
      fecha,                                    // "YYYY-MM-DD"
      hasta,                                    // solo tipo "fijo" (opcional, "YYYY-MM")
      categoriaId                               // opcional (puede ser null)
    }
  ]
}
```

Los respaldos viejos (sin `ingresos` ni `categoriasIngreso`) se abren igual:
`normalizar()` les completa lo que falta.

El tema se guarda aparte, en la clave `gastos-tema` (`"auto"` / `"claro"` /
`"oscuro"`), porque es una preferencia del dispositivo, no un dato para respaldar.

**Con sincronización**, ese mismo JSON se guarda además en Supabase, en la tabla
`estados` (columna `datos jsonb`), una fila por usuario. Al iniciar sesión, si la
nube tiene datos manda la nube; si está vacía, se sube lo que haya local. Después
cada cambio se sube con ~1 s de retardo.

---

## Si algo falla

1. **Abrí la consola del navegador**: tecla `F12` → pestaña *Console*. Los errores
   aparecen ahí en rojo, con el archivo y la línea.
2. Los archivos de lógica (`formato.js`, `nucleo.js`) son **funciones puras**: les
   das datos y devuelven datos. Son los más fáciles de probar sueltos desde la
   consola, por ejemplo:
   ```js
   Gastos.Nucleo.impactoEnMes({ tipo:"cuotas", monto:1000, cuotas:3, fecha:"2026-01-10" }, "2026-02")
   // -> 1000
   ```
3. **Después de editar un CSS o un JS**, el navegador puede seguir usando la
   versión vieja de la caché. Subí el número de `?v=8` a `?v=9` (etc.) en
   `index.html` en la línea de ese archivo, o recargá con `Ctrl + F5`.
4. Si los datos quedaron raros, **exportá un respaldo primero** y después probá
   *Ajustes → Borrar todo*. Podés volver a importar el respaldo.
5. Ver los datos crudos: consola → `JSON.parse(localStorage.getItem("gastos-app-v1"))`.

---

## Publicar en internet (GitHub + Supabase + Vercel)

Esto es para poder probar la app desde el celular y la compu con **los mismos
datos**. Es modo testeo: funciona, pero no está pulido para "producción" de
verdad.

### 1) Subir el código a GitHub

El repo ya está listo (con `git init` y un primer commit). Falta conectarlo a
GitHub:

```bash
# creá un repo vacío en github.com (por ejemplo: faro-gastos), y después:
git remote add origin https://github.com/TU-USUARIO/faro-gastos.git
git branch -M main
git push -u origin main
```

> Podés hacerlo **privado**. La `anon key` de Supabase que va en `js/config.js`
> es pública igual (la protege el Row Level Security), pero si el repo es privado
> te quedás más tranquilo.

### 2) Crear el proyecto de Supabase

1. Entrá a [supabase.com](https://supabase.com) → **New project**. Elegí una
   región cercana (por ejemplo *South America (São Paulo)*).
2. Cuando esté listo: **SQL Editor → New query**, pegá todo el contenido de
   `supabase/schema.sql` y **Run**.
3. **Project Settings → API**: copiá
   - **Project URL** → va en `js/config.js` como `url`
   - **anon / public key** → va en `js/config.js` como `anonKey`
4. **Authentication → URL Configuration**:
   - *Site URL:* `https://TU-APP.vercel.app` (lo vas a saber después del paso 3)
   - *Redirect URLs:* `https://TU-APP.vercel.app/**`
5. Editá `js/config.js`, poné los dos valores, y `git commit -am "config" && git push`.

### 3) Hostear en Vercel

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** → elegí el repo `faro-gastos`.
3. **Framework Preset: Other**. No hace falta build command ni output directory
   (es un sitio estático). **Deploy**.
4. Te queda una URL tipo `https://faro-gastos.vercel.app`. Ponela en el paso 2.4
   de Supabase (Site URL y Redirect URLs) si todavía no lo hiciste.

Cada `git push` a `main` vuelve a desplegar solo.

### 4) Probar

- Abrí la URL de Vercel en la compu. Te pide email + contraseña → "¿No tenés
  cuenta? Creá una" → entrás.
- Abrí la misma URL en el celular, iniciá sesión con el mismo email y
  contraseña → ves los mismos datos.
- En el celular, "Agregar a la pantalla de inicio" para que quede como una app
  (ver *"Instalarla en el celular"* más abajo).

### Volver a modo local

En **Ajustes → Sincronización → "Seguir sin cuenta"**, o dejá `js/config.js`
vacío otra vez.

---

## Instalarla en el celular (PWA)

Faro es una **PWA** (Progressive Web App): se instala directo desde el
navegador, sin pasar por App Store ni Play Store, sin aprobación de nadie y
sin costo. Una vez instalada, anda offline (muestra los últimos datos que
haya podido cargar) y abre en pantalla completa, como cualquier app.

Requiere que esté servida por https (Vercel cumple esto); no funciona
abriendo `index.html` como archivo local.

- **Android (Chrome):** entrás a la URL → aparece un cartel "Agregar a la
  pantalla de inicio" (o Menú ⋮ → "Instalar app" / "Agregar a pantalla de inicio").
- **iPhone (Safari):** entrás a la URL → botón compartir (el cuadradito con la
  flecha) → "Agregar a pantalla de inicio". Safari no ofrece instalar PWAs desde
  otro navegador (Chrome/Firefox en iOS) ni un cartel automático: este paso es
  siempre manual.

Qué hace posible esto (por si hay que tocarlo):
- `manifest.webmanifest` — nombre, ícono e ícono "maskable" (se adapta a la
  forma que le pida Android), color de fondo, `display: standalone`.
- `sw.js` + `js/registro-sw.js` — el Service Worker: cachea la app la primera
  vez que se abre y la sirve desde ahí si después no hay conexión. Los pedidos
  a Supabase nunca se cachean (siempre van a internet, tal cual).
- `assets/apple-touch-icon.png` — ícono específico para iOS (Safari no lee el
  manifest para esto).

**¿Y publicarla en las tiendas (App Store / Play Store)?** Es un paso aparte,
no obligatorio: significa empaquetar esta misma web con **Capacitor** (o un
TWA para solo Android) y sí pasar por la revisión de Apple/Google (cuenta de
Apple Developer $99/año + Google Play ~$25 única vez). No hace falta para que
la app se pueda instalar y usar hoy — la PWA ya cubre eso.

---

## Decisiones de diseño y límites conocidos

- **Los meses se cuentan por mes calendario**, no por ciclo de facturación de la
  tarjeta. Si comprás el 28 y cierra el 20, esta app imputa la cuota a ese mismo
  mes. Es una simplificación a propósito para que sea fácil de cargar.
- **No se convierten monedas.** Los pesos y los dólares se muestran siempre por
  separado. No hay cotización.
- **La proyección no incluye** los gastos fijos sin fecha de fin para decidir
  *hasta dónde* llegar (serían infinitos), pero sí los muestra en cada mes.
- **El "te queda" es solo del mes en curso.** No arrastra saldo de un mes a otro
  ni descuenta cuotas de meses futuros: contesta "¿me alcanza este mes?", nada más.
- **No hay análisis ni gráficos** a propósito: es un registro, no un tablero.
- **Responsive:** el layout se adapta a celular. La navegación pasa a una barra
  inferior por debajo de 620 px; los formularios se apilan en una columna por
  debajo de 480 px; y la marca se acorta a "Faro" por debajo de 380 px. Los
  montos grandes se achican solos (`clamp()`) para no desbordar.

---

## Futuro (ideas, no hechas todavía)

- Un tablero rápido estilo resumen.
- *Service worker* para que funcione sin internet una vez cargada y para
  instalarla mejor en el celular.
- Tablas normalizadas en Supabase en vez de un solo JSON (para "producción" de
  verdad, con varios usuarios o consultas).
- Empaquetarla como app mobile (Capacitor u otra). El `nucleo.js` está aislado
  justamente para poder reutilizarlo sin cambios.
