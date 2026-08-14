# PathFolio

A short illustrated course, in plain Spanish with zero financial jargon, that
turns your answers into an illustrative investment allocation — explained in
everyday language, backed by a real historical backtest on real market data.
No backend, no build step, no ongoing cost to run.

**[Live demo →](https://andregomezzenteno-sudo.github.io/pathfolio/)**

Built as a portfolio piece connecting finance + applied AI, targeting fintech
roles (Revolut, Kraken, BVNK, Affirm, UST, and similar).

## What it does

1. **A 23-step questionnaire**, styled as a short course rather than a form,
   with connective narrative text ("ya que esto es para tu jubilación,
   hablemos de...") linking each screen to the answer before it rather than
   reading like a stack of unrelated fields:
   - Age bracket, risk tolerance (1–5 slider, live "stability vs. growth"
     preview), and time horizon set the baseline.
   - **Five parallel adaptive choices** — equity index (S&P 500 / NASDAQ 100 /
     MSCI World), bonds type (government / corporate / mixed), real estate
     type (REITs cotizados / crowdfunding inmobiliario), private equity
     (sí/no), and alternative investments type (cripto / oro / materias
     primas) — each first asks if you already know what it is, shows an
     illustrated lesson only if not, then asks for a real choice. Every
     choice actually moves the portfolio: the equity/bonds picks change which
     ETF the backtest fetches and tilt the weights (see *The risk tilt*), and
     real estate / private equity / alternative investments are real optional
     slices carved straight out of the allocation, not just facts you read
     about (see *The sleeve carve-outs*).
   - Explanation style, a second drawdown-tolerance slider (cross-checked
     against the first risk answer), and finally an amount — with an optional
     monthly contribution that unlocks a lump-sum-vs-dollar-cost-averaging
     comparison on the results chart.
2. **Falling "¿Sabías que?" clouds**, spawned every few seconds and drifting
   straight down the left/right margins, carrying short contextual trivia
   (historical, curious, or informative one-liners) about whatever product
   the current question is actually about — index-related facts while you're
   choosing an index, real-estate facts on the real-estate question, and so
   on (see `SCREEN_TO_TOPIC` and [`cloudFacts.json`](cloudFacts.json) in
   [app.js](app.js)). Each cloud is collapsed to just an icon by default —
   click one to pause it and expand its fact, click again to let it keep
   falling. This replaced an earlier design (first a side drawer, then a
   single cloud passively drifting across the top) — the falling clouds keep
   the same "always optional, never gating" spirit, but now you choose which
   ones to stop and read instead of facts cycling on their own schedule.
3. **Everything is sketch-styled**, not just the icons — every card, button,
   and chip carries a second, hand-jittered outline (an SVG
   `feTurbulence`/`feDisplacementMap` filter) layered over its normal crisp
   border, and both charts (the donut and the equity-curve line) render
   through the same filter, so the data itself looks hand-drawn. Icons use a
   separate "boil" animation (three jittered variants of the same sketch,
   cycled with hard cuts) rather than a smooth vector tween. See *The sketch
   system* below.
4. **A deterministic allocation** across up to six plain-language buckets —
   **renta variable**, **renta fija**, **efectivo**, and the optional
   **inversión inmobiliaria**, **private equity**, and **otras inversiones**
   sleeves — decided by a small rules table (`allocations.json`) — never by
   the LLM. Three independent signals can each pull the risk tier down (never
   up): a short time horizon, a low tolerance for real drawdowns that
   disagrees with the stated risk slider, and an age bracket of 60+ (the
   classic retirement glide-path principle — less time for a bad sequence of
   returns to recover from, regardless of how the person feels about risk).
   See *Why the allocation is deterministic* below.
4. **A three-layer dashboard:**
   - **Capa 1** — headline + a donut chart of the allocation breakdown (3 to 6
     segments depending on which optional sleeves were chosen and qualify),
     with a legend carrying the direct percentage labels
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
- **Three independent signals can each only make the allocation *more*
  conservative, never less** — a short time horizon objectively limits how
  much volatility you can absorb before needing the money; a stated drawdown
  tolerance that disagrees with the risk slider (behavioral finance: people
  often over-state risk tolerance in the abstract, then reveal a lower true
  capacity when asked a more concrete "would you sell" question) reveals a
  lower true risk capacity; and an age bracket of 60+ caps at "moderado"
  regardless of every other answer, per standard retirement glide-path
  reasoning. See `computeEffectiveRisk()` in [app.js](app.js) (and its Python
  mirror in [engine/generate_archetypes.py](engine/generate_archetypes.py)).
  When any cap kicks in, the UI says so explicitly rather than silently
  overriding the user's answer.
- **The equity and bonds instrument choices feed back into the weights
  themselves**, not just which ticker fills a fixed-size slot — see *The risk
  tilt* below.

## The risk tilt

Earlier drafts let you pick NASDAQ 100 vs. S&P 500 vs. MSCI World (and
government vs. corporate vs. mixed bonds) but only swapped which ticker
got fetched — the donut percentages never moved, which felt like the choice
didn't actually do anything. `adjustWeightsForInstrumentRisk()` in
[app.js](app.js) fixes that: each instrument option carries a
`riskMultiplier` in [allocations.json](allocations.json) (an illustrative
estimate of its volatility relative to the baseline pick — NASDAQ 100 at
1.35 vs. MSCI World's 1.0, corporate bonds at 1.20 vs. the mixed fund's 1.0,
government at 0.85) and a modestly-dampened tilt trims or grows that
bucket's weight accordingly — equities and bonds trade against each other,
cash stays fixed as the safety floor set purely by the risk/horizon/age/
volatility signals. Pick two baseline instruments and nothing changes;
pick NASDAQ 100 and the equities slice visibly shrinks a few points, with a
notice on the dashboard explaining why. It's a simplified, transparent take
on real risk-parity/volatility-targeting portfolio construction, not a
live-computed one — the multipliers are documented estimates, not pulled
from the fetched price history.

## The sleeve carve-outs

Real estate, private equity, and alternative investments aren't bolted onto
the allocation as a fixed extra slice — `applySleeves()` in
[app.js](app.js) carves each one directly **out of the equities weight**, in
that order, never out of bonds or cash, so the "safety floor" set by the
risk/horizon/age/volatility signals is never touched by an optional choice.

- **Inversión inmobiliaria** scales with the *effective* risk tier
  (`realEstateFractionByTier` in [allocations.json](allocations.json): 8% of
  equities at conservador, up to 15% at arriesgado) since real estate's role
  as a diversifier is more useful the more equity exposure you already have.
  It's a pure opt-in, not risk-gated — but it also asks a real follow-up
  question: **which kind**. REITs cotizados resolve to a real fetchable
  ticker (`VNQ`); crowdfunding inmobiliario has no public daily price feed at
  all, so it resolves to a documented flat illustrative annual rate instead
  (see *hasRealData*, below) — the sub-type choice genuinely changes what the
  backtest chart is made of, not just a label.
- **Otras inversiones** (`alternativeFraction`, a flat 8% of equities) is far
  more strictly gated: it's only ever actually included if your **final**
  computed risk tier — after every cap has already been applied — is
  "arriesgado," regardless of what you requested on the question. Its
  sub-type choice (cripto / oro / materias primas) always resolves to a real
  ticker (`BTC/USD`, `GLD`, or `DBC`), so picking a different one changes
  which real historical series the backtest actually fetches.
- **Private equity** (`privateEquityFraction`, 10% of equities) carries
  *two* independent gates, both required: the same final-risk-tier check as
  alternative investments, **and** a minimum initial amount
  (`privateEquityMinAmount`, illustratively set at $10,000) — echoing how
  real retail private-equity vehicles (feeder funds, ELTIFs) gate on a
  minimum ticket size. Private equity has no public daily price feed at all
  (it's illiquid by nature), so — like real-estate crowdfunding — it always
  resolves to a documented flat illustrative annual rate, never a fabricated
  ticker.

When a sleeve is requested but excluded, the dashboard says exactly why —
including, for private equity, whether it was the risk tier, the capital
minimum, or both — rather than silently dropping it or silently granting it.
When multiple sleeves apply, each is carved from whatever equities weight is
*left after the previous one*, so they always stack to a valid,
fully-summing allocation regardless of how many are active.

**hasRealData**: every sleeve sub-type in [allocations.json](allocations.json)
carries an explicit `hasRealData` flag. `true` means it resolves to a real
ticker fetched from Twelve Data, same as the equity/bonds pickers; `false`
means there is no honest way to back it with real market data, so it
compounds at a documented flat annual rate instead (via the `flatAssets`
parameter on `blendPortfolio()`) and is clearly marked "Estimado" in the
detail table — the same principle already applied to the plain cash bucket,
now made explicit and reusable rather than special-cased. Coleccionables
(art, wine, classic cars) is explained in the alternative-investments lesson
for context but was deliberately left out of the sub-type choice entirely:
there's no defensible way to back it with either real data or an illustrative
rate.

## The sketch system

Two SVG filters (`#sketchWobble` for UI chrome, `#sketchWobbleChart` for
charts — defined inline at the top of [index.html](index.html)) combine
`feTurbulence` and `feDisplacementMap` to distort geometry by a few pixels.
Every card, button, and chip keeps its normal crisp background/border for
legibility, and gets a *second*, filtered outline layered on top via a shared
`::after` CSS rule (see the "Sketch-wobble frame" block in
[style.css](style.css)) — so text never distorts, only the decorative
second line does. The donut and line-chart data marks apply the (stronger)
chart variant directly to themselves, since there's no text to protect there
and a wobbly data line is the more authentic sketch look. Icons use a
separate technique — `jitterPathD()` in [app.js](app.js) perturbs a single
canonical path's coordinates by a small deterministic offset to generate two
more "frames," and a shared CSS keyframe animation hard-cuts between the
three — the classic traditional-animation "boil."

## How the explanation text was generated

[`engine/generate_archetypes.py`](engine/generate_archetypes.py) is a real,
runnable **LangGraph** pipeline: given a (risk, horizon) profile and its
already-decided allocation, one node explains it in plain language via Claude
with structured output (Pydantic), and a second generates the "why do you ask
this" FAQ snippets. Run it yourself with an `ANTHROPIC_API_KEY` and it
regenerates [`archetypes.json`](archetypes.json) live, end to end.

The content actually shipped in `archetypes.json` (and in
[`lessons.json`](lessons.json) — the fourteen inline lesson slides shown when
you say you don't already know a topic, including the private-equity and
alternative-investments explainers — and in
[`cloudFacts.json`](cloudFacts.json), the short one-liners the falling
clouds carry) was written directly by Claude (Anthropic) during development
— in the same voice and scope that pipeline is designed to produce, just at
build time instead of per visitor.
This is the reason the public site never calls a paid API live: doing so would
mean an API key exposed in client-side code with no backend to hide it behind,
and unlike the free, rate-limited market-data APIs this project also uses, an
LLM API has a real per-call cost — a bad actor hitting an exposed key
repeatedly would mean a real bill, not just a 429. Pre-generating the content
at build time removes that risk entirely while keeping every explanation
genuinely LLM-authored, not templated filler.

## Backtest data

- Equities bucket → whichever index you chose: `SPY` (S&P 500), `QQQ`
  (NASDAQ 100), or `VT` (MSCI World / Vanguard Total World Stock ETF) — see
  `equityIndexOptions` in [allocations.json](allocations.json)
- Bonds bucket → whichever choice you made: `GOVT` (U.S. Treasuries), `LQD`
  (investment-grade corporate), or `BND` (a blended mix) — see `bondsOptions`
  in the same file
- Real estate sleeve (if chosen) → `VNQ` (Vanguard Real Estate ETF) for the
  REITs sub-type, or a flat illustrative rate for crowdfunding (no ticker)
- Alternative-investments sleeve (if chosen and it qualifies) → `BTC/USD`
  (crypto), `GLD` (SPDR Gold Shares, for metales), or `DBC` (Invesco DB
  Commodity Index Tracking Fund, for materias primas), depending on the
  sub-type you picked
- Private equity sleeve (if chosen and it qualifies) → a flat illustrative
  rate (no ticker — no public daily price feed exists for it)
- Cash bucket → a flat illustrative annual rate (no market price series exists
  to fetch for plain cash)

Each ticker is fetched **once and cached by symbol** (`tickerSeriesCache` in
[app.js](app.js), shared across every picker) — not once per profile — from
[Twelve Data](https://twelvedata.com/)'s free tier, confirmed during
development to return real daily history for every one of the six tickers
above, GLD/DBC included. Every profile's chart is a **weighted blend of
however many series actually apply**, computed client-side by three
generalized, N-asset-agnostic functions in [app.js](app.js):
`alignSeriesSet()` intersects trading dates across every *real* series in
play, `blendPortfolio()` takes that arbitrary-length series/weights list plus
a separate cash weight and produces one blended daily return series — and, as
of the private-equity/crowdfunding sleeves, an additional `flatAssets`
parameter lets any number of *illustrative-rate* sleeves (no ticker at all)
compound alongside the real ones in the same pass, the same way cash always
has. If you also gave a monthly contribution amount, `simulateDCA()` adds a
second line: the same blended daily returns, but with the monthly amount
added the first time each new calendar month appears in the series — a
simple, honest approximation of dollar-cost averaging next to the
lump-sum-only line.
This reuses the same `TWELVE_DATA_API_KEY` embedded in the sibling
[`trading-backtester`](https://github.com/andregomezzenteno-sudo/trading-backtester)
project (same free-tier, rate-limited, intentionally-public key — see that
repo's README for the full reasoning) and uses far fewer calls per session
than that project does.

## Architecture

Static site, same pattern as `trading-backtester`: `index.html` / `style.css`
for structure and the (distinct, warmer) design system, `app.js` for the
questionnaire state machine, the deterministic allocation engine (including
the sleeve carve-outs), the generalized N-asset backtest math, the falling
fact clouds, and hand-rolled SVG chart rendering (a donut for the allocation
breakdown, a line chart for the equity curve, plus the sketch-icon "boil"
animation system — no charting or animation library dependency).
`allocations.json`, `archetypes.json`, `lessons.json`, and `cloudFacts.json`
are static data files fetched on load. `engine/` is Python, used only offline
to produce `archetypes.json` — it is never invoked by the deployed site.

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
