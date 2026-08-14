# PathFolio

A short illustrated course, in plain Spanish with zero financial jargon, that
turns your answers into an illustrative investment allocation — explained in
everyday language, backed by a real historical backtest on real market data.
No backend, no build step, no ongoing cost to run.

**[Live demo →](https://andregomezzenteno-sudo.github.io/pathfolio/)**

Built as a portfolio piece connecting finance + applied AI, targeting fintech
roles (Revolut, Kraken, BVNK, Affirm, UST, and similar).

## What it does

1. **An 8-step questionnaire**, styled as a short course rather than a form:
   risk tolerance and drawdown tolerance are 1-5 sliders with live visual
   feedback (drag it and watch a "stability vs. growth" preview shift in real
   time); time horizon, explanation style, and amount are illustrated cards;
   a dedicated adaptive step asks whether you already know the difference
   between the S&P 500, NASDAQ 100, and MSCI World — if not, a short lesson
   slide explains all three (with sketch icons) before asking which you'd
   prefer. That choice is real: it changes which ETF the backtest actually
   fetches.
2. **A "¿Sabías que?" drawer**, reachable from any screen, with ten optional
   topics (acciones, bonos, efectivo, índices, fondos indexados/ETFs, REITs,
   criptomonedas, interés compuesto, private equity, volatilidad) — never
   gating progress, always one tap away. Each topic is a one-sentence hook
   plus 2–3 short bullet facts, not a paragraph — meant to be skimmed, not
   studied. Every icon uses a hand-drawn "boil" animation (three jittered
   variants of the same sketch, cycled with hard cuts) rather than a smooth
   vector tween.
3. **A deterministic allocation** across three plain-language buckets
   ("empresas grandes del mundo", "gobiernos/empresas", "efectivo"), decided by
   a small rules table (`allocations.json`) — never by the LLM. Two
   independent signals can each pull the risk tier down (never up): a short
   time horizon, and a low tolerance for real drawdowns that disagrees with
   the stated risk slider. See *Why the allocation is deterministic* below.
4. **A three-layer dashboard:**
   - **Capa 1** — headline + a donut chart of the allocation breakdown, with a
     legend carrying the direct percentage labels
   - **Capa 2** — "si hubieras invertido $X hace N años, hoy tendrías $Y", with
     a real equity-curve chart blended from actual historical ETF prices
   - **Capa 3** — technical detail: real tickers (reflecting whichever index
     you picked), expense ratios, annualized volatility, max drawdown —
     expanded or collapsed by default depending on your "detalle vs.
     resultados" answer
5. Every explanation and lesson shown was written by **Claude (Anthropic)** —
   see *How the explanation text was generated* below.

## Fase 1 vs. Fase 2

This is explicitly **Fase 1**: no broker connection, no real money, no
commission model — a functional demo. Fase 2 (real broker integration,
referral commissions) is intentionally out of scope here: in Spain/the EU it
likely falls under MiFID II, with a real question of whether this crosses from
"education" into "advice" requiring CNMV registration as an *agente
vinculado*. Not something to back into without specific legal advice, so it
isn't built.

That regulatory line shaped Fase 1's design directly — see below.

## Why the allocation is deterministic, not LLM-generated

The brief's original idea had the LLM decide the allocation *and* explain it.
This build splits that in two: a small rules table
(`allocations.json` — risk tier × time horizon → fixed weights) decides the
numbers; the LLM's only job is to explain an already-fixed allocation in plain
language. Reasons, all reinforcing each other:

- **Regulatory**: an LLM that never picks the actual financial numbers is a
  materially easier "this is education, not advice" argument than one that
  does — directly relevant given the MiFID II caution above.
- **No hallucination risk in the number that matters.** The LLM can get a
  sentence wrong; it can't get the allocation percentage wrong, because it
  never produces it.
- **Auditable.** Anyone can read `allocations.json` and see exactly what
  every profile gets, with no model non-determinism involved.
- **Two independent signals can each only make the allocation *more*
  conservative, never less** — a short time horizon objectively limits how
  much volatility you can absorb before needing the money, and a stated
  drawdown tolerance that disagrees with the risk slider (behavioral finance:
  people often over-state risk tolerance in the abstract, then reveal a lower
  true capacity when asked a more concrete "would you sell" question) reveals
  a lower true risk capacity. See `computeEffectiveRisk()` in
  [app.js](app.js) (and its Python mirror in
  [engine/generate_archetypes.py](engine/generate_archetypes.py)). When either
  cap kicks in, the UI says so explicitly rather than silently overriding the
  user's answer.

## How the explanation text was generated

[`engine/generate_archetypes.py`](engine/generate_archetypes.py) is a real,
runnable **LangGraph** pipeline: given a (risk, horizon) profile and its
already-decided allocation, one node explains it in plain language via Claude
with structured output (Pydantic), and a second generates the "why do you ask
this" FAQ snippets. Run it yourself with an `ANTHROPIC_API_KEY` and it
regenerates [`archetypes.json`](archetypes.json) live, end to end.

The content actually shipped in `archetypes.json` (and in
[`lessons.json`](lessons.json), the "¿Sabías que?" drawer's six topics,
including the private-equity explainer) was written directly by Claude
(Anthropic) during development — in the same voice and scope that pipeline is
designed to produce, just at build time instead of per visitor.
This is the reason the public site never calls a paid API live: doing so would
mean an API key exposed in client-side code with no backend to hide it behind,
and unlike the free, rate-limited market-data APIs this project also uses, an
LLM API has a real per-call cost — a bad actor hitting an exposed key
repeatedly would mean a real bill, not just a 429. Pre-generating the content
at build time removes that risk entirely while keeping every explanation
genuinely LLM-authored, not templated filler.

## Backtest data

- Equities bucket → whichever index you chose in the questionnaire: `SPY`
  (S&P 500), `QQQ` (NASDAQ 100), or `VT` (MSCI World / Vanguard Total World
  Stock ETF) — see `equityIndexOptions` in [allocations.json](allocations.json)
- Bonds bucket → `BND` (Vanguard Total Bond Market ETF)
- Cash bucket → a flat illustrative annual rate (no market price series exists
  to fetch for plain cash)

Each ticker is fetched **once and cached by symbol** (`equitySeriesCache` in
[app.js](app.js)) — not once per profile — from
[Twelve Data](https://twelvedata.com/)'s free tier, confirmed during
development to return ~8–10 years of daily history even on the free plan.
Every profile's chart is a different **weighted blend** of the chosen
equity series and the bond series, computed client-side — see
`blendPortfolio()` in [app.js](app.js).
This reuses the same `TWELVE_DATA_API_KEY` embedded in the sibling
[`trading-backtester`](https://github.com/andregomezzenteno-sudo/trading-backtester)
project (same free-tier, rate-limited, intentionally-public key — see that
repo's README for the full reasoning) and uses far fewer calls per session
than that project does.

## Architecture

Static site, same pattern as `trading-backtester`: `index.html` / `style.css`
for structure and the (distinct, warmer) design system, `app.js` for the
questionnaire state machine, the deterministic allocation engine, the blended
backtest math, and hand-rolled SVG chart rendering (a donut for the allocation
breakdown, a line chart for the equity curve, plus the sketch-icon "boil"
animation system — no charting or animation library dependency).
`allocations.json`, `archetypes.json`, and `lessons.json` are static data
files fetched on load. `engine/` is Python, used only offline to produce
`archetypes.json` — it is never invoked by the deployed site.

**Sketch icons** (`SKETCH_ICONS` in [app.js](app.js)): each icon is one simple
SVG path (only `M`/`L`/`C`/`Z` commands, deliberately no arcs — arc flags
would break under jitter). `jitterPathD()` perturbs every coordinate in that
path by a small deterministic offset to produce two more "frames"; a single
CSS keyframe animation (`@keyframes sketch-boil` in [style.css](style.css))
cross-fades between the three with hard cuts, no easing, so it reads as a
hand-redrawn sketch rather than a smooth tween.

## Running locally

No build step. Any static file server works:

```bash
npx serve .
# or
python -m http.server 8000
```

To regenerate `archetypes.json` yourself:

```bash
cd engine
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python generate_archetypes.py
```

## Deployment

GitHub Pages via GitHub Actions (`actions/deploy-pages`), same workflow as
`trading-backtester` — any push to `main` redeploys automatically.
