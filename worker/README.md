# Proxy de datos de mercado

Pequeño Cloudflare Worker que se pone entre la app y Twelve Data para que **la
clave de la API no tenga que viajar al navegador**.

Sin él, una web estática que consulta una API con clave no tiene dónde
esconderla: acaba incrustada en el JavaScript y, por tanto, a la vista en el
repositorio. Con el proxy, la clave vive como secreto de Cloudflare y el
navegador solo habla con este Worker.

No es un reenvío ciego, porque un proxy abierto sería peor que la clave
expuesta: cualquiera podría gastar esta cuota. Lleva lista blanca de símbolos,
lista blanca de orígenes, tope de tamaño de petición y caché de 6 horas (las
barras diarias no cambian dentro del día, así que además ahorra muchísima
cuota en un plan de 8 peticiones por minuto).

## Desplegarlo

```bash
npm install -g wrangler          # si no lo tienes
cd worker
wrangler login                   # abre el navegador una vez
wrangler secret put TWELVE_DATA_API_KEY   # pega la clave cuando la pida
wrangler deploy
```

`wrangler deploy` imprime la URL, algo como
`https://pathfolio-data-proxy.TU-SUBDOMINIO.workers.dev`.

Pégala en [`../config.js`](../config.js):

```js
window.PATHFOLIO_CONFIG = { dataProxyUrl: 'https://pathfolio-data-proxy.TU-SUBDOMINIO.workers.dev' };
```

A partir de ahí la app deja de usar la clave incrustada. El último paso es
borrarla de `app.js` (la constante `TWELVE_DATA_API_KEY`) y **rotarla** en el
panel de Twelve Data, porque la anterior ha estado en un repositorio público y
hay que darla por comprometida.

## Comprobarlo

```bash
curl "https://TU-WORKER.workers.dev?symbol=SPY&outputsize=5"     # 200 con datos
curl "https://TU-WORKER.workers.dev?symbol=AAPL&outputsize=5"    # 400, no está en la lista
```
