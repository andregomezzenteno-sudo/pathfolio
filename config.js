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
 *
 * loadingMinMs — cuánto dura como mínimo la pantalla de carga previa al
 * resultado. No es relleno: es el rato en el que se descargan de verdad los
 * precios históricos, y da margen para ver el vídeo de repaso. Se puede bajar
 * a 0 (las pruebas de integración lo hacen, no pueden esperar 10 s por
 * recorrido).
 */
window.PATHFOLIO_CONFIG = {
  dataProxyUrl: 'https://pathfolio-data-proxy.allpainends.workers.dev',
  loadingMinMs: 10000,
};
