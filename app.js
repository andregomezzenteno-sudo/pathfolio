'use strict';

/* ---------- Content (fetched once) ---------- */

let ALLOCATIONS = null;
let ARCHETYPES = null;
let LESSONS = null;
let CLOUD_FACTS = null;

async function loadContent() {
  const [allocRes, archRes, lessonsRes, cloudRes] = await Promise.all([
    fetch('allocations.json'),
    fetch('archetypes.json'),
    fetch('lessons.json'),
    fetch('cloudFacts.json'),
  ]);
  ALLOCATIONS = await allocRes.json();
  ARCHETYPES = await archRes.json();
  LESSONS = await lessonsRes.json();
  CLOUD_FACTS = await cloudRes.json();
  updateCloudForQuestion(QUESTIONS[currentStep]);
  startCloudCycle();
}

/* ---------- Sketch icons: hand-drawn "boil" animation ---------- */
/* One canonical path per icon; two extra frames are the SAME path with a
   small deterministic coordinate jitter, cycled via CSS opacity keyframes
   (see .sketch-icon in style.css) — the classic traditional-animation
   "boil" technique, without hand-authoring 3 full variants per icon. */

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
};

function jitterPathD(d, seed) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return d.replace(/-?\d+(\.\d+)?/g, m => (parseFloat(m) + (rand() - 0.5) * 2.2).toFixed(1));
}

function renderSketchIcon(container, iconKey, size) {
  const d = SKETCH_ICONS[iconKey];
  if (!d || !container) return;
  container.textContent = '';
  const svg = svgEl('svg', { viewBox: '0 0 64 64', width: size || 40, height: size || 40, class: 'sketch-icon' });
  const seedBase = [...iconKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  [d, jitterPathD(d, seedBase + 11), jitterPathD(d, seedBase + 47)].forEach((frameD, i) => {
    svg.appendChild(svgEl('path', {
      d: frameD, fill: 'none', stroke: 'currentColor', 'stroke-width': 3,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      class: `frame frame-${i + 1}`,
    }));
  });
  container.appendChild(svg);
}

function renderAllSketchIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    renderSketchIcon(el, el.dataset.icon, parseInt(el.dataset.size, 10) || 40);
  });
}

/* ---------- Deterministic allocation engine ---------- */

function riskSliderToTier(v) {
  if (v <= 2) return 'conservador';
  if (v === 3) return 'moderado';
  return 'arriesgado';
}
function volatilitySliderToTier(v) {
  if (v <= 2) return 'conservador';
  if (v === 3) return 'moderado';
  return 'arriesgado';
}

function applyCap(currentTier, capTier, riskOrder) {
  if (!capTier) return { tier: currentTier, wasCapped: false };
  const capped = riskOrder.indexOf(capTier) < riskOrder.indexOf(currentTier) ? capTier : currentTier;
  return { tier: capped, wasCapped: capped !== currentTier };
}

// A 60+ age bracket caps at "moderado" regardless of stated risk/horizon —
// the classic retirement glide-path principle: less time for a bad sequence
// of returns to recover from, independent of how the person FEELS about risk.
function ageToCapTier(age) {
  return age === '60+' ? 'moderado' : null;
}

// Three independent signals can each only pull the effective risk tier DOWN
// from the stated risk-slider tier, never up: a short horizon objectively
// limits how much volatility you can absorb, a low tolerance for actual
// drawdowns (the "would you panic-sell" question) reveals a lower true risk
// capacity than the abstract slider might have suggested, and an age bracket
// close to/in retirement limits how long a bad sequence of returns has to
// recover. All three are applied transparently — the UI states when and why
// each adjustment happened, never silently.
function computeEffectiveRisk(riskSliderValue, horizon, volatilitySliderValue, age, allocations) {
  const order = allocations.riskOrder;
  let tier = riskSliderToTier(riskSliderValue);

  const afterHorizon = applyCap(tier, allocations.horizonCap[horizon], order);
  tier = afterHorizon.tier;

  const afterVol = applyCap(tier, volatilitySliderToTier(volatilitySliderValue), order);
  tier = afterVol.tier;

  const afterAge = applyCap(tier, ageToCapTier(age), order);
  tier = afterAge.tier;

  return {
    effectiveRisk: tier,
    wasCappedByHorizon: afterHorizon.wasCapped,
    wasCappedByVolatility: afterVol.wasCapped,
    wasCappedByAge: afterAge.wasCapped,
  };
}

function getAllocationWeights(effectiveRisk, allocations) {
  return allocations.buckets[effectiveRisk];
}

// Makes the equity/bonds INSTRUMENT choice actually move the donut
// percentages, not just swap which ticker fills a fixed-size slot. A more
// volatile pick (e.g. NASDAQ 100, riskMultiplier 1.35) gets a modestly
// smaller share; the difference goes to the other bucket — cash is left
// untouched since it's the safety floor set by risk/horizon/age/volatility,
// unrelated to which specific fund was chosen. `dampening` keeps the shift
// noticeable but bounded (a real risk-parity engine would go further; this
// is a legible, transparent approximation of the same idea). Equities and
// bonds are renormalized after the tilt so the three weights still sum to
// exactly 1.
function adjustWeightsForInstrumentRisk(baseWeights, equityRiskMultiplier, bondsRiskMultiplier, dampening) {
  const equityTilt = 1 - dampening * (equityRiskMultiplier - 1);
  const bondsTilt = 1 - dampening * (bondsRiskMultiplier - 1);

  let equities = baseWeights.equities * equityTilt;
  let bonds = baseWeights.bonds * bondsTilt;
  const cash = baseWeights.cash;

  const targetSum = baseWeights.equities + baseWeights.bonds;
  const currentSum = equities + bonds;
  const scale = currentSum > 0 ? targetSum / currentSum : 1;
  equities *= scale;
  bonds *= scale;

  return { equities, bonds, cash };
}

// Three optional sleeves (real estate, alternative, private equity) are real
// carve-outs FROM the equities weight (never a new fixed bucket, never
// decorative) — applied in this order, each taking a slice of whatever the
// equities weight already is after the previous one. Real estate scales with
// the tier, same as before generalizing to 3 sleeves. Alternative only ever
// actually lands here if the FINAL effective risk tier qualifies, regardless
// of what the user picked earlier — a small-but-real allocation only makes
// sense once every other signal has already agreed the person can carry that
// much risk, so this re-checks it at the end rather than trusting an answer
// given before the full picture was in. Private equity carries that same
// risk-tier check PLUS a minimum initial-amount check, mirroring how real
// retail private-equity vehicles (feeder funds, ELTIFs) gate on a minimum
// ticket size — requesting it without enough capital is honestly excluded,
// not silently downgraded or silently granted.
function applySleeves(weights, { includeRealEstate, includeAlternative, includePrivateEquity, effectiveRisk, initialAmount }, allocations) {
  const result = { equities: weights.equities, bonds: weights.bonds, cash: weights.cash, realEstate: 0, alternative: 0, privateEquity: 0 };

  if (includeRealEstate) {
    const frac = allocations.realEstateFractionByTier[effectiveRisk] || 0;
    const sleeve = result.equities * frac;
    result.equities -= sleeve;
    result.realEstate = sleeve;
  }

  const alternativeQualifies = includeAlternative && effectiveRisk === allocations.alternativeRequiresTier;
  if (alternativeQualifies) {
    const sleeve = result.equities * allocations.alternativeFraction;
    result.equities -= sleeve;
    result.alternative = sleeve;
  }

  const peQualifiesRisk = effectiveRisk === allocations.privateEquityRequiresTier;
  const peQualifiesCapital = (initialAmount || 0) >= allocations.privateEquityMinAmount;
  const peQualifies = includePrivateEquity && peQualifiesRisk && peQualifiesCapital;
  if (peQualifies) {
    const sleeve = result.equities * allocations.privateEquityFraction;
    result.equities -= sleeve;
    result.privateEquity = sleeve;
  }

  return {
    weights: result,
    alternativeIncluded: alternativeQualifies,
    alternativeRequestedButExcluded: includeAlternative && !alternativeQualifies,
    privateEquityIncluded: peQualifies,
    privateEquityRequestedButExcluded: includePrivateEquity && !peQualifies,
    privateEquityExcludedReason: includePrivateEquity && !peQualifies
      ? (!peQualifiesRisk && !peQualifiesCapital ? 'both' : (!peQualifiesRisk ? 'risk' : 'capital'))
      : null,
  };
}

function getExplanation(effectiveRisk, horizon, archetypes) {
  const key = `${effectiveRisk}|${horizon}`;
  return archetypes.explanations[key] || null;
}

function resolveEquityIndex(choiceKey, allocations) {
  return allocations.equityIndexOptions[choiceKey] || allocations.equityIndexOptions[allocations.defaultEquityIndex];
}

function resolveBondsChoice(choiceKey, allocations) {
  return allocations.bondsOptions[choiceKey] || allocations.bondsOptions[allocations.defaultBondsChoice];
}

function resolveRealEstateSubtype(choiceKey, allocations) {
  return allocations.realEstateSubtypes[choiceKey] || allocations.realEstateSubtypes[allocations.defaultRealEstateSubtype];
}

function resolveAlternativeSubtype(choiceKey, allocations) {
  return allocations.alternativeSubtypes[choiceKey] || allocations.alternativeSubtypes[allocations.defaultAlternativeSubtype];
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

// ticker -> {dates, closes}, shared by both the equity-index and bonds-choice
// pickers since either one can change and re-trigger a fetch for a ticker
// already seen (or not) — one cache, keyed by symbol, covers both.
const tickerSeriesCache = new Map();
async function fetchTickerSeries(ticker) {
  if (!tickerSeriesCache.has(ticker)) {
    tickerSeriesCache.set(ticker, await fetchPricesTwelveData(ticker, 2500));
  }
  return tickerSeriesCache.get(ticker);
}

/* ---------- Portfolio math ---------- */

// Generalized to N series (equities, bonds, and optionally real estate and/or
// alternative investments when either resolves to a real fetchable ticker)
// instead of a fixed pair — intersects every series down to the dates they
// all share, so an added sleeve can never silently misalign the others.
function alignSeriesSet(seriesList) {
  const maps = seriesList.map(s => new Map(s.dates.map((d, i) => [d, s.closes[i]])));
  const dates = seriesList[0].dates.filter(d => maps.every(m => m.has(d)));
  const closesList = maps.map(m => dates.map(d => m.get(d)));
  return { dates, closesList };
}

// weightsList lines up 1:1 with closesList (same order as alignSeriesSet's
// input) — cash is handled separately since it has no price series to blend.
// flatAssets covers any OTHER sleeve with no real price series either (real
// estate crowdfunding, private equity): each compounds at its own documented
// illustrative annual rate, exactly like cash does, just not shown as the
// dedicated "if you'd kept it all in cash" comparison line.
function blendPortfolio({ dates, closesList, weightsList, cashWeight, cashAnnualRate, flatAssets = [], barsPerYear = 252 }) {
  const n = dates.length;
  const cashPerBar = Math.pow(1 + cashAnnualRate, 1 / barsPerYear) - 1;
  const flatPerBar = flatAssets.map(a => ({ weight: a.weight, perBar: Math.pow(1 + a.annualRate, 1 / barsPerYear) - 1 }));
  const portfolioEquity = new Array(n).fill(1);
  const cashOnlyEquity = new Array(n).fill(1);
  const dailyReturns = [];
  for (let i = 1; i < n; i++) {
    let blended = cashWeight * cashPerBar;
    for (let k = 0; k < closesList.length; k++) {
      const c = closesList[k];
      blended += weightsList[k] * (c[i] - c[i - 1]) / c[i - 1];
    }
    for (const f of flatPerBar) blended += f.weight * f.perBar;
    portfolioEquity[i] = portfolioEquity[i - 1] * (1 + blended);
    cashOnlyEquity[i] = cashOnlyEquity[i - 1] * (1 + cashPerBar);
    dailyReturns.push(blended);
  }
  return { dates, portfolioEquity, cashOnlyEquity, dailyReturns };
}

// Same blended daily returns as the lump-sum line, but adds a fixed monthly
// contribution the first time each new calendar month appears in the date
// series — a simple, honest approximation of dollar-cost averaging (real
// contribution timing within a month varies; this doesn't pretend otherwise).
function simulateDCA({ dates, dailyReturns, initialAmount, monthlyAmount }) {
  const n = dates.length;
  const value = new Array(n).fill(0);
  value[0] = initialAmount;
  let lastKey = dates[0].slice(0, 7); // "YYYY-MM"
  for (let i = 1; i < n; i++) {
    value[i] = value[i - 1] * (1 + dailyReturns[i - 1]);
    const key = dates[i].slice(0, 7);
    if (monthlyAmount > 0 && key !== lastKey) {
      value[i] += monthlyAmount;
      lastKey = key;
    }
  }
  return value;
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

// Part-to-whole, styled as a donut per the requested "dashboard" aesthetic.
// Classic stroke-dasharray/stroke-dashoffset technique on a thick-stroked
// circle. Paired with a legend that carries the direct percentage labels
// (arcs are too thin here for reliable in-place text), so identity and value
// both stay reachable without hovering.
function renderDonut(svg, segments) {
  const rect = svg.getBoundingClientRect();
  const size = Math.max(160, Math.min(220, rect.width || 220));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const cx = size / 2, cy = size / 2, r = size * 0.34, strokeW = size * 0.20;
  const circumference = 2 * Math.PI * r;

  svg.appendChild(svgEl('circle', { cx, cy, r, fill: 'none', stroke: 'var(--gridline)', 'stroke-width': strokeW }));

  let offset = 0;
  segments.forEach(seg => {
    const segLen = Math.max(0, seg.weight * circumference - 2); // 2px surface gap between segments
    const circle = svgEl('circle', {
      cx, cy, r, fill: 'none', stroke: seg.color, 'stroke-width': strokeW,
      'stroke-linecap': 'round',
      'stroke-dasharray': `${segLen} ${circumference - segLen}`,
      'stroke-dashoffset': -offset,
      transform: `rotate(-90 ${cx} ${cy})`,
      filter: 'url(#sketchWobbleChart)',
    });
    svg.appendChild(circle);
    offset += seg.weight * circumference;
  });

  const label = svgEl('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': size * 0.11, 'font-weight': 700, fill: 'var(--text-primary)' });
  label.textContent = 'Tu cartera';
  svg.appendChild(label);
  const sublabel = svgEl('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': size * 0.06, fill: 'var(--text-muted)' });
  sublabel.textContent = segments.length === 1 ? '1 parte' : `${segments.length} partes`;
  svg.appendChild(sublabel);
}

function buildDonutLegend(container, segments) {
  container.textContent = '';
  segments.forEach(seg => {
    const row = document.createElement('div');
    row.className = 'donut-legend-row';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch dot';
    swatch.style.background = seg.color;
    const name = document.createElement('span');
    name.className = 'donut-legend-name';
    name.textContent = seg.name;
    const pct = document.createElement('span');
    pct.className = 'donut-legend-pct';
    pct.textContent = Math.round(seg.weight * 100) + '%';
    row.append(swatch, name, pct);
    container.appendChild(row);
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
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#sketchWobbleChart)' }));
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

const QUESTIONS = [
  'age', 'risk', 'horizon',
  'knowledge', 'indexLesson', 'equityIndex',
  'bondsKnowledge', 'bondsLesson', 'bondsChoice',
  'realEstateKnowledge', 'realEstateLesson', 'realEstateChoice', 'realEstateType',
  'peKnowledge', 'peLesson', 'peChoice',
  'altKnowledge', 'altLesson', 'altChoice', 'altType',
  'style', 'volatility', 'amount',
];
// Each entry decides, from the CURRENT answers, whether that step should be
// shown at all — a step with no entry always shows. Two shapes reused across
// the whole quiz: a lesson slide shows only if its paired knowledge gate was
// NOT answered "si" (so already-informed users skip it), and a sub-type
// choice shows only if its paired opt-in question was answered "si" (asking
// "which kind of X" makes no sense if the user just said they don't want X).
const CONDITIONAL_STEPS = {
  indexLesson: a => a.knowledge !== 'si',
  bondsLesson: a => a.bondsKnowledge !== 'si',
  realEstateLesson: a => a.realEstateKnowledge !== 'si',
  realEstateType: a => a.realEstateChoice === 'si',
  peLesson: a => a.peKnowledge !== 'si',
  altLesson: a => a.altKnowledge !== 'si',
  altType: a => a.altChoice === 'si',
};
const answers = {
  age: null, risk: 3, horizon: null, knowledge: null, equityIndex: null,
  bondsKnowledge: null, bondsChoice: null,
  realEstateKnowledge: null, realEstateChoice: null, realEstateType: null,
  peKnowledge: null, peChoice: null,
  altKnowledge: null, altChoice: null, altType: null,
  style: null, volatility: 3, amount: 1000, monthly: 0,
};
let currentStep = 0;

const screenLanding = document.getElementById('screen-landing');
const screenQuiz = document.getElementById('screen-quiz');
const screenDashboard = document.getElementById('screen-dashboard');
const progressBarOuter = document.getElementById('progressBarOuter');
const progressBarFill = document.getElementById('progressBarFill');
const progressLabel = document.getElementById('progressLabel');
const startBtn = document.getElementById('startBtn');
const seeResultsBtn = document.getElementById('seeResultsBtn');
const amountInput = document.getElementById('amountInput');
const monthlyInput = document.getElementById('monthlyInput');
const restartBtn = document.getElementById('restartBtn');

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
  progressLabel.textContent = `Pregunta ${pos} de ${total}`;
}

// "Hila cosas": a short sentence at the top of select screens that names the
// answer just given before asking the next thing, so the flow reads as one
// connected conversation rather than a stack of unrelated form fields.
const HORIZON_PHRASE = { viaje: 'para un viaje o una meta cercana', casa: 'para comprar una casa', crecer: 'para que crezca, sin apuro', jubilacion: 'para tu jubilación' };
const EQUITY_LABEL = { sp500: 'el S&P 500', nasdaq100: 'el NASDAQ 100', msci: 'el MSCI World' };
const RISK_PHRASE = { 1: 'muy baja', 2: 'baja', 3: 'media', 4: 'alta', 5: 'muy alta' };
const CONNECTORS = {
  risk: a => a.age ? `Con ${a.age} años, pensemos en cómo reaccionás ante las bajadas.` : null,
  knowledge: a => a.horizon ? `Ya que esto es ${HORIZON_PHRASE[a.horizon]}, hablemos de la parte de acciones.` : null,
  bondsKnowledge: a => a.equityIndex ? `Con ${EQUITY_LABEL[a.equityIndex]} elegido, vamos con la otra mitad clásica de una cartera: los bonos.` : null,
  realEstateKnowledge: () => 'Más allá de acciones y bonos, hay otras piezas que podés sumar — empecemos por bienes raíces.',
  realEstateType: () => 'Bien, ahora elijamos la forma concreta.',
  peKnowledge: a => a.realEstateChoice === 'si' ? 'Con bienes raíces sumados, otra pieza poco común: empresas que no cotizan en bolsa.' : 'Otra pieza poco común: empresas que no cotizan en bolsa.',
  altKnowledge: () => 'Una última familia opcional — mucho más volátil que el resto de la cartera.',
  altType: () => '¿Cuál de las tres te interesa más?',
  volatility: a => `Dijiste que tu tolerancia al riesgo es ${RISK_PHRASE[a.risk]} — probémosla con un escenario real.`,
  amount: () => 'Con tu perfil casi listo, solo falta ponerle números.',
};

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
  updateCloudForQuestion(qKey);
  renderProgress();
}

function nextStep() {
  let next = currentStep + 1;
  while (next < QUESTIONS.length && !shouldShowStep(next)) next += 1;
  if (next < QUESTIONS.length) showStep(next);
}

function goToQuiz() {
  screenLanding.hidden = true;
  screenQuiz.hidden = false;
  progressBarOuter.hidden = false;
  showStep(0);
}

function selectOption(question, value, btn) {
  answers[question] = value;
  document.querySelectorAll(`[data-options="${question}"] .option-card`).forEach(el => el.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  setTimeout(nextStep, 150);
}

document.querySelectorAll('.option-card[data-value]').forEach(btn => {
  btn.addEventListener('click', () => {
    const optionsParent = btn.closest('[data-options]');
    if (optionsParent) selectOption(optionsParent.dataset.options, btn.dataset.value, btn);
  });
});

/* Sliders with live feedback */
const riskSlider = document.getElementById('riskSlider');
const riskFillStability = document.getElementById('riskFillStability');
const riskFillGrowth = document.getElementById('riskFillGrowth');

function updateRiskPreview() {
  const v = parseInt(riskSlider.value, 10);
  const growthPct = ((v - 1) / 4) * 100;
  riskFillGrowth.style.width = growthPct + '%';
  riskFillStability.style.width = (100 - growthPct) + '%';
}
riskSlider.addEventListener('input', updateRiskPreview);
updateRiskPreview();

document.querySelectorAll('[data-advance]').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.advance;
    if (q === 'risk') answers.risk = parseInt(riskSlider.value, 10);
    if (q === 'volatility') answers.volatility = parseInt(document.getElementById('volatilitySlider').value, 10);
    nextStep();
  });
});

startBtn.addEventListener('click', goToQuiz);
seeResultsBtn.addEventListener('click', () => {
  answers.amount = Math.max(100, parseFloat(amountInput.value) || 1000);
  answers.monthly = Math.max(0, parseFloat(monthlyInput.value) || 0);
  runDashboard();
});
restartBtn.addEventListener('click', () => {
  screenDashboard.hidden = true;
  document.querySelectorAll('.option-card.selected').forEach(el => el.classList.remove('selected'));
  answers.age = answers.horizon = answers.knowledge = answers.equityIndex = null;
  answers.bondsKnowledge = answers.bondsChoice = answers.style = null;
  answers.realEstateKnowledge = answers.realEstateChoice = answers.realEstateType = null;
  answers.peKnowledge = answers.peChoice = null;
  answers.altKnowledge = answers.altChoice = answers.altType = null;
  answers.risk = 3; answers.volatility = 3; answers.monthly = 0;
  riskSlider.value = 3; document.getElementById('volatilitySlider').value = 3; monthlyInput.value = 0;
  updateRiskPreview();
  goToQuiz();
});

/* ---------- Falling fact clouds (replace the old side drawer) ----------
   Small clouds drift down the left/right margins, one spawned every few
   seconds, alternating sides, each carrying a fact about whatever topic the
   current question is on. They're collapsed (icon only) by default — click
   one to pause it and expand its bubble, click again (or just wait) to let
   it keep falling. Spawned/removed dynamically rather than living in the
   HTML, since there can be several on screen carrying different facts. */

const SCREEN_TO_TOPIC = {
  age: 'interesCompuesto', risk: 'volatilidad', horizon: 'diversificacion', knowledge: 'indices', indexLesson: 'indices',
  equityIndex: 'indices', bondsKnowledge: 'bonos', bondsLesson: 'bonos', bondsChoice: 'diversificacion',
  realEstateKnowledge: 'realEstate', realEstateLesson: 'realEstate', realEstateChoice: 'realEstate', realEstateType: 'realEstate',
  peKnowledge: 'privateEquity', peLesson: 'privateEquity', peChoice: 'privateEquity',
  altKnowledge: 'otrasInversiones', altLesson: 'otrasInversiones', altChoice: 'otrasInversiones', altType: 'otrasInversiones',
  style: 'fondosIndexados', volatility: 'rebalanceo', amount: 'dcaVsLumpSum',
};

const CLOUD_FALL_MS = 17000;
const CLOUD_SPAWN_MS = 5000;
const cloudLaneEls = { left: document.getElementById('cloudLaneLeft'), right: document.getElementById('cloudLaneRight') };
let currentCloudTopic = 'acciones';
let cloudSpawnTimer = null;
let cloudNextSide = 'left';
const cloudTopicIndex = new Map();

function nextCloudFact(topic) {
  const pool = (CLOUD_FACTS && CLOUD_FACTS.facts[topic]) || [];
  if (!pool.length) return null;
  const i = cloudTopicIndex.get(topic) || 0;
  cloudTopicIndex.set(topic, i + 1);
  return pool[i % pool.length];
}

function spawnFallingCloud() {
  const lane = cloudLaneEls[cloudNextSide];
  cloudNextSide = cloudNextSide === 'left' ? 'right' : 'left';
  if (!lane) return;
  const fact = nextCloudFact(currentCloudTopic);
  if (!fact) return;

  const el = document.createElement('div');
  el.className = 'falling-cloud';
  el.style.animationDuration = CLOUD_FALL_MS + 'ms';
  el.innerHTML =
    '<span class="cloud-shape sketch-icon-slot" data-icon="cloud" data-size="60"></span>' +
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
  currentCloudTopic = SCREEN_TO_TOPIC[questionKey] || 'acciones';
}

/* ---------- Dashboard ---------- */

const dashHeadline = document.getElementById('dashHeadline');
const capNotice = document.getElementById('capNotice');
const volNotice = document.getElementById('volNotice');
const ageNotice = document.getElementById('ageNotice');
const tiltNotice = document.getElementById('tiltNotice');
const altNotice = document.getElementById('altNotice');
const peNotice = document.getElementById('peNotice');
const allocationDonut = document.getElementById('allocationDonut');
const donutLegend = document.getElementById('donutLegend');
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

async function runDashboard() {
  screenQuiz.hidden = true;
  progressBarOuter.hidden = true;
  screenDashboard.hidden = false;
  backtestStory.textContent = 'Cargando datos históricos reales…';
  currentCloudTopic = 'dcaVsLumpSum';

  const { effectiveRisk, wasCappedByHorizon, wasCappedByVolatility, wasCappedByAge } = computeEffectiveRisk(answers.risk, answers.horizon, answers.volatility, answers.age, ALLOCATIONS);
  const baseWeights = getAllocationWeights(effectiveRisk, ALLOCATIONS);
  const explanation = getExplanation(effectiveRisk, answers.horizon, ARCHETYPES);
  const equityInstrument = resolveEquityIndex(answers.equityIndex, ALLOCATIONS);
  const bondsInstrument = resolveBondsChoice(answers.bondsChoice, ALLOCATIONS);
  const weights = adjustWeightsForInstrumentRisk(baseWeights, equityInstrument.riskMultiplier, bondsInstrument.riskMultiplier, ALLOCATIONS.tiltDampening);
  const wasTilted = Math.abs(weights.equities - baseWeights.equities) > 0.005;

  dashHeadline.textContent = explanation ? explanation.headline : '—';

  capNotice.hidden = !wasCappedByHorizon;
  if (wasCappedByHorizon) capNotice.textContent = ARCHETYPES.horizonCapNotice;
  volNotice.hidden = !wasCappedByVolatility;
  if (wasCappedByVolatility) {
    volNotice.textContent = 'Dijiste que tolerarías más riesgo, pero tu respuesta sobre caídas reales sugiere lo contrario — ajustamos la mezcla hacia algo más prudente. Mejor prevenir que vender en pánico.';
  }
  ageNotice.hidden = !wasCappedByAge;
  if (wasCappedByAge) {
    ageNotice.textContent = 'Con 60+ años, hay menos tiempo para que una mala racha se recupere antes de necesitar el dinero — ajustamos la mezcla hacia algo más prudente, independientemente de tu tolerancia al riesgo.';
  }
  tiltNotice.hidden = !wasTilted;
  if (wasTilted) {
    const eqDir = weights.equities < baseWeights.equities ? 'un poco menos' : 'un poco más';
    tiltNotice.textContent = `${equityInstrument.label} y/o ${bondsInstrument.label} son más o menos volátiles que nuestras opciones de referencia, así que le dimos a las empresas grandes ${eqDir} de peso del que te hubiera tocado por defecto — buscando mantener el riesgo total parecido, sin importar qué instrumento específico elegiste.`;
  }

  const realEstateInstrument = resolveRealEstateSubtype(answers.realEstateType, ALLOCATIONS);
  const alternativeInstrument = resolveAlternativeSubtype(answers.altType, ALLOCATIONS);
  const {
    weights: finalWeights, alternativeIncluded, alternativeRequestedButExcluded,
    privateEquityIncluded, privateEquityRequestedButExcluded, privateEquityExcludedReason,
  } = applySleeves(weights, {
    includeRealEstate: answers.realEstateChoice === 'si',
    includeAlternative: answers.altChoice === 'si',
    includePrivateEquity: answers.peChoice === 'si',
    effectiveRisk, initialAmount: answers.amount,
  }, ALLOCATIONS);

  altNotice.hidden = !alternativeRequestedButExcluded;
  if (alternativeRequestedButExcluded) {
    altNotice.textContent = `Pediste sumar "otras inversiones" (${alternativeInstrument.label.toLowerCase()}), pero tu perfil final terminó siendo "${effectiveRisk}", no "arriesgado" — así que lo dejamos afuera. Una porción de un activo tan volátil solo tiene sentido si cada otra señal (horizonte, caídas reales, edad) ya está de acuerdo.`;
  }
  peNotice.hidden = !privateEquityRequestedButExcluded;
  if (privateEquityRequestedButExcluded) {
    const reasonText = {
      risk: `tu perfil final terminó siendo "${effectiveRisk}", no "arriesgado"`,
      capital: `los fondos de private equity minoristas suelen pedir un mínimo de inversión inicial (acá usamos ${formatUSD(ALLOCATIONS.privateEquityMinAmount, 0)} como referencia) y tu monto no llega`,
      both: `tu perfil final no es "arriesgado" y además tu monto no alcanza el mínimo habitual de estos fondos (${formatUSD(ALLOCATIONS.privateEquityMinAmount, 0)})`,
    }[privateEquityExcludedReason];
    peNotice.textContent = `Pediste sumar private equity, pero ${reasonText} — así que lo dejamos afuera.`;
  }

  const includeRealEstate = finalWeights.realEstate > 0;

  const donutSegments = [
    { name: `Renta variable (${equityInstrument.label})`, weight: finalWeights.equities, color: 'var(--series-1)' },
    { name: `Renta fija (${bondsInstrument.label})`, weight: finalWeights.bonds, color: 'var(--series-2)' },
    { name: 'Efectivo', weight: finalWeights.cash, color: 'var(--series-3)' },
  ];
  if (includeRealEstate) donutSegments.push({ name: `Inversión inmobiliaria (${realEstateInstrument.label})`, weight: finalWeights.realEstate, color: 'var(--series-4)' });
  if (privateEquityIncluded) donutSegments.push({ name: 'Private Equity', weight: finalWeights.privateEquity, color: 'var(--series-6)' });
  if (alternativeIncluded) donutSegments.push({ name: `Otras inversiones (${alternativeInstrument.label})`, weight: finalWeights.alternative, color: 'var(--series-5)' });
  renderDonut(allocationDonut, donutSegments);
  buildDonutLegend(donutLegend, donutSegments);

  const styleDetail = answers.style === 'detalle';
  layer3Toggle.setAttribute('aria-expanded', String(styleDetail));
  layer3Body.hidden = !styleDetail;
  explanationDetail.textContent = explanation ? explanation.detail : '';

  try {
    const tickerSpecs = [
      { key: 'equities', name: `Renta variable (${equityInstrument.label})`, ticker: equityInstrument.ticker, weight: finalWeights.equities, ter: equityInstrument.expenseRatio },
      { key: 'bonds', name: `Renta fija (${bondsInstrument.label})`, ticker: bondsInstrument.ticker, weight: finalWeights.bonds, ter: bondsInstrument.expenseRatio },
    ];
    const flatSpecs = [];
    if (includeRealEstate) {
      const row = { key: 'realEstate', name: `Inversión inmobiliaria (${realEstateInstrument.label})`, weight: finalWeights.realEstate, ter: realEstateInstrument.expenseRatio };
      if (realEstateInstrument.hasRealData) tickerSpecs.push({ ...row, ticker: realEstateInstrument.ticker });
      else flatSpecs.push({ ...row, ticker: null, annualRate: realEstateInstrument.illustrativeAnnualRate });
    }
    if (privateEquityIncluded) {
      flatSpecs.push({
        key: 'privateEquity', name: 'Private Equity', ticker: null,
        weight: finalWeights.privateEquity, ter: ALLOCATIONS.privateEquityInstrument.expenseRatio,
        annualRate: ALLOCATIONS.privateEquityInstrument.illustrativeAnnualRate,
      });
    }
    if (alternativeIncluded) {
      tickerSpecs.push({
        key: 'alternative', name: `Otras inversiones (${alternativeInstrument.label})`, ticker: alternativeInstrument.ticker,
        weight: finalWeights.alternative, ter: alternativeInstrument.expenseRatio,
      });
    }

    const fetchedSeries = await Promise.all(tickerSpecs.map(s => fetchTickerSeries(s.ticker)));
    const aligned = alignSeriesSet(fetchedSeries);
    const cashRate = ALLOCATIONS.instruments.cash.illustrativeAnnualRate;
    const blend = blendPortfolio({
      dates: aligned.dates, closesList: aligned.closesList,
      weightsList: tickerSpecs.map(s => s.weight),
      cashWeight: finalWeights.cash, cashAnnualRate: cashRate,
      flatAssets: flatSpecs.map(s => ({ weight: s.weight, annualRate: s.annualRate })),
    });

    const n = blend.dates.length;
    const finalValue = answers.amount * blend.portfolioEquity[n - 1];
    const cashOnlyValue = answers.amount * blend.cashOnlyEquity[n - 1];
    const years = ((new Date(blend.dates[n - 1]) - new Date(blend.dates[0])) / (365.25 * 86400000)).toFixed(1);

    const hasMonthly = answers.monthly > 0;
    const dcaSeries = hasMonthly ? simulateDCA({ dates: blend.dates, dailyReturns: blend.dailyReturns, initialAmount: answers.amount, monthlyAmount: answers.monthly }) : null;

    backtestStory.textContent = hasMonthly
      ? `Si hubieras invertido ${formatUSD(answers.amount, 0)} hace ${years} años (${shortDate(blend.dates[0])}) y aportado ${formatUSD(answers.monthly, 0)} más cada mes, hoy tendrías aproximadamente ${formatUSD(dcaSeries[n - 1], 0)} — contra ${formatUSD(finalValue, 0)} si solo hubieras puesto el monto inicial y nada más.`
      : `Si hubieras invertido ${formatUSD(answers.amount, 0)} así hace ${years} años (${shortDate(blend.dates[0])}), hoy tendrías aproximadamente ${formatUSD(finalValue, 0)}. Dejarlo todo en efectivo, en cambio, hubiera dado ${formatUSD(cashOnlyValue, 0)}.`;

    const chartSeries = [
      { name: hasMonthly ? 'Solo aporte inicial' : 'Tu cartera', color: 'var(--series-1)', data: blend.portfolioEquity.map(v => answers.amount * v) },
    ];
    if (hasMonthly) chartSeries.push({ name: 'Con aporte mensual', color: 'var(--series-2)', data: dcaSeries });
    chartSeries.push({ name: 'Solo efectivo', color: 'var(--series-3)', data: blend.cashOnlyEquity.map(v => answers.amount * v) });

    renderLineChart({
      svg: document.getElementById('pfChart'),
      tooltipEl: document.getElementById('pfTooltip'),
      dates: blend.dates,
      series: chartSeries,
      yFormat: v => formatUSD(v, 0),
      tooltipFormat: v => formatUSD(v, 0),
    });
    buildLegend(document.getElementById('pfLegend'), chartSeries.map(s => ({ name: s.name, color: s.color })));

    const vol = annualizedVol(blend.dailyReturns, 252);
    const dd = maxDrawdown(blend.portfolioEquity);
    detailTableBody.textContent = '';
    // hasRealData rows (equities/bonds/real-estate-REITs/alternative) share the
    // portfolio's overall annualized volatility; cash and flat-rate sleeves
    // (real-estate crowdfunding, private equity) have no real daily prices to
    // compute a volatility figure from, so they show — instead of a fake number.
    const rows = [
      ...tickerSpecs.map(s => [s.name, s.ticker, s.weight, true, s.ter]),
      ['Efectivo', 'Estimado', finalWeights.cash, false, null],
      ...flatSpecs.map(s => [s.name, 'Estimado', s.weight, false, s.ter]),
    ];
    rows.forEach(([name, ticker, weight, hasRealData, ter]) => {
      const tr = document.createElement('tr');
      [name, ticker, formatPct(weight, 0), hasRealData ? formatPct(vol, 1) : '—', ter == null ? '—' : formatPct(ter, 2)].forEach((text, ci) => {
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

renderAllSketchIcons();
loadContent();
