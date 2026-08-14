import { JSDOM } from 'jsdom';
import fs from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

// Relativo al propio fichero para que corra igual en local y en el CI.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const html = read('index.html');
// Se apunta el proxy a un host de prueba: lo que se comprueba es que la app
// hable SIEMPRE con él y nunca lleve credenciales, no la URL concreta.
const configJs = read('config.js').replace(/dataProxyUrl: '[^']*'/, "dataProxyUrl: 'https://proxy.test'");
const i18nJs = read('i18n.js');
const dynamicJs = read('i18n/dynamic.js');
const engineJs = read('engine.js');
const appJs = read('app.js');
const allocationsJson = read('allocations.json');
const archetypesJson = read('archetypes.json');
const cloudFactsJson = read('cloudFacts.json');
const CLOUD_FACTS = JSON.parse(cloudFactsJson);

function buildFixture(seedStart, driftPerDay) {
  const dates = [];
  let d = new Date(Date.UTC(2022, 0, 3));
  while (dates.length < 520) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(d).toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  let seed = seedStart;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const closes = [100];
  for (let i = 1; i < dates.length; i++) closes.push(closes[i - 1] * (1 + driftPerDay + (rand() - 0.5) * 0.02));
  return { values: dates.map((dt, i) => ({ datetime: dt, close: String(closes[i]) })).reverse() };
}
const fixtures = {
  SPY: buildFixture(7, 0.0005), QQQ: buildFixture(13, 0.0006), VT: buildFixture(11, 0.0004),
  GOVT: buildFixture(17, 0.00005), LQD: buildFixture(19, 0.00007), BND: buildFixture(23, 0.00008),
  VNQ: buildFixture(51, 0.0003), GLD: buildFixture(61, 0.0002), DBC: buildFixture(67, 0.0001),
  'BTC/USD': buildFixture(77, 0.0012),
  DIA: buildFixture(29, 0.00045), TIP: buildFixture(31, 0.00006), SLV: buildFixture(37, 0.00015),
  XLK: buildFixture(41, 0.0007), XLI: buildFixture(43, 0.0004), XLV: buildFixture(47, 0.0003),
  XLE: buildFixture(53, 0.0002), VGK: buildFixture(59, 0.00035), VWO: buildFixture(71, 0.0003),
  IJR: buildFixture(73, 0.0004),
  // El tipo de cambio: sin él, las series en dólares no se pueden pasar a euros.
  'EUR/USD': buildFixture(83, 0.00002),
};
const fetchedUrls = [];

async function main() {
  // Idioma explícito: jsdom declara navigator.language en-US, así que sin esto
  // la app arrancaría en inglés (que es justo lo que debe hacer para alguien
  // de fuera, pero aquí queremos recorrer el flujo en español).
  const warnings = [];
  const dom = new JSDOM(html, { url: 'https://example.com/?lang=es', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new (await import('jsdom')).VirtualConsole().on('warn', m => warnings.push(String(m))) });
  const { window } = dom;
  const doc = window.document;

  window.Element.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 320, width: 600, height: 320 });

  window.fetch = async (url) => {
    fetchedUrls.push(url);
    if (url.includes('allocations.json')) return { ok: true, json: async () => JSON.parse(allocationsJson) };
    if (url.includes('archetypes.json')) return { ok: true, json: async () => JSON.parse(archetypesJson) };
    if (url.includes('cloudFacts.json')) return { ok: true, json: async () => JSON.parse(cloudFactsJson) };
    if (url.includes('i18n/es.json')) return { ok: true, json: async () => JSON.parse(read('i18n/es.json')) };
    if (url.includes('i18n/en.json')) return { ok: true, json: async () => JSON.parse(read('i18n/en.json')) };
    if (url.includes('api.twelvedata.com') || url.includes('proxy.test')) {
      const symbol = new URL(url).searchParams.get('symbol');
      if (!fixtures[symbol]) throw new Error('ticker inesperado: ' + symbol);
      return { ok: true, status: 200, json: async () => ({ status: 'ok', ...fixtures[symbol] }) };
    }
    throw new Error('fetch inesperado ' + url);
  };

  // Mismo orden que index.html: primero el motor, luego la interfaz.
  for (const src of [configJs, i18nJs, dynamicJs, engineJs, appJs]) {
    const script = doc.createElement('script');
    script.textContent = src;
    doc.body.appendChild(script);
  }

  const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await flush(12);

  function assert(cond, msg) { if (!cond) throw new Error('FALLO: ' + msg); }
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const visible = q => !doc.getElementById('q-' + q).hidden;
  function setSlider(id, value) {
    const el = doc.getElementById(id);
    el.value = String(value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  function pick(question, value) {
    const btn = doc.querySelector(`[data-options="${question}"] .option-card[data-value="${value}"]`);
    assert(btn, `debería existir la opción ${question}=${value}`);
    click(btn);
  }
  const advance = q => click(doc.querySelector(`[data-advance="${q}"]`));
  const absNum = t => Math.abs(parseFloat(t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')));
  const step = async (fn) => { fn(); await wait(220); };

  /* ---------- lessons.json ya no se descarga ---------- */
  assert(!fetchedUrls.some(u => u.includes('lessons.json')),
    'lessons.json ya no debería descargarse: el contenido vive en las diapositivas del HTML');
  console.log('OK: lessons.json ya no se descarga (cabo suelto eliminado)');

  /* ---------- iconos: 3 fotogramas y marcados como listos (sin parpadeo) ---------- */
  const slots = doc.querySelectorAll('[data-icon]');
  assert(slots.length > 20, `debería haber muchos iconos sketch, hay ${slots.length}`);
  let framesOk = 0;
  slots.forEach(s => {
    const frames = s.querySelectorAll('svg.sketch-icon path.frame');
    if (frames.length === 3) framesOk += 1;
    assert(s.classList.contains('icon-ready'), 'cada icono debería marcarse como listo para no mostrarse a medias');
  });
  assert(framesOk === slots.length, `los ${slots.length} iconos deberían tener 3 fotogramas; solo ${framesOk} los tienen`);

  // El parpadeo se veía porque todos los iconos cambiaban de fotograma a la
  // vez: hay que comprobar que cada icono arranca con una fase distinta y que
  // todos los retardos son negativos (animación ya en marcha en t=0).
  const phases = new Set();
  let allNegative = true;
  slots.forEach(s => {
    const f1 = s.querySelector('path.frame-1');
    const delay = parseFloat(f1.style.animationDelay);
    if (delay > 0) allNegative = false;
    phases.add(f1.style.animationDelay);
    const frames = [...s.querySelectorAll('path.frame')].map(p => parseFloat(p.style.animationDelay));
    // Los tres fotogramas de un mismo icono deben ir separados justo un tercio
    // del ciclo, o se solaparían dos a la vez (o ninguno).
    assert(Math.abs((frames[0] - frames[1]) - 1400 / 3) < 1 && Math.abs((frames[1] - frames[2]) - 1400 / 3) < 1,
      `los 3 fotogramas deberían ir separados un tercio del ciclo, dieron ${frames}`);
  });
  assert(allNegative, 'todos los retardos deberían ser negativos para que ningún fotograma nazca sin opacidad definitiva');
  assert(phases.size > 10, `los iconos deberían arrancar desfasados entre sí para no parpadear al unísono, solo hay ${phases.size} fases distintas`);
  console.log(`OK: los ${slots.length} iconos llevan 3 fotogramas, arrancan con ${phases.size} fases distintas y con retardo negativo (sin parpadeo al unísono)`);

  /* ---------- nubes: nunca más de 3, y siempre del tema actual ---------- */
  click(doc.getElementById('startBtn'));
  await flush();
  let clouds = doc.querySelectorAll('.falling-cloud');
  assert(clouds.length >= 1 && clouds.length <= 3, `debería haber entre 1 y 3 nubes, hay ${clouds.length}`);
  const ageTopicFacts = CLOUD_FACTS.facts.es.interesCompuesto;
  clouds.forEach(c => {
    const text = c.querySelector('.cloud-bubble p').textContent;
    assert(ageTopicFacts.includes(text), `en la pregunta de edad la nube debería llevar un dato de interés compuesto, llevaba: "${text}"`);
  });
  const firstCloud = clouds[0];
  assert(!firstCloud.classList.contains('expanded'), 'las nubes deberían nacer colapsadas');
  click(firstCloud);
  assert(firstCloud.classList.contains('expanded') && firstCloud.classList.contains('paused'),
    'al hacer clic la nube debería abrirse y pararse');
  // El texto tiene que estar entero en el DOM, no recortado a un fragmento.
  const bubbleText = firstCloud.querySelector('.cloud-bubble p').textContent;
  assert(bubbleText.length > 30 && !bubbleText.endsWith('…'),
    `la nube debería llevar el dato completo, llevaba: "${bubbleText}"`);

  // Con una nube abierta en un carril, no deben caer más por ese mismo lado.
  const busyLane = firstCloud.closest('.cloud-lane');
  const busyLaneId = busyLane.id;
  const before = busyLane.querySelectorAll('.falling-cloud').length;
  for (let i = 0; i < 6; i++) window.eval('spawnFallingCloud()');
  assert(busyLane.querySelectorAll('.falling-cloud').length === before,
    `no deberían caer nubes nuevas por el carril con una abierta (${busyLaneId})`);
  console.log('OK: con una nube abierta, ese carril deja de generar nubes nuevas mientras la lees');

  click(firstCloud);
  assert(!firstCloud.classList.contains('expanded'), 'un segundo clic debería volver a colapsarla y dejarla caer');
  console.log(`OK: como mucho 3 nubes a la vez, todas del tema de la pregunta, con el texto completo, y el clic las abre/pausa y las cierra`);

  /* ---------- vista previa en vivo ---------- */
  const previewSegs = () => doc.getElementById('previewDonut').querySelectorAll('circle').length;
  assert(previewSegs() === 4, `la vista previa debería arrancar con 1 pista + 3 segmentos, tiene ${previewSegs()}`);
  const riskLabel = doc.getElementById('previewRiskLabel');
  assert(riskLabel.textContent.includes('Moderado'), `con el slider a 50 el perfil debería ser Moderado, dice "${riskLabel.textContent}"`);

  /* ---------- flujo con vuelta atrás ---------- */
  await step(() => pick('age', '31-45'));
  assert(visible('risk'), 'debería avanzar a la pregunta de riesgo');

  // slider continuo: cualquier punto vale, no solo 5 muescas
  setSlider('riskSlider', 88);
  assert(doc.getElementById('riskReadout').textContent.includes('88'),
    'el slider debería aceptar cualquier valor y mostrarlo');
  assert(riskLabel.textContent.includes('Arriesgado'), 'con 88 el perfil en vivo debería pasar a Arriesgado');

  // atrás: debe volver a edad con la respuesta aún marcada
  click(doc.getElementById('backBtn'));
  await wait(220);
  assert(visible('age'), 'el botón atrás debería devolvernos a la pregunta de edad');
  const ageSelected = doc.querySelector('[data-options="age"] .option-card.selected');
  assert(ageSelected && ageSelected.dataset.value === '31-45', 'al volver atrás debería seguir marcada la respuesta anterior');
  assert(doc.getElementById('backBtn').hidden, 'en la primera pregunta el botón atrás debería ocultarse');
  console.log('OK: el botón atrás vuelve a la pregunta anterior conservando lo ya respondido, y se oculta en la primera');

  await step(() => pick('age', '31-45'));
  await step(() => advance('risk'));
  await step(() => pick('horizon', 'jubilacion'));

  await step(() => pick('rvKnowledge', 'no'));
  assert(visible('rvLesson'), 'decir que no conoces la renta variable debería mostrar su lección');
  assert(doc.getElementById('q-rvLesson').textContent.includes('ETF'),
    'la lección de renta variable debería explicar qué es un ETF antes de preguntar por índices');
  await step(() => advance('rvLesson'));

  assert(visible('indexKnowledge'), 'después de la lección de renta variable debería venir la de índices');
  await step(() => pick('indexKnowledge', 'no'));
  const idxLesson = doc.getElementById('q-indexLesson').textContent;
  assert(idxLesson.includes('Apple') && idxLesson.includes('Nvidia') && idxLesson.includes('Inditex'),
    'la lección de índices debería poner ejemplos de empresas reales dentro de cada fondo');
  console.log('OK: se pregunta y explica renta variable/ETF ANTES de los índices, y la lección lista empresas reales de cada fondo');
  await step(() => advance('indexLesson'));

  /* ---------- selección múltiple real ---------- */
  assert(visible('equityIndex'), 'debería llegar a la elección de índices');
  const eqContinue = doc.querySelector('[data-advance="equityIndex"]');
  assert(eqContinue.disabled, 'sin nada marcado, Continuar debería estar deshabilitado');
  pick('equityIndex', 'sp500');
  assert(!eqContinue.disabled && eqContinue.textContent.includes('1 opción'), 'con una marcada debería habilitarse e indicar 1 opción');
  pick('equityIndex', 'nasdaq100');
  assert(eqContinue.textContent.includes('2 opciones'), `con dos marcadas debería indicar 2 opciones, decía "${eqContinue.textContent}"`);
  assert(doc.querySelectorAll('[data-options="equityIndex"] .option-card.selected').length === 2,
    'deberían quedar dos tarjetas marcadas a la vez');
  pick('equityIndex', 'nasdaq100'); // se desmarca
  assert(eqContinue.textContent.includes('1 opción'), 'volver a pulsar debería desmarcar');
  pick('equityIndex', 'nasdaq100');

  // El reparto dentro del bloque: aparece solo al marcar 2+, y mover el peso
  // tiene que cambiar el porcentaje que se muestra.
  const mixPanel = doc.querySelector('[data-mix="equityIndex"]');
  assert(!mixPanel.hidden, 'con dos índices marcados debería aparecer el reparto entre ellos');
  const mixRows = mixPanel.querySelectorAll('.mix-row');
  assert(mixRows.length === 2, `debería haber un control por instrumento elegido, hubo ${mixRows.length}`);
  const pctBefore = mixRows[1].querySelector('.mix-pct').textContent;
  const slider = mixRows[1].querySelector('input[type="range"]');
  slider.value = '10';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  const pctAfter = mixPanel.querySelectorAll('.mix-row')[1].querySelector('.mix-pct').textContent;
  assert(pctBefore !== pctAfter, `subir el peso debería cambiar su porcentaje (${pctBefore} -> ${pctAfter})`);
  console.log(`OK: dentro de un bloque se puede pedir más de un instrumento que de otro (${pctBefore} -> ${pctAfter} en NASDAQ)`);

  await step(() => advance('equityIndex'));
  console.log('OK: los índices admiten marcar varios a la vez, se pueden desmarcar y Continuar refleja cuántos llevas');

  // Inclinación hacia sectores/regiones concretos.
  assert(visible('equityTiltAsk'), 'debería ofrecerse inclinar la cartera hacia sectores o regiones');
  await step(() => pick('equityTiltAsk', 'si'));
  assert(visible('equityTilt'), 'decir que sí debería mostrar los sectores y regiones');
  pick('equityTilt', 'tecnologia');
  pick('equityTilt', 'industriales');
  await step(() => advance('equityTilt'));
  console.log('OK: se puede inclinar la renta variable hacia sectores concretos (tecnología, industriales…), que era justo lo que no se podía pedir');

  await step(() => pick('bondsKnowledge', 'si'));
  assert(visible('bondsChoice'), 'decir que sí debería saltar la lección de renta fija');
  pick('bondsChoice', 'govt');
  pick('bondsChoice', 'corporate');
  await step(() => advance('bondsChoice'));

  await step(() => pick('realEstateKnowledge', 'si'));
  await step(() => pick('realEstateChoice', 'si'));
  assert(visible('realEstateType'), 'aceptar el inmobiliario debería preguntar por el subtipo');
  pick('realEstateType', 'reits');
  pick('realEstateType', 'crowdfunding');
  await step(() => advance('realEstateType'));

  await step(() => pick('peKnowledge', 'no'));
  const peLesson = doc.getElementById('q-peLesson').textContent;
  assert(peLesson.includes('Mercadona') && peLesson.includes('El Corte Inglés') && peLesson.includes('SpaceX'),
    'la lección de private equity debería nombrar empresas reales que no cotizan');
  console.log('OK: la lección de private equity pone ejemplos reales de grandes empresas que no cotizan');
  await step(() => advance('peLesson'));
  await step(() => pick('peChoice', 'si'));

  await step(() => pick('altKnowledge', 'si'));
  await step(() => pick('altChoice', 'si'));
  assert(visible('altType'), 'aceptar otras inversiones debería preguntar por el subtipo');
  pick('altType', 'metales');
  pick('altType', 'materiasPrimas');
  await step(() => advance('altType'));

  await step(() => pick('style', 'detalle'));
  setSlider('volatilitySlider', 95);
  await step(() => advance('volatility'));

  // la vista previa ya debe mostrar las 6 categorías antes de pulsar "ver resultado"
  doc.getElementById('amountInput').value = '50000';
  doc.getElementById('amountInput').dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(120);
  assert(previewSegs() === 7, `la vista previa debería mostrar 1 pista + 6 categorías antes del resultado, tiene ${previewSegs()}`);
  console.log('OK: el donut de la vista previa se va rellenando con cada respuesta y llega a las 6 categorías antes de ver el resultado');

  click(doc.getElementById('seeResultsBtn'));
  await flush(30);

  /* ---------- dashboard ---------- */
  assert(!doc.getElementById('screen-dashboard').hidden, 'el dashboard debería mostrarse');
  const donutSegs = doc.getElementById('allocationDonut').querySelectorAll('.donut-seg');
  assert(donutSegs.length === 6, `el donut final debería pintar 6 categorías, pintó ${donutSegs.length}`);

  const legendEl = doc.getElementById('donutLegend');
  const legend = legendEl.textContent;
  ['Renta variable', 'Renta fija', 'Efectivo', 'Inversión inmobiliaria', 'Private Equity', 'Otras inversiones']
    .forEach(name => assert(legend.includes(name), `la leyenda debería incluir "${name}"`));
  assert(legend.includes('S&P 500') && legend.includes('NASDAQ 100'),
    'la leyenda debería desglosar los instrumentos elegidos dentro de cada categoría');

  // Cada instrumento del desglose lleva su propio % y su importe en euros.
  const memberLines = legendEl.querySelectorAll('.legend-member-line');
  assert(memberLines.length >= 8, `la leyenda debería listar cada instrumento por separado, listó ${memberLines.length}`);
  memberLines.forEach(l => {
    const t = l.querySelector('.legend-member-pct').textContent;
    assert(/%/.test(t) && /€/.test(t), `cada instrumento debería mostrar su % y su importe, mostró "${t}"`);
  });

  // Y el total tiene que cuadrar en 100 % clavado.
  const totalPct = legendEl.querySelector('.legend-total .donut-legend-pct').textContent;
  assert(totalPct.replace(/\s/g, '').startsWith('100,0'), `la leyenda debería cerrar en 100,0 %, cerró en "${totalPct}"`);
  console.log(`OK: la leyenda anida los ${memberLines.length} instrumentos con su % y su importe dentro de cada categoría, y cierra en ${totalPct.trim()}`);

  /* ---------- tooltip del donut con desglose ---------- */
  const tip = doc.getElementById('donutTooltip');
  assert(tip && tip.hidden, 'el tooltip del donut debería existir y arrancar oculto');
  const hits = doc.getElementById('allocationDonut').querySelectorAll('.donut-hit');
  assert(hits.length === 6, `debería haber una zona de detección por categoría, hay ${hits.length}`);
  hits[0].dispatchEvent(new window.Event('pointerenter', { bubbles: false }));
  assert(!tip.hidden, 'al pasar el ratón por un trozo debería aparecer el tooltip');
  const tipText = tip.textContent;
  assert(tipText.includes('Renta variable'), 'el tooltip debería nombrar la categoría');
  assert(tip.querySelector('.dt-pct').textContent.includes('%'), 'el tooltip debería dar el porcentaje de la categoría');
  assert(tip.querySelector('.dt-money').textContent.includes('€'), 'el tooltip debería dar el importe en euros');
  const tipMembers = tip.querySelectorAll('.dt-member');
  assert(tipMembers.length === 4, `el tooltip debería desglosar los 4 instrumentos de renta variable elegidos (2 índices + 2 sectores), desglosó ${tipMembers.length}`);
  assert(tipText.includes('SPY') && tipText.includes('QQQ'), 'el desglose del tooltip debería incluir los tickers reales');
  hits[0].dispatchEvent(new window.Event('pointerleave', { bubbles: false }));
  assert(tip.hidden, 'al salir del trozo el tooltip debería ocultarse');
  console.log('OK: pasar el ratón por un trozo del donut despliega categoría, %, importe y el desglose de lo que lleva dentro');

  // ambos índices elegidos deben descargarse de verdad y pesar lo mismo
  ['SPY', 'QQQ', 'XLK', 'XLI', 'GOVT', 'LQD', 'VNQ', 'GLD', 'DBC'].forEach(t => {
    assert(fetchedUrls.some(u => u.includes('twelvedata.com') && u.includes('symbol=' + encodeURIComponent(t).replace('%2F', '/'))
      || u.includes('symbol=' + t)), `debería haberse descargado el ticker real ${t}`);
  });
  assert(!fetchedUrls.some(u => u.includes('symbol=BTC')), 'no se eligió cripto, así que BTC no debería descargarse');
  assert(fetchedUrls.some(u => u.includes('EUR%2FUSD') || u.includes('EUR/USD')),
    'debería descargarse el tipo de cambio: los fondos cotizan en dólares y el resultado se enseña en euros');
  console.log('OK: se descargan los tickers reales de todo lo elegido, sectores incluidos (SPY+QQQ+XLK+XLI, GOVT+LQD, VNQ, GLD+DBC)');

  /* ---------- origen de los datos: siempre a través del proxy ---------- */
  // Ninguna petición debe llevar credencial: la pone el Worker desde su propio
  // secreto. Si esto falla, la clave ha vuelto al cliente.
  assert(!fetchedUrls.some(u => u.includes('apikey=')),
    'ninguna petición debería llevar la clave de la API');
  assert(fetchedUrls.some(u => u.includes('proxy.test?symbol=')),
    'los datos de mercado deberían pedirse al proxy');

  // Y sin proxy configurado se falla diciendo qué falta, en vez de caer a
  // incrustar una credencial otra vez.
  const saved = window.PATHFOLIO_CONFIG.dataProxyUrl;
  window.PATHFOLIO_CONFIG.dataProxyUrl = '';
  let threw = null;
  try { window.eval("marketDataUrl('SPY', 2500)"); } catch (e) { threw = e; }
  assert(threw && /dataProxyUrl/.test(threw.message),
    'sin proxy debería fallar explicando qué falta, no llamar con clave');
  window.PATHFOLIO_CONFIG.dataProxyUrl = saved;
  console.log('OK: la clave ya no viaja al navegador — todo pasa por el proxy, y sin él la app dice qué falta');

  /* ---------- narración: de dónde sale cada porcentaje ---------- */
  const steps = doc.getElementById('narrativeList').querySelectorAll('.narrative-step');
  assert(steps.length >= 7, `la narración debería tener al menos 7 pasos con esta cartera, tiene ${steps.length}`);
  const narrative = doc.getElementById('narrativeList').textContent;
  ['perfil efectivo', 'reparto de partida', 'inversión inmobiliaria', 'otras inversiones', 'private equity', 'reparto final']
    .forEach(frag => assert(narrative.toLowerCase().includes(frag.toLowerCase()), `la narración debería explicar "${frag}"`));
  assert(/\d+,\d+ %/.test(narrative), 'la narración debería ir con cifras concretas, no con generalidades');
  assert(narrative.includes('€'), 'la narración debería traducir los porcentajes a euros del importe real');
  assert(narrative.includes('Suma 100,0 %'), 'la narración debería cerrar comprobando que el reparto suma 100 %');
  console.log(`OK: "explícamelo todo" son ahora ${steps.length} pasos con tus cifras reales, del perfil al reparto final cuadrando en 100 %`);

  const tableBody = doc.getElementById('detailTableBody');
  const tableText = tableBody.textContent;
  assert(tableText.includes('SPY') && tableText.includes('QQQ'), 'la tabla debería listar los dos índices elegidos por separado');
  assert(tableText.includes('Estimación'), 'las filas sin cotización real deberían marcarse como Estimación');

  // La tabla se agrupa por categoría con subtotal, que es lo que permite ver
  // "de este 40 % de renta fija, tanto es pública y tanto corporativa".
  const groupRows = tableBody.querySelectorAll('.group-row');
  assert(groupRows.length === 6, `debería haber una fila de subtotal por categoría, hay ${groupRows.length}`);
  const bondsGroup = [...groupRows].find(r => r.textContent.includes('Renta fija'));
  assert(bondsGroup, 'debería existir el subtotal de renta fija');
  const bondsGroupPct = bondsGroup.querySelectorAll('td')[3].textContent;
  const rows = [...tableBody.querySelectorAll('tr')];
  const govtRow = rows.find(r => r.textContent.includes('GOVT'));
  const lqdRow = rows.find(r => r.textContent.includes('LQD'));
  const weightOf = row => row.querySelectorAll('td')[3].textContent;
  const num = t => parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.'));
  assert(Math.abs((num(weightOf(govtRow)) + num(weightOf(lqdRow))) - num(bondsGroupPct)) < 0.15,
    `los dos tipos de bono deberían sumar el subtotal de renta fija (${weightOf(govtRow)} + ${weightOf(lqdRow)} vs ${bondsGroupPct})`);
  console.log(`OK: la tabla agrupa por categoría con subtotal — renta fija ${bondsGroupPct.trim()} = deuda pública ${weightOf(govtRow).trim()} + corporativa ${weightOf(lqdRow).trim()}`);

  const spyRow = rows.find(r => r.textContent.includes('SPY'));
  const qqqRow = rows.find(r => r.textContent.includes('QQQ'));
  // Se subió el peso del NASDAQ en el panel de reparto, así que ahora tiene
  // que pesar MÁS que el S&P: si siguieran iguales, el control no serviría.
  assert(absNum(weightOf(qqqRow)) > absNum(weightOf(spyRow)),
    `tras subir su peso, el NASDAQ debería pesar más que el S&P (${weightOf(qqqRow)} vs ${weightOf(spyRow)})`);
  console.log(`OK: el reparto que fijaste manda de verdad en la cartera final (NASDAQ ${weightOf(qqqRow).trim()} frente a S&P ${weightOf(spyRow).trim()})`);

  /* ---------- comparativa contra carteras de un solo activo ---------- */
  const compareRows = [...doc.getElementById('comparisonTableBody').querySelectorAll('tr')];
  assert(compareRows.length === 4, `la comparativa debería tener tu cartera + renta variable + renta fija + efectivo, tiene ${compareRows.length}`);
  const youRow = compareRows.find(r => r.classList.contains('is-you'));
  assert(youRow && youRow.textContent.includes('Tu cartera'), 'tu cartera debería estar resaltada en la comparativa');
  const compareText = doc.getElementById('comparisonTableBody').textContent;
  ['Solo renta variable', 'Solo renta fija', 'Solo efectivo'].forEach(n =>
    assert(compareText.includes(n), `la comparativa debería incluir "${n}"`));

  // Concentrarlo todo en renta variable tiene que salir MÁS volátil y con
  // MÁS caída que la cartera diversificada; si no, la comparación no estaría
  // enseñando lo que dice enseñar.
  const cellsOf = r => [...r.querySelectorAll('td')].map(td => td.textContent);
  const equityRow = compareRows.find(r => r.textContent.includes('Solo renta variable'));
  assert(absNum(cellsOf(equityRow)[3]) > absNum(cellsOf(youRow)[3]),
    `solo renta variable debería ser más volátil que la cartera diversificada (${cellsOf(equityRow)[3]} vs ${cellsOf(youRow)[3]})`);
  assert(absNum(cellsOf(equityRow)[4]) > absNum(cellsOf(youRow)[4]),
    `solo renta variable debería tener peor caída máxima que la cartera diversificada (${cellsOf(equityRow)[4]} vs ${cellsOf(youRow)[4]})`);
  assert(doc.getElementById('comparisonTakeaway').textContent.includes('caída máxima'),
    'la comparativa debería venir con su lectura escrita, no solo con la tabla');
  console.log(`OK: la comparativa demuestra el valor de diversificar — solo renta variable: vol ${cellsOf(equityRow)[3].trim()} y caída ${cellsOf(equityRow)[4].trim()}, frente a ${cellsOf(youRow)[3].trim()} y ${cellsOf(youRow)[4].trim()} de tu cartera`);

  /* ---------- avisos metodológicos ---------- */
  const drift = doc.getElementById('driftNotice').textContent;
  assert(drift.includes('rebalanceas una vez al año') && drift.includes('€'),
    'debería declararse la asunción de rebalanceo anual y qué habría pasado sin él');
  const coverage = doc.getElementById('coverageNotice');
  assert(!coverage.hidden, 'con private equity dentro debería avisarse de que parte de la cartera no tiene precios reales');
  assert(coverage.textContent.includes('suelo'),
    'el aviso debería decir que la volatilidad y la caída máxima son un suelo, no la cifra real');
  console.log('OK: se declaran las dos asunciones que inflarían el resultado si se callaran (rebalanceo anual y tramos sin precios reales)');

  /* ---------- el donut es accesible por teclado, no solo con el ratón ---------- */
  const firstHit = doc.getElementById('allocationDonut').querySelector('.donut-hit');
  assert(firstHit.getAttribute('tabindex') === '0' && firstHit.getAttribute('role') === 'button',
    'cada trozo del donut debería ser alcanzable con el teclado');
  assert(/%/.test(firstHit.getAttribute('aria-label')), 'cada trozo debería anunciar su categoría y porcentaje');
  firstHit.dispatchEvent(new window.Event('focus', { bubbles: false }));
  assert(!doc.getElementById('donutTooltip').hidden, 'enfocar un trozo con el teclado debería abrir su desglose');
  firstHit.dispatchEvent(new window.Event('blur', { bubbles: false }));
  console.log('OK: los trozos del donut se pueden recorrer con teclado y anuncian su categoría y porcentaje');

  const stats = doc.getElementById('statGrid').querySelectorAll('.stat-tile');
  assert(stats.length >= 6, `debería haber al menos 6 cifras destacadas, hay ${stats.length}`);
  const statText = doc.getElementById('statGrid').textContent;
  ['Valor final', 'Rentabilidad total', 'Rentabilidad anualizada', 'Volatilidad anual', 'Máxima caída',
   'Rebalanceando cada año', 'Respaldado por datos reales']
    .forEach(l => assert(statText.includes(l), `debería mostrarse la cifra "${l}"`));
  // La caída máxima solo se entiende traducida a dinero.
  const ddTile = [...stats].find(t => t.textContent.includes('Máxima caída'));
  assert(/€/.test(ddTile.textContent) && ddTile.textContent.includes('convertirse en'),
    `la caída máxima debería decir en euros lo que habrías visto, decía: "${ddTile.textContent}"`);
  console.log(`OK: el dashboard añade ${stats.length} cifras destacadas (valor final, rentabilidades, volatilidad, caída máxima, ventaja sobre efectivo, mejor/peor año)`);

  assert(doc.getElementById('altNotice').hidden && doc.getElementById('peNotice').hidden,
    'no debería haber avisos de exclusión cuando todo cumple los requisitos');
  assert(doc.getElementById('dashProfileTag').textContent.includes('Arriesgado'), 'la etiqueta de perfil debería decir Arriesgado');

  /* ---------- private equity denegado por capital ---------- */
  click(doc.getElementById('restartBtn'));
  await flush();
  await step(() => pick('age', '31-45'));
  setSlider('riskSlider', 95);
  await step(() => advance('risk'));
  await step(() => pick('horizon', 'jubilacion'));
  await step(() => pick('rvKnowledge', 'si'));
  await step(() => pick('indexKnowledge', 'si'));
  pick('equityIndex', 'msci');
  await step(() => advance('equityIndex'));
  await step(() => pick('equityTiltAsk', 'no'));
  assert(visible('bondsKnowledge'), 'decir que no a la inclinación debería saltarse la pregunta de sectores');
  await step(() => pick('bondsKnowledge', 'si'));
  pick('bondsChoice', 'mixed');
  await step(() => advance('bondsChoice'));
  await step(() => pick('realEstateKnowledge', 'si'));
  await step(() => pick('realEstateChoice', 'no'));
  assert(visible('peKnowledge'), 'rechazar el inmobiliario debería saltarse su subtipo');
  await step(() => pick('peKnowledge', 'si'));
  await step(() => pick('peChoice', 'si'));
  await step(() => pick('altKnowledge', 'si'));
  await step(() => pick('altChoice', 'no'));
  assert(visible('style'), 'rechazar otras inversiones debería saltarse su subtipo');
  await step(() => pick('style', 'resultados'));
  setSlider('volatilitySlider', 95);
  await step(() => advance('volatility'));
  doc.getElementById('amountInput').value = '1000'; // por debajo del mínimo
  click(doc.getElementById('seeResultsBtn'));
  await flush(30);

  const peNotice = doc.getElementById('peNotice');
  assert(!peNotice.hidden, 'debería avisar de que private equity queda fuera');
  assert(peNotice.textContent.includes('mínimo') && peNotice.textContent.includes('10.000'),
    `el aviso debería explicar que es por el importe mínimo, decía: "${peNotice.textContent}"`);
  assert(doc.getElementById('allocationDonut').querySelectorAll('.donut-seg').length === 3,
    'sin sleeves aceptados el donut debería quedarse en 3 categorías');
  console.log('OK: pedir private equity con capital insuficiente lo excluye y explica exactamente por qué (importe mínimo)');

  /* ---------- comisiones e inflación ---------- */
  const statTxt = doc.getElementById('statGrid').textContent;
  assert(statTxt.includes('Se han llevado las comisiones'), 'debería mostrarse cuánto se llevan las comisiones');
  assert(statTxt.includes('Valor real, en euros de hoy'), 'debería mostrarse el valor real descontando inflación');
  const inflNote = doc.getElementById('inflationNotice').textContent;
  assert(inflNote.includes('inflación') && inflNote.includes('€'),
    'debería explicarse en euros qué se lleva la inflación');
  assert(inflNote.includes('efectivo'),
    'la nota de inflación debería cerrar el círculo: por eso el efectivo no es tan seguro como parece');
  console.log('OK: el dashboard cifra en euros lo que se llevan las comisiones y lo que se lleva la inflación');

  /* ---------- riesgo divisa ---------- */
  assert(statTxt.includes('Efecto del tipo de cambio'),
    'debería mostrarse cuánto ha puesto o quitado el tipo de cambio');
  const fxTxt = doc.getElementById('fxNotice').textContent;
  assert(fxTxt.includes('dólares') && fxTxt.includes('riesgo divisa'),
    'debería explicarse que los fondos cotizan en dólares y qué implica');
  console.log('OK: los fondos en dólares se convierten a euros con el cambio de cada día, y se aísla el efecto divisa');

  /* ---------- estado en la URL: recargar y compartir ---------- */
  const hash = window.location.hash;
  assert(hash.includes('age=') && hash.includes('equityIndex='),
    `la URL debería llevar las respuestas para poder recargar o compartir, llevaba: "${hash}"`);
  assert(!/monthly=NaN|undefined|null/.test(hash), `la URL no debería llevar valores basura: "${hash}"`);

  // Round-trip: lo que se codifica tiene que decodificarse igual.
  const decoded = window.eval('decodeAnswers(' + JSON.stringify(hash) + ')');
  assert(decoded.seen > 8, `deberían recuperarse todas las respuestas de la URL, se recuperaron ${decoded.seen}`);
  assert(decoded.answers.age === '31-45', 'la edad debería recuperarse tal cual');
  assert(Array.isArray(decoded.answers.equityIndex), 'las multiselecciones deberían recuperarse como lista');

  // Entrada maliciosa o inventada: se ignora, no llega al motor.
  const dirty = window.eval("decodeAnswers('#age=<script>&risk=9999&equityIndex=noexiste,sp500&horizon=inventado')");
  assert(dirty.answers.age === null, 'un valor de edad que no existe debería descartarse');
  assert(dirty.answers.risk === 50, 'un riesgo fuera de rango debería descartarse y quedarse en el valor inicial');
  assert(dirty.answers.horizon === null, 'un horizonte inventado debería descartarse');
  assert(dirty.answers.equityIndex.join() === 'sp500', 'de una multiselección debería quedarse solo lo válido');
  console.log('OK: el enlace guarda y restaura la cartera, y descarta cualquier valor inventado antes de que llegue al motor');

  /* ---------- cambio de idioma ---------- */
  const enBtn = doc.querySelector('.lang-btn[data-lang="en"]');
  assert(enBtn, 'debería existir el selector de idioma');
  assert(doc.querySelector('.lang-btn[data-lang="es"]').classList.contains('active'),
    'el idioma activo debería estar marcado');

  click(enBtn);
  await flush(30);

  assert(doc.documentElement.lang === 'en', 'el idioma del documento debería cambiar a en');
  assert(enBtn.classList.contains('active'), 'el botón EN debería quedar marcado');
  assert(window.location.href.includes('lang=en'),
    'el idioma debería viajar en la URL para que un enlace compartido llegue igual');

  // Interfaz traducida, incluido lo que se genera desde JS.
  const restart = doc.getElementById('restartBtn').textContent;
  assert(restart === 'Start over', `el HTML debería estar traducido, decía "${restart}"`);
  const tagEn = doc.getElementById('dashProfileTag').textContent;
  assert(/profile/i.test(tagEn), `las cadenas dinámicas deberían traducirse, decía "${tagEn}"`);
  const statsEn = doc.getElementById('statGrid').textContent;
  assert(statsEn.includes('Final value') && statsEn.includes('Currency effect'),
    'las cifras destacadas deberían estar en inglés');
  const narrativeEn = doc.getElementById('narrativeList').textContent;
  assert(/effective profile/i.test(narrativeEn), 'la narración debería estar en inglés');
  assert(!/renta variable|Perfil |Valor final/.test(statsEn + narrativeEn + restart),
    'no debería quedar ningún resto en español al cambiar a inglés');

  // El contenido de datos también: instrumentos y datos curiosos.
  const legendEn = doc.getElementById('donutLegend').textContent;
  assert(legendEn.includes('Equities') && legendEn.includes('Fixed income'),
    `las categorías deberían traducirse, decía: "${legendEn.slice(0, 90)}"`);
  console.log('OK: el selector cambia HTML, cadenas dinámicas, narración y contenido de datos, y el idioma viaja en la URL');


  /* ---------- nada en español debe sobrevivir al cambio a inglés ---------- */
  // Ir parcheando textos sueltos a mano no escala: esto recorre la pantalla
  // entera y compara contra el catálogo español, así que cualquier texto que
  // alguien olvide marcar en el futuro aparece aquí y no en producción.
  {
    const esCat = JSON.parse(read('i18n/es.json'));
    const enCat = JSON.parse(read('i18n/en.json'));
    // Muchos textos son idénticos en los dos idiomas (nombres propios,
    // tickers, "Dow Jones"): esos no son un fallo.
    const sameInBoth = new Set(Object.keys(esCat).filter(k => esCat[k] === enCat[k]).map(k => esCat[k]));
    const spanishOnly = new Set(Object.values(esCat).filter(v => !sameInBoth.has(v)));

    const leftovers = [];
    const walker = doc.createTreeWalker(doc.body, window.NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text) continue;
      // Se miran TAMBIÉN las pantallas ocultas: la traducción se aplica a todo
      // el DOM, esté visible o no, así que un texto oculto que siga en español
      // es un texto sin marcar que aparecerá en cuanto se navegue hasta él.
      // (Saltarse lo oculto fue el primer intento, y dejaba sin comprobar el
      // cuestionario entero al estar el dashboard en pantalla.)
      if (spanishOnly.has(text)) {
        const owner = node.parentElement;
        leftovers.push(`${text.slice(0, 40)} [${owner.tagName.toLowerCase()}.${String(owner.className).split(' ')[0]}]`);
      }
    }
    assert(leftovers.length === 0,
      `quedan ${leftovers.length} textos en español con la app en inglés: ${leftovers.slice(0, 6).map(x => `"${x}"`).join(', ')}`);

    // Y ninguna entidad HTML sin decodificar: el catálogo se aplica como texto
    // plano, así que un "&amp;" guardado se vería literal en pantalla.
    const visible = doc.body.textContent;
    assert(!/&(amp|lt|gt|quot|#\d+);/.test(visible),
      `hay entidades HTML mostrándose literales (p. ej. en "S&P 500"): ${(visible.match(/&\w+;/g) || []).slice(0, 3)}`);

    // Los atributos accesibles también tienen que traducirse.
    const donutAria = doc.getElementById('allocationDonut').getAttribute('aria-label');
    assert(/portfolio/i.test(donutAria), `el aria-label del donut debería traducirse, decía "${donutAria}"`);
    console.log('OK: con la app en inglés no queda ni un texto en español, ni entidades sin decodificar, y los aria-label también se traducen');
  }

  // Y de vuelta al español sin perder la cartera.
  click(doc.querySelector('.lang-btn[data-lang="es"]'));
  await flush(30);
  assert(doc.getElementById('restartBtn').textContent === 'Volver a empezar', 'debería poder volverse al español');
  assert(!doc.getElementById('screen-dashboard').hidden, 'cambiar de idioma no debería sacarte del resultado');
  console.log('OK: se puede volver al español sin perder el resultado que ya estaba en pantalla');

  assert(doc.getElementById('shareBtn'), 'debería existir el botón de copiar enlace');

  console.log('\nTODAS LAS PRUEBAS DE INTEGRACIÓN DOM DE PATHFOLIO PASAN');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
