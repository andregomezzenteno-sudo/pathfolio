# PathFolio

A questionnaire, in plain Spanish with zero financial jargon, that turns four
simple answers into an illustrative investment allocation — explained in
everyday language, backed by a real historical backtest on real market data.
No backend, no build step, no ongoing cost to run.

**[Live demo →](https://andregomezzenteno-sudo.github.io/pathfolio/)**

Built as a portfolio piece connecting finance + applied AI, targeting fintech
roles (Revolut, Kraken, BVNK, Affirm, UST, and similar).

## What it does

1. **Questionnaire**, one question per screen, illustrated, with an optional
   "¿por qué te pregunto esto?" toggle on each: risk tolerance, time horizon,
   how much explanation you want, and an illustrative amount to invest.
2. **A deterministic allocation** across three plain-language buckets
   ("empresas grandes del mundo", "gobiernos/empresas", "efectivo"), decided by
   a small rules table (`allocations.json`) — never by the LLM. See
   *Why the allocation is deterministic* below.
3. **A three-layer dashboard:**
   - **Capa 1** — headline + a stacked-bar allocation breakdown
   - **Capa 2** — "si hubieras invertido $X hace N años, hoy tendrías $Y", with
     a real equity-curve chart blended from actual historical ETF prices
   - **Capa 3** — technical detail: real tickers, expense ratios, annualized
     volatility, max drawdown — expanded or collapsed by default depending on
     your answer to the "detalle vs. resultados" question
4. Every explanation shown was written by **Claude (Anthropic)** — see
   *How the explanation text was generated* below.

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
- **A horizon can only make the allocation *more* conservative than what the
  user's stated risk tolerance would otherwise give** — a short time horizon
  objectively limits how much volatility you can absorb before needing the
  money, regardless of stated appetite. See `computeEffectiveRisk()` in
  [app.js](app.js) (and its Python mirror in
  [engine/generate_archetypes.py](engine/generate_archetypes.py)). When this
  cap kicks in, the UI says so explicitly rather than silently overriding the
  user's answer.

## How the explanation text was generated

[`engine/generate_archetypes.py`](engine/generate_archetypes.py) is a real,
runnable **LangGraph** pipeline: given a (risk, horizon) profile and its
already-decided allocation, one node explains it in plain language via Claude
with structured output (Pydantic), and a second generates the "why do you ask
this" FAQ snippets. Run it yourself with an `ANTHROPIC_API_KEY` and it
regenerates [`archetypes.json`](archetypes.json) live, end to end.

The content actually shipped in `archetypes.json` was written directly by
Claude (Anthropic) during development — in the same voice and scope that
pipeline is designed to produce, just at build time instead of per visitor.
This is the reason the public site never calls a paid API live: doing so would
mean an API key exposed in client-side code with no backend to hide it behind,
and unlike the free, rate-limited market-data APIs this project also uses, an
LLM API has a real per-call cost — a bad actor hitting an exposed key
repeatedly would mean a real bill, not just a 429. Pre-generating the content
at build time removes that risk entirely while keeping every explanation
genuinely LLM-authored, not templated filler.

## Backtest data

Both ETFs are fetched **once** (not per profile) from
[Twelve Data](https://twelvedata.com/)'s free tier — confirmed during
development to return ~8–10 years of daily history even on the free plan:

- Equities bucket → `VT` (Vanguard Total World Stock ETF)
- Bonds bucket → `BND` (Vanguard Total Bond Market ETF)
- Cash bucket → a flat illustrative annual rate (no market price series exists
  to fetch for plain cash)

Every profile's chart is a different **weighted blend** of the same two real
series, computed client-side — see `blendPortfolio()` in [app.js](app.js).
This reuses the same `TWELVE_DATA_API_KEY` embedded in the sibling
[`trading-backtester`](https://github.com/andregomezzenteno-sudo/trading-backtester)
project (same free-tier, rate-limited, intentionally-public key — see that
repo's README for the full reasoning) and uses far fewer calls per session
than that project does.

## Architecture

Static site, same pattern as `trading-backtester`: `index.html` / `style.css`
for structure and the (distinct, warmer) design system, `app.js` for the
questionnaire state machine, the deterministic allocation engine, the blended
backtest math, and hand-rolled SVG chart rendering (a horizontal stacked bar
for the allocation breakdown, a line chart for the equity curve — no charting
library dependency). `allocations.json` and `archetypes.json` are static data
files fetched on load. `engine/` is Python, used only offline to produce
`archetypes.json` — it is never invoked by the deployed site.

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
