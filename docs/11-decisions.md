# Architecture Decision Records
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17

> [!IMPORTANT]
> This document is a living ledger. Every time an architectural decision is made that affects the system's mathematical bounds, service topology, or data contracts, a new ADR **must** be appended before the code change is merged. See `AGENTS.md §2.4` for the mandatory ADR process for LPPLS bound modifications.

---

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-001 | Separate Python Math Engine from Node.js Backend | ACCEPTED | 2026-09-17 |
| ADR-002 | LPPLS Parameter Bounds as Immutable Constants | ACCEPTED | 2026-09-17 |
| ADR-003 | Redis as Primary Serving Cache with Write-Through Pattern | ACCEPTED | 2026-09-17 |
| ADR-004 | Next.js App Router with SSR for Dynamic OG Images | ACCEPTED | 2026-09-17 |
| ADR-005 | PostgreSQL over Specialized Time-Series Databases | ACCEPTED | 2026-09-17 |

---

## ADR-001 — Separate Python Math Engine from Node.js Backend

| Field | Value |
|-------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-09-17 |
| **Deciders** | Systems Architecture |
| **Story** | The core product feature (LPPLS regression) requires heavy numerical optimization |

### Context

The AI Bubble Doomsday Clock's primary value proposition is the LPPLS regression — a constrained, nonlinear least-squares optimization over 500 data points. This requires:

1. **NumPy** for dense matrix operations (design matrix construction, OLS slaving)
2. **SciPy** (`optimize.minimize` with `method='L-BFGS-B'`) for the constrained nonlinear optimization
3. Deterministic, typed, purely mathematical execution with no side effects

The application's serving layer, by contrast, requires:

1. High-concurrency I/O handling (10,000 simultaneous HTTP connections)
2. Cron scheduling, Redis cache management, PostgreSQL queries
3. Non-blocking event loop that cannot tolerate Python's GIL

These requirements are **fundamentally incompatible** in a single runtime:

| Requirement | Python | Node.js |
|------------|--------|---------|
| LPPLS matrix optimization (NumPy/SciPy) | ✅ Native | ❌ No viable equivalent |
| High-concurrency I/O (10k connections) | ⚠️ GIL-constrained | ✅ Non-blocking event loop |
| Cron scheduling | ⚠️ asyncio complexity | ✅ `node-cron` |
| Redis + Postgres drivers | ✅ Available | ✅ Better ecosystem |
| Docker memory per instance | ⚠️ 512MB (NumPy/SciPy) | ✅ 128MB sufficient |

### Decision

The LPPLS solver runs as a **dedicated, isolated Python FastAPI microservice** (`services/python-engine/`) that:

- Accepts a price array and date list via `POST /solve`
- Performs the matrix optimization purely in memory
- Returns the fitted parameters as JSON
- Has **zero database connections, zero external HTTP calls, zero persistent state**

The Node.js backend (`services/api/`) exclusively owns:

- All external I/O (yfinance, SEC EDGAR)
- PostgreSQL read/write
- Redis cache management
- Cron scheduling
- The public REST API

Communication between the two services is via an **internal HTTP call** over the Docker bridge network (latency ≈ 2–8ms on the same host).

### Consequences

#### Positive
- Python engine is trivially unit-testable in complete isolation from infrastructure
- Both services scale independently (Python engine is stateless → horizontal scaling for free)
- Python version and dependency management is fully independent (e.g., upgrade SciPy without touching Node)
- Service boundary makes the architectural principle explicit and enforceable in code review and CI

#### Negative
- One additional network hop per pipeline run (~5–15ms on internal Docker network)
- Two separate CI pipelines to maintain (ruff/mypy/pytest + ESLint/TypeScript/Vitest)
- Requires health check and timeout handling in the Node orchestrator

#### Mitigation for Network Hop
The pipeline runs once per day (22:00 UTC). A 15ms overhead on a ~30-second pipeline is negligible. The real-time serving path reads from Redis and never calls the Python engine, so there is zero latency impact on end-user requests.

### Alternatives Considered

| Alternative | Reason Rejected |
|------------|----------------|
| Pure Node.js with `mathjs` or `ml.js` | No L-BFGS-B constrained optimizer; matrix operations are orders of magnitude slower |
| Python monolith (FastAPI for everything) | asyncio + numpy/scipy GIL = poor concurrency for I/O-heavy serving layer |
| WebAssembly (WASM) Python in Node | Large binary size; limited SciPy support in WASM; not production-battle-tested |
| AWS Lambda for Python engine | Adds cloud dependency; cold-start latency unacceptable for 30-second pipeline budget |

---

## ADR-002 — LPPLS Parameter Bounds as Immutable Constants

| Field | Value |
|-------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-09-17 |
| **Deciders** | Systems Architecture |
| **References** | Sornette, D. (2003). *Why Stock Markets Crash*. Princeton University Press. Johansen, A. (2000). The NASDAQ crash of April 2000. *Physica A*. |

### Context

The LPPLS optimization is a constrained nonlinear problem. The choice of parameter bounds is not arbitrary — it is grounded in:

1. **Empirical evidence**: Sornette (2003) and Johansen (2000) established these bounds by fitting the LPPLS model to over 50 historical bubble/crash datasets across multiple asset classes and countries
2. **Physical interpretation**: The bounds encode the qualitative behavior that the model is designed to capture
3. **Overfitting risk**: Relaxing the bounds allows the optimizer to find spurious, physically meaningless fits that look good statistically but have no predictive power

The three bounds:

| Parameter | Bound | Physical Meaning |
|-----------|-------|-----------------|
| $m$ (growth exponent) | $0.1 < m < 0.9$ | $m < 1$ ensures super-exponential growth (faster than exponential); $m > 0.1$ prevents near-instantaneous singularity; $m < 0.9$ prevents near-linear growth that the model doesn't meaningfully distinguish from trend |
| $\omega$ (log-periodic frequency) | $4 < \omega < 25$ | Too low ($\omega < 4$): oscillations are too slow to be genuinely log-periodic; Too high ($\omega > 25$): oscillations are faster than Nyquist limit for daily data → aliasing artifact, not real signal |
| $B$ (amplitude) | $B < 0$ | $B < 0$ is the mathematical statement that the price curve is *accelerating* toward $t_c$ (second derivative is positive). If $B > 0$, the price is decelerating and moving away from a singularity — the opposite of a bubble trajectory |

### Decision

The following constants are **hardcoded** in `services/python-engine/app/constants.py` and **enforced at the database layer** via PostgreSQL CHECK constraints in `migrations/007_check_constraints.sql`:

```python
# services/python-engine/app/constants.py
LPPLS_M_MIN:     float = 0.1
LPPLS_M_MAX:     float = 0.9
LPPLS_OMEGA_MIN: float = 4.0
LPPLS_OMEGA_MAX: float = 25.0
LPPLS_B_MAX:     float = 0.0  # B must be strictly less than this
```

```sql
-- migrations/007_check_constraints.sql
ALTER TABLE lppls_results
  ADD CONSTRAINT chk_lppls_m     CHECK (m     > 0.1 AND m     < 0.9),
  ADD CONSTRAINT chk_lppls_omega CHECK (omega > 4.0 AND omega < 25.0),
  ADD CONSTRAINT chk_lppls_B     CHECK (B     < 0.0);
```

**Any modification to these constants requires**:

1. A new ADR appended to this document with:
   - Mathematical justification citing peer-reviewed literature
   - Backtesting evidence against the historical crash suite (see `docs/10-testing-strategy.md §6.1`)
   - Explicit evidence that the modified bounds do not increase false positive rate above 20%
2. The new ADR must be included in the same pull request as the code change
3. Pull request must pass the complete test suite (including mathematical backtest)

### Consequences

#### Positive
- Prevents accidental overfitting — the model remains scientifically defensible
- Clear audit trail for model evolution (every bounds change has a documented rationale)
- Database CHECK constraints provide a second line of defense against Python bugs

#### Negative
- In rare cases, the true $t_c$ may be outside the $t_c$ window (e.g., crash occurs very soon); the optimizer cannot find it and returns the nearest feasible solution
- Some researchers argue $m$ can go as low as 0.01 for specific datasets; these cases are currently excluded

---

## ADR-003 — Redis as Primary Serving Cache with Write-Through Pattern

| Field | Value |
|-------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-09-17 |

### Context

The `/api/v1/clock` endpoint is the hot path. During a viral event, it could receive 10,000+ requests per second. The underlying hazard rate computation involves:

1. A PostgreSQL query for the latest LPPLS result
2. A PostgreSQL query for the latest stress snapshot
3. Sigmoid computation and minutes-to-midnight conversion

At 10,000 req/s, this would require 20,000 Postgres queries per second — far exceeding the single-instance capacity.

However, the hazard rate changes **at most once per day** (when the daily pipeline runs at 22:00 UTC). It is therefore wasteful to recompute it on every request.

### Decision

The computed hazard rate is **cached in Redis** after every successful pipeline run:

- Key: `hazard:current`
- Value: Full JSON payload (all fields needed by `/api/v1/clock`)
- TTL: 86400 seconds (24 hours)
- Eviction: Key is explicitly `DEL`-ed and re-written after each successful pipeline run

**Write-through pattern**: Node API writes to PostgreSQL first (in the `hazard_rate_log` table), then writes to Redis. It never writes to Redis without a prior successful DB commit. This ensures PostgreSQL is always the durable source of truth.

**Stale detection**: If the `updated_at` field in the cached JSON is more than 26 hours old (pipeline should have run but didn't), the API adds `X-Cache-Stale: true` to the response and sets `data_quality: "stale"` in the payload.

**Cache miss path**: On startup or after manual cache invalidation, the API performs a PostgreSQL query to populate Redis before serving the next request.

### Consequences

#### Positive
- Sub-5ms response times on the hot path (Redis GET ≈ 1–2ms)
- PostgreSQL is not queried on any end-user request for the clock endpoint
- System degrades gracefully on pipeline failure (stale data served, not errors)

#### Negative
- Redis becomes a critical-path dependency — if Redis is down, `/api/v1/clock` falls back to Postgres (slower but functional)
- Maximum data staleness is 24 hours (by design — acceptable given daily pipeline cadence)
- Requires stale detection logic to prevent users from seeing data labeled as "live" when it's old

### Alternatives Considered

| Alternative | Reason Rejected |
|------------|----------------|
| HTTP Cache-Control only | CDN caching cannot serve real-time data; bypassed by API clients |
| Compute on every request | Unacceptable at 10,000+ req/s; 20,000 Postgres queries/s |
| PostgreSQL Materialized View | Doesn't eliminate query overhead; still requires DB hit per request |
| In-process memory cache (Node.js) | Lost on process restart; doesn't work with multiple Node.js replicas |

---

## ADR-004 — Next.js App Router with SSR for Dynamic OG Images

| Field | Value |
|-------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-09-17 |

### Context

The viral distribution mechanic requires that when the platform URL is shared on Twitter, LinkedIn, or Slack, the link preview shows a **real-time, dynamically generated** image displaying the current "minutes to midnight" value.

Social platforms fetch OG metadata by making an HTTP request to the URL and parsing the `og:image` meta tag. The `og:image` URL then points to a PNG that the platform downloads and displays as the preview thumbnail.

To make this real-time, the OG image must be **generated server-side at request time** — not pre-rendered as a static asset.

### Decision

Use **Next.js 14 App Router** with `generateMetadata()` for dynamic meta tags. The OG image is generated by a dedicated API route (`/api/og`) using the `@vercel/og` edge-runtime canvas library (or a server-side `canvas` alternative if not using Vercel).

- `generateMetadata()` fetches the current clock state from the Node API and injects:
  - `og:title: "AI Bubble Doomsday Clock — 23 min to Midnight"`
  - `og:image: "https://aibubbleclock.com/api/og?minutes=23&theme=dark"`
- The `/api/og` route reads `minutes` from the query parameter, renders the 1200×630 PNG, and caches it in Redis (`og:image:{hash}`) with a 1-hour TTL

### Consequences

#### Positive
- Social platforms always receive the latest clock value in the OG image
- SSR enables proper SEO meta tags on every page render
- `@vercel/og` runs at the Edge (fast globally) and has first-class Next.js support

#### Negative
- SSR adds complexity compared to a purely static site
- OG image generation is compute-intensive; Redis caching is essential (1h TTL mitigates this)
- Requires careful coordination between the Node API and Next.js meta tag injection

---

## ADR-005 — PostgreSQL over Specialized Time-Series Databases

| Field | Value |
|-------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-09-17 |

### Context

The `daily_prices` table is the closest to a time-series workload — it grows by approximately 7 tickers × 1 row/day = 7 rows/day, or **~2,555 rows/year**. Queries are primarily range scans by date.

Evaluated alternatives:

| Database | Fit | Concern |
|---------|-----|---------|
| **TimescaleDB** (PostgreSQL extension) | Good for hypertables | Adds operational complexity; ~2.5k rows/year doesn't justify it |
| **InfluxDB** | Good for high-cardinality metrics | Schema-less; harder to query alongside relational `fundamental_data`; different query language |
| **QuestDB** | Excellent time-series performance | Least mature ecosystem; difficult to JOIN with relational tables |
| **PostgreSQL 16** (vanilla) | Sufficient for this scale | Well-understood; BRIN indexes efficient for sequential time-series; range partitioning available |

### Decision

Use **vanilla PostgreSQL 16** with:

1. **BRIN indexes** on `trade_date` columns — highly efficient for sequential time-series data (very small index footprint)
2. **Range partitioning** on `daily_prices` by year — enables partition pruning for date range queries
3. **B-tree composite index** on `(ticker, trade_date DESC)` for the primary LPPLS data fetch query

**Data volume estimates**:

| Table | Rows/year | 5-year total | PostgreSQL verdict |
|-------|-----------|-------------|-------------------|
| `daily_prices` | ~2,555 | ~12,775 | Trivially small |
| `lppls_results` | 252 | 1,260 | Trivially small |
| `stress_index_snapshots` | 252 | 1,260 | Trivially small |
| `hazard_rate_log` | 252 | 1,260 | Trivially small |
| `fundamental_data` | ~16 (4 tickers × 4 quarters) | ~80 | Trivially small |

At these volumes, PostgreSQL easily handles the workload with single-digit millisecond query times.

### Consequences

#### Positive
- No additional operational complexity (single database technology)
- Rich SQL ecosystem; easy to query across `daily_prices`, `fundamental_data`, and `lppls_results` in a single JOIN
- Clear migration path to TimescaleDB if volume exceeds expectations (it's a drop-in PostgreSQL extension)

#### Negative
- If the ticker basket expands significantly (e.g., 200 stocks instead of 7), the `daily_prices` growth rate increases by 30× and TimescaleDB should be reconsidered
- PostgreSQL BRIN indexes are less effective if rows are inserted out of date order (not a concern with our sequential pipeline)

### Migration Path to TimescaleDB (if needed)

If `daily_prices` exceeds 5 million rows or query latency on date range scans exceeds 100ms:

1. `CREATE EXTENSION IF NOT EXISTS timescaledb;`
2. `SELECT create_hypertable('daily_prices', 'trade_date');`
3. Drop BRIN index (TimescaleDB handles this internally)
4. No application code changes required

---

*To add a new ADR*: copy the template below, increment the number, fill in all fields, and submit as part of the PR that implements the decision.

```markdown
## ADR-00N — [Title]

| Field | Value |
|-------|-------|
| **Status** | PROPOSED / ACCEPTED / DEPRECATED / SUPERSEDED BY ADR-00X |
| **Date** | YYYY-MM-DD |
| **Deciders** | [Names or roles] |
| **References** | [Relevant papers, issues, or prior ADRs] |

### Context
[What is the problem? Why does a decision need to be made?]

### Decision
[What is the decision? Be precise and specific.]

### Consequences
#### Positive
[What becomes easier or better?]

#### Negative
[What becomes harder? What are the trade-offs?]

### Alternatives Considered
[What else was evaluated, and why was it rejected?]
```
