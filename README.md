# PathFolio

A short illustrated course, in plain Spanish with zero financial jargon, that
turns your answers into an illustrative investment allocation — explained in
everyday language, backed by a real historical backtest on real market data.
No backend, no build step, no ongoing cost to run.

**[Live demo →](https://andregomezzenteno-sudo.github.io/pathfolio/)**

Built as a portfolio piece connecting finance + applied AI, targeting fintech
roles (Revolut, Kraken, BVNK, Affirm, UST, and similar).

## What it does

1. **A 25-step questionnaire**, styled as a short course rather than a form,
   with connective narrative text ("ya que esto es para tu jubilación,
   hablemos de...") linking each screen to the answer before it rather than
   reading like a stack of unrelated fields. You can always go **back** with
   the arrow in the progress bar, and every previous answer is still there
   when you do.
   - Age bracket, a **continuous 0–100 risk slider** (drop the handle
     literally anywhere — it is not five fixed notches — with a live
     "stability vs. growth" preview), and time horizon set the baseline.
   - **Five adaptive topic blocks** — equity/ETFs, bonds, real estate,
     private equity, and alternative investments. Each first asks whether you
     already know what it is, shows an illustrated lesson only if not (with
     real company examples: Apple and Nvidia inside the index funds,
     Mercadona and El Corte Inglés for private equity), then asks for a real
     choice.
   - **You never have to pick just one.** Equity indices, bond types, real
     estate vehicles and alternative assets are all **multi-select**: want
     both the S&P 500 and the NASDAQ 100, or gold *and* commodities? Take
     them. The block's weight splits evenly between whatever you selected,
     and the risk tilt uses the average of their risk multipliers.
   - **A live donut** sits beside the questionnaire and rebuilds itself with
     every single answer, so you watch the portfolio being assembled rather
     than meeting it at the end.
   - Explanation style, a second continuous drawdown-tolerance slider
     (cross-checked against the first risk answer), and finally an amount —
     with an optional monthly contribution that unlocks a
     lump-sum-vs-dollar-cost-averaging comparison on the results chart.
2. **Falling "¿Sabías que?" clouds** drift down the left and right margins,
   **at most three at a time**, all carrying trivia about whatever topic the
   current question is on — the lane is cleared and refilled whenever you
   change question, so you never read a fact about something you already left
   behind (see `SCREEN_TO_TOPIC` and [`cloudFacts.json`](cloudFacts.json)).
   Each cloud is collapsed to just an icon; click one to pause its fall and
   read it, click again to let it go. While a cloud is open, that lane stops
   spawning new ones so nothing falls over what you're reading, and the
   expanded bubble deliberately breaks out of the narrow lane so the fact is
   never clipped.
3. **Everything is sketch-styled**, not just the icons — every card, button,
   and tile carries a second, hand-jittered outline (an SVG
   `feTurbulence`/`feDisplacementMap` filter) layered over its normal crisp
   border, and both charts (the donut and the equity-curve line) render
   through the same filter, so the data itself looks hand-drawn. Icons use a
   separate "boil" animation (three jittered variants of the same sketch,
   cycled with hard cuts) rather than a smooth vector tween. See *The sketch
   system* below.
4. **A deterministic allocation** across up to six plain-language buckets —
   **renta variable**, **renta fija**, **efectivo**, and the optional
   **inversión inmobiliaria**, **private equity**, and **otras inversiones**
   sleeves — decided by a small rules table (`allocations.json`), never by
   the LLM. Three independent signals can each pull the risk tier down (never
   up): a short time horizon, a low tolerance for real drawdowns that
   disagrees with the stated risk slider, and an age bracket of 60+ (the
   classic retirement glide-path principle — less time for a bad sequence of
   returns to recover from, regardless of how the person feels about risk).
   An **unanswered** question never caps anything: a slider sitting at its
   default is not an answer, which is why `volatility` stays `null` until you
   actually touch or confirm it. See *Why the allocation is deterministic*.
5. **A three-layer dashboard:**
   - **Capa 1** — headline, risk-profile tag, and a donut of the allocation
     (3 to 6 segments depending on which optional sleeves qualified). Hover
     any slice and it grows while the rest dim, with a tooltip breaking that
     category down: its %, its € amount, and every instrument inside it with
     its own weight. The legend does the same statically — nested sub-rows
     per instrument (`Renta fija 40 %` → `Deuda pública 20 % · 2.000 €`,
     `Deuda corporativa 20 % · 2.000 €`) and a **Total** row that visibly
     closes at exactly 100 %
   - **Capa 2** — the plain-language story ("si hubieras invertido X hace N
     años…"), a row of **stat tiles** (final value, total return, annualized
     return/CAGR, annualized volatility, max drawdown, edge over cash, best
     and worst calendar year — all counting up on load), and the equity-curve
     chart with a crosshair tooltip
   - **De dónde sale cada porcentaje** — the real answer to "explícamelo
     todo": a numbered chain that derives your allocation step by step with
     *your* figures — which signals capped your risk tier and to what, the
     starting split for that tier, how your chosen instruments tilted it
     (from X % to Y %), each optional sleeve carved out of equities (again,
     from X % to Y %, in both % and €), how each block splits between the
     options you ticked, and a final line that adds up to 100 %
   - **Capa 3** — per-instrument technical detail, grouped by category with a
     subtotal row per block, so "of that 40 % in renta fija, how much is
     government and how much corporate?" is answered by reading, not by doing
     arithmetic — expanded or collapsed by default depending on your
     "detalle vs. resultados" answer
6. Every explanation and lesson shown was written by **Claude (Anthropic)** —
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
government at 0.85; with multi-select, the **average** of whatever you
ticked) and a modestly-dampened tilt trims or grows that bucket's weight
accordingly — equities and bonds trade against each other,
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
  question: **which kind**, and you can take both. REITs/SOCIMIs resolve to a
  real fetchable ticker (`VNQ`); crowdfunding inmobiliario has no public
  daily price feed at all, so it resolves to a documented flat illustrative
  annual rate instead (see *hasRealData*, below) — the sub-type choice
  genuinely changes what the backtest chart is made of, not just a label.
- **Otras inversiones** (`alternativeFraction`, a flat 8% of equities) is far
  more strictly gated: it's only ever actually included if your **final**
  computed risk tier — after every cap has already been applied — is
  "arriesgado," regardless of what you requested on the question. Its
  sub-types (cripto / oro / materias primas) are multi-select and each
  resolves to a real ticker (`BTC/USD`, `GLD`, `DBC`), so what you tick
  changes which real historical series the backtest actually fetches — and
  ticking several splits the sleeve evenly between them.
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
parameter on `blendPortfolio()`) and is clearly marked "Estimación" in the
detail table — the same principle already applied to the plain cash bucket,
now made explicit and reusable rather than special-cased. Coleccionables
(art, wine, classic cars) is explained in the alternative-investments lesson
for context but was deliberately left out of the sub-type choice entirely:
there's no defensible way to back it with either real data or an illustrative
rate.

## Percentages that actually add up

Every percentage on screen is computed once, in `computeAllocation()`, using
**largest-remainder rounding** (`displayPercents()` in [app.js](app.js)) and
then carried on the segment/holding itself. Rounding each slice independently
is how a portfolio ends up displaying `33,3 % + 33,3 % + 33,3 % = 99,9 %`;
here the leftover hundredths are handed to the slices with the largest
truncated remainders, so the donut legend, the hover tooltip, the narrative
and the technical table all print the *same* numbers and the total closes at
exactly 100 %. A block that is real but tiny is never rounded away to 0 %.

Sub-allocations follow the same rule: a block's weight splits evenly between
whatever you ticked inside it, and those parts always sum back to the block.

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
three — the classic traditional-animation "boil." The three frame animations
use **negative** delays so all of them are already mid-cycle at t=0; with
positive delays there was a window at load where no frame had reached its
final opacity yet and the icons visibly flickered before settling. Each slot
is also only revealed once its SVG is actually in the DOM (`.icon-ready`), so
an icon is never seen half-drawn. Crucially, each icon also gets its **own
phase offset** (`renderSketchIcon` in [app.js](app.js)): when sixty icons
switch frames on the very same tick, what you perceive is not a drawing
wobbling but the whole page strobing. Spreading the phase makes each icon
boil on its own clock.

## How the explanation text was generated

[`engine/generate_archetypes.py`](engine/generate_archetypes.py) is a real,
runnable **LangGraph** pipeline: given a (risk, horizon) profile and its
already-decided allocation, one node explains it in plain language via Claude
with structured output (Pydantic), and a second generates the "why do you ask
this" FAQ snippets. Run it yourself with an `ANTHROPIC_API_KEY` and it
regenerates [`archetypes.json`](archetypes.json) live, end to end.

The content actually shipped in `archetypes.json`, in the inline lesson
slides in [`index.html`](index.html) (shown only when you say you don't
already know a topic), and in [`cloudFacts.json`](cloudFacts.json) (the
one-liners the falling clouds carry) was written directly by Claude
(Anthropic) during development
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
questionnaire state machine (multi-select, back navigation, conditional
steps), the deterministic allocation engine (including the sleeve
carve-outs), the generalized N-asset backtest math, the live preview donut,
the falling fact clouds, and hand-rolled SVG chart rendering (a donut for the allocation
breakdown, a line chart for the equity curve, plus the sketch-icon "boil"
animation system — no charting or animation library dependency).
`allocations.json`, `archetypes.json`, and `cloudFacts.json` are static data
files fetched on load. `engine/` is Python, used only offline
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
