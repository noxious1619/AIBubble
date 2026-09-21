# Feature Catalogue
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17

---

## 1. Feature Priority Matrix

| Feature ID | Feature Name | Priority | Phase | Owner Service | Sprint |
|------------|-------------|----------|-------|--------------|--------|
| F-001 | LPPLS Matrix Regression Engine | P0 | 1 | Python Engine | 2 |
| F-002 | Macro Stress Index Calculator | P0 | 2 | Node API | 4 |
| F-003 | Hazard Rate Synthesis | P0 | 3 | Node API | 5 |
| F-004 | Automated Data Pipeline | P0 | 2 | Node API | 3 |
| F-005 | Doomsday Clock Face (Animated) | P1 | 4 | Next.js Frontend | 6 |
| F-006 | "View the Math" Terminal Drawer | P1 | 4 | Next.js Frontend | 7 |
| F-007 | Dynamic OG Image Generation | P1 | 4 | Node API | 7 |
| F-008 | Live Event Ticker | P1 | 4 | Next.js Frontend | 7 |
| F-009 | Historical Backtesting Dashboard | P2 | Post-MVP | Node API + Frontend | — |
| F-010 | Email/Push Alert System | P2 | Post-MVP | Node API | — |
| F-011 | Embeddable Widget (iframe) | P2 | Post-MVP | Next.js Frontend | — |

**Priority Definitions**:
- **P0**: Required for MVP launch; blocking if incomplete
- **P1**: Required for viral launch mechanics; high business value
- **P2**: Post-MVP; does not block launch

---

## 2. P0 Features — Core Mathematical Engine

### F-001 — LPPLS Matrix Regression Engine

**Owner**: Python Engine (`services/python-engine`)
**Trigger**: Called by Node API on completion of daily data pipeline

#### Mathematical Specification

The Log-Periodic Power Law Singularity model (Sornette, 2003) describes a financial bubble as:

$$\ln P(t) = A + B(t_c - t)^m \left[1 + C\cos\left(\omega \ln(t_c - t) + \phi\right)\right]$$

Where:
- $P(t)$ = asset price at time $t$ (Nasdaq-100 adjusted close)
- $t_c$ = critical time (the predicted crash date) — **the primary output**
- $m$ = growth exponent, constrained to $0.1 < m < 0.9$
- $\omega$ = log-periodic angular frequency, constrained to $4 < \omega < 25$
- $\phi$ = phase parameter, $0 \leq \phi < 2\pi$
- $A$ = price level at singularity ($A > 0$)
- $B$ = amplitude coefficient ($B < 0$, enforcing price acceleration)
- $C$ = relative amplitude of oscillations ($|C| < 1$)

The model is decomposed into linear parameters ($A$, $B\cos\phi$, $B\sin\phi$) and nonlinear parameters ($t_c$, $m$, $\omega$) to enable the Ordinary Least Squares (OLS) Slaving trick, reducing the 7-parameter optimization to a 3-parameter search.

**OLS Slaving**: Given fixed nonlinear parameters $\{t_c, m, \omega\}$, the design matrix $\mathbf{X}$ is:

$$\mathbf{X} = \begin{bmatrix} 1 & f_1(t_1) & g_1(t_1) \\ 1 & f_1(t_2) & g_1(t_2) \\ \vdots & \vdots & \vdots \end{bmatrix}$$

where $f_i = (t_c - t_i)^m \cos(\omega \ln(t_c - t_i))$ and $g_i = (t_c - t_i)^m \sin(\omega \ln(t_c - t_i))$

Linear parameters solved via: $\boldsymbol{\theta}_{lin} = (\mathbf{X}^T\mathbf{X})^{-1}\mathbf{X}^T\mathbf{y}$

**Optimization objective** (minimize residual norm):

$$\min_{t_c, m, \omega} \left\| \mathbf{y} - \mathbf{X}(t_c, m, \omega)\boldsymbol{\theta}_{lin} \right\|_2^2$$

Solver: `scipy.optimize.minimize` with `method='L-BFGS-B'` and bounds enforcement.

#### Input/Output Contract

**Input** (JSON payload to `/solve`):
```
prices:  float[]  — 500 adjusted closing prices, chronological order
dates:   string[] — ISO-8601 date strings corresponding to each price
```

**Output** (JSON response):
```
tc:               float  — Critical time as decimal year (e.g., 2027.43)
m:                float  — Growth exponent [0.1, 0.9]
omega:            float  — Log-periodic frequency [4, 25]
phi:              float  — Phase [0, 2π)
A:                float  — Price level at singularity
B:                float  — Amplitude coefficient (must be < 0)
C1:               float  — cos component = C·cos(φ)·B
C2:               float  — sin component = C·sin(φ)·B
residual_norm:    float  — L2 norm of fit residuals
confidence_score: float  — 1 - (residual_norm / baseline_norm), [0, 1]
```

#### Constraints (Immutable)

| Parameter | Lower | Upper |
|-----------|-------|-------|
| $m$ | 0.1 | 0.9 |
| $\omega$ | 4.0 | 25.0 |
| $B$ | $-\infty$ | 0.0 |
| $t_c$ | $t_{end} + 1\text{ day}$ | $t_{end} + 5\text{ years}$ |

#### Acceptance Criteria

```gherkin
Given a synthetic price series generated from known LPPLS parameters {tc, m, ω, φ, A, B, C}
When the solver runs on this series
Then the recovered tc must be within ±10 trading days of the true tc
And m, ω must be within ±0.05 of true values
And residual_norm must be < 0.01

Given an input with fewer than 100 price points
When the solver runs
Then it must raise a validation error (HTTP 422) with message "Insufficient data: minimum 100 price points required"

Given the same input prices called twice
When the solver runs twice
Then both outputs must be bit-for-bit identical (determinism requirement)
```

---

### F-002 — Macro Stress Index Calculator

**Owner**: Node.js API (`services/api/src/stress/`)
**Trigger**: Called after daily data pipeline completes; stored in `stress_index_snapshots`

#### Overview

A composite 0–100 stress index calculated from four equally-weighted sub-components. A score of 100 indicates maximum observed historical fragility; 0 indicates no measurable stress.

$$S_{composite} = w_1 \cdot S_{PE} + w_2 \cdot S_{HHI} + w_3 \cdot S_{corr} + w_4 \cdot S_{CapEx}$$

**Weights** (equal-weighted MVP, configurable post-MVP):
$$w_1 = w_2 = w_3 = w_4 = 0.25$$

#### Sub-Component 1: Forward P/E Stress Score ($S_{PE}$)

Tracks the market-cap-weighted forward P/E ratio of the AI basket (NVDA, MSFT, AMZN, GOOGL, META, TSLA, AMD) against a long-run fair-value benchmark.

$$S_{PE} = \min\left(100,\ \frac{\overline{PE}_{current} - PE_{fair}}{PE_{max\_hist} - PE_{fair}} \times 100\right)$$

Where:
- $\overline{PE}_{current}$ = market-cap-weighted mean forward P/E across AI basket
- $PE_{fair}$ = 20.0 (long-run S&P 500 mean forward P/E)
- $PE_{max\_hist}$ = 50.0 (dot-com peak benchmark)
- Score is clamped to $[0, 100]$

#### Sub-Component 2: HHI Concentration Score ($S_{HHI}$)

Measures market concentration among AI infrastructure providers. High concentration → systemic risk if any single entity fails.

$$HHI = \sum_{i=1}^{N} s_i^2$$

Where $s_i$ is the market-cap share of firm $i$ within the AI basket as a decimal.

$$S_{HHI} = \min\left(100,\ \frac{HHI - HHI_{min}}{HHI_{max} - HHI_{min}} \times 100\right)$$

Where:
- $HHI_{min}$ = 0.05 (perfectly competitive reference, $N=20$, equal shares)
- $HHI_{max}$ = 0.50 (near-monopoly reference)
- Current AI basket with 7 firms: $HHI \approx 0.20$–$0.35$

#### Sub-Component 3: Pairwise Correlation Score ($S_{corr}$)

Measures systemic herding — when all AI stocks move together, idiosyncratic risk disappears, amplifying contagion risk.

$$\bar{\rho} = \frac{2}{N(N-1)} \sum_{i < j} \rho_{ij}$$

Where $\rho_{ij}$ is the 60-day rolling Pearson correlation between log-returns of stocks $i$ and $j$.

$$S_{corr} = \min\left(100,\ \bar{\rho} \times 100\right)$$

#### Sub-Component 4: CapEx Deficit Score ($S_{CapEx}$)

Measures the severity of capital expenditure relative to AI-attributable operating revenue.

$$D = \frac{\sum_{i} CapEx_{i,TTM}}{\sum_{i} AI\_Rev_{i,TTM}}$$

$$S_{CapEx} = \min\left(100,\ \frac{D - D_{baseline}}{D_{max} - D_{baseline}} \times 100\right)$$

Where:
- $D_{baseline}$ = 0.5 (sustainable reinvestment rate)
- $D_{max}$ = 5.0 (extreme bubble reinvestment rate)
- **Current estimate** (2026 guidance): $D \approx 3.2$–$3.8$, implying $S_{CapEx} \approx 61$–$73$

#### Acceptance Criteria

```gherkin
Given Forward P/E = 45, HHI = 0.30, mean_correlation = 0.75, CapEx_deficit_ratio = 3.5
When the stress index is calculated
Then S_PE ≈ 83.3, S_HHI ≈ 55.6, S_corr = 75.0, S_CapEx ≈ 66.7
And composite_score ≈ 70.2
And all scores are clamped to [0, 100]

Given all inputs at minimum values (PE=20, HHI=0.05, corr=0, D=0.5)
When calculated
Then composite_score = 0.0

Given all inputs at maximum values (PE=50, HHI=0.50, corr=1.0, D=5.0)
When calculated
Then composite_score = 100.0
```

---

### F-003 — Hazard Rate Synthesis

**Owner**: Node.js API (`services/api/src/hazard/`)
**Trigger**: Runs after F-001 and F-002 complete; result cached in Redis

#### Temporal Proximity Score ($T_{prox}$)

$$T_{prox} = \max\left(0,\ 1 - \frac{t_c - t_{now}}{t_{window}}\right)$$

Where:
- $t_c$ = LPPLS critical date (decimal year)
- $t_{now}$ = current date (decimal year)
- $t_{window}$ = 2.0 years (maximum lookahead window; beyond this $T_{prox} = 0$)

#### Raw Hazard Rate ($H_{raw}$)

$$H_{raw} = T_{prox} \times \frac{S_{composite}}{100}$$

$H_{raw} \in [0, 1]$: 0 = no risk detectable, 1 = maximum risk.

#### Logistic S-Curve Mapping

The raw hazard is mapped through a logistic function to produce the clock position, emphasizing the transition zone between 0.4 and 0.7:

$$H_{sigmoid} = \frac{1}{1 + e^{-k(H_{raw} - H_0)}}$$

Where:
- $k$ = 12.0 (steepness; controls how sharply the clock accelerates near the midpoint)
- $H_0$ = 0.55 (inflection point; clock is at 30 minutes when $H_{raw} = 0.55$)

#### Minutes-to-Midnight Conversion

$$\text{Minutes to Midnight} = 60 \times H_{sigmoid}$$

Semantic bands:

| Minutes | Color | Interpretation |
|---------|-------|---------------|
| 0–15 | 🔴 Red | Critical — imminent fragility |
| 15–30 | 🟠 Amber | High stress — elevated vigilance |
| 30–45 | 🟡 Yellow | Moderate — watch closely |
| 45–60 | 🟢 Green | Low — no imminent signal |

#### Acceptance Criteria

```gherkin
Given tc is exactly 1 year away and composite_score = 100
When hazard is computed
Then T_prox = 0.5, H_raw = 0.5
And H_sigmoid ≈ 0.269 (k=12, H0=0.55)
And minutes_to_midnight ≈ 16.1

Given tc is in the past (tc < t_now)
When hazard is computed
Then T_prox = 1.0 (clamped) and H_raw = composite_score / 100

Given tc is more than 2 years away
When hazard is computed
Then T_prox = 0.0 and H_raw = 0.0 regardless of stress score
```

---

### F-004 — Automated Data Pipeline

**Owner**: Node.js API — Cron Scheduler (`services/api/src/cron/`)

#### High-Frequency Pipeline (Daily)

**Schedule**: `0 22 * * 1-5` (UTC 22:00 Monday–Friday; ~30 min after NYSE close)

Steps:
1. Fetch last 500 trading days of Nasdaq-100 adjusted closing prices via yfinance
2. Fetch market caps for AI basket (NVDA, MSFT, AMZN, GOOGL, META, TSLA, AMD)
3. Upsert into `daily_prices` table (conflict: `ON CONFLICT (ticker, trade_date) DO UPDATE`)
4. Call Python engine `POST /solve` with price array
5. Insert result into `lppls_results` table
6. Recalculate macro stress index using fresh market cap data
7. Insert into `stress_index_snapshots`
8. Compute hazard rate
9. Invalidate Redis key `hazard:current`
10. Write new hazard payload to Redis with TTL 86400s
11. Append to `hazard_rate_log`

**Failure handling**: Exponential backoff on yfinance failures (3 retries at 5s, 15s, 45s). After 3 failures, serve stale Redis cache and emit structured error log.

**Target completion time**: < 60 seconds from trigger.

#### Low-Frequency Pipeline (Quarterly)

**Trigger**: Manual via `POST /api/v1/admin/trigger-pipeline` with `{ type: "quarterly" }` payload, or via GitHub Actions workflow on SEC filing detection.

Steps:
1. Parse CapEx and AI-attributable revenue from SEC 10-Q filings for each hyperscaler
2. Store source URL and filing date in `fundamental_data`
3. Re-run F-002 stress index with updated CapEx inputs
4. Trigger F-003 hazard rate recalculation
5. Update Redis cache

#### Acceptance Criteria

```gherkin
Given market close on a weekday
When the cron triggers at 22:00 UTC
Then the full pipeline completes within 60 seconds
And the Redis key `hazard:current` has a new `updated_at` timestamp
And a new row exists in `lppls_results`

Given yfinance returns an error 3 consecutive times
When the pipeline runs
Then a structured error log entry is emitted with code PIPELINE_FETCH_FAILED
And the stale Redis cache continues to be served
And no row is inserted into lppls_results
```

---

## 3. P1 Features — Frontend & Virality

### F-005 — Doomsday Clock Face (Animated)

**Owner**: Next.js Frontend (`apps/web/src/components/ClockFace/`)

- SVG-based circular dial with 60 tick marks (major ticks at 5-minute intervals, minor ticks at 1-minute intervals)
- Single animated minute hand driven by `minutes_to_midnight` API value
- Hand rotation: `rotate(${(minutes / 60) * 360 - 90}deg)` from 12 o'clock position
- Pulsing glow ring: animation period inversely proportional to `hazard_rate`
- Color transitions (CSS custom properties):
  - `> 45 min`: `--clock-accent: #22C55E` (green)
  - `15–45 min`: `--clock-accent: #F59E0B` (amber)
  - `< 15 min`: `--clock-accent: #EF4444` (red)
- SWR polling interval: 30 seconds (re-validates against cache TTL)
- Text readout below dial: `"XX min to midnight"` (ARIA live region)

### F-006 — "View the Math" Terminal Drawer

**Owner**: Next.js Frontend (`apps/web/src/components/MathDrawer/`)

- Triggered by "View the Math" button; slides up from bottom on mobile, from right on desktop
- Fetches `GET /api/v1/model` on first open; cached locally in component state
- Sections displayed in monospace (JetBrains Mono):
  1. **LPPLS Parameters**: table of `{tc, m, ω, φ, A, B, C1, C2}` with confidence score
  2. **Stress Index**: sub-scores with mini progress bars and formula tooltips
  3. **Hazard Computation**: step-by-step breakdown of `T_prox → H_raw → H_sigmoid → minutes`
  4. **Data Freshness**: last pipeline run timestamp, data source attributions
  5. **Raw JSON Export**: "Download JSON" button triggers browser download of full model payload

### F-007 — Dynamic OG Image Generation

**Owner**: Node.js API (`services/api/src/og/`) or Next.js API route

- Endpoint: `GET /api/v1/og-image?theme=dark`
- Generates a 1200×630px PNG image server-side using `@vercel/og` or `canvas`
- Image content:
  - Clock face rendering (simplified SVG → PNG)
  - Large bold text: `"AI BUBBLE DOOMSDAY CLOCK"`
  - Sub-text: `"XX minutes to midnight"` (live value from Redis)
  - Timestamp: `"Updated: YYYY-MM-DD"`
  - Footer: `"aibubbleclock.com — Not Financial Advice"`
- OG image cached in Redis key `og:image:{hash}` with TTL 3600s
- Meta tags injected by Next.js via `generateMetadata()`:
  - `og:image`, `og:title`, `og:description`, `twitter:card: "summary_large_image"`

### F-008 — Live Event Ticker

**Owner**: Next.js Frontend (`apps/web/src/components/EventTicker/`)

- Horizontally scrolling marquee below the clock face
- Each event item: `[YYYY-MM-DD HH:MM] {headline} | Hazard Δ: {+/-X.X min}`
- Initial data: static seed events seeded in `events` table (MVP)
- Events manually curated and inserted via admin interface (Post-MVP: automated via news API)
- CSS animation: `translateX` at constant 40px/s; pauses on hover

---

## 4. P2 Features — Post-MVP

### F-009 — Historical Backtesting Dashboard
Interactive chart showing historical `minutes_to_midnight` values overlaid with realized market corrections. Requires `GET /api/v1/history?range=1y` endpoint.

### F-010 — Email/Push Alert System
User-configurable threshold alerts ("Notify me when clock reaches < 20 minutes"). Requires user account system and email/push infrastructure.

### F-011 — Embeddable Widget
`<iframe>` embed code generating a compact (400×200px) clock face for third-party websites. Requires CORS policy update and lightweight embed bundle.

---

*See also*: [docs/07-api-specification.md](07-api-specification.md) | [docs/06-database-schema.md](06-database-schema.md) | [docs/08-design-system.md](08-design-system.md)
