'use strict';
/*
 * Configuración del despliegue. Se carga antes que el resto y no contiene
 * secretos: solo dice DÓNDE están las cosas.
 *
 * dataProxyUrl — URL del Cloudflare Worker que hace de proxy hacia Twelve Data
 * (ver worker/README.md). Cuando está puesta, el navegador nunca ve la clave
 * de la API: se la pone el Worker desde un secreto de Cloudflare.
 *
 * Es obligatoria: sin ella la app falla diciendo qué falta, en vez de volver
 * a incrustar una credencial en el cliente. Para levantar tu propio proxy,
 * ver worker/README.md.
 */
window.PATHFOLIO_CONFIG = {
  dataProxyUrl: 'https://pathfolio-data-proxy.allpainends.workers.dev',
};
