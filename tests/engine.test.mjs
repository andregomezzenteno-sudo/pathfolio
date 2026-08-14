import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ruta relativa al propio fichero: las pruebas tienen que correr igual en
// Windows en local que en el Ubuntu del CI.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const ALLOCATIONS = JSON.parse(read('allocations.json'));
const ARCHETYPES = JSON.parse(read('archetypes.json'));
const CLOUD_FACTS = JSON.parse(read('cloudFacts.json'));

/* Estas pruebas importan engine.js DIRECTAMENTE: ejecutan el mismo código que
   corre en el navegador, no una copia. Antes el test replicaba las funciones
   y esa copia se desincronizó del original más de una vez, dando verde sobre
   código que ya no existía. Importar el motor real elimina esa clase entera
   de fallos, y solo es posible porque engine.js no toca el DOM. */
import engine from '../engine.js';

const {
  sliderToTier, computeEffectiveRisk, resolvePicks, averageRiskMultiplier,
  adjustWeightsForInstrumentRisk, applySleeves, computeAllocation, buildAllocationNarrative,
  alignSeriesSet, simulatePortfolio, simulateDCA, annualizedVol, maxDrawdown,
  calendarYearReturns, realValue, displayPercents,
} = engine;

/* Implementación de REFERENCIA del modelo antiguo (suma ponderada de
   rentabilidades diarias con pesos constantes). No es una copia de código en
   producción — ese modelo ya no existe — sino el patrón contra el que se
   comprueba que simulatePortfolio en modo "daily" lo reproduce exactamente.
   Ahí está la prueba de que aquel modelo asumía, sin declararlo, que se
   rebalanceaba todos los días. */
function legacyDailyRebalanceBlend({ dates, closesList, weightsList, cashWeight, cashAnnualRate, barsPerYear = 252 }) {
  const n = dates.length;
  const cashPerBar = Math.pow(1 + cashAnnualRate, 1 / barsPerYear) - 1;
  const portfolioEquity = new Array(n).fill(1);
  for (let i = 1; i < n; i++) {
    let blended = cashWeight * cashPerBar;
    for (let k = 0; k < closesList.length; k++) {
      const c = closesList[k];
      blended += weightsList[k] * (c[i] - c[i - 1]) / c[i - 1];
    }
    portfolioEquity[i] = portfolioEquity[i - 1] * (1 + blended);
  }
  return { portfolioEquity };
}

function assert(cond, msg) { if (!cond) throw new Error('FALLO: ' + msg); }
function approx(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }
const baseAnswers = () => ({
  age: null, risk: 50, horizon: null, equityIndex: [], bondsChoice: [],
  realEstateChoice: null, realEstateType: [], peChoice: null,
  altChoice: null, altType: [], volatility: 50, amount: 1000,
});

/* ---- allocations.json: coherencia básica ---- */
{
  for (const tier of ALLOCATIONS.riskOrder) {
    const w = ALLOCATIONS.buckets[tier];
    assert(approx(w.equities + w.bonds + w.cash, 1, 1e-9), `los pesos de ${tier} deberían sumar 1`);
  }
  const eqByTier = ALLOCATIONS.riskOrder.map(t => ALLOCATIONS.buckets[t].equities);
  for (let i = 1; i < eqByTier.length; i++) {
    assert(eqByTier[i] > eqByTier[i - 1], 'riskOrder debería crecer monótonamente en renta variable');
  }
  console.log('OK: los pesos de allocations.json suman 1 y crecen de forma monótona por nivel de riesgo');
}

/* ---- slider continuo: los tres tramos y sus fronteras exactas ---- */
{
  const cases = [[0, 'conservador'], [33, 'conservador'], [34, 'moderado'], [50, 'moderado'], [66, 'moderado'], [67, 'arriesgado'], [100, 'arriesgado']];
  for (const [v, expected] of cases) {
    assert(sliderToTier(v) === expected, `slider ${v} debería dar ${expected}, dio ${sliderToTier(v)}`);
  }
  console.log('OK: el slider continuo (0-100) mapea a los tres niveles con fronteras exactas en 33/34 y 66/67');
}

/* ---- los tres topes de riesgo, sueltos y combinados ---- */
{
  const r1 = computeEffectiveRisk(100, 'viaje', 100, '31-45', ALLOCATIONS);
  assert(r1.effectiveRisk === 'moderado' && r1.wasCappedByHorizon, 'un horizonte corto debería topar arriesgado en moderado');

  const r2 = computeEffectiveRisk(100, 'jubilacion', 10, '31-45', ALLOCATIONS);
  assert(r2.effectiveRisk === 'conservador' && r2.wasCappedByVolatility, 'una tolerancia baja a caídas reales debería topar hacia abajo');

  const r3 = computeEffectiveRisk(100, 'jubilacion', 100, '60+', ALLOCATIONS);
  assert(r3.effectiveRisk === 'moderado' && r3.wasCappedByAge, '60+ debería topar en moderado aunque todo lo demás diga arriesgado');

  const r4 = computeEffectiveRisk(100, 'viaje', 10, '60+', ALLOCATIONS);
  assert(r4.effectiveRisk === 'conservador', 'los tres topes juntos deberían llevar al nivel más conservador');

  const r5 = computeEffectiveRisk(100, 'jubilacion', 100, '31-45', ALLOCATIONS);
  assert(r5.effectiveRisk === 'arriesgado' && !r5.wasCappedByHorizon && !r5.wasCappedByVolatility && !r5.wasCappedByAge,
    'sin señales en contra, arriesgado debería quedarse en arriesgado sin avisos falsos');

  const r6 = computeEffectiveRisk(10, 'viaje', 10, '60+', ALLOCATIONS);
  assert(r6.effectiveRisk === 'conservador' && !r6.wasCappedByHorizon && !r6.wasCappedByAge,
    'un perfil que YA es conservador no debería reportarse como "ajustado" por topes que no le afectan');

  console.log('OK: horizonte, tolerancia a caídas y edad solo bajan el nivel, se combinan bien y nunca avisan de un ajuste que no ocurrió');
}

/* ---- una pregunta SIN RESPONDER no debe topar nada ---- */
{
  // Con la volatilidad todavía sin responder (null), un perfil arriesgado
  // debe seguir siendo arriesgado en la vista previa en vivo: un valor por
  // defecto del slider no es una respuesta de la persona.
  const pending = computeEffectiveRisk(88, 'jubilacion', null, '31-45', ALLOCATIONS);
  assert(pending.effectiveRisk === 'arriesgado' && !pending.wasCappedByVolatility,
    `con la volatilidad sin responder no debería toparse nada, dio ${JSON.stringify(pending)}`);

  // En cuanto se responde de verdad con un valor bajo, sí debe topar.
  const answered = computeEffectiveRisk(88, 'jubilacion', 50, '31-45', ALLOCATIONS);
  assert(answered.effectiveRisk === 'moderado' && answered.wasCappedByVolatility,
    'una vez respondida, una tolerancia media sí debería topar un perfil arriesgado');

  // Lo mismo aplica a horizonte y edad, que ya son null hasta responderse.
  const nothingAnswered = computeEffectiveRisk(88, null, null, null, ALLOCATIONS);
  assert(nothingAnswered.effectiveRisk === 'arriesgado', 'sin ninguna señal respondida no debería aplicarse ningún tope');
  console.log('OK: las preguntas sin responder no topan el perfil (un valor por defecto del slider no cuenta como respuesta)');
}

/* ---- cobertura de arquetipos ---- */
{
  const missing = [];
  for (const statedRisk of [10, 50, 100]) {
    for (const horizon of Object.keys(ALLOCATIONS.horizonCap)) {
      const { effectiveRisk } = computeEffectiveRisk(statedRisk, horizon, 100, '31-45', ALLOCATIONS);
      if (!ARCHETYPES.explanations[`${effectiveRisk}|${horizon}`]) missing.push(`${effectiveRisk}|${horizon}`);
    }
  }
  assert(missing.length === 0, `faltan arquetipos para combinaciones alcanzables: ${missing.join(', ')}`);
  for (const [key, entry] of Object.entries(ARCHETYPES.explanations)) {
    assert(entry.headline && entry.headline.length > 20, `${key}: titular demasiado corto o ausente`);
    assert(entry.detail && entry.detail.length > 60, `${key}: detalle demasiado corto o ausente`);
  }
  console.log(`OK: los arquetipos cubren las ${Object.keys(ARCHETYPES.explanations).length} combinaciones alcanzables con contenido real`);
}

/* ---- resolvePicks: selección múltiple, con respaldos sensatos ---- */
{
  const opts = ALLOCATIONS.equityIndexOptions;
  assert(resolvePicks(['sp500'], opts, 'msci').map(p => p.key).join() === 'sp500', 'una sola elección debería resolverse tal cual');
  assert(resolvePicks(['sp500', 'nasdaq100'], opts, 'msci').length === 2, 'debería admitir varias elecciones a la vez');
  assert(resolvePicks([], opts, 'msci').map(p => p.key).join() === 'msci', 'sin elección debería caer al valor por defecto');
  assert(resolvePicks(['inventado'], opts, 'msci').map(p => p.key).join() === 'msci', 'una clave inválida debería caer al valor por defecto');
  assert(resolvePicks(null, opts, 'msci').map(p => p.key).join() === 'msci', 'null debería caer al valor por defecto');
  assert(resolvePicks(['sp500', 'inventado'], opts, 'msci').map(p => p.key).join() === 'sp500', 'debería filtrar las claves inválidas y quedarse con las válidas');
  console.log('OK: resolvePicks admite selección múltiple y cae a la opción de referencia ante entradas vacías o inválidas');
}

/* ---- el ajuste por riesgo usa la MEDIA de los instrumentos elegidos ---- */
{
  const base = { equities: 0.50, bonds: 0.40, cash: 0.10 };
  const D = ALLOCATIONS.tiltDampening;

  const neutral = adjustWeightsForInstrumentRisk(base, 1.0, 1.0, D);
  assert(approx(neutral.equities, base.equities, 1e-9), 'instrumentos de referencia (multiplicador 1.0) no deberían producir ningún ajuste');

  const onlyNasdaq = adjustWeightsForInstrumentRisk(base, ALLOCATIONS.equityIndexOptions.nasdaq100.riskMultiplier, 1.0, D);
  assert(onlyNasdaq.equities < base.equities - 0.005, 'elegir solo NASDAQ 100 debería recortar el peso de renta variable de forma visible');

  const bothIndices = resolvePicks(['nasdaq100', 'msci'], ALLOCATIONS.equityIndexOptions, 'msci');
  const avg = averageRiskMultiplier(bothIndices);
  assert(approx(avg, (1.35 + 1.0) / 2, 1e-9), `la media de NASDAQ+MSCI debería ser 1.175, dio ${avg}`);
  const mixed = adjustWeightsForInstrumentRisk(base, avg, 1.0, D);
  assert(mixed.equities > onlyNasdaq.equities && mixed.equities < base.equities,
    'mezclar NASDAQ con MSCI debería quedar a medio camino entre elegir solo NASDAQ y no ajustar nada');
  assert(approx(mixed.cash, base.cash, 1e-9), 'el efectivo nunca debería moverse por la elección de instrumento');
  console.log(`OK: con selección múltiple el ajuste usa la media (NASDAQ solo: ${(onlyNasdaq.equities * 100).toFixed(1)}%, NASDAQ+MSCI: ${(mixed.equities * 100).toFixed(1)}%, referencia: 50.0%)`);
}

/* ---- computeAllocation: el peso de cada bloque se reparte entre lo elegido ---- */
{
  const a = { ...baseAnswers(), risk: 100, volatility: 100, horizon: 'jubilacion', age: '31-45', equityIndex: ['sp500', 'nasdaq100'] };
  const res = computeAllocation(a, ALLOCATIONS);
  const eqHoldings = res.holdings.filter(h => h.category === 'equities');
  assert(eqHoldings.length === 2, `elegir dos índices debería dar dos posiciones de renta variable, dio ${eqHoldings.length}`);
  assert(approx(eqHoldings[0].weight, eqHoldings[1].weight, 1e-12), 'el peso debería repartirse a partes iguales entre los índices elegidos');
  assert(approx(eqHoldings[0].weight + eqHoldings[1].weight, res.weights.equities, 1e-12),
    'las posiciones deberían sumar exactamente el peso del bloque de renta variable');

  const totalWeight = res.holdings.reduce((s, h) => s + h.weight, 0);
  assert(approx(totalWeight, 1, 1e-9), `todas las posiciones juntas deberían sumar 1, dio ${totalWeight}`);

  const one = computeAllocation({ ...a, equityIndex: ['sp500'] }, ALLOCATIONS);
  assert(one.holdings.filter(h => h.category === 'equities').length === 1, 'elegir un solo índice debería dar una sola posición');
  console.log('OK: computeAllocation reparte el peso de cada bloque a partes iguales entre los instrumentos elegidos y el total sigue sumando 1');
}

/* ---- segmentos del donut: 3 como mínimo, 6 como máximo, color por categoría ---- */
{
  const minimal = computeAllocation({ ...baseAnswers(), horizon: 'jubilacion', age: '31-45' }, ALLOCATIONS);
  assert(minimal.segments.length === 3, `sin sleeves debería haber 3 segmentos, hubo ${minimal.segments.length}`);

  const maximal = computeAllocation({
    ...baseAnswers(), risk: 100, volatility: 100, horizon: 'jubilacion', age: '31-45', amount: 50000,
    realEstateChoice: 'si', realEstateType: ['reits', 'crowdfunding'],
    peChoice: 'si', altChoice: 'si', altType: ['crypto', 'metales', 'materiasPrimas'],
  }, ALLOCATIONS);
  assert(maximal.segments.length === 6, `con todo activado debería haber 6 segmentos, hubo ${maximal.segments.length}`);
  assert(approx(maximal.segments.reduce((s, x) => s + x.weight, 0), 1, 1e-9), 'los segmentos deberían sumar 1');
  assert(maximal.holdings.length === 9, `debería haber 9 posiciones (1 rv + 1 rf + 2 inmob + 1 PE + 3 otras + efectivo), hubo ${maximal.holdings.length}`);
  console.log('OK: el donut va de 3 a 6 categorías y con todo activado desglosa 9 posiciones reales que suman 1');
}

/* ---- los porcentajes en pantalla suman exactamente 100 ---- */
{
  // Tres tercios redondeados por separado darían 33,3 x3 = 99,9. El reparto
  // por resto mayor tiene que corregirlo.
  const thirds = displayPercents([1 / 3, 1 / 3, 1 / 3], 1);
  assert(approx(thirds.reduce((a, b) => a + b, 0), 100, 1e-9), `tres tercios deberían sumar 100, sumaron ${thirds.reduce((a, b) => a + b, 0)}`);

  const seven = displayPercents(new Array(7).fill(1 / 7), 1);
  assert(approx(seven.reduce((a, b) => a + b, 0), 100, 1e-9), 'siete séptimos deberían sumar 100');

  // Y sobre repartos reales de la propia app, con y sin sleeves.
  for (const answers of [
    { ...baseAnswers(), horizon: 'jubilacion', age: '31-45' },
    { ...baseAnswers(), risk: 100, volatility: 100, horizon: 'jubilacion', age: '31-45', amount: 50000,
      realEstateChoice: 'si', realEstateType: ['reits', 'crowdfunding'], peChoice: 'si',
      altChoice: 'si', altType: ['crypto', 'metales', 'materiasPrimas'], equityIndex: ['sp500', 'nasdaq100'] },
  ]) {
    const res = computeAllocation(answers, ALLOCATIONS);
    const segSum = displayPercents(res.segments.map(s => s.weight), 1).reduce((a, b) => a + b, 0);
    const holdSum = displayPercents(res.holdings.map(h => h.weight), 1).reduce((a, b) => a + b, 0);
    assert(approx(segSum, 100, 1e-9), `los porcentajes de las categorías deberían sumar 100, sumaron ${segSum}`);
    assert(approx(holdSum, 100, 1e-9), `los porcentajes de las posiciones deberían sumar 100, sumaron ${holdSum}`);
  }

  // Ningún bloque real debe quedarse en 0,0 % por redondeo hacia abajo.
  const tiny = displayPercents([0.9994, 0.0006], 1);
  assert(tiny[1] > 0, 'un bloque diminuto pero real no debería redondearse hasta desaparecer del todo');
  console.log('OK: los porcentajes que se muestran suman exactamente 100 (reparto por resto mayor), en categorías y en posiciones');
}

/* ---- cada categoría desglosa qué lleva dentro y cuánto ---- */
{
  const res = computeAllocation({
    ...baseAnswers(), risk: 100, volatility: 100, horizon: 'jubilacion', age: '31-45',
    equityIndex: ['sp500', 'nasdaq100', 'msci'], bondsChoice: ['govt', 'corporate'],
  }, ALLOCATIONS);

  const bonds = res.segments.find(s => s.key === 'bonds');
  assert(Array.isArray(bonds.members), 'los miembros de una categoría deben ser objetos, no una cadena de texto');
  assert(bonds.members.length === 2, `renta fija debería desglosar 2 instrumentos, desglosó ${bonds.members.length}`);
  assert(bonds.members.every(m => typeof m.weight === 'number' && m.label),
    'cada instrumento del desglose necesita su propio peso y etiqueta');
  assert(approx(bonds.members.reduce((a, m) => a + m.weight, 0), bonds.weight, 1e-12),
    'los instrumentos de una categoría deben sumar exactamente el peso de esa categoría');

  const equities = res.segments.find(s => s.key === 'equities');
  assert(equities.members.length === 3, 'renta variable debería desglosar los 3 índices elegidos');
  console.log('OK: cada categoría del donut lleva el desglose de sus instrumentos, y cada desglose suma el peso de su categoría');
}

/* ---- alignSeriesSet ---- */
{
  const A = { dates: ['2020-01-01', '2020-01-02', '2020-01-03', '2020-01-06'], closes: [100, 101, 102, 103] };
  const B = { dates: ['2020-01-01', '2020-01-02', '2020-01-06'], closes: [50, 50.5, 51] };
  const C = { dates: ['2020-01-01', '2020-01-02', '2020-01-03', '2020-01-06'], closes: [10, 10.1, 10.2, 10.3] };

  const a2 = alignSeriesSet([A, B]);
  assert(a2.dates.length === 3 && !a2.dates.includes('2020-01-03'), 'debería quedarse solo con las fechas comunes');
  assert(a2.closesList[0][2] === 103 && a2.closesList[1][2] === 51, 'los valores deberían seguir alineados tras el hueco');

  const a3 = alignSeriesSet([A, B, C]);
  assert(a3.dates.length === 3 && a3.closesList.length === 3, 'con 3 series debería seguir cruzando por el hueco de B');
  console.log('OK: alignSeriesSet cruza correctamente 2 y 3+ series sin desalinear valores');
}

/* ---- blendPortfolio, incluido flatAssets ---- */
{
  const dates = ['d0', 'd1', 'd2', 'd3'];
  const eq = [100, 110, 99, 121], bond = [100, 101, 102, 103];
  const cashRate = 0.02;
  const cashPerBar = Math.pow(1.02, 1 / 252) - 1;
  const eqRet1 = 0.10, bondRet1 = 0.01;

  const blend = simulatePortfolio({ dates, closesList: [eq, bond], weightsList: [0.6, 0.3], cashWeight: 0.1, cashAnnualRate: cashRate, rebalance: 'daily' });
  assert(approx(blend.portfolioEquity[1], 1 * (1 + 0.6 * eqRet1 + 0.3 * bondRet1 + 0.1 * cashPerBar), 1e-9), 'la mezcla del día 1 no cuadra con el cálculo manual');

  const allCash = simulatePortfolio({ dates, closesList: [eq], weightsList: [0], cashWeight: 1, cashAnnualRate: cashRate, rebalance: 'daily' });
  for (let i = 0; i < dates.length; i++) {
    assert(approx(allCash.portfolioEquity[i], allCash.cashOnlyEquity[i], 1e-9), '100% efectivo debería coincidir exactamente con la curva de solo efectivo');
  }

  const allEquity = simulatePortfolio({ dates, closesList: [eq], weightsList: [1], cashWeight: 0, cashAnnualRate: cashRate, rebalance: 'daily' });
  for (let i = 0; i < dates.length; i++) {
    assert(approx(allEquity.portfolioEquity[i], eq[i] / eq[0], 1e-9), '100% renta variable debería coincidir con la curva bruta del activo');
  }

  // 4 tickers reales
  const reits = [100, 105, 95, 130], gold = [100, 103, 101, 108];
  const w4 = [0.4, 0.3, 0.2, 0.1];
  const blend4 = simulatePortfolio({ dates, closesList: [eq, bond, reits, gold], weightsList: w4, cashWeight: 0, cashAnnualRate: 0, rebalance: 'daily' });
  const expected4 = 1 + w4[0] * eqRet1 + w4[1] * bondRet1 + w4[2] * 0.05 + w4[3] * 0.03;
  assert(approx(blend4.portfolioEquity[1], expected4, 1e-9), 'la mezcla de 4 tickers no cuadra con el cálculo manual');

  // sleeves de tasa fija (crowdfunding / private equity)
  const flat = simulatePortfolio({
    dates, closesList: [eq], weightsList: [0.5], cashWeight: 0.2, cashAnnualRate: cashRate,
    flatAssets: [{ weight: 0.2, annualRate: 0.11 }, { weight: 0.1, annualRate: 0.07 }], rebalance: 'daily',
  });
  const pePerBar = Math.pow(1.11, 1 / 252) - 1, cfPerBar = Math.pow(1.07, 1 / 252) - 1;
  assert(approx(flat.portfolioEquity[1], 1 * (1 + 0.5 * eqRet1 + 0.2 * cashPerBar + 0.2 * pePerBar + 0.1 * cfPerBar), 1e-9),
    'la mezcla con varios activos de tasa fija no cuadra con el cálculo manual');
  assert(!approx(flat.cashOnlyEquity[1], flat.portfolioEquity[1]),
    'los activos de tasa fija NO deben mezclarse dentro de la línea de comparación "solo efectivo"');
  console.log('OK: simulatePortfolio cuadra con el cálculo manual en 2 y 4 tickers, y capitaliza varios sleeves de tasa fija sin contaminar la línea de efectivo');
}

/* ---- simulatePortfolio: el modelo de unidades y el rebalanceo ---- */
{
  const dates = ['d0', 'd1', 'd2', 'd3'];
  const eq = [100, 110, 99, 121], bond = [100, 101, 102, 103];
  const cashRate = 0.02;

  // 1) Rebalancear a diario tiene que dar EXACTAMENTE lo mismo que el modelo
  // anterior de "suma ponderada de rentabilidades". Es la prueba de que el
  // modelo viejo asumía, sin decirlo, un rebalanceo diario — y de que el
  // nuevo lo generaliza en vez de cambiar de resultado por capricho.
  const oldModel = legacyDailyRebalanceBlend({ dates, closesList: [eq, bond], weightsList: [0.6, 0.3], cashWeight: 0.1, cashAnnualRate: cashRate });
  const daily = simulatePortfolio({ dates, closesList: [eq, bond], weightsList: [0.6, 0.3], cashWeight: 0.1, cashAnnualRate: cashRate, rebalance: 'daily' });
  for (let i = 0; i < dates.length; i++) {
    assert(approx(daily.portfolioEquity[i], oldModel.portfolioEquity[i], 1e-12),
      `rebalanceo diario debería reproducir el modelo antiguo en el índice ${i}: ${daily.portfolioEquity[i]} vs ${oldModel.portfolioEquity[i]}`);
  }
  console.log('OK: rebalancear a diario reproduce exactamente el modelo antiguo — confirma que aquel asumía rebalanceo diario sin declararlo');

  // 2) Sin rebalancear, los pesos DERIVAN: si la renta variable sube más,
  // acaba pesando más que su objetivo. Ese es justo el efecto que el modelo
  // antiguo escondía.
  const drift = simulatePortfolio({ dates, closesList: [eq, bond], weightsList: [0.5, 0.5], cashWeight: 0, cashAnnualRate: 0, rebalance: 'none' });
  assert(drift.finalWeights.tickers[0] > 0.5, `sin rebalancear, el activo que más sube debería acabar pesando más de su objetivo, acabó en ${drift.finalWeights.tickers[0]}`);
  assert(approx(drift.finalWeights.tickers[0] + drift.finalWeights.tickers[1], 1, 1e-9), 'los pesos finales deberían seguir sumando 1');

  // Y una cartera de un solo activo debe seguir clavada a la curva de ese
  // activo, se rebalancee como se rebalancee (no hay nada que cuadrar).
  for (const mode of ['none', 'annual', 'daily']) {
    const solo = simulatePortfolio({ dates, closesList: [eq], weightsList: [1], cashWeight: 0, cashAnnualRate: 0, rebalance: mode });
    for (let i = 0; i < dates.length; i++) {
      assert(approx(solo.portfolioEquity[i], eq[i] / eq[0], 1e-12), `con un solo activo y rebalanceo "${mode}" la curva debería ser la del activo`);
    }
  }
  console.log('OK: sin rebalancear los pesos derivan de verdad (los objetivos ya no se imponen cada día) y una cartera de un activo sigue su curva');

  // 3) El rebalanceo anual solo cuadra al empezar cada año natural nuevo.
  const longDates = [], longEq = [], longBond = [];
  for (let y = 2020; y <= 2023; y++) {
    for (let d = 1; d <= 60; d++) {
      longDates.push(`${y}-01-${String((d % 28) + 1).padStart(2, '0')}`);
      longEq.push(100 * Math.pow(1.001, longEq.length));
      longBond.push(100 * Math.pow(1.0001, longBond.length));
    }
  }
  const annual = simulatePortfolio({ dates: longDates, closesList: [longEq, longBond], weightsList: [0.6, 0.4], cashWeight: 0, cashAnnualRate: 0, rebalance: 'annual' });
  assert(annual.rebalanceDates.length === 3, `con 4 años naturales debería rebalancear 3 veces (al entrar en 2021, 2022 y 2023), hizo ${annual.rebalanceDates.length}`);
  assert(annual.rebalanceDates.every(d => d.startsWith('2021') || d.startsWith('2022') || d.startsWith('2023')),
    'los rebalanceos deberían caer en la primera sesión de cada año nuevo');

  // Rebalancear tiene que quedar ENTRE no tocar nada y tocar cada día.
  const annualEnd = annual.portfolioEquity[annual.portfolioEquity.length - 1];
  const noneEnd = simulatePortfolio({ dates: longDates, closesList: [longEq, longBond], weightsList: [0.6, 0.4], cashWeight: 0, cashAnnualRate: 0, rebalance: 'none' }).portfolioEquity.slice(-1)[0];
  assert(annualEnd !== noneEnd, 'rebalancear debería dar un resultado distinto de no rebalancear nunca');
  console.log(`OK: el rebalanceo anual cuadra la cartera ${annual.rebalanceDates.length} veces (una por año nuevo) y da un resultado distinto de dejarla derivar`);

  // 4) Los sleeves de tasa fija siguen capitalizando y no contaminan la línea
  // de comparación de efectivo.
  const withFlat = simulatePortfolio({
    dates, closesList: [eq], weightsList: [0.7], cashWeight: 0.2, cashAnnualRate: cashRate,
    flatAssets: [{ weight: 0.1, annualRate: 0.11 }], rebalance: 'annual',
  });
  assert(withFlat.finalWeights.flat.length === 1 && withFlat.finalWeights.flat[0] > 0, 'el sleeve de tasa fija debería seguir teniendo peso al final');
  assert(!approx(withFlat.cashOnlyEquity[3], withFlat.portfolioEquity[3]), 'la línea de solo efectivo no debe incluir los activos de tasa fija');
  console.log('OK: los sleeves de tasa fija capitalizan dentro de la cartera sin contaminar la línea de "solo efectivo"');
}

/* ---- comisiones (TER) e inflación ---- */
{
  const dates = [], flat = [];
  for (let y = 2015; y <= 2024; y++) for (let d = 0; d < 252; d++) { dates.push(`${y}-06-15`); flat.push(100); }
  // Un activo totalmente plano aísla el efecto: cualquier diferencia con 1
  // es exclusivamente coste.
  const free = simulatePortfolio({ dates, closesList: [flat], weightsList: [1], cashWeight: 0, cashAnnualRate: 0, rebalance: 'none' });
  const paid = simulatePortfolio({ dates, closesList: [flat], weightsList: [1], expenseRatios: [0.01], cashWeight: 0, cashAnnualRate: 0, rebalance: 'none' });
  assert(approx(free.portfolioEquity[free.portfolioEquity.length - 1], 1, 1e-12), 'sin coste, un activo plano debería quedarse clavado en 1');

  const kept = paid.portfolioEquity[paid.portfolioEquity.length - 1];
  // Entre n fechas hay n-1 sesiones, y la comisión se cobra en cada una: el
  // periodo efectivo es (n-1)/252 años, no n/252.
  const yearsCharged = (dates.length - 1) / 252;
  const expected = Math.pow(1 - 0.01, yearsCharged);
  assert(approx(kept, expected, 1e-12), `un TER del 1 % durante ${yearsCharged.toFixed(4)} años debería dejar ${expected}, dejó ${kept}`);
  assert(kept < 0.91 && kept > 0.90, `ese 1 % anual, que suena a nada, se come casi el 10 % del capital en 10 años (quedó ${(kept * 100).toFixed(1)} %)`);

  // Con TER a cero el resultado tiene que ser idéntico a no pasar el parámetro,
  // para que la comparación "con y sin comisiones" del dashboard sea limpia.
  const zero = simulatePortfolio({ dates, closesList: [flat], weightsList: [1], expenseRatios: [0], cashWeight: 0, cashAnnualRate: 0, rebalance: 'none' });
  assert(approx(zero.portfolioEquity[zero.portfolioEquity.length - 1], 1, 1e-12), 'un TER de 0 debería equivaler a no cobrar comisión');
  console.log(`OK: el TER se descuenta cada sesión — un 1 % anual deja ${(kept * 100).toFixed(1)} % del capital a 10 años, y a 0 no cobra nada`);

  // Inflación: descontar y capitalizar tienen que ser inversas exactas.
  assert(approx(realValue(1000, 0, 10), 1000, 1e-9), 'sin inflación, el valor real es el nominal');
  assert(approx(realValue(1000 * Math.pow(1.02, 10), 0.02, 10), 1000, 1e-9), 'descontar debería deshacer exactamente la capitalización');
  assert(realValue(90000, 0.02, 10) < 90000, 'con inflación positiva, el valor real siempre es menor que el nominal');
  assert(realValue(90000, 0.02, 30) < realValue(90000, 0.02, 10), 'cuanto más lejos, más poder adquisitivo se pierde');
  assert(typeof ALLOCATIONS.assumedAnnualInflation === 'number' && ALLOCATIONS.assumedAnnualInflation > 0,
    'la inflación asumida debería estar documentada en allocations.json');
  console.log(`OK: la inflación descuenta correctamente (${Math.round(realValue(90000, 0.02, 10))} € de hoy equivalen a 90.000 € dentro de 10 años al 2 %)`);
}

/* ---- applySleeves: los tres recortes, sus topes y su orden ---- */
{
  const moderado = { equities: 0.50, bonds: 0.40, cash: 0.10 };
  const arriesgado = { equities: 0.80, bonds: 0.15, cash: 0.05 };
  const none = { includeRealEstate: false, includeAlternative: false, includePrivateEquity: false, effectiveRisk: 'moderado', initialAmount: 0 };

  const noop = applySleeves(moderado, none, ALLOCATIONS);
  assert(noop.weights.equities === moderado.equities && noop.weights.realEstate === 0, 'sin sleeves debería ser una operación nula');

  const re = applySleeves(moderado, { ...none, includeRealEstate: true }, ALLOCATIONS);
  const expectedRE = moderado.equities * ALLOCATIONS.realEstateFractionByTier.moderado;
  assert(approx(re.weights.realEstate, expectedRE, 1e-9), 'el recorte inmobiliario debería salir de la fracción del nivel de riesgo');
  assert(approx(re.weights.bonds, moderado.bonds, 1e-9) && approx(re.weights.cash, moderado.cash, 1e-9), 'renta fija y efectivo no deberían tocarse');
  assert(approx(Object.values(re.weights).reduce((a, b) => a + b, 0), 1, 1e-9), 'los pesos deberían seguir sumando 1');

  const altDenied = applySleeves(moderado, { ...none, includeAlternative: true }, ALLOCATIONS);
  assert(!altDenied.alternativeIncluded && altDenied.alternativeRequestedButExcluded, 'otras inversiones debería excluirse fuera de arriesgado y marcar el motivo');

  const arriesgadoNone = { ...none, effectiveRisk: 'arriesgado' };
  const altOk = applySleeves(arriesgado, { ...arriesgadoNone, includeAlternative: true }, ALLOCATIONS);
  assert(altOk.alternativeIncluded && approx(altOk.weights.alternative, arriesgado.equities * ALLOCATIONS.alternativeFraction, 1e-9), 'otras inversiones debería entrar en arriesgado');

  // private equity: las 4 combinaciones de riesgo x capital
  const peBoth = applySleeves(moderado, { ...none, includePrivateEquity: true, initialAmount: 1000 }, ALLOCATIONS);
  assert(peBoth.privateEquityExcludedReason === 'ambos', `riesgo bajo + capital corto debería dar motivo 'ambos', dio '${peBoth.privateEquityExcludedReason}'`);
  const peCapital = applySleeves(arriesgado, { ...arriesgadoNone, includePrivateEquity: true, initialAmount: 1000 }, ALLOCATIONS);
  assert(peCapital.privateEquityExcludedReason === 'capital', `riesgo OK + capital corto debería dar motivo 'capital', dio '${peCapital.privateEquityExcludedReason}'`);
  const peRisk = applySleeves(moderado, { ...none, includePrivateEquity: true, initialAmount: 50000 }, ALLOCATIONS);
  assert(peRisk.privateEquityExcludedReason === 'riesgo', `capital OK + riesgo bajo debería dar motivo 'riesgo', dio '${peRisk.privateEquityExcludedReason}'`);
  const peOk = applySleeves(arriesgado, { ...arriesgadoNone, includePrivateEquity: true, initialAmount: 50000 }, ALLOCATIONS);
  assert(peOk.privateEquityIncluded && !peOk.privateEquityRequestedButExcluded, 'con riesgo y capital suficientes debería entrar');
  assert(approx(peOk.weights.privateEquity, arriesgado.equities * ALLOCATIONS.privateEquityFraction, 1e-9), 'el recorte de private equity no cuadra');

  // el mínimo se comprueba con >=, así que justo en el umbral debe entrar
  const peExact = applySleeves(arriesgado, { ...arriesgadoNone, includePrivateEquity: true, initialAmount: ALLOCATIONS.privateEquityMinAmount }, ALLOCATIONS);
  assert(peExact.privateEquityIncluded, 'un importe exactamente igual al mínimo debería considerarse suficiente');

  // los tres apilados, cada uno sobre lo que queda del anterior
  const all3 = applySleeves(arriesgado, { includeRealEstate: true, includeAlternative: true, includePrivateEquity: true, effectiveRisk: 'arriesgado', initialAmount: 50000 }, ALLOCATIONS);
  const afterRE = arriesgado.equities * (1 - ALLOCATIONS.realEstateFractionByTier.arriesgado);
  const expectedAlt = afterRE * ALLOCATIONS.alternativeFraction;
  const expectedPE = (afterRE - expectedAlt) * ALLOCATIONS.privateEquityFraction;
  assert(approx(all3.weights.alternative, expectedAlt, 1e-9), 'otras inversiones debería recortarse sobre la renta variable ya reducida por el inmobiliario');
  assert(approx(all3.weights.privateEquity, expectedPE, 1e-9), 'private equity debería recortarse sobre lo que queda tras los dos anteriores');
  assert(approx(Object.values(all3.weights).reduce((a, b) => a + b, 0), 1, 1e-9), 'con los tres sleeves los pesos deberían seguir sumando 1');
  console.log('OK: los tres sleeves recortan solo de renta variable, respetan sus topes (incluido el mínimo exacto de PE) y se apilan en orden sumando 1');
}

/* ---- DCA ---- */
{
  const dates = ['2020-01-01', '2020-01-15', '2020-02-03', '2020-02-20', '2020-03-02'];
  const rets = [0, 0, 0, 0];
  const withDCA = simulateDCA({ dates, dailyReturns: rets, initialAmount: 1000, monthlyAmount: 100 });
  assert(withDCA[4] === 1200, `debería añadir exactamente una aportación por mes nuevo (feb y mar), dio ${withDCA[4]}`);
  const without = simulateDCA({ dates, dailyReturns: rets, initialAmount: 1000, monthlyAmount: 0 });
  assert(without[4] === 1000, 'sin aportación mensual debería reducirse a capitalización simple');
  console.log('OK: simulateDCA añade una aportación por mes nuevo y se reduce a capitalización simple con aportación 0');
}

/* ---- volatilidad, máxima caída y años naturales ---- */
{
  assert(approx(annualizedVol([0, 0, 0, 0], 252), 0), 'rentabilidades sin varianza deberían dar volatilidad 0');
  const equity = [1, 1.1, 0.9, 1.05, 0.8, 1.2];
  assert(approx(maxDrawdown(equity), (0.8 - 1.1) / 1.1, 1e-9), 'la máxima caída no cuadra con el cálculo manual');

  // Un año con pocas sesiones (parcial) debe quedar fuera para no presentarlo
  // como el mejor/peor año completo.
  const dates = [], eq = [];
  for (let i = 0; i < 250; i++) { dates.push(`2021-01-${String((i % 28) + 1).padStart(2, '0')}`); eq.push(1 + i * 0.001); }
  for (let i = 0; i < 10; i++) { dates.push(`2022-01-${String(i + 1).padStart(2, '0')}`); eq.push(2 + i); }
  const years = calendarYearReturns(dates, eq);
  assert(years.length === 1 && years[0].year === '2021', `solo 2021 tiene sesiones suficientes; 2022 (10 sesiones) debería descartarse, dio ${JSON.stringify(years)}`);
  console.log('OK: volatilidad y máxima caída cuadran, y los años parciales se descartan del mejor/peor año');
}

/* ---- cloudFacts.json: todos los temas alcanzables, con al menos 3 datos ---- */
{
  const TOPICS = [
    'interesCompuesto', 'volatilidad', 'diversificacion', 'rentaVariable', 'indices', 'bonos',
    'realEstate', 'privateEquity', 'otrasInversiones', 'fondosIndexados', 'rebalanceo', 'dcaVsLumpSum', 'acciones',
  ];
  for (const topic of TOPICS) {
    const facts = CLOUD_FACTS.facts[topic];
    // Como mucho caen 3 nubes a la vez, así que cada tema necesita al menos 3
    // datos para no repetir el mismo texto en dos nubes simultáneas.
    assert(Array.isArray(facts) && facts.length >= 3, `cloudFacts.json necesita al menos 3 datos para "${topic}" (hay ${facts ? facts.length : 0})`);
    facts.forEach((f, i) => assert(f.length > 15 && f.length < 200, `cloudFacts.${topic}[${i}] tiene un tamaño raro (${f.length} caracteres)`));
  }
  console.log(`OK: cloudFacts.json cubre los ${TOPICS.length} temas alcanzables, cada uno con al menos 3 datos (uno por nube simultánea)`);
}

/* ---- allocations.json: coherencia de los subtipos ---- */
{
  const re = ALLOCATIONS.realEstateSubtypes;
  assert(re.reits.hasRealData === true && !!re.reits.ticker, 'REITs debería estar marcado con datos reales y ticker real');
  assert(re.crowdfunding.hasRealData === false && re.crowdfunding.ticker == null && typeof re.crowdfunding.illustrativeAnnualRate === 'number',
    'crowdfunding debería ir por tasa fija y no inventarse un ticker');
  assert(re[ALLOCATIONS.defaultRealEstateSubtype], 'defaultRealEstateSubtype debería resolver a una entrada real');

  for (const key of ['crypto', 'metales', 'materiasPrimas']) {
    const s = ALLOCATIONS.alternativeSubtypes[key];
    assert(s && s.hasRealData === true && !!s.ticker, `el subtipo "${key}" debería tener datos reales y ticker`);
  }
  assert(ALLOCATIONS.alternativeSubtypes[ALLOCATIONS.defaultAlternativeSubtype], 'defaultAlternativeSubtype debería resolver a una entrada real');
  assert(!ALLOCATIONS.alternativeSubtypes.coleccionables, 'los coleccionables NO deben ser seleccionables: no hay datos honestos que los respalden');

  assert(ALLOCATIONS.privateEquityInstrument.hasRealData === false, 'private equity nunca debe afirmar tener datos de mercado reales');
  assert(typeof ALLOCATIONS.privateEquityMinAmount === 'number' && ALLOCATIONS.privateEquityMinAmount > 0, 'privateEquityMinAmount debería ser un umbral positivo real');

  // Todo instrumento con datos reales necesita ticker; todo instrumento sin
  // ellos necesita una tasa ilustrativa. Ni uno solo puede quedarse a medias.
  const everyInstrument = [
    ...Object.values(ALLOCATIONS.equityIndexOptions), ...Object.values(ALLOCATIONS.bondsOptions),
    ...Object.values(re), ...Object.values(ALLOCATIONS.alternativeSubtypes), ALLOCATIONS.privateEquityInstrument,
  ];
  for (const inst of everyInstrument) {
    const real = inst.hasRealData !== false;
    if (real) assert(!!inst.ticker, `"${inst.label}" dice tener datos reales pero no tiene ticker`);
    else assert(typeof inst.illustrativeAnnualRate === 'number', `"${inst.label}" no tiene datos reales, así que necesita una tasa anual ilustrativa`);
    assert(inst.label && inst.label.length > 1, 'todo instrumento necesita una etiqueta legible');
  }
  console.log(`OK: los ${everyInstrument.length} instrumentos son coherentes — o ticker real, o tasa ilustrativa documentada, nunca a medias`);
}

/* ---- todo el texto visible va en castellano de España ---- */
{
  // El contenido generado (archetypes.json) se escapó de la conversión a
  // castellano de España porque no es interfaz, es datos: el titular que sale
  // en el dashboard seguía tuteando en rioplatense. Esta prueba barre TODAS
  // las fuentes de texto de una vez para que no vuelva a pasar en ninguna.
  // "plata" solo cuenta con posesivo ("tu plata"): suelto es el metal, que sí
  // aparece legítimamente en los metales preciosos. "acá" va con límite de
  // palabra para no cazar "acabar", "acaso" y compañía.
  const VOSEO = /\b(?:sos|podés|querés|tenés|elegís|necesitás|invertís|sabés|mirá|fijate|pensá|dejás|ponés|escribí|devolvé|andá|acá)\b|\b(?:tu|mi|su)s? plata\b/gi;
  // El motor Python enumera a propósito las formas prohibidas dentro de la
  // instrucción al modelo; esas líneas van marcadas para no contarlas.
  const stripMarked = text => text.split('\n').filter(l => !l.includes('dialect-guard-ignore')).join('\n');
  const sources = {
    'archetypes.json': fs.readFileSync(ROOT + '/archetypes.json', 'utf8'),
    'cloudFacts.json': fs.readFileSync(ROOT + '/cloudFacts.json', 'utf8'),
    'allocations.json': fs.readFileSync(ROOT + '/allocations.json', 'utf8'),
    'index.html': fs.readFileSync(ROOT + '/index.html', 'utf8'),
    'app.js': fs.readFileSync(ROOT + '/app.js', 'utf8'),
    'engine/generate_archetypes.py': fs.readFileSync(ROOT + '/engine\\generate_archetypes.py', 'utf8'),
  };
  const offenders = [];
  for (const [name, raw] of Object.entries(sources)) {
    const text = stripMarked(raw);
    const hits = text.match(VOSEO);
    if (hits) offenders.push(`${name}: ${[...new Set(hits.map(h => h.toLowerCase()))].join(', ')}`);
  }
  assert(offenders.length === 0, `hay texto que no está en castellano de España -> ${offenders.join(' | ')}`);

  // Y el contenido generado debe tutear de verdad, no simplemente evitar el
  // voseo quedándose en impersonal.
  const arch = JSON.parse(sources['archetypes.json']);
  const archText = Object.values(arch.explanations).map(e => e.headline + ' ' + e.detail).join(' ');
  assert(/\b(?:tienes|puedes|prefieres|necesites|vas a|tu dinero)\b/i.test(archText),
    'las explicaciones deberían tutear en castellano de España');
  console.log(`OK: las ${Object.keys(sources).length} fuentes de texto están en castellano de España, sin una sola forma rioplatense`);
}

console.log('\nTODAS LAS PRUEBAS DE LÓGICA DE PATHFOLIO PASAN');
