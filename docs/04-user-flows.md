# User Flows
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17

All sequence diagrams use Mermaid syntax. Legend: solid arrows = request/trigger, dashed arrows = response/return.

---

## Flow 1 — First-Time Visitor Landing (Cache Hit)

The critical render path. This must complete within 3 seconds on a standard 4G connection.

```mermaid
sequenceDiagram
    actor Alex as Alex (Browser)
    participant CDN as CDN / Edge Cache
    participant Web as Next.js SSR (Port 3000)
    participant API as Node API (Port 3001)
    participant Redis as Redis (Port 6379)

    Alex->>CDN: GET https://aibubbleclock.com/
    CDN-->>CDN: Check edge cache (miss for SSR)
    CDN->>Web: Forward request
    Web->>API: GET /api/v1/clock
    API->>Redis: GET hazard:current
    Redis-->>API: { minutes: 23.4, hazard: 0.71, tc_date: "2027-03-12", stress_score: 68.2, updated_at: "..." }
    API-->>Web: 200 OK { minutes_to_midnight: 23.4, ... } | X-Cache: HIT
    Web-->>Web: generateMetadata() — inject og:title, og:image URL
    Web-->>CDN: HTML with server-rendered clock initial state
    CDN-->>Alex: HTML (First Contentful Paint)
    Alex->>Alex: Hydrate React; ClockFace renders with SVG hand at 23.4 min
    Alex->>Alex: SWR begins 30-second polling cycle
```

**Key constraints**:
- Redis cache hit path: `API → Redis → API` must complete in < 5ms
- Next.js SSR render + HTML send: < 200ms
- Full page hydration (Largest Contentful Paint): < 3s on 4G

---

## Flow 2 — First-Time Visitor Landing (Cache Miss)

Occurs immediately after pipeline runs and cache is invalidated, or on first boot.

```mermaid
sequenceDiagram
    actor Alex as Alex (Browser)
    participant Web as Next.js SSR
    participant API as Node API
    participant Redis as Redis
    participant DB as PostgreSQL

    Alex->>Web: GET /
    Web->>API: GET /api/v1/clock
    API->>Redis: GET hazard:current
    Redis-->>API: (nil) — cache miss
    API->>DB: SELECT * FROM hazard_rate_log ORDER BY computed_at DESC LIMIT 1
    DB-->>API: Most recent hazard row
    API-->>API: Compute response from DB row
    API->>Redis: SET hazard:current { ... } EX 86400
    Redis-->>API: OK
    API-->>Web: 200 OK { ... } | X-Cache: MISS
    Web-->>Alex: Rendered HTML
```

**Note**: This flow is rare. The pipeline always pre-populates Redis before any traffic surge.

---

## Flow 3 — "View the Math" Drawer Interaction

```mermaid
sequenceDiagram
    actor Priya as Dr. Priya (Browser)
    participant ClockPage as ClockFace Page
    participant Drawer as MathDrawer Component
    participant API as Node API
    participant DB as PostgreSQL

    Priya->>ClockPage: Clicks "View the Math" button
    ClockPage->>Drawer: setState(open: true)
    Drawer-->>Priya: Slide-up animation begins (300ms cubic-bezier)

    alt First open (no cached state)
        Drawer->>API: GET /api/v1/model
        API->>DB: SELECT lppls_results ORDER BY run_timestamp DESC LIMIT 1
        DB-->>API: LPPLS row
        API->>DB: SELECT stress_index_snapshots ORDER BY snapshot_date DESC LIMIT 1
        DB-->>API: Stress snapshot row
        API->>DB: SELECT hazard_rate_log ORDER BY computed_at DESC LIMIT 1
        DB-->>API: Hazard row
        API-->>Drawer: 200 OK { lppls: {...}, stress: {...}, hazard: {...} }
        Drawer-->>Drawer: Cache response in component state
    else Subsequent open
        Drawer-->>Priya: Renders from cached component state (no network call)
    end

    Drawer-->>Priya: Renders LPPLS parameters table
    Drawer-->>Priya: Renders stress sub-score rows with progress bars
    Drawer-->>Priya: Renders hazard computation breakdown
    Drawer-->>Priya: Renders data freshness timestamps

    Priya->>Drawer: Clicks "Download JSON"
    Drawer-->>Priya: Browser triggers download: doomsday-clock-YYYY-MM-DD.json
```

---

## Flow 4 — Social Share OG Image Flow

```mermaid
sequenceDiagram
    actor Sam as Sam (Browser / Social Platform)
    participant Social as Social Platform (Twitter/LinkedIn)
    participant Web as Next.js Route Handler
    participant API as Node API
    participant Redis as Redis
    participant OG as OG Image Generator

    Sam->>Sam: Pastes URL into tweet composer
    Social->>Web: GET / (HEAD request for OG metadata)
    Web-->>Social: HTML with og:image = /api/v1/og-image?theme=dark

    Social->>Web: GET /api/v1/og-image?theme=dark
    Web->>API: Proxy to Node API GET /api/v1/og-image
    API->>Redis: GET og:image:{hash(dark)}
    Redis-->>API: (nil) — cache miss

    API->>Redis: GET hazard:current
    Redis-->>API: { minutes: 23.4, ... }
    API->>OG: render(minutes=23.4, theme=dark)
    OG-->>API: PNG binary (1200×630px)

    API->>Redis: SET og:image:{hash} {png_bytes} EX 3600
    API-->>Social: 200 OK image/png

    Social-->>Sam: Preview card renders: "AI BUBBLE DOOMSDAY CLOCK — 23 min to Midnight"
```

---

## Flow 5 — Daily Automated Data Pipeline

The fully automated end-to-end pipeline. No human interaction required.

```mermaid
sequenceDiagram
    participant Cron as node-cron (22:00 UTC)
    participant Orch as Orchestrator Service
    participant yf as yfinance (External)
    participant DB as PostgreSQL
    participant Python as Python Math Engine
    participant Redis as Redis

    Cron->>Orch: trigger() — daily pipeline start
    Orch->>yf: download(tickers=NDX_BASKET, period="500d", auto_adjust=True)

    alt yfinance success
        yf-->>Orch: OHLCV DataFrame (500 rows × 7 tickers)
        Orch->>DB: UPSERT INTO daily_prices (batch, ON CONFLICT DO UPDATE)
        DB-->>Orch: 7 × N rows upserted
        Orch->>Python: POST /solve { prices: [...500 adj_close...], dates: [...] }
        Python-->>Python: LPPLS L-BFGS-B optimization (2–10 seconds)
        Python-->>Orch: { tc, m, omega, phi, A, B, C1, C2, residual_norm, confidence_score }
        Orch->>DB: INSERT INTO lppls_results
        Orch->>Orch: Calculate macro stress index (F-002)
        Orch->>DB: INSERT INTO stress_index_snapshots
        Orch->>Orch: Calculate hazard rate (F-003)
        Orch->>DB: INSERT INTO hazard_rate_log
        Orch->>Redis: DEL hazard:current
        Orch->>Redis: SET hazard:current { minutes, hazard, tc, stress, updated_at } EX 86400
        Orch-->>Cron: Pipeline complete — elapsed: {N}ms
    else yfinance failure (retry 1)
        yf-->>Orch: Error / timeout
        Orch->>Orch: Wait 5s (exponential backoff)
        Orch->>yf: retry 1
    else yfinance failure (retry 2)
        Orch->>Orch: Wait 15s
        Orch->>yf: retry 2
    else yfinance failure (retry 3)
        Orch->>Orch: Wait 45s
        Orch->>yf: retry 3
    else All retries exhausted
        Orch->>Orch: Emit structured log { code: PIPELINE_FETCH_FAILED, timestamp }
        Orch-->>Cron: Pipeline failed — stale cache retained
    end
```

---

## Flow 6 — Quarterly Fundamental Data Update

```mermaid
sequenceDiagram
    actor Admin as Admin / GitHub Action
    participant API as Node API
    participant EDGAR as SEC EDGAR (External)
    participant DB as PostgreSQL
    participant Orch as Orchestrator
    participant Redis as Redis

    Admin->>API: POST /api/v1/admin/trigger-pipeline { type: "quarterly" }
    API-->>API: Verify Bearer token (INTERNAL_API_SECRET)
    API->>API: Queue quarterly job (job_id = UUID)
    API-->>Admin: 202 Accepted { job_id, status: "queued" }

    API->>EDGAR: Fetch 10-Q filings (MSFT, GOOGL, AMZN, META)
    EDGAR-->>API: XML/JSON filing data
    API-->>API: Parse cash_capex_ttm, ai_revenue_ttm per ticker
    API->>DB: INSERT INTO fundamental_data (ticker, fiscal_quarter, capex_ttm, ai_revenue_ttm, source_url)
    DB-->>API: Rows inserted

    API->>Orch: Trigger F-002 stress index recalculation
    Orch->>DB: SELECT fundamental_data for CapEx deficit calc
    DB-->>Orch: Latest fundamental rows
    Orch-->>Orch: Recalculate S_CapEx sub-score
    Orch-->>Orch: Recalculate composite stress score
    Orch->>DB: INSERT INTO stress_index_snapshots
    Orch->>Orch: Recalculate hazard rate (F-003)
    Orch->>Redis: SET hazard:current { ... } EX 86400
    Orch-->>API: Quarterly update complete
```

---

## Flow 7 — Error & Graceful Degradation Path

```mermaid
sequenceDiagram
    actor Alex as Alex (Browser)
    participant Web as Next.js SSR
    participant API as Node API
    participant Redis as Redis
    participant DB as PostgreSQL

    Note over API,DB: Scenario: Pipeline has been failing for > 26 hours

    Alex->>Web: GET /
    Web->>API: GET /api/v1/clock
    API->>Redis: GET hazard:current
    Redis-->>API: { minutes: 23.4, updated_at: "2026-09-16T22:01:00Z" }
    API-->>API: Detect stale: now - updated_at > 93600s (26 hours)
    API-->>Web: 200 OK { minutes_to_midnight: 23.4, ... } | X-Cache: HIT | X-Cache-Stale: true

    Web-->>Alex: Clock rendered (stale data)
    Web-->>Alex: Yellow banner: "Data may be delayed. Last updated: Sept 16, 2026 10:01 PM UTC"

    Note over Alex: Alex sees the clock but knows data is old
```

---

## Flow 8 — Python Engine Timeout Handling

```mermaid
sequenceDiagram
    participant Orch as Node Orchestrator
    participant Python as Python Math Engine

    Orch->>Python: POST /solve { prices: [...], dates: [...] }
    Python-->>Python: L-BFGS-B optimization running...

    alt Optimization completes within 30s
        Python-->>Orch: 200 OK { tc, m, omega, ... }
        Orch-->>Orch: Proceed with hazard calculation
    else Timeout after 30s
        Python-->>Orch: Timeout / 504
        Orch-->>Orch: Log { code: LPPLS_SOLVER_TIMEOUT, elapsed: 30000 }
        Orch->>DB: SELECT lppls_results ORDER BY run_timestamp DESC LIMIT 1
        DB-->>Orch: Previous successful result
        Orch-->>Orch: Use previous tc for hazard calc with confidence_score penalized by 0.5
        Orch->>Redis: SET hazard:current { ..., data_quality: "degraded" } EX 86400
    end
```

---

*See also*: [docs/03-user-stories.md](03-user-stories.md) | [docs/05-architecture.md](05-architecture.md) | [docs/07-api-specification.md](07-api-specification.md)
