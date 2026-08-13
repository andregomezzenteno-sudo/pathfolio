'use strict';

/* ---------- Content (fetched once) ---------- */

let ALLOCATIONS = null;
let ARCHETYPES = null;

async function loadContent() {
  const [allocRes, archRes] = await Promise.all([
    fetch('allocations.json'),
    fetch('archetypes.json'),
  ]);
  ALLOCATIONS = await allocRes.json();
  ARCHETYPES = await archRes.json();
}

/* ---------- Deterministic allocation engine ---------- */

// Horizon can only pull the effective risk tier DOWN from what the user
// stated, never up — a short horizon objectively limits how much volatility
// you can absorb before needing the money, regardless of stated appetite.
function computeEffectiveRisk(statedRisk, horizon, allocations) {
  const cap = allocations.horizonCap[horizon];
  if (!cap) return { effectiveRisk: statedRisk, wasCapped: false };
  const order = allocations.riskOrder;
  const effectiveRisk = order.indexOf(cap) < order.indexOf(statedRisk) ? cap : statedRisk;
  return { effectiveRisk, wasCapped: effectiveRisk !== statedRisk };
}

function getAllocationWeights(effectiveRisk, allocations) {
  return allocations.buckets[effectiveRisk];
}

function getExplanation(effectiveRisk, horizon, archetypes) {
  const key = `${effectiveRisk}|${horizon}`;
  return archetypes.explanations[key] || null;
}

/* ---------- Data fetching (Twelve Data — same key/pattern as trading-backtester) ---------- */

const TWELVE_DATA_API_KEY = '861f8f9854f843bb929a3eb03b49d5d7';

async function fetchPricesTwelveData(symbol, outputsize) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${outputsize}&apikey=${TWELVE_DATA_API_KEY}`;
  let res = await fetch(url);
  let json = await res.json();
  if (json.status === 'error' && json.code === 429) {
    await new Promise(r => setTimeout(r, 8000));
    res = await fetch(url);
    json = await res.json();
  }
  if (!res.ok || json.status === 'error') {
    throw new Error(json.message || ('API error ' + res.status));
  }
  const values = Array.isArray(json.values) ? json.values : [];
  const chronological = values.slice().reverse();
  const dates = chronological.map(v => v.datetime);
  const closes = chronological.map(v => parseFloat(v.close));
  return { dates, closes };
}

/* ---------- Portfolio math ---------- */

// Two ETFs on the same exchange should share a trading calendar, but align by
// date explicitly rather than assuming matching indices — cheap insurance
// against an isolated missing bar in either series.
function alignByDate(datesA, closesA, datesB, closesB) {
  const mapB = new Map(datesB.map((d, i) => [d, closesB[i]]));
  const dates = [], a = [], b = [];
  datesA.forEach((d, i) => {
    if (mapB.has(d)) { dates.push(d); a.push(closesA[i]); b.push(mapB.get(d)); }
  });
  return { dates, equityCloses: a, bondCloses: b };
}

function blendPortfolio({ dates, equityCloses, bondCloses, weights, cashAnnualRate, barsPerYear = 252 }) {
  const n = dates.length;
  const cashPerBar = Math.pow(1 + cashAnnualRate, 1 / barsPerYear) - 1;
  const portfolioEquity = new Array(n).fill(1);
  const cashOnlyEquity = new Array(n).fill(1);
  const dailyReturns = [];
  for (let i = 1; i < n; i++) {
    const eqRet = (equityCloses[i] - equityCloses[i - 1]) / equityCloses[i - 1];
    const bondRet = (bondCloses[i] - bondCloses[i - 1]) / bondCloses[i - 1];
    const blended = weights.equities * eqRet + weights.bonds * bondRet + weights.cash * cashPerBar;
    portfolioEquity[i] = portfolioEquity[i - 1] * (1 + blended);
    cashOnlyEquity[i] = cashOnlyEquity[i - 1] * (1 + cashPerBar);
    dailyReturns.push(blended);
  }
  return { dates, portfolioEquity, cashOnlyEquity, dailyReturns };
}

function annualizedVol(rets, periodsPerYear) {
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

function maxDrawdown(equitySeries) {
  let peak = equitySeries[0], maxDD = 0;
  for (const v of equitySeries) {
    peak = Math.max(peak, v);
    maxDD = Math.min(maxDD, (v - peak) / peak);
  }
  return maxDD;
}

/* ---------- Formatting ---------- */

function formatUSD(v, decimals) {
  if (v == null || Number.isNaN(v)) return '—';
  const d = decimals != null ? decimals : (v < 1000 ? 2 : 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function formatPct(v, decimals = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return (v * 100).toFixed(decimals) + '%';
}
function shortDate(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/* ---------- SVG chart helpers ---------- */

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
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

// Part-to-whole with 3 categories -> a single horizontal stacked bar with
// direct labels (per the dataviz skill: stacked bar, categorical color, ≤3
// series is comfortable for direct labels, no legend box needed alongside).
function renderStackedBar(svg, segments) {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(280, rect.width);
  const height = 88;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const barY = 28, barH = 32;
  const gap = 2;
  let x = 0;
  segments.forEach((seg, i) => {
    const segW = seg.weight * width;
    const w = Math.max(0, segW - (i < segments.length - 1 ? gap : 0));
    svg.appendChild(svgEl('rect', {
      x, y: barY, width: w, height: barH,
      rx: 6, ry: 6, fill: seg.color,
    }));
    const labelX = x + segW / 2;
    if (segW > 46) {
      const pctLabel = svgEl('text', { x: labelX, y: barY + barH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#fff' });
      pctLabel.textContent = Math.round(seg.weight * 100) + '%';
      svg.appendChild(pctLabel);
    }
    const nameLabel = svgEl('text', { x: labelX, y: barY + barH + 18, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'var(--text-secondary)' });
    nameLabel.textContent = seg.name;
    svg.appendChild(nameLabel);
    x += segW;
  });
}

function renderLineChart({ svg, tooltipEl, dates, series, yFormat, tooltipFormat }) {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(300, rect.width);
  const height = 300;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const margin = { top: 14, right: 16, bottom: 26, left: 64 };
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
    const x = xForIndex(idx);
    const label = svgEl('text', { x, y: height - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-muted)' });
    label.textContent = shortDate(dates[idx]).replace(/ de \d+$/, '').replace(' de ', ' ');
    svg.appendChild(label);
  }

  series.forEach(s => {
    let d = '';
    s.data.forEach((v, i) => {
      if (v == null) return;
      d += (d === '' ? 'M' : 'L') + xForIndex(i).toFixed(2) + ',' + yForValue(v).toFixed(2) + ' ';
    });
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
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
      buildTooltip(tooltipEl, dates[idx], rows);
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

/* ---------- Questionnaire state machine ---------- */

const QUESTIONS = ['risk', 'horizon', 'style', 'amount'];
const answers = { risk: null, horizon: null, style: null, amount: 1000 };
let currentStep = 0; // index into QUESTIONS, -1 = landing

const screenLanding = document.getElementById('screen-landing');
const screenQuiz = document.getElementById('screen-quiz');
const screenDashboard = document.getElementById('screen-dashboard');
const quizProgress = document.getElementById('quizProgress');
const startBtn = document.getElementById('startBtn');
const seeResultsBtn = document.getElementById('seeResultsBtn');
const amountInput = document.getElementById('amountInput');
const restartBtn = document.getElementById('restartBtn');

function renderProgress() {
  quizProgress.textContent = '';
  QUESTIONS.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i === currentStep ? ' active' : i < currentStep ? ' done' : '');
    quizProgress.appendChild(dot);
  });
}

function showStep(step) {
  currentStep = step;
  QUESTIONS.forEach((q, i) => {
    document.getElementById('q-' + q).hidden = i !== step;
  });
  renderProgress();
}

function goToQuiz() {
  screenLanding.hidden = true;
  screenQuiz.hidden = false;
  showStep(0);
}

function selectOption(question, value, btn) {
  answers[question] = value;
  document.querySelectorAll(`[data-options="${question}"] .option-card`).forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  setTimeout(() => {
    if (currentStep < QUESTIONS.length - 1) showStep(currentStep + 1);
  }, 150);
}

document.querySelectorAll('.option-card').forEach(btn => {
  btn.addEventListener('click', () => {
    const question = btn.closest('[data-options]').dataset.options;
    selectOption(question, btn.dataset.value, btn);
  });
});

document.querySelectorAll('.faq-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.faq;
    const textEl = document.querySelector(`[data-faq-text="${key}"]`);
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    textEl.hidden = expanded;
    if (!textEl.textContent && ARCHETYPES) textEl.textContent = ARCHETYPES.faq[key] || '';
  });
});

startBtn.addEventListener('click', goToQuiz);
seeResultsBtn.addEventListener('click', () => {
  answers.amount = Math.max(100, parseFloat(amountInput.value) || 1000);
  runDashboard();
});
restartBtn.addEventListener('click', () => {
  screenDashboard.hidden = true;
  document.querySelectorAll('.option-card.selected').forEach(el => el.classList.remove('selected'));
  answers.risk = answers.horizon = answers.style = null;
  goToQuiz();
});

/* ---------- Dashboard ---------- */

const dashHeadline = document.getElementById('dashHeadline');
const capNotice = document.getElementById('capNotice');
const allocationChart = document.getElementById('allocationChart');
const backtestStory = document.getElementById('backtestStory');
const explanationDetail = document.getElementById('explanationDetail');
const detailTableBody = document.getElementById('detailTableBody');
const layer3Toggle = document.getElementById('layer3Toggle');
const layer3Body = document.getElementById('layer3Body');

layer3Toggle.addEventListener('click', () => {
  const expanded = layer3Toggle.getAttribute('aria-expanded') === 'true';
  layer3Toggle.setAttribute('aria-expanded', String(!expanded));
  layer3Body.hidden = expanded;
});

let cachedEquitySeries = null;
let cachedBondSeries = null;

async function runDashboard() {
  screenQuiz.hidden = true;
  screenDashboard.hidden = false;
  backtestStory.textContent = 'Cargando datos históricos reales…';

  const { effectiveRisk, wasCapped } = computeEffectiveRisk(answers.risk, answers.horizon, ALLOCATIONS);
  const weights = getAllocationWeights(effectiveRisk, ALLOCATIONS);
  const explanation = getExplanation(effectiveRisk, answers.horizon, ARCHETYPES);

  dashHeadline.textContent = explanation ? explanation.headline : '—';
  capNotice.hidden = !wasCapped;
  if (wasCapped) capNotice.textContent = ARCHETYPES.horizonCapNotice;

  renderStackedBar(allocationChart, [
    { name: 'Empresas grandes del mundo', weight: weights.equities, color: 'var(--series-1)' },
    { name: 'Gobiernos/empresas (bonos)', weight: weights.bonds, color: 'var(--series-2)' },
    { name: 'Efectivo', weight: weights.cash, color: 'var(--series-3)' },
  ]);

  const styleDetail = answers.style === 'detalle';
  layer3Toggle.setAttribute('aria-expanded', String(styleDetail));
  layer3Body.hidden = !styleDetail;
  explanationDetail.textContent = explanation ? explanation.detail : '';

  try {
    if (!cachedEquitySeries) cachedEquitySeries = await fetchPricesTwelveData(ALLOCATIONS.instruments.equities.ticker, 2500);
    if (!cachedBondSeries) cachedBondSeries = await fetchPricesTwelveData(ALLOCATIONS.instruments.bonds.ticker, 2500);

    const aligned = alignByDate(cachedEquitySeries.dates, cachedEquitySeries.closes, cachedBondSeries.dates, cachedBondSeries.closes);
    const cashRate = ALLOCATIONS.instruments.cash.illustrativeAnnualRate;
    const blend = blendPortfolio({ dates: aligned.dates, equityCloses: aligned.equityCloses, bondCloses: aligned.bondCloses, weights, cashAnnualRate: cashRate });

    const n = blend.dates.length;
    const finalValue = answers.amount * blend.portfolioEquity[n - 1];
    const cashOnlyValue = answers.amount * blend.cashOnlyEquity[n - 1];
    const years = ((new Date(blend.dates[n - 1]) - new Date(blend.dates[0])) / (365.25 * 86400000)).toFixed(1);

    backtestStory.textContent = `Si hubieras invertido ${formatUSD(answers.amount, 0)} así hace ${years} años (${shortDate(blend.dates[0])}), hoy tendrías aproximadamente ${formatUSD(finalValue, 0)}. Dejarlo todo en efectivo, en cambio, hubiera dado ${formatUSD(cashOnlyValue, 0)}.`;

    renderLineChart({
      svg: document.getElementById('pfChart'),
      tooltipEl: document.getElementById('pfTooltip'),
      dates: blend.dates,
      series: [
        { name: 'Tu cartera', color: 'var(--series-1)', data: blend.portfolioEquity.map(v => answers.amount * v) },
        { name: 'Solo efectivo', color: 'var(--series-3)', data: blend.cashOnlyEquity.map(v => answers.amount * v) },
      ],
      yFormat: v => formatUSD(v, 0),
      tooltipFormat: v => formatUSD(v, 0),
    });
    buildLegend(document.getElementById('pfLegend'), [
      { name: 'Tu cartera', color: 'var(--series-1)' },
      { name: 'Solo efectivo', color: 'var(--series-3)' },
    ]);

    const vol = annualizedVol(blend.dailyReturns, 252);
    const dd = maxDrawdown(blend.portfolioEquity);
    detailTableBody.textContent = '';
    const rows = [
      ['Empresas grandes del mundo', ALLOCATIONS.instruments.equities.ticker, weights.equities, ALLOCATIONS.instruments.equities.expenseRatio],
      ['Gobiernos/empresas (bonos)', ALLOCATIONS.instruments.bonds.ticker, weights.bonds, ALLOCATIONS.instruments.bonds.expenseRatio],
      ['Efectivo', '—', weights.cash, null],
    ];
    rows.forEach(([name, ticker, weight, ter]) => {
      const tr = document.createElement('tr');
      [name, ticker, formatPct(weight, 0), name === 'Efectivo' ? '—' : formatPct(vol, 1), ter == null ? '—' : formatPct(ter, 2)].forEach((text, ci) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (ci >= 2) td.classList.add('num');
        tr.appendChild(td);
      });
      detailTableBody.appendChild(tr);
    });
    const ddRow = document.createElement('tr');
    ['Máx. caída histórica de tu cartera', '', '', formatPct(dd, 1), ''].forEach((text, ci) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (ci >= 2) td.classList.add('num');
      ddRow.appendChild(td);
    });
    detailTableBody.appendChild(ddRow);
  } catch (err) {
    console.error(err);
    backtestStory.textContent = 'No pudimos cargar los datos históricos ahora mismo (posible límite de la API gratuita). Probá de nuevo en unos segundos.';
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

window.addEventListener('resize', debounce(() => {
  if (!screenDashboard.hidden) runDashboard();
}, 200));

loadContent();
