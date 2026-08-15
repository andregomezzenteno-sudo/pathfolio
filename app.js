'use strict';

/* ---------- Contenido (se descarga una vez) ---------- */

let ALLOCATIONS = null;
let ARCHETYPES = null;
let CLOUD_FACTS = null;

async function loadContent() {
  const [allocRes, archRes, cloudRes] = await Promise.all([
    fetch('allocations.json'),
    fetch('archetypes.json'),
    fetch('cloudFacts.json'),
  ]);
  ALLOCATIONS = await allocRes.json();
  ARCHETYPES = await archRes.json();
  CLOUD_FACTS = await cloudRes.json();
  updateCloudForQuestion(QUESTIONS[currentStep]);
  startCloudCycle();
  renderPreview();
}

/* ---------- Iconos sketch: animación "boil" dibujada a mano ---------- */
/* Un trazo canónico por icono; los otros dos fotogramas son EL MISMO trazo
   con un temblor determinista en las coordenadas, alternados con keyframes
   CSS de opacidad (ver .sketch-icon en style.css) — la técnica clásica del
   "boil" de la animación tradicional, sin dibujar 3 variantes a mano. */

const SKETCH_ICONS = {
  stocks:       'M8 54 H56 M14 54 V38 M26 54 V30 M38 54 V20 M50 54 V10',
  travel:       'M16 22 H48 V48 H16 Z M24 22 V16 C24 13 26 11 29 11 H35 C38 11 40 13 40 16 V22 M16 34 H48',
  house:        'M10 30 L32 12 L54 30 M16 26 V54 H48 V26 M27 36 H37 V50 H27 Z',
  sprout:       'M32 54 V28 M32 28 C32 18 24 12 16 12 C16 22 22 28 32 28 M32 28 C32 20 39 15 47 15 C47 24 41 28 32 28',
  retirement:   'M32 20 C37 20 41 16 41 11 C41 6 37 2 32 2 C27 2 23 6 23 11 C23 16 27 20 32 20 Z M14 52 C16 38 24 32 32 32 C40 32 48 38 50 52',
  check:        'M12 34 L26 48 L52 16',
  question:     'M24 22 C24 14 30 10 36 12 C42 14 44 22 38 26 C34 29 32 31 32 38 M32 46 L32 50',
  sp500flag:    'M14 8 V56 M14 10 H50 V28 H14 M14 14 H50 M14 18 H50 M14 22 H50 M14 26 H50',
  chip:         'M20 20 H44 V44 H20 Z M20 12 V20 M28 12 V20 M36 12 V20 M44 12 V20 M20 44 V52 M28 44 V52 M36 44 V52 M44 44 V52 M12 20 H20 M12 28 H20 M12 36 H20 M12 44 H20 M44 20 H52 M44 28 H52 M44 36 H52 M44 44 H52',
  globe:        'M32 8 C46 8 56 19 56 32 C56 45 46 56 32 56 C18 56 8 45 8 32 C8 19 18 8 32 8 Z M32 8 C40 16 40 48 32 56 M32 8 C24 16 24 48 32 56 M9 24 H55 M9 40 H55',
  document:     'M16 8 H40 L48 16 V56 H16 Z M40 8 V16 H48 M22 26 H42 M22 34 H42 M22 42 H36',
  cash:         'M6 22 H58 V42 H6 Z M14 22 V42 M50 22 V42 M22 32 H42',
  bonds:        'M14 12 H50 V44 H14 Z M20 20 H44 M20 28 H44 M20 36 H36 M26 44 L20 56 L26 50 L32 56 L32 44',
  vault:        'M12 10 H52 V54 H12 Z M32 32 C36 32 39 29 39 25 C39 21 36 18 32 18 C28 18 25 21 25 25 C25 29 28 32 32 32 Z M32 32 V40 M20 10 V4 M44 10 V4',
  rollercoaster:'M6 44 L18 20 L30 48 L42 12 L58 36',
  layers:       'M32 8 L52 18 L32 28 L12 18 Z M12 32 L32 22 L52 32 L32 42 Z M12 46 L32 36 L52 46 L32 56 Z',
  government:   'M32 8 L52 22 H12 Z M16 26 V50 M24 26 V50 M32 26 V50 M40 26 V50 M48 26 V50 M10 50 H54 M10 56 H54',
  balance:      'M32 8 V52 M14 20 H50 M14 20 L6 38 H22 Z M50 20 L42 38 H58 Z M22 52 H42',
  calendar:     'M12 14 H52 V54 H12 Z M12 26 H52 M20 14 V6 M44 14 V6 M20 36 H28 M36 36 H44 M20 46 H28 M36 46 H44',
  cloud:        'M16 40 C10 40 6 35 6 29 C6 23 11 18 17 18 C18 10 25 4 34 4 C43 4 50 11 51 20 C58 21 63 27 63 34 C63 41 57 46 50 46 H20 C18 46 16 44 16 40 Z',
  building:     'M16 12 H48 V56 H16 Z M22 20 H28 M36 20 H42 M22 30 H28 M36 30 H42 M22 40 H28 M36 40 H42 M26 48 H38 V56 H26 Z',
  coin:         'M32 12 C42 12 50 20 50 30 C50 40 42 48 32 48 C22 48 14 40 14 30 C14 20 22 12 32 12 Z M26 24 H38 M26 36 H38 M30 20 V40',
  spiral:       'M33 40 C29 40 26 37 26 33 C26 28 30 24 35 24 C41 24 46 29 46 35 C46 42 40 48 32 48 C23 48 16 41 16 32 C16 22 24 14 34 14',
  ingot:        'M10 44 L18 20 H46 L54 44 Z M10 44 H54 M18 20 L24 30 H40 L46 20',
  barrel:       'M20 8 H44 V56 H20 Z M20 8 C14 14 14 50 20 56 M44 8 C50 14 50 50 44 56 M20 20 H44 M20 44 H44',
  frame:        'M8 8 H56 V50 H8 Z M16 16 H48 V42 H16 Z M16 42 L28 28 L36 36 L48 22 V42 Z M22 24 C24 24 26 22 26 20 C26 18 24 16 22 16 C20 16 18 18 18 20 C18 22 20 24 22 24 Z',
  basket:       'M8 22 H56 L48 52 H16 Z M8 22 L20 6 M56 22 L44 6 M24 30 V44 M32 30 V44 M40 30 V44',
  factory:      'M8 54 V28 L22 38 V28 L36 38 V16 H56 V54 Z M42 24 H50 M42 34 H50 M14 44 H24 M8 54 H58',
};

function jitterPathD(d, seed) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return d.replace(/-?\d+(\.\d+)?/g, m => (parseFloat(m) + (rand() - 0.5) * 2.2).toFixed(1));
}

const BOIL_CYCLE_MS = 1400;
let boilPhaseCounter = 0;

function renderSketchIcon(container, iconKey, size) {
  const d = SKETCH_ICONS[iconKey];
  if (!d || !container) return;
  container.textContent = '';
  const svg = svgEl('svg', { viewBox: '0 0 64 64', width: size || 40, height: size || 40, class: 'sketch-icon' });
  const seedBase = [...iconKey].reduce((a, c) => a + c.charCodeAt(0), 0);

  // Desfase por icono. Si todos los iconos de la página cambian de fotograma
  // en el mismo instante, lo que se percibe no es un dibujo temblando sino
  // la pantalla entera parpadeando de golpe. Repartiendo la fase, cada icono
  // hierve por su cuenta y el conjunto se lee como algo dibujado a mano.
  // El desfase es NEGATIVO para que la animación ya esté en marcha en t=0 y
  // ningún fotograma se quede sin su opacidad definitiva al cargar.
  const phase = -((boilPhaseCounter++ * 137) % BOIL_CYCLE_MS);
  const third = BOIL_CYCLE_MS / 3;

  [d, jitterPathD(d, seedBase + 11), jitterPathD(d, seedBase + 47)].forEach((frameD, i) => {
    const path = svgEl('path', {
      d: frameD, fill: 'none', stroke: 'currentColor', 'stroke-width': 3,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      class: `frame frame-${i + 1}`,
    });
    path.style.animationDuration = BOIL_CYCLE_MS + 'ms';
    path.style.animationDelay = (phase - i * third) + 'ms';
    svg.appendChild(path);
  });
  container.appendChild(svg);
  container.classList.add('icon-ready');
}

function renderAllSketchIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.dataset.iconRendered === '1') return;
    renderSketchIcon(el, el.dataset.icon, parseInt(el.dataset.size, 10) || 40);
    el.dataset.iconRendered = '1';
  });
}

/* ---------- Motor determinista ----------
   Vive en engine.js, cargado por index.html antes que este fichero. Publica
   sus funciones como globales (computeAllocation, simulatePortfolio,
   formatEUR...) y las mismas las importan las pruebas en Node, así que lo que
   se prueba es exactamente lo que se ejecuta aquí. */

/* ---------- Descarga de datos (Twelve Data — misma clave/patrón que trading-backtester) ---------- */

/* Origen de los datos de mercado.
 *
 * El navegador nunca ve la clave de la API: llama a un Cloudflare Worker
 * (worker/) que la añade desde un secreto suyo. Antes la clave iba incrustada
 * aquí y, por tanto, a la vista en un repositorio público — que es una mala
 * señal en cualquier proyecto que se mire con ojos de fintech, por muy
 * limitada que sea la clave.
 *
 * La URL del proxy vive en config.js, no aquí, para que cambiar de despliegue
 * no obligue a tocar la lógica. Se lee en cada llamada en vez de una sola vez
 * al cargar: cuesta nada y hace que el origen de los datos sea observable. */
const dataProxyUrl = () => (window.PATHFOLIO_CONFIG && window.PATHFOLIO_CONFIG.dataProxyUrl) || '';

function marketDataUrl(symbol, outputsize) {
  const proxy = dataProxyUrl();
  if (!proxy) {
    // Sin proxy no hay de dónde sacar los datos, y la alternativa sería volver
    // a incrustar una credencial en el cliente. Mejor fallar diciendo qué falta.
    throw new Error('No hay proxy de datos configurado (config.js -> dataProxyUrl). Ver worker/README.md.');
  }
  return `${proxy.replace(/\/$/, '')}?symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}`;
}

async function fetchPricesTwelveData(symbol, outputsize) {
  const url = marketDataUrl(symbol, outputsize);
  let res = await fetch(url);
  let json = await res.json();
  if (json.status === 'error' && json.code === 429) {
    await new Promise(r => setTimeout(r, 8000));
    res = await fetch(url);
    json = await res.json();
  }
  if (!res.ok || json.status === 'error') {
    throw new Error(json.message || t('error.apiStatus', { status: res.status }));
  }
  const values = Array.isArray(json.values) ? json.values : [];
  const chronological = values.slice().reverse();
  return { dates: chronological.map(v => v.datetime), closes: chronological.map(v => parseFloat(v.close)) };
}

// ticker -> promesa de {dates, closes}. Se cachea la PROMESA, no el resultado:
// si se cacheara el resultado, dos peticiones simultáneas del mismo símbolo
// fallarían las dos en la comprobación y lo descargarían dos veces, gastando
// el doble de cuota en un plan que va muy justo.
const tickerSeriesCache = new Map();
function fetchTickerSeries(ticker) {
  if (!tickerSeriesCache.has(ticker)) {
    const p = fetchPricesTwelveData(ticker, 2500).catch(err => {
      tickerSeriesCache.delete(ticker); // un fallo no debe quedar cacheado para siempre
      throw new Error(`No se pudo descargar ${ticker}: ${err.message}`);
    });
    tickerSeriesCache.set(ticker, p);
  }
  return tickerSeriesCache.get(ticker);
}

// El plan gratuito de Twelve Data permite 8 peticiones por minuto. Con
// selección múltiple se pueden llegar a pedir 10 tickers de una tacada, así
// que se lanzan por tandas en vez de todos a la vez: reduce los 429 y, si aun
// así llega alguno, fetchPricesTwelveData ya reintenta tras esperar.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i], i);
      }
    })
  );
  return results;
}

/* ---------- Ayudantes SVG y animación ---------- */

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cuenta ascendente para las cifras destacadas. Respeta prefers-reduced-motion
// saltando directamente al valor final.
function animateNumber(el, to, formatter, ms = 900) {
  if (!el) return;
  const from = 0;
  if (prefersReducedMotion()) { el.textContent = formatter(to); return; }
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function buildTooltip(tooltipEl, dateLabel, rows) {
  tooltipEl.textContent = '';
  const dateDiv = document.createElement('div');
  dateDiv.className = 'tt-date';
  dateDiv.textContent = dateLabel;
  tooltipEl.appendChild(dateDiv);
  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'tt-row';
    const key = document.createElement('span');
    key.className = 'tt-key';
    key.style.background = r.color;
    const name = document.createElement('span');
    name.className = 'tt-name';
    name.textContent = r.name;
    const val = document.createElement('span');
    val.className = 'tt-val';
    val.textContent = r.value;
    row.append(key, name, val);
    tooltipEl.appendChild(row);
  });
}

function buildLegend(container, items) {
  container.textContent = '';
  items.forEach(item => {
    const el = document.createElement('span');
    el.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = item.color;
    const label = document.createElement('span');
    label.textContent = item.name;
    el.append(swatch, label);
    container.appendChild(el);
  });
}

/* Parte-sobre-el-todo, con forma de donut por la estética pedida. Técnica
   clásica de stroke-dasharray/stroke-dashoffset sobre un círculo de trazo
   grueso. Va siempre acompañado de una leyenda con las etiquetas de
   porcentaje directas (los arcos son demasiado finos para meter texto
   dentro), así que identidad y valor quedan accesibles sin pasar el ratón.
   Los segmentos se animan desde su estado ANTERIOR (no desde cero) para que
   la vista previa en vivo se reacomode con suavidad cada vez que respondes,
   en lugar de dar un salto. */
function renderDonut(svg, segments, { centerLabel = null, tooltipEl = null, amount = null } = {}) {
  centerLabel = centerLabel || t('donut.center');
  const rect = svg.getBoundingClientRect();
  const size = Math.max(150, Math.min(260, rect.width || 200));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const cx = size / 2, cy = size / 2, r = size * 0.355, strokeW = size * 0.155;
  const circumference = 2 * Math.PI * r;
  const gap = segments.length > 1 ? Math.min(3, circumference * 0.006) : 0;
  const prev = svg.__prevDonut || new Map();
  const next = new Map();

  svg.appendChild(svgEl('circle', { cx, cy, r, fill: 'none', stroke: 'var(--gridline)', 'stroke-width': strokeW }));

  const hoverGroup = svgEl('g', { class: 'donut-segments' });
  svg.appendChild(hoverGroup);

  let offset = 0;
  segments.forEach(seg => {
    // El hueco entre segmentos se descuenta del arco, nunca por debajo de
    // cero: un bloque de 0,5 % debe seguir viéndose como una rayita, no
    // desaparecer ni invertirse por restarle más de lo que mide.
    const full = seg.weight * circumference;
    const segLen = Math.max(circumference * 0.004, full - gap);
    const thisOffset = offset;
    const before = prev.get(seg.key) || { len: 0, offset: thisOffset };

    const arc = svgEl('circle', {
      cx, cy, r, fill: 'none', stroke: seg.color, 'stroke-width': strokeW,
      'stroke-linecap': 'butt',
      'stroke-dasharray': `${before.len} ${circumference - before.len}`,
      'stroke-dashoffset': -before.offset,
      transform: `rotate(-90 ${cx} ${cy})`,
      filter: 'url(#sketchWobbleChart)',
      class: 'donut-seg',
    });
    hoverGroup.appendChild(arc);
    requestAnimationFrame(() => {
      arc.setAttribute('stroke-dasharray', `${segLen} ${circumference - segLen}`);
      arc.setAttribute('stroke-dashoffset', -thisOffset);
    });

    if (tooltipEl) {
      // Zona de detección propia, invisible y más gruesa que el arco pintado,
      // para que apuntar a un segmento fino no sea un ejercicio de puntería.
      const hit = svgEl('circle', {
        cx, cy, r, fill: 'none', stroke: 'transparent', 'stroke-width': strokeW * 1.5,
        'stroke-dasharray': `${segLen} ${circumference - segLen}`,
        'stroke-dashoffset': -thisOffset,
        transform: `rotate(-90 ${cx} ${cy})`,
        class: 'donut-hit',
      });
      // Ratón, teclado y toque llegan al mismo sitio: en móvil no hay "pasar
      // por encima", y con teclado el donut sería inaccesible si solo
      // escuchara al puntero.
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', `${seg.name}: ${formatPctValue(seg.displayPct, 1)}`);
      const show = () => {
        svg.classList.add('has-hover');
        hoverGroup.querySelectorAll('.donut-seg').forEach(el => el.classList.remove('is-hovered'));
        arc.classList.add('is-hovered');
        showDonutTooltip(tooltipEl, seg, amount);
      };
      const hide = () => {
        svg.classList.remove('has-hover');
        arc.classList.remove('is-hovered');
        tooltipEl.hidden = true;
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
      hit.addEventListener('click', show);
      hoverGroup.appendChild(hit);
    }

    next.set(seg.key, { len: segLen, offset: thisOffset });
    offset += full;
  });
  svg.__prevDonut = next;

  const label = svgEl('text', { x: cx, y: cy - 1, 'text-anchor': 'middle', 'font-size': size * 0.1, 'font-weight': 700, fill: 'var(--text-primary)' });
  label.textContent = centerLabel;
  svg.appendChild(label);
  const sublabel = svgEl('text', { x: cx, y: cy + 15, 'text-anchor': 'middle', 'font-size': size * 0.055, fill: 'var(--text-muted)' });
  sublabel.textContent = segments.length === 1 ? t('donut.block') : t('donut.blocks', { n: segments.length });
  svg.appendChild(sublabel);
}

// El tooltip del donut no se queda en "Renta fija 40 %": desglosa qué hay
// dentro de ese 40 % y cuánto pesa cada cosa, que es justo lo que hace falta
// para entender de dónde sale el número.
function showDonutTooltip(tooltipEl, seg, amount) {
  tooltipEl.textContent = '';
  tooltipEl.hidden = false;

  const head = document.createElement('div');
  head.className = 'dt-head';
  const swatch = document.createElement('span');
  swatch.className = 'dt-swatch';
  swatch.style.background = seg.color;
  const name = document.createElement('span');
  name.className = 'dt-name';
  name.textContent = seg.name;
  const pct = document.createElement('span');
  pct.className = 'dt-pct';
  pct.textContent = formatPctValue(seg.displayPct, 1);
  head.append(swatch, name, pct);
  tooltipEl.appendChild(head);

  if (amount != null) {
    const money = document.createElement('div');
    money.className = 'dt-money';
    money.textContent = t('dt.of', { part: formatEUR(amount * seg.weight, 0), whole: formatEUR(amount, 0) });
    tooltipEl.appendChild(money);
  }

  const members = seg.members || [];
  if (members.length) {
    const list = document.createElement('div');
    list.className = 'dt-members';
    members.forEach(m => {
      const row = document.createElement('div');
      row.className = 'dt-member';
      const label = document.createElement('span');
      label.textContent = m.label + (m.ticker ? ` (${m.ticker})` : '');
      const mp = document.createElement('span');
      mp.className = 'dt-member-pct';
      mp.textContent = formatPctValue(m.displayPct, 1);
      row.append(label, mp);
      list.appendChild(row);
    });
    tooltipEl.appendChild(list);
  }
}

// Leyenda anidada: cada categoría con su porcentaje y, debajo, qué hay dentro
// y cuánto pesa cada pieza — "Renta fija 40 %: deuda pública 20 %, deuda
// corporativa 20 %". Cierra con una fila de total que deja ver que todo suma
// exactamente 100 %.
function buildDonutLegend(container, segments, { showMembers = false, amount = null } = {}) {
  container.textContent = '';
  segments.forEach(seg => {
    const row = document.createElement('div');
    row.className = 'donut-legend-row';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch dot';
    swatch.style.background = seg.color;

    const textWrap = document.createElement('span');
    textWrap.className = 'donut-legend-text';
    const nameLine = document.createElement('span');
    nameLine.className = 'donut-legend-name';
    nameLine.textContent = seg.name;
    textWrap.appendChild(nameLine);

    if (showMembers && seg.members && seg.members.length) {
      const sub = document.createElement('span');
      sub.className = 'donut-legend-members';
      seg.members.forEach(m => {
        const line = document.createElement('span');
        line.className = 'legend-member-line';
        const label = document.createElement('span');
        label.textContent = m.label;
        const mp = document.createElement('span');
        mp.className = 'legend-member-pct';
        mp.textContent = formatPctValue(m.displayPct, 1) +
          (amount != null ? ` · ${formatEUR(amount * m.weight, 0)}` : '');
        line.append(label, mp);
        sub.appendChild(line);
      });
      textWrap.appendChild(sub);
    }

    const pct = document.createElement('span');
    pct.className = 'donut-legend-pct';
    pct.textContent = formatPctValue(seg.displayPct, showMembers ? 1 : 0);
    row.append(swatch, textWrap, pct);
    container.appendChild(row);
  });

  if (showMembers) {
    const total = document.createElement('div');
    total.className = 'donut-legend-row legend-total';
    const spacer = document.createElement('span');
    spacer.className = 'legend-swatch dot is-empty';
    const label = document.createElement('span');
    label.className = 'donut-legend-text';
    label.textContent = t('legend.total');
    const pct = document.createElement('span');
    pct.className = 'donut-legend-pct';
    pct.textContent = formatPctValue(segments.reduce((s, x) => s + x.displayPct, 0), 1);
    total.append(spacer, label, pct);
    container.appendChild(total);
  }
}

function renderLineChart({ svg, tooltipEl, dates, series, yFormat, tooltipFormat }) {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(300, rect.width);
  const height = 320;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const margin = { top: 14, right: 16, bottom: 26, left: 72 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const n = dates.length;

  const allY = series.flatMap(s => s.data.filter(v => v != null));
  let yMin = Math.min(...allY), yMax = Math.max(...allY);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const pad = (yMax - yMin) * 0.08;
  yMin -= pad; yMax += pad;

  const xForIndex = i => margin.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yForValue = v => margin.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const yTicks = 4;
  for (let t = 0; t <= yTicks; t++) {
    const v = yMin + (yMax - yMin) * (t / yTicks);
    const y = yForValue(v);
    svg.appendChild(svgEl('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, stroke: 'var(--gridline)', 'stroke-width': 1 }));
    const label = svgEl('text', { x: margin.left - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-muted)' });
    label.textContent = yFormat(v);
    svg.appendChild(label);
  }
  svg.appendChild(svgEl('line', { x1: margin.left, x2: width - margin.right, y1: margin.top + innerH, y2: margin.top + innerH, stroke: 'var(--baseline)', 'stroke-width': 1 }));

  const xTickCount = Math.min(6, n);
  for (let t = 0; t < xTickCount; t++) {
    const idx = Math.round((t / (xTickCount - 1 || 1)) * (n - 1));
    const label = svgEl('text', { x: xForIndex(idx), y: height - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-muted)' });
    // (Antes había aquí un .replace() pensado para recortar un "de" del
    // formato largo en español, pero shortDate() nunca produjo ese patrón
    // — era código muerto en los dos idiomas. shortDate() ya es compacto.)
    label.textContent = shortDate(dates[idx]);
    svg.appendChild(label);
  }

  series.forEach(s => {
    let d = '';
    s.data.forEach((v, i) => {
      if (v == null) return;
      d += (d === '' ? 'M' : 'L') + xForIndex(i).toFixed(2) + ',' + yForValue(v).toFixed(2) + ' ';
    });
    const path = svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#sketchWobbleChart)' });
    svg.appendChild(path);
    // Dibujado progresivo de la línea. getTotalLength no existe en todos los
    // entornos (p. ej. jsdom en los tests), así que si falla simplemente se
    // pinta la línea entera sin animar.
    if (!prefersReducedMotion()) {
      try {
        const len = path.getTotalLength();
        if (len > 0) {
          path.style.strokeDasharray = String(len);
          path.style.strokeDashoffset = String(len);
          requestAnimationFrame(() => {
            path.style.transition = 'stroke-dashoffset 1.1s ease-out';
            path.style.strokeDashoffset = '0';
          });
        }
      } catch (e) { /* sin animación, la línea ya está dibujada */ }
    }
  });

  const crosshair = svgEl('line', { x1: 0, x2: 0, y1: margin.top, y2: margin.top + innerH, stroke: 'var(--baseline)', 'stroke-width': 1, visibility: 'hidden' });
  svg.appendChild(crosshair);
  const dots = series.map(s => {
    const d = svgEl('circle', { r: 4, fill: s.color, stroke: 'var(--surface-1)', 'stroke-width': 2, visibility: 'hidden' });
    svg.appendChild(d);
    return d;
  });
  const hitRect = svgEl('rect', { x: margin.left, y: margin.top, width: Math.max(innerW, 0), height: Math.max(innerH, 0), fill: 'transparent' });
  svg.appendChild(hitRect);

  function handleMove(evt) {
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width === 0) return;
    const px = (evt.clientX - svgRect.left) * (width / svgRect.width);
    let idx = Math.round(((px - margin.left) / innerW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    const x = xForIndex(idx);
    crosshair.setAttribute('x1', x);
    crosshair.setAttribute('x2', x);
    crosshair.setAttribute('visibility', 'visible');

    const rows = [];
    series.forEach((s, si) => {
      const v = s.data[idx];
      if (v == null) { dots[si].setAttribute('visibility', 'hidden'); return; }
      dots[si].setAttribute('cx', x);
      dots[si].setAttribute('cy', yForValue(v));
      dots[si].setAttribute('visibility', 'visible');
      rows.push({ name: s.name, color: s.color, value: (tooltipFormat || yFormat)(v) });
    });

    if (tooltipEl) {
      tooltipEl.hidden = false;
      const wrapRect = svg.parentElement.getBoundingClientRect();
      tooltipEl.style.left = (svgRect.left - wrapRect.left + x) + 'px';
      tooltipEl.style.top = (svgRect.top - wrapRect.top + margin.top) + 'px';
      buildTooltip(tooltipEl, shortDate(dates[idx]), rows);
    }
  }
  function handleLeave() {
    crosshair.setAttribute('visibility', 'hidden');
    dots.forEach(d => d.setAttribute('visibility', 'hidden'));
    if (tooltipEl) tooltipEl.hidden = true;
  }
  hitRect.addEventListener('pointermove', handleMove);
  hitRect.addEventListener('pointerleave', handleLeave);
}

/* ---------- Máquina de estados del cuestionario ---------- */

const QUESTIONS = [
  'age', 'risk', 'horizon',
  'rvKnowledge', 'rvLesson',
  'indexKnowledge', 'indexLesson', 'equityIndex', 'equityTiltAsk', 'equityTilt',
  'bondsKnowledge', 'bondsLesson', 'bondsChoice',
  'realEstateKnowledge', 'realEstateLesson', 'realEstateChoice', 'realEstateType',
  'peKnowledge', 'peLesson', 'peChoice',
  'altKnowledge', 'altLesson', 'altChoice', 'altType',
  'style', 'volatility', 'amount',
];

// Cada entrada decide, a partir de las respuestas ACTUALES, si ese paso debe
// mostrarse siquiera; un paso sin entrada se muestra siempre. Dos formas
// reutilizadas por todo el cuestionario: una diapositiva de lección solo
// aparece si su pregunta de conocimiento NO se respondió "sí" (quien ya sabe
// se la salta), y una pregunta de subtipo solo aparece si su pregunta de
// entrada se respondió "sí" (preguntar "¿cuál?" no tiene sentido si acabas
// de decir que no quieres eso).
const CONDITIONAL_STEPS = {
  rvLesson: a => a.rvKnowledge !== 'si',
  indexLesson: a => a.indexKnowledge !== 'si',
  bondsLesson: a => a.bondsKnowledge !== 'si',
  realEstateLesson: a => a.realEstateKnowledge !== 'si',
  realEstateType: a => a.realEstateChoice === 'si',
  peLesson: a => a.peKnowledge !== 'si',
  altLesson: a => a.altKnowledge !== 'si',
  equityTilt: a => a.equityTiltAsk === 'si',
  altType: a => a.altChoice === 'si',
};

// Preguntas de selección múltiple: acumulan un array y avanzan con el botón
// "Continuar" en vez de al primer clic.
const MULTI_QUESTIONS = new Set(['equityIndex', 'equityTilt', 'bondsChoice', 'realEstateType', 'altType']);

function freshAnswers() {
  return {
    age: null, risk: 50, horizon: null,
    rvKnowledge: null, indexKnowledge: null, equityIndex: [],
    equityTiltAsk: null, equityTilt: [],
    bondsKnowledge: null, bondsChoice: [],
    // Peso relativo de cada instrumento dentro de su bloque. Sin esto, elegir
    // varios repartía siempre a partes iguales y no había forma de pedir "más
    // tecnología" o "más oro que bitcoin": la elección múltiple existía, la
    // proporción no.
    mix: {},
    realEstateKnowledge: null, realEstateChoice: null, realEstateType: [],
    peKnowledge: null, peChoice: null,
    altKnowledge: null, altChoice: null, altType: [],
    style: null, volatility: null, amount: 1000, monthly: 0,
  };
}
let answers = freshAnswers();
let currentStep = 0;

const screenLanding = document.getElementById('screen-landing');
const screenQuiz = document.getElementById('screen-quiz');
const screenDashboard = document.getElementById('screen-dashboard');
const quizChrome = document.getElementById('quizChrome');
const progressBarFill = document.getElementById('progressBarFill');
const progressLabel = document.getElementById('progressLabel');
const backBtn = document.getElementById('backBtn');
const startBtn = document.getElementById('startBtn');
const seeResultsBtn = document.getElementById('seeResultsBtn');
const amountInput = document.getElementById('amountInput');
const monthlyInput = document.getElementById('monthlyInput');
const restartBtn = document.getElementById('restartBtn');
const retryRow = document.getElementById('retryRow');
const previewDonut = document.getElementById('previewDonut');
const previewLegend = document.getElementById('previewLegend');
const previewRiskLabel = document.getElementById('previewRiskLabel');

function shouldShowStep(index) {
  const predicate = CONDITIONAL_STEPS[QUESTIONS[index]];
  return !predicate || predicate(answers);
}
function effectiveQuestionCount() {
  return QUESTIONS.filter((q, i) => shouldShowStep(i)).length;
}
function effectivePosition(step) {
  return QUESTIONS.slice(0, step + 1).filter((q, i) => shouldShowStep(i)).length;
}

function renderProgress() {
  const total = effectiveQuestionCount();
  const pos = effectivePosition(currentStep);
  progressBarFill.style.width = Math.round((pos / total) * 100) + '%';
  progressLabel.textContent = t('progress', { pos, total });
  backBtn.hidden = pos <= 1;
}

/* "Hilar las cosas": una frase corta arriba de algunas pantallas que nombra
   la respuesta recién dada antes de preguntar lo siguiente, para que el flujo
   se lea como una conversación y no como un montón de campos sueltos. */
const tierLabel = tier => t('tier.' + tier);
const horizonPhrase = h => t('horizon.' + h);
const RISK_PHRASE = v => t('riskPhrase.' + (v <= 20 ? 1 : v <= 40 ? 2 : v <= 60 ? 3 : v <= 80 ? 4 : 5));
const listPhrase = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
const labelsOf = (keys, map) => (keys || []).map(k => map[k] && localized(map[k]).label).filter(Boolean);

const CONNECTORS = {
  risk: a => a.age ? t('connector.risk', { age: a.age }) : null,
  rvKnowledge: a => a.horizon ? t('connector.rvKnowledge', { horizon: horizonPhrase(a.horizon) }) : null,
  indexKnowledge: () => t('connector.indexKnowledge'),
  equityIndex: () => t('connector.equityIndex'),
  equityTiltAsk: () => t('connector.equityTiltAsk'),
  bondsKnowledge: a => {
    const picks = labelsOf(a.equityIndex, ALLOCATIONS ? ALLOCATIONS.equityIndexOptions : {});
    return picks.length ? t('connector.bondsKnowledge', { picks: listPhrase(picks) }) : null;
  },
  bondsChoice: () => t('connector.bondsChoice'),
  realEstateKnowledge: () => t('connector.realEstateKnowledge'),
  realEstateType: () => t('connector.realEstateType'),
  peKnowledge: () => t('connector.peKnowledge'),
  altKnowledge: () => t('connector.altKnowledge'),
  altType: () => t('connector.altType'),
  volatility: a => t('connector.volatility', { risk: RISK_PHRASE(a.risk) }),
  amount: () => t('connector.amount'),
};


// Al volver atrás hay que repintar lo que ya estaba elegido, tanto en
// selección simple como múltiple.
function syncSelections(qKey) {
  const container = document.querySelector(`[data-options="${qKey}"]`);
  if (!container) return;
  const value = answers[qKey];
  const selected = Array.isArray(value) ? value : (value == null ? [] : [value]);
  container.querySelectorAll('.option-card').forEach(el => {
    el.classList.toggle('selected', selected.includes(el.dataset.value));
  });
  syncMultiButton(qKey);
}

/* Reparto dentro de un bloque. Elegir varios instrumentos repartía siempre a
   partes iguales, así que no había forma de decir "quiero algo más de
   tecnología" o "más oro que bitcoin": la elección múltiple existía pero la
   proporción no. Cada elegido recibe un peso relativo del 1 al 10 y el
   porcentaje real sale de dividir por la suma — así no hace falta que cuadren
   a 100 a mano, que es donde este tipo de control se vuelve incómodo. */
function renderMixPanel(qKey) {
  const panel = document.querySelector(`[data-mix="${qKey}"]`);
  if (!panel) return;
  const selected = answers[qKey] || [];
  const optionsEl = document.querySelector(`[data-options="${qKey}"]`);
  const labelOf = key => {
    const card = optionsEl && optionsEl.querySelector(`.option-card[data-value="${key}"] .option-label`);
    return card ? card.textContent : key;
  };

  panel.hidden = selected.length < 2;
  if (panel.hidden) { panel.textContent = ''; return; }

  const total = selected.reduce((a, k) => a + (answers.mix[k] || 5), 0) || 1;
  panel.textContent = '';
  const title = document.createElement('p');
  title.className = 'mix-title';
  title.textContent = t('mix.title');
  panel.appendChild(title);

  selected.forEach(key => {
    const value = answers.mix[key] || 5;
    const row = document.createElement('div');
    row.className = 'mix-row';

    const name = document.createElement('span');
    name.className = 'mix-name';
    name.textContent = labelOf(key);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1'; slider.max = '10'; slider.step = '1';
    slider.value = String(value);
    slider.setAttribute('aria-label', t('mix.aria', { name: labelOf(key) }));

    const pct = document.createElement('span');
    pct.className = 'mix-pct';
    pct.textContent = formatPctValue((value / total) * 100, 0);

    slider.addEventListener('input', () => {
      answers.mix[key] = parseInt(slider.value, 10);
      renderMixPanel(qKey);
      renderPreview();
      syncUrl();
    });

    row.append(name, slider, pct);
    panel.appendChild(row);
  });
}

function syncMultiButton(qKey) {
  if (!MULTI_QUESTIONS.has(qKey)) return;
  const btn = document.querySelector(`[data-advance="${qKey}"]`);
  if (!btn) return;
  const count = (answers[qKey] || []).length;
  btn.disabled = count === 0;
  btn.textContent = count === 0 ? t('multi.none')
    : count === 1 ? t('multi.one') : t('multi.many', { n: count });
}

function showStep(step) {
  currentStep = step;
  QUESTIONS.forEach((q, i) => {
    document.getElementById('q-' + q).hidden = i !== step;
  });
  const qKey = QUESTIONS[step];
  const connectorEl = document.querySelector(`#q-${qKey} [data-connector]`);
  if (connectorEl) {
    const text = CONNECTORS[qKey] ? CONNECTORS[qKey](answers) : null;
    connectorEl.hidden = !text;
    connectorEl.textContent = text || '';
  }
  syncSelections(qKey);
  updateCloudForQuestion(qKey);
  renderProgress();
  renderPreview();

  // Con lector de pantalla, cambiar de pregunta sin más deja al usuario sin
  // saber que la pantalla ha cambiado: el foco se queda donde estaba (en un
  // botón que ya no existe). Llevar el foco al enunciado nuevo hace que se
  // lea la pregunta y sitúa el recorrido por teclado en el sitio correcto.
  const heading = document.querySelector(`#q-${qKey} h2`);
  if (heading && !screenQuiz.hidden) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

function nextStep() {
  let next = currentStep + 1;
  while (next < QUESTIONS.length && !shouldShowStep(next)) next += 1;
  if (next < QUESTIONS.length) showStep(next);
}

function prevStep() {
  let prev = currentStep - 1;
  while (prev >= 0 && !shouldShowStep(prev)) prev -= 1;
  if (prev >= 0) showStep(prev);
}

function goToQuiz() {
  screenLanding.hidden = true;
  screenQuiz.hidden = false;
  quizChrome.hidden = false;
  showStep(0);
}

function chooseOption(question, value, btn) {
  if (MULTI_QUESTIONS.has(question)) {
    const list = answers[question] || [];
    answers[question] = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    btn.classList.toggle('selected');
    syncMultiButton(question);
    renderMixPanel(question);
    renderPreview();
    syncUrl();
    return;
  }
  answers[question] = value;
  document.querySelectorAll(`[data-options="${question}"] .option-card`).forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  renderPreview();
  syncUrl();
  setTimeout(nextStep, 160);
}

document.querySelectorAll('.option-card[data-value]').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('[data-options]');
    if (parent) chooseOption(parent.dataset.options, btn.dataset.value, btn);
  });
});

/* Sliders continuos con respuesta visual en vivo */
const riskSlider = document.getElementById('riskSlider');
const riskFillStability = document.getElementById('riskFillStability');
const riskFillGrowth = document.getElementById('riskFillGrowth');
const riskReadout = document.getElementById('riskReadout');
const volatilitySlider = document.getElementById('volatilitySlider');
const volatilityReadout = document.getElementById('volatilityReadout');



function updateRiskPreview() {
  const v = parseInt(riskSlider.value, 10);
  answers.risk = v;
  riskFillGrowth.style.width = v + '%';
  riskFillStability.style.width = (100 - v) + '%';
  riskReadout.textContent = t('slider.risk', { v, tier: tierLabel(sliderToTier(v)) });
  renderPreview();
  syncUrl();
}
riskSlider.addEventListener('input', updateRiskPreview);

// El texto del slider se pinta siempre, pero la respuesta solo se registra
// cuando la persona lo toca o confirma la pregunta — ver la nota sobre
// volatility == null en computeEffectiveRisk().
function renderVolatilityReadout() {
  const v = parseInt(volatilitySlider.value, 10);
  volatilityReadout.textContent = t('slider.volatility', { v, phrase: RISK_PHRASE(v) });
}
function commitVolatility() {
  answers.volatility = parseInt(volatilitySlider.value, 10);
  renderVolatilityReadout();
  renderPreview();
  syncUrl();
}
volatilitySlider.addEventListener('input', commitVolatility);

document.querySelectorAll('[data-advance]').forEach(btn => {
  btn.addEventListener('click', () => {
    // Confirmar la pregunta cuenta como responderla, aunque no se haya
    // movido el slider de su posición inicial.
    if (btn.dataset.advance === 'volatility') commitVolatility();
    if (btn.dataset.advance === 'risk') answers.risk = parseInt(riskSlider.value, 10);
    nextStep();
  });
});
backBtn.addEventListener('click', () => prevStep());

startBtn.addEventListener('click', goToQuiz);
seeResultsBtn.addEventListener('click', () => {
  answers.amount = Math.max(100, parseFloat(amountInput.value) || 1000);
  answers.monthly = Math.max(0, parseFloat(monthlyInput.value) || 0);
  syncUrl();
  runDashboard();
});
amountInput.addEventListener('input', () => {
  answers.amount = Math.max(0, parseFloat(amountInput.value) || 0);
  renderPreview();
  syncUrl();
});
restartBtn.addEventListener('click', () => {
  screenDashboard.hidden = true;
  document.querySelectorAll('.option-card.selected').forEach(el => el.classList.remove('selected'));
  answers = freshAnswers();
  riskSlider.value = 50; volatilitySlider.value = 50;
  amountInput.value = 1000; monthlyInput.value = 0;
  updateRiskPreview(); renderVolatilityReadout();
  if (previewDonut) previewDonut.__prevDonut = null;
  syncUrl();
  goToQuiz();
});

/* Vista previa en vivo: la misma cartera que verás al final, recalculada con
   cada respuesta, para que se vea cómo se va construyendo el donut en lugar
   de aparecer de golpe al terminar. */
// El catálogo del HTML no se expone; para restaurar el texto de un botón tras
// un mensaje temporal se relee del propio atributo.
function getCatalogText(key) {
  const el = document.querySelector(`[data-i18n="${key}"]`);
  return el ? el.textContent : '';
}

function renderPreview() {
  if (!ALLOCATIONS || !previewDonut) return;
  const result = computeAllocation(answers, ALLOCATIONS);
  result.segments.forEach(seg => { seg.name = t('cat.' + seg.key); });
  renderDonut(previewDonut, result.segments, { centerLabel: t('preview.center') });
  buildDonutLegend(previewLegend, result.segments);
  previewRiskLabel.textContent = t('preview.risk', { tier: tierLabel(result.effectiveRisk) });
}

/* ---------- Estado en la URL ----------
   Hasta ahora, recargar la página tiraba todas las respuestas a la basura.
   Serializando lo respondido en el hash se arreglan dos cosas de golpe:
   recargar (o compartir el enlace) reconstruye la misma cartera, y puedes
   enseñarle a alguien TU resultado concreto en vez de decirle "entra y
   contesta lo mismo que yo". Solo van las respuestas, que ya son públicas por
   naturaleza: no hay nada personal que filtrar. */

const URL_KEYS = ['age', 'risk', 'horizon', 'rvKnowledge', 'indexKnowledge', 'equityIndex',
  'bondsKnowledge', 'bondsChoice', 'realEstateKnowledge', 'realEstateChoice', 'realEstateType',
  'peKnowledge', 'peChoice', 'altKnowledge', 'altChoice', 'altType',
  'equityTiltAsk', 'equityTilt', 'style', 'volatility', 'amount', 'monthly'];

function encodeAnswers(a) {
  const parts = [];
  // El reparto entre instrumentos también forma parte de "tu" cartera, así
  // que viaja en el enlace: sin él, compartirlo devolvería otra distinta.
  const mixKeys = Object.keys(a.mix || {}).filter(k => a.mix[k] && a.mix[k] !== 5);
  if (mixKeys.length) parts.push('mix=' + encodeURIComponent(mixKeys.map(k => `${k}:${a.mix[k]}`).join(',')));
  for (const k of URL_KEYS) {
    const v = a[k];
    if (v == null || (Array.isArray(v) && !v.length)) continue;
    parts.push(`${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`);
  }
  return parts.join('&');
}

// Todo lo que entra por la URL es texto de fuera, así que se valida contra las
// opciones que existen de verdad: una clave inventada se ignora en vez de
// colarse hasta el motor.
function decodeAnswers(hash) {
  const out = freshAnswers();
  const params = new URLSearchParams((hash || '').replace(/^#/, ''));
  const validOptions = key => {
    const el = document.querySelector(`[data-options="${key}"]`);
    return el ? [...el.querySelectorAll('.option-card')].map(b => b.dataset.value) : null;
  };
  let seen = 0;
  if (params.has('mix')) {
    for (const pair of params.get('mix').split(',')) {
      const [key, raw] = pair.split(':');
      const n = parseInt(raw, 10);
      if (key && Number.isFinite(n) && n >= 1 && n <= 10) { out.mix[key] = n; seen++; }
    }
  }
  for (const k of URL_KEYS) {
    if (!params.has(k)) continue;
    const raw = params.get(k);
    if (k === 'risk' || k === 'volatility') {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 100) { out[k] = n; seen++; }
    } else if (k === 'amount' || k === 'monthly') {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1e9) { out[k] = n; seen++; }
    } else {
      const allowed = validOptions(k);
      if (!allowed) continue;
      if (MULTI_QUESTIONS.has(k)) {
        const picked = raw.split(',').filter(v => allowed.includes(v));
        if (picked.length) { out[k] = picked; seen++; }
      } else if (allowed.includes(raw)) {
        out[k] = raw; seen++;
      }
    }
  }
  return { answers: out, seen };
}

function syncUrl() {
  const encoded = encodeAnswers(answers);
  history.replaceState(null, '', encoded ? '#' + encoded : location.pathname);
}

/* ---------- Nubes que caen ----------
   Nubes pequeñas que caen por los márgenes izquierdo y derecho, como mucho
   MAX_CLOUDS a la vez y siempre con datos del tema de la pregunta que tengas
   en pantalla. Al cambiar de pregunta se limpian las que quedaban, para que
   nunca veas un dato de un tema que ya has dejado atrás. Están colapsadas
   (solo el icono) por defecto: al hacer clic se paran y se abren. */

const SCREEN_TO_TOPIC = {
  age: 'interesCompuesto', risk: 'volatilidad', horizon: 'diversificacion',
  rvKnowledge: 'rentaVariable', rvLesson: 'rentaVariable',
  indexKnowledge: 'indices', indexLesson: 'indices', equityIndex: 'indices',
  bondsKnowledge: 'bonos', bondsLesson: 'bonos', bondsChoice: 'bonos',
  realEstateKnowledge: 'realEstate', realEstateLesson: 'realEstate', realEstateChoice: 'realEstate', realEstateType: 'realEstate',
  peKnowledge: 'privateEquity', peLesson: 'privateEquity', peChoice: 'privateEquity',
  altKnowledge: 'otrasInversiones', altLesson: 'otrasInversiones', altChoice: 'otrasInversiones', altType: 'otrasInversiones',
  style: 'fondosIndexados', volatility: 'rebalanceo', amount: 'dcaVsLumpSum',
};

const MAX_CLOUDS = 3;
const CLOUD_SPAWN_MS = 4200;
const cloudLanes = { left: document.getElementById('cloudLaneLeft'), right: document.getElementById('cloudLaneRight') };
let currentCloudTopic = 'acciones';
let cloudSpawnTimer = null;
let cloudNextSide = 'left';
let cloudFactCursor = 0;

function liveCloudCount() {
  return document.querySelectorAll('.falling-cloud').length;
}

function clearClouds() {
  document.querySelectorAll('.falling-cloud').forEach(el => el.remove());
}

// Un carril con una nube abierta está "ocupado": mientras estés leyendo esa,
// no deben seguir cayéndote nubes por ese mismo lado y taparla.
function laneIsBusy(side) {
  const lane = cloudLanes[side];
  return !lane || !!lane.querySelector('.falling-cloud.expanded');
}

function spawnFallingCloud() {
  if (liveCloudCount() >= MAX_CLOUDS) return;
  const byLang = CLOUD_FACTS && (CLOUD_FACTS.facts[getLang()] || CLOUD_FACTS.facts.es);
  const pool = (byLang && byLang[currentCloudTopic]) || [];
  if (!pool.length) return;

  // Si el lado que toca está ocupado se prueba el otro; si lo están los dos,
  // no se genera nada hasta que se cierre alguna.
  let side = cloudNextSide;
  if (laneIsBusy(side)) side = side === 'left' ? 'right' : 'left';
  if (laneIsBusy(side)) return;
  const lane = cloudLanes[side];
  cloudNextSide = side === 'left' ? 'right' : 'left';
  if (!lane) return;

  const fact = pool[cloudFactCursor % pool.length];
  cloudFactCursor += 1;

  // Un poco de variación para que no parezca una sola columna cayendo.
  const duration = 15000 + Math.random() * 8000;
  const drift = Math.round(Math.random() * 26);
  const scale = 0.85 + Math.random() * 0.3;

  const el = document.createElement('div');
  el.className = 'falling-cloud';
  el.style.animationDuration = duration + 'ms';
  el.style.setProperty('--cloud-drift', drift + 'px');
  el.style.setProperty('--cloud-scale', scale.toFixed(2));
  el.innerHTML =
    '<span class="cloud-shape sketch-icon-slot" data-icon="cloud" data-size="58"></span>' +
    '<div class="cloud-bubble"><p></p></div>';
  el.querySelector('.cloud-bubble p').textContent = fact;
  el.addEventListener('click', () => {
    const expanded = el.classList.toggle('expanded');
    el.classList.toggle('paused', expanded);
  });
  el.addEventListener('animationend', () => el.remove());
  lane.appendChild(el);
  renderAllSketchIcons(el);
}

function startCloudCycle() {
  if (cloudSpawnTimer) return;
  spawnFallingCloud();
  cloudSpawnTimer = setInterval(spawnFallingCloud, CLOUD_SPAWN_MS);
}

function updateCloudForQuestion(questionKey) {
  const topic = SCREEN_TO_TOPIC[questionKey] || 'acciones';
  if (topic === currentCloudTopic) return;
  currentCloudTopic = topic;
  cloudFactCursor = 0;
  clearClouds();
  spawnFallingCloud();
}

/* ---------- Dashboard ---------- */

const dashHeadline = document.getElementById('dashHeadline');
const dashProfileTag = document.getElementById('dashProfileTag');
const capNotice = document.getElementById('capNotice');
const volNotice = document.getElementById('volNotice');
const ageNotice = document.getElementById('ageNotice');
const tiltNotice = document.getElementById('tiltNotice');
const altNotice = document.getElementById('altNotice');
const peNotice = document.getElementById('peNotice');
const allocationDonut = document.getElementById('allocationDonut');
const donutLegend = document.getElementById('donutLegend');
const donutTooltip = document.getElementById('donutTooltip');
const narrativeList = document.getElementById('narrativeList');
const driftNotice = document.getElementById('driftNotice');
const coverageNotice = document.getElementById('coverageNotice');
const comparisonTableBody = document.getElementById('comparisonTableBody');
const comparisonTakeaway = document.getElementById('comparisonTakeaway');
const inflationNotice = document.getElementById('inflationNotice');
const fxNotice = document.getElementById('fxNotice');
const backtestStory = document.getElementById('backtestStory');
const statGrid = document.getElementById('statGrid');
const explanationDetail = document.getElementById('explanationDetail');
const detailTableBody = document.getElementById('detailTableBody');
const layer3Toggle = document.getElementById('layer3Toggle');
const layer3Body = document.getElementById('layer3Body');

document.getElementById('retryBtn').addEventListener('click', () => {
  backtestStory.textContent = t('loading');
  retryRow.hidden = true;
  runDashboard();
});

layer3Toggle.addEventListener('click', () => {
  const expanded = layer3Toggle.getAttribute('aria-expanded') === 'true';
  layer3Toggle.setAttribute('aria-expanded', String(!expanded));
  layer3Body.hidden = expanded;
});


/* La respuesta real a "explícamelo todo": la cadena completa de cómo se llegó
   a cada porcentaje, con TUS números. Vive aquí y no en el motor porque es
   presentación: el motor solo produce cifras, esto las cuenta. */
function buildAllocationNarrative(result, answers, allocations) {
  const steps = [];
  const base = result.baseWeights;
  const tilted = result.tiltedWeights;
  const w = result.weights;
  const hasAmount = answers.amount > 0;
  const money = v => hasAmount ? ` (${formatEUR(answers.amount * v, 0)})` : '';
  const score = Math.round(result.riskScore);

  const caps = [];
  if (result.wasCappedByHorizon) caps.push(t('narr.cap.horizon'));
  if (result.wasCappedByVolatility) caps.push(t('narr.cap.volatility'));
  if (result.wasCappedByAge) caps.push(t('narr.cap.age'));
  steps.push({
    title: t('narr.profile.title', { tier: tierLabel(result.effectiveRisk) }),
    text: caps.length
      ? t('narr.profile.capped', { stated: answers.risk, caps: listPhrase(caps), score, tier: result.effectiveRisk })
      : t('narr.profile.free', { stated: answers.risk, vol: answers.volatility, score, tier: result.effectiveRisk }),
  });

  const basePcts = displayPercents([base.equities, base.bonds, base.cash], 1);
  steps.push({
    title: t('narr.base.title'),
    text: t('narr.base.text', { score, equities: formatPctValue(basePcts[0]), bonds: formatPctValue(basePcts[1]), cash: formatPctValue(basePcts[2]) }),
  });

  const eqNames = listPhrase(result.equityPicks.map(p => p.label));
  const bondNames = listPhrase(result.bondsPicks.map(p => p.label));
  if (result.wasTilted) {
    steps.push({
      title: t('narr.tilt.title'),
      text: t('narr.tilt.text', {
        equity: eqNames, bonds: bondNames,
        dir: t(tilted.equities < base.equities ? 'narr.tilt.down' : 'narr.tilt.up'),
        from: formatPct(base.equities, 1), to: formatPct(tilted.equities, 1), bondsTo: formatPct(tilted.bonds, 1),
      }),
    });
  } else {
    steps.push({ title: t('narr.noTilt.title'), text: t('narr.noTilt.text', { equity: eqNames, bonds: bondNames }) });
  }

  let running = tilted.equities;
  const sleeve = (key, weight, titleKey, textKey, extra) => {
    if (weight <= 0) return;
    const after = running - weight;
    steps.push({
      title: t(titleKey),
      text: t(textKey, { score, pct: formatPct(weight, 1), money: money(weight),
                         from: formatPct(running, 1), to: formatPct(after, 1), ...extra }),
    });
    running = after;
  };
  sleeve('realEstate', w.realEstate, 'narr.re.title', 'narr.re.text',
    { frac: formatPct(interpolateCurve(allocations.realEstateFractionCurve, result.riskScore, 'fraction'), 0) });
  sleeve('alternative', w.alternative, 'narr.alt.title', 'narr.alt.text',
    { frac: formatPct(interpolateCurve(allocations.alternativeFractionCurve, result.riskScore, 'fraction'), 0),
      picks: listPhrase(result.altPicks.map(p => p.label)) });
  sleeve('privateEquity', w.privateEquity, 'narr.pe.title', 'narr.pe.text',
    { frac: formatPct(interpolateCurve(allocations.privateEquityFractionCurve, result.riskScore, 'fraction'), 0),
      amount: formatEUR(answers.amount, 0), min: formatEUR(allocations.privateEquityMinAmount, 0),
      minScore: allocations.privateEquityMinScore });

  result.segments.forEach(seg => {
    if (!seg.members || seg.members.length < 2) return;
    steps.push({
      title: t('narr.inside.title', { pct: formatPctValue(seg.displayPct, 1), name: seg.name.toLowerCase() }),
      text: t('narr.inside.text', { n: seg.members.length, list: seg.members
        .map(m => `${m.label} ${formatPctValue(m.displayPct, 1)}${hasAmount ? ` (${formatEUR(answers.amount * m.weight, 0)})` : ''}`)
        .join(', ') }),
    });
  });

  steps.push({
    title: t('narr.final.title'),
    text: result.segments.map(s => `${s.name} ${formatPctValue(s.displayPct, 1)}${money(s.weight)}`).join(' · ')
      + t('narr.final.sum', { total: formatPctValue(result.segments.reduce((x, s) => x + s.displayPct, 0), 1) }),
  });
  return steps;
}

function buildNarrative(container, steps) {
  container.textContent = '';
  steps.forEach((s, i) => {
    const item = document.createElement('li');
    item.className = 'narrative-step';
    const num = document.createElement('span');
    num.className = 'narrative-num';
    num.textContent = String(i + 1);
    const body = document.createElement('div');
    body.className = 'narrative-body';
    const title = document.createElement('strong');
    title.textContent = s.title;
    const text = document.createElement('p');
    text.textContent = s.text;
    body.append(title, text);
    item.append(num, body);
    container.appendChild(item);
  });
}

function buildStatTiles(container, tiles) {
  container.textContent = '';
  tiles.forEach(t => {
    const cell = document.createElement('div');
    cell.className = 'stat-tile';
    const label = document.createElement('span');
    label.className = 'stat-label';
    label.textContent = t.label;
    const value = document.createElement('strong');
    value.className = 'stat-value';
    if (t.tone) value.classList.add('tone-' + t.tone);
    value.textContent = t.animate ? t.format(0) : t.text;
    const note = document.createElement('span');
    note.className = 'stat-note';
    note.textContent = t.note || '';
    cell.append(label, value, note);
    container.appendChild(cell);
    if (t.animate) animateNumber(value, t.value, t.format);
  });
}

async function runDashboard() {
  screenQuiz.hidden = true;
  quizChrome.hidden = true;
  screenDashboard.hidden = false;
  backtestStory.textContent = t('loading');
  statGrid.textContent = '';
  currentCloudTopic = 'dcaVsLumpSum';
  clearClouds();

  const result = computeAllocation(answers, ALLOCATIONS);
  const { effectiveRisk, weights: finalWeights, holdings, segments } = result;
  // El efectivo lo etiqueta el motor en español; aquí se traduce al idioma
  // activo antes de pintarlo en leyenda, tabla y tooltip.
  holdings.forEach(h => { if (h.key === 'cash') { h.label = t('cash.label'); h.name = t('cash.name'); } });
  // Los nombres de categoría los define el motor en español; se traducen aquí,
  // al pintar, para que el motor siga sin saber nada de idiomas.
  segments.forEach(seg => { seg.name = t('cat.' + seg.key); });
  const archetypesForLang = { explanations: ARCHETYPES.explanations[getLang()] || ARCHETYPES.explanations.es };
  const explanation = getExplanation(effectiveRisk, answers.horizon, archetypesForLang);

  dashHeadline.textContent = explanation ? explanation.headline : '—';
  dashProfileTag.textContent = t('profileTag', { tier: tierLabel(effectiveRisk) });

  capNotice.hidden = !result.wasCappedByHorizon;
  if (result.wasCappedByHorizon) capNotice.textContent = ARCHETYPES.horizonCapNotice[getLang()] || ARCHETYPES.horizonCapNotice.es;
  volNotice.hidden = !result.wasCappedByVolatility;
  if (result.wasCappedByVolatility) {
    volNotice.textContent = t('notice.volatility');
  }
  ageNotice.hidden = !result.wasCappedByAge;
  if (result.wasCappedByAge) {
    ageNotice.textContent = t('notice.age', { age: answers.age });
  }
  tiltNotice.hidden = !result.wasTilted;
  if (result.wasTilted) {
    const dir = t(finalWeights.equities < result.baseWeights.equities ? 'notice.tilt.less' : 'notice.tilt.more');
    const eqNames = listPhrase(result.equityPicks.map(p => p.label));
    const bondNames = listPhrase(result.bondsPicks.map(p => p.label));
    tiltNotice.textContent = t('notice.tilt', { equity: eqNames, bonds: bondNames, dir });
  }
  // Cada subtipo tiene su propio umbral, así que se dice exactamente cuál se
  // ha quedado fuera y por qué, en vez de excluir la familia entera de golpe.
  const rejected = [...result.realEstateRejected, ...result.altRejected];
  altNotice.hidden = rejected.length === 0;
  if (rejected.length) {
    altNotice.textContent = t('notice.rejected', {
      items: listPhrase(rejected.map(r => r.label.toLowerCase())),
      score: Math.round(result.riskScore),
      thresholds: listPhrase(rejected.map(r => t('notice.rejected.threshold', { score: r.minScore, label: r.label.toLowerCase() }))),
    });
  }
  peNotice.hidden = !result.privateEquityRequestedButExcluded;
  if (result.privateEquityRequestedButExcluded) {
    const motivos = {
      horizonte: t('notice.pe.horizonte'),
      riesgo: t('notice.pe.riesgo', { score: Math.round(result.riskScore), min: ALLOCATIONS.privateEquityMinScore }),
      capital: t('notice.pe.capital', { min: formatEUR(ALLOCATIONS.privateEquityMinAmount, 0) }),
    };
    peNotice.textContent = t('notice.pe', { reasons: listPhrase(result.privateEquityExcludedReasons.map(r => motivos[r])) });
  }

  renderDonut(allocationDonut, segments, { tooltipEl: donutTooltip, amount: answers.amount });
  buildDonutLegend(donutLegend, segments, { showMembers: true, amount: answers.amount });

  // "Explícamelo todo" es esto: la cadena completa con tus cifras, no un
  // párrafo genérico. Se muestra siempre; lo que cambia con la respuesta de
  // estilo es si el bloque técnico arranca abierto o plegado.
  buildNarrative(narrativeList, buildAllocationNarrative(result, answers, ALLOCATIONS));

  const styleDetail = answers.style === 'detalle';
  layer3Toggle.setAttribute('aria-expanded', String(styleDetail));
  layer3Body.hidden = !styleDetail;
  explanationDetail.textContent = explanation ? explanation.detail : '';

  try {
    const tickerHoldings = holdings.filter(h => h.hasRealData && h.ticker);
    const flatHoldings = holdings.filter(h => !h.hasRealData && h.key !== 'cash');

    // Todos los ETFs de esta cartera cotizan en dólares, así que hace falta el
    // tipo de cambio para expresar el resultado en euros de verdad. Se alinea
    // junto al resto para que cada día use SU cambio, no uno medio.
    const fetchedSeries = await mapWithConcurrency(
      [...tickerHoldings.map(h => h.ticker), 'EUR/USD'], 3, t => fetchTickerSeries(t)
    );
    const alignedAll = alignSeriesSet(fetchedSeries);
    const eurUsd = alignedAll.closesList[alignedAll.closesList.length - 1];
    const usdCloses = alignedAll.closesList.slice(0, -1);
    const aligned = { dates: alignedAll.dates, closesList: convertToEur(usdCloses, eurUsd) };
    const cashAnnualRate = ALLOCATIONS.instruments.cash.illustrativeAnnualRate;
    const flatAssets = flatHoldings.map(h => ({ weight: h.weight, annualRate: h.illustrativeAnnualRate }));
    const runSim = (weightsList, cashWeight, flats, rebalance, expenseRatios) => simulatePortfolio({
      dates: aligned.dates, closesList: aligned.closesList,
      weightsList, expenseRatios, cashWeight, cashAnnualRate, flatAssets: flats, rebalance,
    });

    const tickerWeights = tickerHoldings.map(h => h.weight);
    const tickerTERs = tickerHoldings.map(h => h.expenseRatio || 0);
    // La cartera "de verdad" se rebalancea una vez al año, que es la práctica
    // que la propia app enseña, y paga las comisiones de sus fondos. Las otras
    // dos simulaciones existen para poder enseñar, en euros, qué aporta
    // rebalancear y cuánto se llevan esas comisiones.
    const blend = runSim(tickerWeights, finalWeights.cash, flatAssets, 'annual', tickerTERs);
    const drifted = runSim(tickerWeights, finalWeights.cash, flatAssets, 'none', tickerTERs);
    const noFees = runSim(tickerWeights, finalWeights.cash, flatAssets, 'annual', null);

    // La misma cartera SIN convertir divisa: la diferencia es exactamente lo
    // que ha puesto (o quitado) el tipo de cambio, que para quien invierte
    // desde la zona euro en activos en dólares es una parte real del
    // resultado y no un detalle contable.
    const unhedged = simulatePortfolio({
      dates: alignedAll.dates, closesList: usdCloses,
      weightsList: tickerWeights, expenseRatios: tickerTERs,
      cashWeight: finalWeights.cash, cashAnnualRate, flatAssets, rebalance: 'annual',
    });

    const n = blend.dates.length;
    const growth = blend.portfolioEquity[n - 1];
    const finalValue = answers.amount * growth;
    const cashOnlyValue = answers.amount * blend.cashOnlyEquity[n - 1];
    const years = (new Date(blend.dates[n - 1]) - new Date(blend.dates[0])) / (365.25 * 86400000);
    const cagr = Math.pow(growth, 1 / years) - 1;
    const vol = annualizedVol(blend.dailyReturns, 252);
    const dd = maxDrawdown(blend.portfolioEquity);
    const yearly = calendarYearReturns(blend.dates, blend.portfolioEquity);
    const best = yearly.length ? yearly.reduce((a, b) => (b.ret > a.ret ? b : a)) : null;
    const worst = yearly.length ? yearly.reduce((a, b) => (b.ret < a.ret ? b : a)) : null;

    const hasMonthly = answers.monthly > 0;
    const dcaSeries = hasMonthly ? simulateDCA({ dates: blend.dates, dailyReturns: blend.dailyReturns, initialAmount: answers.amount, monthlyAmount: answers.monthly }) : null;
    const totalInvested = answers.amount + (hasMonthly ? answers.monthly * Math.round(years * 12) : 0);

    // Qué parte de la cartera lleva precios reales detrás. Si no es el 100 %,
    // la volatilidad y la caída máxima salen MÁS BAJAS de lo que serían en la
    // realidad, porque los tramos de tasa fija (crowdfunding, private equity)
    // aportan rentabilidad sin aportar ni un solo sobresalto. Decirlo importa:
    // callarlo haría que la cartera pareciese más tranquila de lo que es.
    const realDataShare = holdings.filter(h => h.hasRealData).reduce((a, h) => a + h.weight, 0);
    const estimatedShare = 1 - realDataShare;

    // La caída máxima en porcentaje no dice gran cosa hasta que la traduces a
    // dinero: ver esa cifra en euros es lo que de verdad explica por qué la
    // gente vende en el peor momento.
    let peak = blend.portfolioEquity[0], ddPeak = peak, ddTrough = peak;
    for (const v of blend.portfolioEquity) {
      if (v > peak) peak = v;
      if ((v - peak) / peak < (ddTrough - ddPeak) / ddPeak) { ddPeak = peak; ddTrough = v; }
    }
    const ddPeakEUR = answers.amount * ddPeak;
    const ddTroughEUR = answers.amount * ddTrough;

    // Lo que aporta rebalancear una vez al año, en euros, frente a no tocar
    // nada nunca. Es el mismo concepto que enseñan las nubes, ahora medido
    // sobre TU cartera en vez de contado en abstracto.
    const driftedValue = answers.amount * drifted.portfolioEquity[n - 1];
    const rebalanceEdge = finalValue - driftedValue;

    // Lo que se han llevado las comisiones: la misma cartera simulada con y
    // sin TER. Un 0,20 % anual suena a nada y en una década deja de sonar a
    // nada, que es exactamente por qué conviene verlo en euros y no en letra
    // pequeña.
    const feesPaid = answers.amount * noFees.portfolioEquity[n - 1] - finalValue;
    const fxEffect = finalValue - answers.amount * unhedged.portfolioEquity[n - 1];

    // Valor real: los mismos euros, pero expresados en poder adquisitivo de
    // hoy. Sin esto, una cifra nominal a largo plazo engaña sin querer.
    const inflation = ALLOCATIONS.assumedAnnualInflation;
    const nominalEnd = hasMonthly ? dcaSeries[n - 1] : finalValue;
    const realEnd = realValue(nominalEnd, inflation, years);
    const driftedEquityWeight = drifted.finalWeights.tickers
      .reduce((a, w, i) => a + (tickerHoldings[i].category === 'equities' ? w : 0), 0);

    backtestStory.textContent = hasMonthly
      ? t('story.monthly', { amount: formatEUR(answers.amount, 0), years: years.toFixed(1), date: shortDate(blend.dates[0]),
          monthly: formatEUR(answers.monthly, 0), final: formatEUR(dcaSeries[n - 1], 0),
          invested: formatEUR(totalInvested, 0), lump: formatEUR(finalValue, 0) })
      : t('story.plain', { amount: formatEUR(answers.amount, 0), years: years.toFixed(1), date: shortDate(blend.dates[0]),
          final: formatEUR(finalValue, 0), cash: formatEUR(cashOnlyValue, 0) });

    buildStatTiles(statGrid, [
      { label: t('stat.finalValue'), animate: true, value: hasMonthly ? dcaSeries[n - 1] : finalValue, format: v => formatEUR(v, 0), note: t('stat.finalValue.note', { amount: formatEUR(answers.amount, 0) }) },
      { label: t('stat.totalReturn'), animate: true, value: growth - 1, format: v => formatSignedPct(v, 1), tone: growth >= 1 ? 'good' : 'bad', note: t('stat.totalReturn.note', { years: years.toFixed(1) }) },
      { label: t('stat.cagr'), animate: true, value: cagr, format: v => formatSignedPct(v, 1), tone: cagr >= 0 ? 'good' : 'bad', note: t('stat.cagr.note') },
      { label: t('stat.vol'), animate: true, value: vol, format: v => formatPct(v, 1), note: t('stat.vol.note') },
      { label: t('stat.maxDD'), animate: true, value: dd, format: v => formatPct(v, 1), tone: 'bad', note: t('stat.maxDD.note', { peak: formatEUR(ddPeakEUR, 0), trough: formatEUR(ddTroughEUR, 0) }) },
      { label: t('stat.vsCash'), animate: true, value: finalValue - cashOnlyValue, format: v => formatEUR(v, 0), tone: finalValue >= cashOnlyValue ? 'good' : 'bad', note: t('stat.vsCash.note', { cash: formatEUR(cashOnlyValue, 0) }) },
      best ? { label: t('stat.bestYear'), text: `${formatSignedPct(best.ret, 1)}`, tone: 'good', note: t('stat.year.note', { year: best.year }) } : null,
      worst ? { label: t('stat.worstYear'), text: `${formatSignedPct(worst.ret, 1)}`, tone: 'bad', note: t('stat.year.note', { year: worst.year }) } : null,
      { label: t('stat.rebalance'), animate: true, value: rebalanceEdge, format: v => formatEUR(v, 0), tone: rebalanceEdge >= 0 ? 'good' : 'bad', note: t('stat.rebalance.note', { drifted: formatEUR(driftedValue, 0) }) },
      { label: t('stat.fees'), animate: true, value: -feesPaid, format: v => formatEUR(v, 0), tone: 'bad', note: t('stat.fees.note') },
      { label: t('stat.real'), animate: true, value: realEnd, format: v => formatEUR(v, 0), note: t('stat.real.note', { rate: formatPct(inflation, 0) }) },
      { label: t('stat.fx'), animate: true, value: fxEffect, format: v => formatEUR(v, 0), tone: fxEffect >= 0 ? 'good' : 'bad', note: t('stat.fx.note') },
      { label: t('stat.coverage'), animate: true, value: realDataShare, format: v => formatPct(v, 0), note: t(estimatedShare > 0.0001 ? 'stat.coverage.partial' : 'stat.coverage.full') },
    ].filter(Boolean));

    fxNotice.textContent = t('notice.fx', { dir: t(fxEffect >= 0 ? 'notice.fx.added' : 'notice.fx.removed'), amount: formatEUR(Math.abs(fxEffect), 0) });
    inflationNotice.textContent = t('notice.inflation', { rate: formatPct(inflation, 0), nominal: formatEUR(nominalEnd, 0), years: years.toFixed(1), real: formatEUR(realEnd, 0) });

    // Avisos metodológicos: los dos son cosas que inflan el resultado si no se
    // dicen, así que se dicen.
    driftNotice.textContent = t('notice.drift', { years: years.toFixed(1), weight: formatPct(driftedEquityWeight, 0),
      drifted: formatEUR(driftedValue, 0), actual: formatEUR(finalValue, 0) });
    coverageNotice.hidden = estimatedShare <= 0.0001;
    if (!coverageNotice.hidden) {
      coverageNotice.textContent = t('notice.coverage', { share: formatPct(estimatedShare, 0) });
    }

    const chartSeries = [
      { name: t(hasMonthly ? 'chart.lumpOnly' : 'chart.yours'), color: 'var(--series-1)', data: blend.portfolioEquity.map(v => answers.amount * v) },
    ];
    if (hasMonthly) chartSeries.push({ name: t('chart.monthly'), color: 'var(--series-2)', data: dcaSeries });
    chartSeries.push({ name: t('chart.cashOnly'), color: 'var(--series-3)', data: blend.cashOnlyEquity.map(v => answers.amount * v) });

    renderLineChart({
      svg: document.getElementById('pfChart'),
      tooltipEl: document.getElementById('pfTooltip'),
      dates: blend.dates,
      series: chartSeries,
      yFormat: v => formatEUR(v, 0),
      tooltipFormat: v => formatEUR(v, 0),
    });
    buildLegend(document.getElementById('pfLegend'), chartSeries.map(s => ({ name: s.name, color: s.color })));
    lastRender = { segments, amount: answers.amount, chart: { dates: blend.dates, series: chartSeries } };

    /* Comparativa: la misma ventana temporal, los mismos datos, pero
       llevándolo todo a un solo tipo de activo. Es la forma más directa de
       ver para qué sirve diversificar — normalmente la cartera no gana a la
       renta variable pura en rentabilidad, pero sí en caídas, y ahí está la
       gracia. Sin descargar nada nuevo: se reutilizan las series ya en mano. */
    const onlyOf = category => {
      const w = tickerHoldings.map(h => (h.category === category ? h.weight : 0));
      const s = w.reduce((a, b) => a + b, 0);
      return s > 0 ? w.map(x => x / s) : null;
    };
    const zeroFlats = flatAssets.map(f => ({ ...f, weight: 0 }));
    const comparisons = [{ name: t('compare.you'), sim: blend, highlight: true }];
    [['equities', t('compare.equitiesOnly')], ['bonds', t('compare.bondsOnly')]].forEach(([cat, label]) => {
      const w = onlyOf(cat);
      if (w) comparisons.push({ name: label, sim: runSim(w, 0, zeroFlats, 'annual') });
    });

    comparisonTableBody.textContent = '';
    comparisons.forEach(c => {
      const eq = c.sim.portfolioEquity;
      const g = eq[eq.length - 1];
      const row = document.createElement('tr');
      if (c.highlight) row.className = 'is-you';
      [c.name, formatEUR(answers.amount * g, 0), formatSignedPct(Math.pow(g, 1 / years) - 1, 1),
        formatPct(annualizedVol(c.sim.dailyReturns, 252), 1), formatPct(maxDrawdown(eq), 1),
      ].forEach((text, ci) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (ci >= 1) td.classList.add('num');
        row.appendChild(td);
      });
      comparisonTableBody.appendChild(row);
    });
    const cashRow = document.createElement('tr');
    [t('compare.cashOnly'), formatEUR(cashOnlyValue, 0), formatSignedPct(cashAnnualRate, 1), formatPct(0, 1), formatPct(0, 1)]
      .forEach((text, ci) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (ci >= 1) td.classList.add('num');
        cashRow.appendChild(td);
      });
    comparisonTableBody.appendChild(cashRow);

    // La lectura de la comparativa, escrita para que no haya que deducirla.
    const equityOnly = comparisons.find(c => c.name === t('compare.equitiesOnly'));
    comparisonTakeaway.textContent = equityOnly
      ? t('compare.takeaway', {
          value: formatEUR(answers.amount * equityOnly.sim.portfolioEquity[equityOnly.sim.portfolioEquity.length - 1], 0),
          theirDD: formatPct(Math.abs(maxDrawdown(equityOnly.sim.portfolioEquity)), 0), yourDD: formatPct(Math.abs(dd), 0) })
      : t('compare.takeaway.fallback');

    // Las filas con datos reales comparten la volatilidad anualizada de la
    // cartera; el efectivo y los sleeves de tasa fija (crowdfunding, private
    // equity) no tienen precios diarios reales con los que calcularla, así
    // que muestran "—" en vez de un número inventado.
    // La tabla se agrupa por categoría, con una fila de subtotal por bloque,
    // para responder directamente a "de ese 40 % de renta fija, ¿cuánto es
    // pública y cuánto corporativa?" sin tener que sumar a mano.
    detailTableBody.textContent = '';
    segments.forEach(seg => {
      const groupRow = document.createElement('tr');
      groupRow.className = 'group-row';
      const groupCells = [seg.name, seg.members.length === 1 ? t('table.instrumentCount.one') : t('table.instrumentCount', { n: seg.members.length }), '',
        formatPctValue(seg.displayPct, 1), '', formatEUR(answers.amount * seg.weight, 0)];
      groupCells.forEach((text, ci) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (ci >= 3) td.classList.add('num');
        if (ci === 0) { const sw = document.createElement('span'); sw.className = 'row-swatch'; sw.style.background = seg.color; td.prepend(sw); }
        groupRow.appendChild(td);
      });
      detailTableBody.appendChild(groupRow);

      seg.members.forEach(h => {
        const tr = document.createElement('tr');
        tr.className = 'member-row';
        const cells = [
          '', h.label, h.ticker || t('table.estimate'),
          formatPctValue(h.displayPct, 1),
          h.hasRealData ? formatPct(vol, 1) : '—',
          h.expenseRatio == null ? '—' : formatPct(h.expenseRatio, 2),
        ];
        cells.forEach((text, ci) => {
          const td = document.createElement('td');
          td.textContent = text;
          if (ci >= 3) td.classList.add('num');
          if (ci === 2 && !h.hasRealData) td.classList.add('estimated');
          tr.appendChild(td);
        });
        detailTableBody.appendChild(tr);
      });
    });
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    [t('table.total'), '', '',
      formatPctValue(segments.reduce((a, s) => a + s.displayPct, 0), 1),
      formatPct(vol, 1), formatEUR(answers.amount, 0),
    ].forEach((text, ci) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (ci >= 3) td.classList.add('num');
      totalRow.appendChild(td);
    });
    detailTableBody.appendChild(totalRow);
    retryRow.hidden = true;
  } catch (err) {
    console.error(err);
    // El mensaje nombra el ticker que ha fallado en vez de un "algo ha ido
    // mal" genérico, y ofrece reintentar: con el plan gratuito (8 peticiones
    // por minuto) y una selección amplia, el 429 es un escenario real y
    // esperable, no un caso raro.
    backtestStory.textContent = t('error.fetch', { message: err.message });
    driftNotice.textContent = '';
    coverageNotice.hidden = true;
    retryRow.hidden = false;
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Al cambiar el tamaño solo hay que volver a DIBUJAR, no volver a calcular.
// Antes esto llamaba a runDashboard() entero: recalculaba la cartera, volvía a
// pedir las series y relanzaba todas las animaciones, así que arrastrar el
// borde de la ventana hacía que las cifras se pusieran a contar desde cero una
// y otra vez. Ahora se guarda lo último dibujado y solo se repintan los
// gráficos, que son lo único que depende del ancho.
let lastRender = null;
function redrawCharts() {
  if (!lastRender) return;
  renderDonut(allocationDonut, lastRender.segments, { tooltipEl: donutTooltip, amount: lastRender.amount });
  if (lastRender.chart) {
    renderLineChart({
      svg: document.getElementById('pfChart'),
      tooltipEl: document.getElementById('pfTooltip'),
      dates: lastRender.chart.dates,
      series: lastRender.chart.series,
      yFormat: v => formatEUR(v, 0),
      tooltipFormat: v => formatEUR(v, 0),
    });
  }
}

window.addEventListener('resize', debounce(() => {
  if (!screenDashboard.hidden) redrawCharts();
  else if (!screenQuiz.hidden) renderPreview();
}, 200));

// Si la URL trae respuestas (recarga o enlace compartido), se reconstruyen y
// se va directo al resultado. Con respuestas incompletas se retoma en la
// primera pregunta que falte, en lugar de descartarlas y empezar de cero.
function restoreFromUrl() {
  const { answers: restored, seen } = decodeAnswers(location.hash);
  if (!seen) return false;
  answers = restored;
  riskSlider.value = answers.risk;
  volatilitySlider.value = answers.volatility == null ? 50 : answers.volatility;
  amountInput.value = answers.amount;
  monthlyInput.value = answers.monthly;
  updateRiskPreview();
  renderVolatilityReadout();

  const complete = ['age', 'horizon', 'style'].every(k => answers[k]) && answers.volatility != null;
  if (complete) {
    screenLanding.hidden = true;
    runDashboard();
    return true;
  }
  screenLanding.hidden = true;
  screenQuiz.hidden = false;
  quizChrome.hidden = false;
  let first = 0;
  while (first < QUESTIONS.length - 1) {
    const key = QUESTIONS[first];
    const answered = Array.isArray(answers[key]) ? answers[key].length : answers[key] != null;
    if (!shouldShowStep(first) || answered) first += 1; else break;
  }
  showStep(first);
  return true;
}

document.getElementById('shareBtn').addEventListener('click', async () => {
  const btn = document.getElementById('shareBtn');
  try {
    await navigator.clipboard.writeText(location.href);
    btn.textContent = t('share.copied');
  } catch (e) {
    btn.textContent = t('share.manual');
  }
  setTimeout(() => { btn.textContent = getCatalogText('dash.share'); }, 2600);
});

/* Cambio de idioma: recarga el catálogo, repinta el HTML marcado y vuelve a
   dibujar lo que ya estuviera en pantalla, sin perder ninguna respuesta. */
function markActiveLang() {
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === getLang()));
}

async function switchLanguage(lang) {
  await loadLanguage(lang, { dynamic: DYNAMIC_STRINGS });
  markActiveLang();
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  renderVolatilityReadout();
  updateRiskPreview();
  // Los paneles de reparto se construyen desde JS leyendo las etiquetas de las
  // tarjetas, así que hay que rehacerlos SIEMPRE, no solo cuando el
  // cuestionario está a la vista: si no, conservan los nombres del idioma
  // anterior y reaparecen al volver atrás.
  MULTI_QUESTIONS.forEach(q => renderMixPanel(q));
  if (!screenQuiz.hidden) showStep(currentStep);
  // El tooltip del donut se rellena al pasar el ratón y conserva el texto del
  // idioma en que se abrió. Ocultarlo no basta: hay que vaciarlo, porque el
  // contenido sigue en el DOM y reaparecería tal cual.
  if (donutTooltip) { donutTooltip.hidden = true; donutTooltip.textContent = ''; }
  if (!screenDashboard.hidden) runDashboard();
}

document.querySelectorAll('.lang-btn').forEach(btn =>
  btn.addEventListener('click', () => switchLanguage(btn.dataset.lang)));

renderAllSketchIcons();
loadLanguage(detectLang(), { dynamic: DYNAMIC_STRINGS })
  .then(() => {
    markActiveLang();
    updateRiskPreview();
    renderVolatilityReadout();
    return loadContent();
  })
  .then(() => restoreFromUrl());
