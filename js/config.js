/* ============================================================================
 * config.js
 * ----------------------------------------------------------------------------
 * Configuración de la sincronización con la nube (Supabase).
 *
 * - Si dejás los dos valores VACÍOS ("") -> la app funciona 100% local, como
 *   siempre (los datos viven solo en este navegador). Podés abrir index.html
 *   con doble clic y no pasa nada raro.
 *
 * - Si completás `url` y `anonKey` con los de tu proyecto de Supabase -> la app
 *   pide iniciar sesión con tu email y sincroniza tus datos entre dispositivos
 *   (celular y compu). Esto solo funciona si la página está servida por http/https
 *   (por ejemplo en Vercel), no abriendo el archivo directo.
 *
 * La "anon key" es una clave PÚBLICA: no da acceso a nada por sí sola, porque
 * las reglas de seguridad (Row Level Security) de Supabase solo dejan que cada
 * usuario vea y edite SUS propios datos. Por eso es seguro tenerla acá.
 *
 * Dónde sacar estos valores:
 *   Panel de Supabase -> Project Settings -> API
 *     url     = "Project URL"
 *     anonKey = "Project API keys" -> "anon" / "public"
 * ==========================================================================*/

window.GASTOS_CONFIG = {
  url: "https://uetalwmlkhvgqgnzotgz.supabase.co",
  anonKey: "sb_publishable_zZZ4YSmGK4gS1zv4168vdg_xxJj5jOf",
};
