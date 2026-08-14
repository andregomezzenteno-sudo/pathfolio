'use strict';
/*
 * engine.js — el motor determinista de PathFolio: perfil de riesgo, reparto,
 * recortes opcionales, simulación de cartera y formato de cifras.
 *
 * Vive separado de app.js a propósito y no toca el DOM ni una sola vez. Dos
 * razones, y las dos importan:
 *
 *  1. La lógica que decide dinero queda aislada de la que pinta pantallas, así
 *     que se puede leer, auditar y razonar sobre ella sin atravesar interfaz.
 *  2. Las pruebas importan ESTE fichero y ejecutan el código que corre en
 *     producción. Antes replicaban las funciones en el propio test, y una
 *     copia siempre acaba desincronizándose del original — de hecho pasó: la
 *     copia se quedó atrás y las pruebas daban verde sobre código que ya no
 *     existía. Un motor sin dependencias del navegador elimina esa clase
 *     entera de fallos.
 *
 * Sin empaquetadores ni paso de compilación: en el navegador se carga con un
 * <script> normal y publica sus funciones como globales; en Node se importa
 * con require/import. El mismo fichero, sin transpilar.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

/* ---------- Motor determinista de asignación ---------- */

const TIER_LABEL = { conservador: 'Conservador', moderado: 'Moderado', arriesgado: 'Arriesgado' };

// "A, B y C" en vez de "A, B, C": lo usan tanto los conectores del
// cuestionario como la narración del dashboard.
const listPhrase = arr =>
  arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];

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
function simulatePortfolio({ dates, closesList, weightsList, expenseRatios = null, cashWeight, cashAnnualRate, flatAssets = [], rebalance = 'annual', barsPerYear = 252 }) {
  const n = dates.length;
  const cashPerBar = Math.pow(1 + cashAnnualRate, 1 / barsPerYear) - 1;
  const flatPerBar = flatAssets.map(a => Math.pow(1 + a.annualRate, 1 / barsPerYear) - 1);
  // Comisiones (TER): los fondos las descuentan del valor liquidativo poco a
  // poco, no de golpe, así que aquí se restan cada sesión. Parecen ridículas
  // en un año y dejan de parecerlo en diez, que es justo por qué merece la
  // pena enseñarlas en euros. Pasando expenseRatios=null se simula la misma
  // cartera sin coste alguno, que es como se calcula cuánto se han llevado.
  const feePerBar = (expenseRatios || weightsList.map(() => 0))
    .map(ter => 1 - Math.pow(1 - (ter || 0), 1 / barsPerYear));

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
      tickerVals[k] *= (c[i] / c[i - 1]) * (1 - feePerBar[k]);
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
// Descuenta la inflación para expresar un importe futuro en euros de HOY.
// Sin esto, "tendrías 90.000 €" engaña sin querer: dentro de diez años esos
// 90.000 € no compran lo que compran hoy, y en un horizonte de jubilación la
// diferencia deja de ser un matiz. La tasa es una asunción documentada
// (assumedAnnualInflation en allocations.json), no un dato medido.
function realValue(nominal, annualInflation, years) {
  return nominal / Math.pow(1 + annualInflation, years);
}

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


  return {
    sliderToTier, applyCap, ageToCapTier, computeEffectiveRisk, getAllocationWeights,
    resolvePicks, averageRiskMultiplier, adjustWeightsForInstrumentRisk, applySleeves,
    CATEGORY_META, computeAllocation, buildAllocationNarrative, getExplanation,
    alignSeriesSet, simulatePortfolio, simulateDCA, annualizedVol, maxDrawdown,
    calendarYearReturns, realValue, formatEUR, formatPct, formatPctValue, displayPercents,
    formatSignedPct, shortDate, TIER_LABEL, listPhrase,
  };
});
