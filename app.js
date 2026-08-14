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

/* ---------- Motor determinista de asignación ---------- */

/* Los sliders son continuos (0-100) para que puedas dejar la barra
   exactamente donde quieras, no en 5 muescas. Los tres tramos siguen
   mapeando a los mismos tres niveles de la tabla de asignación. */
function sliderToTier(v) {
  if (v <= 33) return 'conservador';
  if (v <= 66) return 'moderado';
  return 'arriesgado';
}

function applyCap(currentTier, capTier, riskOrder) {
  if (!capTier) return { tier: currentTier, wasCapped: false };
  const capped = riskOrder.indexOf(capTier) < riskOrder.indexOf(currentTier) ? capTier : currentTier;
  return { tier: capped, wasCapped: capped !== currentTier };
}

// Un tramo de edad de 60+ topa en "moderado" independientemente del riesgo
// declarado y del horizonte — el principio clásico de la senda de jubilación:
// queda menos tiempo para recuperarse de una mala racha, con independencia de
// cómo se SIENTA la persona respecto al riesgo.
function ageToCapTier(age) {
  return age === '60+' ? 'moderado' : null;
}

// Tres señales independientes solo pueden BAJAR el nivel de riesgo efectivo
// respecto al del slider, nunca subirlo: un horizonte corto limita
// objetivamente cuánta volatilidad puedes absorber, una tolerancia baja a
// caídas reales (la pregunta de "¿venderías presa del pánico?") revela una
// capacidad de riesgo real menor de la que sugería el slider abstracto, y un
// tramo de edad cercano a la jubilación limita cuánto tiempo tiene una mala
// racha para recuperarse. Las tres se aplican de forma transparente: la
// interfaz dice cuándo y por qué se ha ajustado, nunca en silencio.
function computeEffectiveRisk(riskSliderValue, horizon, volatilitySliderValue, age, allocations) {
  const order = allocations.riskOrder;
  let tier = sliderToTier(riskSliderValue);

  const afterHorizon = applyCap(tier, allocations.horizonCap[horizon], order);
  tier = afterHorizon.tier;

  // volatilitySliderValue es null mientras la pregunta esté SIN RESPONDER. Un
  // valor por defecto no es una respuesta: si se tratara como tal, la vista
  // previa en vivo toparía el perfil hacia abajo antes de que la persona haya
  // dicho nada sobre cuánta caída aguanta. Igual que horizonte y edad, que ya
  // son null hasta que se responden y por eso no topan nada.
  const afterVol = applyCap(tier, volatilitySliderValue == null ? null : sliderToTier(volatilitySliderValue), order);
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

// Selección MÚLTIPLE: no hay que elegir uno solo. Devuelve la lista de
// instrumentos elegidos (con su clave), cayendo al de referencia si aún no
// se ha respondido — así la vista previa en vivo siempre tiene algo válido
// que dibujar antes de llegar a esa pregunta.
function resolvePicks(selected, optionsMap, defaultKey) {
  const keys = (Array.isArray(selected) ? selected : [selected]).filter(k => k && optionsMap[k]);
  const finalKeys = keys.length ? keys : [defaultKey];
  return finalKeys.map(k => ({ key: k, ...optionsMap[k] }));
}

function averageRiskMultiplier(picks) {
  if (!picks.length) return 1;
  return picks.reduce((a, p) => a + (p.riskMultiplier != null ? p.riskMultiplier : 1), 0) / picks.length;
}

// Hace que la ELECCIÓN DE INSTRUMENTO mueva de verdad los porcentajes del
// donut, no solo qué ticker rellena un hueco de tamaño fijo. Una opción más
// volátil (p. ej. NASDAQ 100, riskMultiplier 1.35) se lleva algo menos de
// peso; la diferencia va al otro bloque — el efectivo no se toca, porque es
// el suelo de seguridad que fijan riesgo/horizonte/edad/volatilidad y no
// tiene nada que ver con qué fondo concreto se eligió. `dampening` mantiene
// el desplazamiento perceptible pero acotado (un motor real de risk parity
// iría más lejos; esto es una aproximación legible y transparente de la
// misma idea). Con selección múltiple entra la MEDIA de los multiplicadores
// elegidos, así mezclar S&P 500 y NASDAQ queda a medio camino de elegir solo
// uno de los dos. Renta variable y fija se renormalizan tras el ajuste para
// que los tres pesos sigan sumando exactamente 1.
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

// Los tres sleeves opcionales (inmobiliario, otras inversiones, private
// equity) son recortes reales SOBRE el peso de renta variable — nunca un
// bloque nuevo, nunca decorativos — aplicados en este orden, cada uno sobre
// lo que quede de renta variable tras el anterior. El inmobiliario escala
// con el nivel de riesgo. Otras inversiones solo entra de verdad si el nivel
// de riesgo FINAL lo permite, sin importar lo que se pidiera antes: una
// porción pequeña pero real de algo así solo tiene sentido cuando todas las
// demás señales ya han coincidido en que la persona puede cargar con ese
// riesgo, así que se vuelve a comprobar al final en vez de fiarse de una
// respuesta dada antes de tener el cuadro completo. Private equity lleva esa
// misma comprobación MÁS un mínimo de importe inicial, igual que los
// vehículos reales de private equity minorista (fondos feeder, ELTIFs) piden
// un ticket mínimo: pedirlo sin capital suficiente se excluye con aviso, no
// se concede en silencio.
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
      ? (!peQualifiesRisk && !peQualifiesCapital ? 'ambos' : (!peQualifiesRisk ? 'riesgo' : 'capital'))
      : null,
  };
}

/* Categorías del donut. El color sigue SIEMPRE a la categoría, nunca a su
   posición o tamaño, para que añadir o quitar un sleeve no repinte al resto. */
const CATEGORY_META = {
  equities:     { name: 'Renta variable',        color: 'var(--series-1)', icon: 'stocks' },
  bonds:        { name: 'Renta fija',            color: 'var(--series-2)', icon: 'bonds' },
  realEstate:   { name: 'Inversión inmobiliaria', color: 'var(--series-4)', icon: 'building' },
  privateEquity:{ name: 'Private Equity',         color: 'var(--series-6)', icon: 'vault' },
  alternative:  { name: 'Otras inversiones',      color: 'var(--series-5)', icon: 'basket' },
  cash:         { name: 'Efectivo',               color: 'var(--series-3)', icon: 'cash' },
};

// Único punto donde se decide la cartera completa. Lo usan tanto la vista
// previa en vivo del cuestionario como el dashboard final, así que ambos no
// pueden desincronizarse por construcción.
function computeAllocation(answers, allocations) {
  const risk = computeEffectiveRisk(answers.risk, answers.horizon, answers.volatility, answers.age, allocations);
  const effectiveRisk = risk.effectiveRisk;
  const baseWeights = getAllocationWeights(effectiveRisk, allocations);

  const equityPicks = resolvePicks(answers.equityIndex, allocations.equityIndexOptions, allocations.defaultEquityIndex);
  const bondsPicks = resolvePicks(answers.bondsChoice, allocations.bondsOptions, allocations.defaultBondsChoice);

  const tilted = adjustWeightsForInstrumentRisk(
    baseWeights, averageRiskMultiplier(equityPicks), averageRiskMultiplier(bondsPicks), allocations.tiltDampening
  );
  const wasTilted = Math.abs(tilted.equities - baseWeights.equities) > 0.005;

  const sleeved = applySleeves(tilted, {
    includeRealEstate: answers.realEstateChoice === 'si',
    includeAlternative: answers.altChoice === 'si',
    includePrivateEquity: answers.peChoice === 'si',
    effectiveRisk, initialAmount: answers.amount,
  }, allocations);
  const w = sleeved.weights;

  const realEstatePicks = w.realEstate > 0
    ? resolvePicks(answers.realEstateType, allocations.realEstateSubtypes, allocations.defaultRealEstateSubtype) : [];
  const altPicks = sleeved.alternativeIncluded
    ? resolvePicks(answers.altType, allocations.alternativeSubtypes, allocations.defaultAlternativeSubtype) : [];

  // El peso de cada bloque se reparte a partes iguales entre los
  // instrumentos elegidos dentro de él: elegir S&P 500 y NASDAQ a la vez da
  // media renta variable a cada uno, no que uno sustituya al otro.
  const split = (picks, total, category) => picks.map(p => ({
    ...p, category, weight: total / picks.length,
    hasRealData: p.hasRealData !== undefined ? p.hasRealData : true,
  }));

  const holdings = [
    ...split(equityPicks, w.equities, 'equities'),
    ...split(bondsPicks, w.bonds, 'bonds'),
    ...split(realEstatePicks, w.realEstate, 'realEstate'),
    ...(sleeved.privateEquityIncluded ? [{
      key: 'privateEquity', category: 'privateEquity', weight: w.privateEquity, hasRealData: false,
      ...allocations.privateEquityInstrument,
    }] : []),
    ...split(altPicks, w.alternative, 'alternative'),
    { key: 'cash', category: 'cash', weight: w.cash, hasRealData: false, label: 'Efectivo', ticker: null,
      name: 'Liquidez disponible', expenseRatio: null,
      illustrativeAnnualRate: allocations.instruments.cash.illustrativeAnnualRate },
  ].filter(h => h.weight > 0);

  const segments = ['equities', 'bonds', 'realEstate', 'privateEquity', 'alternative', 'cash']
    .filter(key => w[key] > 0)
    .map(key => ({
      key, weight: w[key], name: CATEGORY_META[key].name,
      color: CATEGORY_META[key].color, icon: CATEGORY_META[key].icon,
      // Los miembros van como objetos, no como texto: la leyenda, el tooltip
      // del donut y el desglose técnico necesitan el peso de cada uno por
      // separado para poder decir "de ese 40% de renta fija, 20% es deuda
      // pública y 20% corporativa".
      members: holdings.filter(h => h.category === key),
    }));

  // Los porcentajes que se muestran se calculan una sola vez, aquí, con
  // reparto de resto mayor, y se cuelgan del propio segmento/posición. Así
  // la leyenda, el tooltip, la tabla y la narración enseñan exactamente los
  // mismos números y el total cuadra en 100 % en todos ellos.
  const segPcts = displayPercents(segments.map(s => s.weight), 1);
  segments.forEach((s, i) => { s.displayPct = segPcts[i]; });
  const holdPcts = displayPercents(holdings.map(h => h.weight), 1);
  holdings.forEach((h, i) => { h.displayPct = holdPcts[i]; });

  return {
    ...risk, ...sleeved, effectiveRisk, baseWeights, tiltedWeights: tilted, weights: w, wasTilted,
    equityPicks, bondsPicks, realEstatePicks, altPicks, holdings, segments,
  };
}

/* La respuesta real a "explícamelo todo": la cadena completa de cómo se llegó
   a cada porcentaje, con TUS números y no con generalidades — perfil, reparto
   de partida, ajuste por instrumento, cada recorte opcional y el reparto
   final. Cada paso dice de qué cifra se viene y a cuál se va. */
function buildAllocationNarrative(result, answers, allocations) {
  const steps = [];
  const base = result.baseWeights;
  const tilted = result.tiltedWeights;
  const w = result.weights;
  const hasAmount = answers.amount > 0;
  const money = v => hasAmount ? ` (${formatEUR(answers.amount * v, 0)})` : '';

  /* 1 — de dónde sale el nivel de riesgo */
  const caps = [];
  if (result.wasCappedByHorizon) caps.push('el horizonte que elegiste');
  if (result.wasCappedByVolatility) caps.push('la caída que dijiste que aguantarías');
  if (result.wasCappedByAge) caps.push('tu franja de edad');
  steps.push({
    title: `Tu perfil efectivo es ${TIER_LABEL[result.effectiveRisk]}`,
    text: caps.length
      ? `Colocaste el riesgo en ${answers.risk}/100, que por sí solo daría "${sliderToTier(answers.risk)}". Pero ${listPhrase(caps)} ${caps.length > 1 ? 'obligan' : 'obliga'} a rebajarlo hasta "${result.effectiveRisk}". Estas señales solo pueden bajar el riesgo, nunca subirlo.`
      : `Colocaste el riesgo en ${answers.risk}/100 y dijiste que aguantarías una caída de ${answers.volatility}/100. Ni el horizonte, ni esa tolerancia, ni tu edad obligan a rebajarlo, así que el nivel se queda en "${result.effectiveRisk}".`,
  });

  /* 2 — el reparto de partida de ese nivel */
  const basePcts = displayPercents([base.equities, base.bonds, base.cash], 1);
  steps.push({
    title: 'El reparto de partida de ese perfil',
    text: `La tabla de asignación fija, para "${result.effectiveRisk}", un ${formatPctValue(basePcts[0])} en renta variable, un ${formatPctValue(basePcts[1])} en renta fija y un ${formatPctValue(basePcts[2])} en efectivo. Es el punto de partida antes de mirar qué instrumentos concretos elegiste.`,
  });

  /* 3 — cómo mueven los pesos los instrumentos elegidos */
  const eqNames = listPhrase(result.equityPicks.map(p => p.label));
  const bondNames = listPhrase(result.bondsPicks.map(p => p.label));
  if (result.wasTilted) {
    const dir = tilted.equities < base.equities ? 'baja' : 'sube';
    steps.push({
      title: 'Ajuste por los instrumentos que elegiste',
      text: `Elegiste ${eqNames} en renta variable y ${bondNames} en renta fija. Como no son igual de volátiles que nuestras referencias, la renta variable ${dir} de ${formatPct(base.equities, 1)} a ${formatPct(tilted.equities, 1)}, y la renta fija pasa a ${formatPct(tilted.bonds, 1)}. El efectivo no se toca: es el suelo de seguridad que fija tu perfil, no el fondo concreto.`,
    });
  } else {
    steps.push({
      title: 'Los instrumentos que elegiste no mueven los pesos',
      text: `Elegiste ${eqNames} y ${bondNames}, que son justo nuestras opciones de referencia en volatilidad. Al no ser ni más ni menos movidas de lo esperado, el reparto se queda tal cual estaba.`,
    });
  }

  /* 4 — cada recorte opcional, con el antes y el después */
  let runningEquity = tilted.equities;
  if (w.realEstate > 0) {
    const frac = allocations.realEstateFractionByTier[result.effectiveRisk];
    const after = runningEquity - w.realEstate;
    steps.push({
      title: 'Apartas una parte para inversión inmobiliaria',
      text: `Al perfil "${result.effectiveRisk}" le corresponde reservar el ${formatPct(frac, 0)} de la renta variable para ladrillo. Eso son ${formatPct(w.realEstate, 1)} del total${money(w.realEstate)}, que salen de la renta variable: baja de ${formatPct(runningEquity, 1)} a ${formatPct(after, 1)}. La renta fija y el efectivo no se tocan.`,
    });
    runningEquity = after;
  }
  if (w.alternative > 0) {
    const after = runningEquity - w.alternative;
    steps.push({
      title: 'Apartas una parte para otras inversiones',
      text: `Se reserva el ${formatPct(allocations.alternativeFraction, 0)} de lo que queda de renta variable, es decir ${formatPct(w.alternative, 1)} del total${money(w.alternative)}, repartido entre ${listPhrase(result.altPicks.map(p => p.label))}. La renta variable baja de ${formatPct(runningEquity, 1)} a ${formatPct(after, 1)}.`,
    });
    runningEquity = after;
  }
  if (w.privateEquity > 0) {
    const after = runningEquity - w.privateEquity;
    steps.push({
      title: 'Apartas una parte para private equity',
      text: `Tu perfil llega a "arriesgado" y tu importe (${formatEUR(answers.amount, 0)}) supera el mínimo de referencia de ${formatEUR(allocations.privateEquityMinAmount, 0)}, así que entra: el ${formatPct(allocations.privateEquityFraction, 0)} de la renta variable restante, o sea ${formatPct(w.privateEquity, 1)} del total${money(w.privateEquity)}. La renta variable queda en ${formatPct(after, 1)}.`,
    });
    runningEquity = after;
  }

  /* 5 — dentro de cada bloque, qué hay y cuánto */
  result.segments.forEach(seg => {
    if (!seg.members || seg.members.length < 2) return;
    const inner = seg.members
      .map(m => `${m.label} ${formatPctValue(m.displayPct, 1)}${hasAmount ? ` (${formatEUR(answers.amount * m.weight, 0)})` : ''}`)
      .join(', ');
    steps.push({
      title: `Dentro de ese ${formatPctValue(seg.displayPct, 1)} de ${seg.name.toLowerCase()}`,
      text: `Como elegiste ${seg.members.length} opciones, ese bloque se reparte a partes iguales entre ellas: ${inner}.`,
    });
  });

  /* 6 — el reparto final, cuadrado */
  steps.push({
    title: 'Y así queda el reparto final',
    text: result.segments
      .map(s => `${s.name} ${formatPctValue(s.displayPct, 1)}${money(s.weight)}`)
      .join(' · ') + `. Suma ${formatPctValue(result.segments.reduce((a, s) => a + s.displayPct, 0), 1)}.`,
  });

  return steps;
}

function getExplanation(effectiveRisk, horizon, archetypes) {
  return archetypes.explanations[`${effectiveRisk}|${horizon}`] || null;
}

/* ---------- Descarga de datos (Twelve Data — misma clave/patrón que trading-backtester) ---------- */

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
    throw new Error(json.message || ('Error de la API ' + res.status));
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

/* ---------- Matemática de cartera ---------- */

// Generalizada a N series en lugar de un par fijo — cruza todas las series
// hasta quedarse con las fechas que comparten, así añadir un sleeve nunca
// puede desalinear a los demás en silencio.
function alignSeriesSet(seriesList) {
  const maps = seriesList.map(s => new Map(s.dates.map((d, i) => [d, s.closes[i]])));
  const dates = seriesList[0].dates.filter(d => maps.every(m => m.has(d)));
  return { dates, closesList: maps.map(m => dates.map(d => m.get(d))) };
}

// Simula la cartera siguiendo el VALOR de cada posición, no sumando
// rentabilidades diarias ponderadas.
//
// La diferencia no es cosmética. Sumar `Σ wₖ · rₖ` con pesos constantes es,
// implícitamente, rebalancear la cartera TODOS LOS DÍAS: nadie invierte así,
// y además infla un poco el resultado (recoge prima por volatilidad y suaviza
// la caída máxima). Aquí los pesos se fijan al principio y luego derivan con
// el mercado — si la renta variable sube, pasa a pesar más — y solo se
// vuelven a cuadrar en las fechas de rebalanceo pedidas. Así el backtest
// modela lo que de verdad le pasaría a alguien, y de paso permite enseñar
// qué aporta rebalancear, que es uno de los conceptos que explica la app.
//
// weightsList casa 1:1 con closesList. El efectivo va aparte porque no tiene
// serie de precios, y flatAssets cubre los sleeves que tampoco la tienen
// (crowdfunding inmobiliario, private equity): capitalizan a su tasa anual
// documentada, sin ser la línea de comparación "todo en efectivo".
function simulatePortfolio({ dates, closesList, weightsList, cashWeight, cashAnnualRate, flatAssets = [], rebalance = 'annual', barsPerYear = 252 }) {
  const n = dates.length;
  const cashPerBar = Math.pow(1 + cashAnnualRate, 1 / barsPerYear) - 1;
  const flatPerBar = flatAssets.map(a => Math.pow(1 + a.annualRate, 1 / barsPerYear) - 1);

  // Objetivos fijos, y valores que van derivando a partir de ellos.
  const targetTickers = weightsList.slice();
  const targetFlat = flatAssets.map(a => a.weight);
  let tickerVals = targetTickers.slice();
  let cashVal = cashWeight;
  let flatVals = targetFlat.slice();

  const portfolioEquity = new Array(n).fill(1);
  const cashOnlyEquity = new Array(n).fill(1);
  const dailyReturns = [];
  const rebalanceDates = [];
  let lastYear = dates[0].slice(0, 4);

  for (let i = 1; i < n; i++) {
    for (let k = 0; k < tickerVals.length; k++) {
      const c = closesList[k];
      tickerVals[k] *= c[i] / c[i - 1];
    }
    cashVal *= 1 + cashPerBar;
    for (let k = 0; k < flatVals.length; k++) flatVals[k] *= 1 + flatPerBar[k];

    const total = tickerVals.reduce((a, b) => a + b, 0) + cashVal + flatVals.reduce((a, b) => a + b, 0);
    dailyReturns.push(total / portfolioEquity[i - 1] - 1);
    portfolioEquity[i] = total;
    cashOnlyEquity[i] = cashOnlyEquity[i - 1] * (1 + cashPerBar);

    const year = dates[i].slice(0, 4);
    const isNewYear = year !== lastYear;
    if (isNewYear) lastYear = year;
    // "annual" cuadra en la primera sesión de cada año nuevo; "daily" cuadra
    // siempre (equivale al modelo anterior, se conserva para poder compararlo);
    // "none" no cuadra nunca y deja que los pesos deriven.
    if (rebalance === 'daily' || (rebalance === 'annual' && isNewYear)) {
      if (rebalance === 'annual') rebalanceDates.push(dates[i]);
      tickerVals = targetTickers.map(w => total * w);
      cashVal = total * cashWeight;
      flatVals = targetFlat.map(w => total * w);
    }
  }

  // Los pesos con los que se termina, que es lo que hace visible la deriva.
  const finalTotal = portfolioEquity[n - 1];
  const finalWeights = {
    tickers: tickerVals.map(v => v / finalTotal),
    cash: cashVal / finalTotal,
    flat: flatVals.map(v => v / finalTotal),
  };

  return { dates, portfolioEquity, cashOnlyEquity, dailyReturns, rebalanceDates, finalWeights };
}

// Las mismas rentabilidades diarias mezcladas que la línea de aporte único,
// pero sumando una aportación fija la primera vez que aparece cada mes nuevo
// en la serie de fechas — una aproximación simple y honesta del DCA (el
// momento real de aportar dentro del mes varía; esto no pretende lo contrario).
function simulateDCA({ dates, dailyReturns, initialAmount, monthlyAmount }) {
  const n = dates.length;
  const value = new Array(n).fill(0);
  value[0] = initialAmount;
  let lastKey = dates[0].slice(0, 7);
  for (let i = 1; i < n; i++) {
    value[i] = value[i - 1] * (1 + dailyReturns[i - 1]);
    const key = dates[i].slice(0, 7);
    if (monthlyAmount > 0 && key !== lastKey) { value[i] += monthlyAmount; lastKey = key; }
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
  for (const v of equitySeries) { peak = Math.max(peak, v); maxDD = Math.min(maxDD, (v - peak) / peak); }
  return maxDD;
}

// Solo se consideran los años con al menos `minBars` sesiones, para no
// presentar un año parcial (el primero o el último de la serie) como si
// fuera el mejor o el peor año completo — sería engañoso.
function calendarYearReturns(dates, equity, minBars = 200) {
  const spans = new Map();
  dates.forEach((d, i) => {
    const y = d.slice(0, 4);
    if (!spans.has(y)) spans.set(y, { first: i, last: i, bars: 1 });
    else { const s = spans.get(y); s.last = i; s.bars += 1; }
  });
  const out = [];
  spans.forEach((s, year) => {
    if (s.bars >= minBars) out.push({ year, ret: equity[s.last] / equity[s.first] - 1 });
  });
  return out;
}

/* ---------- Formato ---------- */

function formatEUR(v, decimals) {
  if (v == null || Number.isNaN(v)) return '—';
  const d = decimals != null ? decimals : (Math.abs(v) < 1000 ? 2 : 0);
  return v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €';
}
function formatPct(v, decimals = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return (v * 100).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' %';
}
// Para valores YA expresados en porcentaje (0-100), sin volver a multiplicar.
function formatPctValue(p, decimals = 1) {
  if (p == null || Number.isNaN(p)) return '—';
  return p.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' %';
}
// Reparte el redondeo con el método del resto mayor: los porcentajes que se
// ven en pantalla suman EXACTAMENTE 100, en lugar de quedarse en 99,9 o
// pasarse a 100,1 por redondeos independientes. Importa porque toda la
// cartera se lee como porcentajes que deben cuadrar entre sí.
function displayPercents(weights, decimals = 1) {
  const factor = Math.pow(10, decimals);
  const target = Math.round(100 * factor);
  const raw = weights.map(w => w * target);
  const out = raw.map(Math.floor);
  let remainder = target - out.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFraction.length && remainder > 0; k++, remainder--) out[byFraction[k].i] += 1;
  return out.map(v => v / factor);
}
function formatSignedPct(v, decimals = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + formatPct(v, decimals);
}
function shortDate(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
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
function renderDonut(svg, segments, { centerLabel = 'Tu cartera', tooltipEl = null, amount = null } = {}) {
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
  sublabel.textContent = segments.length === 1 ? '1 bloque' : `${segments.length} bloques`;
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
    money.textContent = `${formatEUR(amount * seg.weight, 0)} de ${formatEUR(amount, 0)}`;
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
    label.textContent = 'Total';
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
    label.textContent = shortDate(dates[idx]).replace(/ de \d+$/, '').replace(' de ', ' ');
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
  'indexKnowledge', 'indexLesson', 'equityIndex',
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
  altType: a => a.altChoice === 'si',
};

// Preguntas de selección múltiple: acumulan un array y avanzan con el botón
// "Continuar" en vez de al primer clic.
const MULTI_QUESTIONS = new Set(['equityIndex', 'bondsChoice', 'realEstateType', 'altType']);

function freshAnswers() {
  return {
    age: null, risk: 50, horizon: null,
    rvKnowledge: null, indexKnowledge: null, equityIndex: [],
    bondsKnowledge: null, bondsChoice: [],
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
  progressLabel.textContent = `Pregunta ${pos} de ${total}`;
  backBtn.hidden = pos <= 1;
}

/* "Hilar las cosas": una frase corta arriba de algunas pantallas que nombra
   la respuesta recién dada antes de preguntar lo siguiente, para que el flujo
   se lea como una conversación y no como un montón de campos sueltos. */
const HORIZON_PHRASE = { viaje: 'para un viaje o una meta cercana', casa: 'para comprar una casa', crecer: 'para que crezca, sin prisa', jubilacion: 'para tu jubilación' };
const RISK_PHRASE = v => (v <= 20 ? 'muy baja' : v <= 40 ? 'baja' : v <= 60 ? 'media' : v <= 80 ? 'alta' : 'muy alta');
const listPhrase = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
const labelsOf = (keys, map) => (keys || []).map(k => map[k] && map[k].label).filter(Boolean);

const CONNECTORS = {
  risk: a => a.age ? `Con ${a.age} años, pensemos en cómo encajas las bajadas.` : null,
  rvKnowledge: a => a.horizon ? `Ya que esto es ${HORIZON_PHRASE[a.horizon]}, empecemos por el bloque más grande de casi cualquier cartera.` : null,
  indexKnowledge: () => 'Vale, y dentro de la renta variable no todos los fondos compran lo mismo.',
  equityIndex: () => 'Puedes marcar varios: el peso se reparte entre los que elijas.',
  bondsKnowledge: a => {
    const picks = labelsOf(a.equityIndex, ALLOCATIONS ? ALLOCATIONS.equityIndexOptions : {});
    return picks.length ? `Con ${listPhrase(picks)} en la parte de renta variable, vamos con la otra mitad clásica: la renta fija.` : null;
  },
  bondsChoice: () => 'Igual que antes, puedes marcar más de una.',
  realEstateKnowledge: () => 'Más allá de acciones y bonos hay otras piezas que puedes sumar. Empecemos por los ladrillos.',
  realEstateType: () => 'Puedes quedarte con las dos si te interesan las dos.',
  peKnowledge: a => a.realEstateChoice === 'si' ? 'Con el ladrillo dentro, otra pieza bastante menos conocida: empresas que no cotizan en bolsa.' : 'Otra pieza bastante menos conocida: empresas que no cotizan en bolsa.',
  altKnowledge: () => 'Y una última familia opcional, bastante más movida que el resto.',
  altType: () => 'Marca todas las que te interesen: el peso se reparte entre ellas.',
  volatility: a => `Dijiste que tu tolerancia al riesgo es ${RISK_PHRASE(a.risk)} — vamos a ponerla a prueba con un escenario real.`,
  amount: () => 'Tu perfil ya está casi listo, solo falta ponerle números.',
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

function syncMultiButton(qKey) {
  if (!MULTI_QUESTIONS.has(qKey)) return;
  const btn = document.querySelector(`[data-advance="${qKey}"]`);
  if (!btn) return;
  const count = (answers[qKey] || []).length;
  btn.disabled = count === 0;
  btn.textContent = count === 0 ? 'Elige al menos una opción'
    : count === 1 ? 'Continuar con 1 opción →' : `Continuar con ${count} opciones →`;
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
    renderPreview();
    return;
  }
  answers[question] = value;
  document.querySelectorAll(`[data-options="${question}"] .option-card`).forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  renderPreview();
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

const TIER_LABEL = { conservador: 'Conservador', moderado: 'Moderado', arriesgado: 'Arriesgado' };

function updateRiskPreview() {
  const v = parseInt(riskSlider.value, 10);
  answers.risk = v;
  riskFillGrowth.style.width = v + '%';
  riskFillStability.style.width = (100 - v) + '%';
  riskReadout.textContent = `${v} / 100 · perfil ${TIER_LABEL[sliderToTier(v)]}`;
  renderPreview();
}
riskSlider.addEventListener('input', updateRiskPreview);

// El texto del slider se pinta siempre, pero la respuesta solo se registra
// cuando la persona lo toca o confirma la pregunta — ver la nota sobre
// volatility == null en computeEffectiveRisk().
function renderVolatilityReadout() {
  const v = parseInt(volatilitySlider.value, 10);
  volatilityReadout.textContent = `${v} / 100 · aguantarías una caída ${RISK_PHRASE(v)}`;
}
function commitVolatility() {
  answers.volatility = parseInt(volatilitySlider.value, 10);
  renderVolatilityReadout();
  renderPreview();
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
  runDashboard();
});
amountInput.addEventListener('input', () => {
  answers.amount = Math.max(0, parseFloat(amountInput.value) || 0);
  renderPreview();
});
restartBtn.addEventListener('click', () => {
  screenDashboard.hidden = true;
  document.querySelectorAll('.option-card.selected').forEach(el => el.classList.remove('selected'));
  answers = freshAnswers();
  riskSlider.value = 50; volatilitySlider.value = 50;
  amountInput.value = 1000; monthlyInput.value = 0;
  updateRiskPreview(); renderVolatilityReadout();
  if (previewDonut) previewDonut.__prevDonut = null;
  goToQuiz();
});

/* Vista previa en vivo: la misma cartera que verás al final, recalculada con
   cada respuesta, para que se vea cómo se va construyendo el donut en lugar
   de aparecer de golpe al terminar. */
function renderPreview() {
  if (!ALLOCATIONS || !previewDonut) return;
  const result = computeAllocation(answers, ALLOCATIONS);
  renderDonut(previewDonut, result.segments, { centerLabel: 'Ahora' });
  buildDonutLegend(previewLegend, result.segments);
  previewRiskLabel.textContent = `Perfil ${TIER_LABEL[result.effectiveRisk]}`;
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
  const pool = (CLOUD_FACTS && CLOUD_FACTS.facts[currentCloudTopic]) || [];
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
const backtestStory = document.getElementById('backtestStory');
const statGrid = document.getElementById('statGrid');
const explanationDetail = document.getElementById('explanationDetail');
const detailTableBody = document.getElementById('detailTableBody');
const layer3Toggle = document.getElementById('layer3Toggle');
const layer3Body = document.getElementById('layer3Body');

document.getElementById('retryBtn').addEventListener('click', () => {
  backtestStory.textContent = 'Cargando datos históricos reales…';
  retryRow.hidden = true;
  runDashboard();
});

layer3Toggle.addEventListener('click', () => {
  const expanded = layer3Toggle.getAttribute('aria-expanded') === 'true';
  layer3Toggle.setAttribute('aria-expanded', String(!expanded));
  layer3Body.hidden = expanded;
});

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
  backtestStory.textContent = 'Cargando datos históricos reales…';
  statGrid.textContent = '';
  currentCloudTopic = 'dcaVsLumpSum';
  clearClouds();

  const result = computeAllocation(answers, ALLOCATIONS);
  const { effectiveRisk, weights: finalWeights, holdings, segments } = result;
  const explanation = getExplanation(effectiveRisk, answers.horizon, ARCHETYPES);

  dashHeadline.textContent = explanation ? explanation.headline : '—';
  dashProfileTag.textContent = `Perfil ${TIER_LABEL[effectiveRisk]}`;

  capNotice.hidden = !result.wasCappedByHorizon;
  if (result.wasCappedByHorizon) capNotice.textContent = ARCHETYPES.horizonCapNotice;
  volNotice.hidden = !result.wasCappedByVolatility;
  if (result.wasCappedByVolatility) {
    volNotice.textContent = 'Dijiste que tolerarías más riesgo, pero tu respuesta sobre caídas reales apunta a lo contrario — hemos ajustado la mezcla hacia algo más prudente. Mejor prevenir que vender presa del pánico.';
  }
  ageNotice.hidden = !result.wasCappedByAge;
  if (result.wasCappedByAge) {
    ageNotice.textContent = 'Con 60+ años queda menos tiempo para que una mala racha se recupere antes de necesitar el dinero, así que hemos ajustado la mezcla hacia algo más prudente, al margen de tu tolerancia al riesgo.';
  }
  tiltNotice.hidden = !result.wasTilted;
  if (result.wasTilted) {
    const dir = finalWeights.equities < result.baseWeights.equities ? 'algo menos' : 'algo más';
    const eqNames = listPhrase(result.equityPicks.map(p => p.label));
    const bondNames = listPhrase(result.bondsPicks.map(p => p.label));
    tiltNotice.textContent = `${eqNames} y ${bondNames} no son igual de volátiles que nuestras opciones de referencia, así que le hemos dado a la renta variable ${dir} de peso del que te habría tocado por defecto — buscando mantener el riesgo total parecido, sea cual sea el instrumento concreto que elijas.`;
  }
  altNotice.hidden = !result.alternativeRequestedButExcluded;
  if (result.alternativeRequestedButExcluded) {
    altNotice.textContent = `Pediste sumar "otras inversiones", pero tu perfil final ha acabado siendo "${effectiveRisk}" y no "arriesgado", así que las hemos dejado fuera. Una porción de algo tan volátil solo tiene sentido si todas las demás señales (horizonte, caídas reales, edad) están de acuerdo.`;
  }
  peNotice.hidden = !result.privateEquityRequestedButExcluded;
  if (result.privateEquityRequestedButExcluded) {
    const min = formatEUR(ALLOCATIONS.privateEquityMinAmount, 0);
    peNotice.textContent = 'Pediste sumar private equity, pero ' + {
      riesgo: `tu perfil final ha acabado siendo "${effectiveRisk}" y no "arriesgado"`,
      capital: `los fondos de private equity minoristas suelen pedir un importe mínimo de entrada (aquí usamos ${min} como referencia) y tu importe no llega`,
      ambos: `tu perfil final no es "arriesgado" y además tu importe no alcanza el mínimo habitual de estos fondos (${min})`,
    }[result.privateEquityExcludedReason] + ' — así que lo hemos dejado fuera.';
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

    const fetchedSeries = await mapWithConcurrency(tickerHoldings, 3, h => fetchTickerSeries(h.ticker));
    const aligned = alignSeriesSet(fetchedSeries);
    const cashAnnualRate = ALLOCATIONS.instruments.cash.illustrativeAnnualRate;
    const flatAssets = flatHoldings.map(h => ({ weight: h.weight, annualRate: h.illustrativeAnnualRate }));
    const runSim = (weightsList, cashWeight, flats, rebalance) => simulatePortfolio({
      dates: aligned.dates, closesList: aligned.closesList,
      weightsList, cashWeight, cashAnnualRate, flatAssets: flats, rebalance,
    });

    const tickerWeights = tickerHoldings.map(h => h.weight);
    // La cartera "de verdad" se rebalancea una vez al año, que es la práctica
    // que la propia app enseña. La versión sin rebalancear se calcula también
    // para poder enseñar, en euros, qué aporta ese gesto.
    const blend = runSim(tickerWeights, finalWeights.cash, flatAssets, 'annual');
    const drifted = runSim(tickerWeights, finalWeights.cash, flatAssets, 'none');

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
    const driftedEquityWeight = drifted.finalWeights.tickers
      .reduce((a, w, i) => a + (tickerHoldings[i].category === 'equities' ? w : 0), 0);

    backtestStory.textContent = hasMonthly
      ? `Si hubieras invertido ${formatEUR(answers.amount, 0)} hace ${years.toFixed(1)} años (${shortDate(blend.dates[0])}) y hubieras aportado ${formatEUR(answers.monthly, 0)} más cada mes, hoy tendrías unos ${formatEUR(dcaSeries[n - 1], 0)} habiendo puesto ${formatEUR(totalInvested, 0)} de tu bolsillo — frente a ${formatEUR(finalValue, 0)} si solo hubieras puesto el importe inicial y nada más.`
      : `Si hubieras invertido ${formatEUR(answers.amount, 0)} así hace ${years.toFixed(1)} años (${shortDate(blend.dates[0])}), hoy tendrías unos ${formatEUR(finalValue, 0)}. Dejarlo todo en efectivo, en cambio, habría dado ${formatEUR(cashOnlyValue, 0)}.`;

    buildStatTiles(statGrid, [
      { label: 'Valor final', animate: true, value: hasMonthly ? dcaSeries[n - 1] : finalValue, format: v => formatEUR(v, 0), note: `Partiendo de ${formatEUR(answers.amount, 0)}` },
      { label: 'Rentabilidad total', animate: true, value: growth - 1, format: v => formatSignedPct(v, 1), tone: growth >= 1 ? 'good' : 'bad', note: `En ${years.toFixed(1)} años` },
      { label: 'Rentabilidad anualizada', animate: true, value: cagr, format: v => formatSignedPct(v, 1), tone: cagr >= 0 ? 'good' : 'bad', note: 'TAE equivalente (CAGR)' },
      { label: 'Volatilidad anual', animate: true, value: vol, format: v => formatPct(v, 1), note: 'Cuánto se movió por el camino' },
      { label: 'Máxima caída', animate: true, value: dd, format: v => formatPct(v, 1), tone: 'bad', note: `Habrías visto ${formatEUR(ddPeakEUR, 0)} convertirse en ${formatEUR(ddTroughEUR, 0)}` },
      { label: 'Ventaja sobre el efectivo', animate: true, value: finalValue - cashOnlyValue, format: v => formatEUR(v, 0), tone: finalValue >= cashOnlyValue ? 'good' : 'bad', note: `El efectivo habría dado ${formatEUR(cashOnlyValue, 0)}` },
      best ? { label: 'Mejor año', text: `${formatSignedPct(best.ret, 1)}`, tone: 'good', note: `Año ${best.year}` } : null,
      worst ? { label: 'Peor año', text: `${formatSignedPct(worst.ret, 1)}`, tone: 'bad', note: `Año ${worst.year}` } : null,
      { label: 'Rebalanceando cada año', animate: true, value: rebalanceEdge, format: v => formatEUR(v, 0), tone: rebalanceEdge >= 0 ? 'good' : 'bad', note: `Frente a no tocar nada nunca (${formatEUR(driftedValue, 0)})` },
      { label: 'Respaldado por datos reales', animate: true, value: realDataShare, format: v => formatPct(v, 0), note: estimatedShare > 0.0001 ? `El resto usa tasas estimadas` : 'Toda la cartera tiene precios reales' },
    ].filter(Boolean));

    // Avisos metodológicos: los dos son cosas que inflan el resultado si no se
    // dicen, así que se dicen.
    driftNotice.textContent = `Estas cifras suponen que rebalanceas una vez al año, volviendo a los porcentajes de arriba. Si no lo hicieras, tras ${years.toFixed(1)} años la renta variable habría derivado hasta pesar ${formatPct(driftedEquityWeight, 0)} y acabarías con ${formatEUR(driftedValue, 0)} en lugar de ${formatEUR(finalValue, 0)}.`;
    coverageNotice.hidden = estimatedShare <= 0.0001;
    if (!coverageNotice.hidden) {
      coverageNotice.textContent = `Ojo: el ${formatPct(estimatedShare, 0)} de esta cartera (crowdfunding inmobiliario y/o private equity) no tiene cotización diaria pública, así que se modela con una tasa anual fija. Eso significa que la volatilidad y la caída máxima de arriba son un suelo: en la realidad esa parte también se movería, y las cifras serían algo peores.`;
    }

    const chartSeries = [
      { name: hasMonthly ? 'Solo aporte inicial' : 'Tu cartera', color: 'var(--series-1)', data: blend.portfolioEquity.map(v => answers.amount * v) },
    ];
    if (hasMonthly) chartSeries.push({ name: 'Con aportación mensual', color: 'var(--series-2)', data: dcaSeries });
    chartSeries.push({ name: 'Solo efectivo', color: 'var(--series-3)', data: blend.cashOnlyEquity.map(v => answers.amount * v) });

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
    const comparisons = [{ name: 'Tu cartera', sim: blend, highlight: true }];
    [['equities', 'Solo renta variable'], ['bonds', 'Solo renta fija']].forEach(([cat, label]) => {
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
    ['Solo efectivo', formatEUR(cashOnlyValue, 0), formatSignedPct(cashAnnualRate, 1), formatPct(0, 1), formatPct(0, 1)]
      .forEach((text, ci) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (ci >= 1) td.classList.add('num');
        cashRow.appendChild(td);
      });
    comparisonTableBody.appendChild(cashRow);

    // La lectura de la comparativa, escrita para que no haya que deducirla.
    const equityOnly = comparisons.find(c => c.name === 'Solo renta variable');
    comparisonTakeaway.textContent = equityOnly
      ? `Fíjate en las dos últimas columnas más que en la primera: llevarlo todo a renta variable habría dado ${formatEUR(answers.amount * equityOnly.sim.portfolioEquity[equityOnly.sim.portfolioEquity.length - 1], 0)}, pero con una caída máxima del ${formatPct(Math.abs(maxDrawdown(equityOnly.sim.portfolioEquity)), 0)} en vez del ${formatPct(Math.abs(dd), 0)}. Diversificar no busca ganar más, busca que el camino sea aguantable — porque la cartera que abandonas a mitad no te sirve de nada.`
      : 'Diversificar no busca ganar más, busca que el camino sea lo bastante aguantable como para no abandonarlo a mitad.';

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
      const groupCells = [seg.name, `${seg.members.length} ${seg.members.length === 1 ? 'instrumento' : 'instrumentos'}`, '',
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
          '', h.label, h.ticker || 'Estimación',
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
    ['Cartera completa', '', '',
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
    backtestStory.textContent = `${err.message}. El plan gratuito de datos permite 8 peticiones por minuto y has elegido bastantes instrumentos, así que puede ser eso — espera unos segundos y reinténtalo.`;
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

renderAllSketchIcons();
updateRiskPreview();
renderVolatilityReadout();
loadContent();
