'use strict';
/*
 * Configuración del despliegue. Se carga antes que el resto y no contiene
 * secretos: solo dice DÓNDE están las cosas.
 *
 * dataProxyUrl — URL del Cloudflare Worker que hace de proxy hacia Twelve Data
 * (ver worker/README.md). Cuando está puesta, el navegador nunca ve la clave
 * de la API: se la pone el Worker desde un secreto de Cloudflare.
 *
 * Si se deja vacía, la app cae a llamar directamente a Twelve Data con la
 * clave incrustada en app.js. Eso funciona y es lo que hubo hasta ahora, pero
 * deja una credencial a la vista en un repositorio público, así que la consola
 * avisa. Es un modo de desarrollo, no el destino.
 */
window.PATHFOLIO_CONFIG = {
  dataProxyUrl: '',
};
