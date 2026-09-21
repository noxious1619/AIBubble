# Development Plan
### AI Bubble Doomsday Clock

> **Document status**: Living Document — Updated as slices complete
> **Version**: 1.0.0
> **Last updated**: 2026-09-18
> **Methodology**: Vertical Slice Development — each slice ships a testable end-to-end increment
> **Execution order**: Slices are sequential. Never begin a slice until all items in the prior slice are checked.

---

## Overview

This document breaks the remaining build into **strict vertical slices** — each one crossing the full stack from database to UI for a single feature area. This avoids integration debt and ensures every shipped increment is independently runnable and testable.

```
[Slice 1] Math Engine Core
      ↓
[Slice 2] Market Data Ingestion
      ↓
[Slice 3] Hazard Synthesis & Caching
      ↓
[Slice 4] Public Dashboard UI
      ↓
[Slice 5] Analytics Terminal UI
      ↓
[Slice 6] Viral Infrastructure
```

---

## Phase 0 — Foundation & Contracts ✅

All scaffolding and contracts are complete. Every subsequent slice builds on this foundation without modifying it.

- [x] Monorepo workspace and Docker orchestration setup (`docker-compose.yml`, service networking)
- [x] Database schema, migrations, and physics bounds enforced as DB-level `CHECK` constraints (Drizzle ORM)
- [x] API contracts and Zod validation schemas (`backend/src/types/api.ts`)
- [x] Frontend design system (Tailwind v3, CSS variables, `globals.css`) and Next.js App Router scaffold

---

## Vertical Slice 1 — The Math Engine Core

**Goal**: A standalone Python service that accepts a price series and returns deterministic LPPLS parameters. The Node.js backend can call it and verify the output in isolation.

**Exit criteria**: `pytest` passes with ≥95% coverage. A synthetic sinusoidal log-price series returns bounded parameters (`0.1 < m < 0.9`, `B < 0`, `4 < ω < 25`).

### Python Engine (`engine/`)
- [x] Implement the LPPLS closed-form equation per Filimonov & Sornette (2013):
  $$\ln P(t) = A + B(t_c - t)^m [1 + C\cos(\omega \ln(t_c - t) + \phi)]$$
- [x] Implement the linear parameter collapse (`A`, `B`, `C1`, `C2`) via OLS at each nonlinear step
- [x] Wire SciPy `L-BFGS-B` optimizer with hard parameter bounds and a penalty term for bound violations
- [x] Implement the `confidence_score` metric: `1 - (residual_norm / baseline_norm)`
- [x] Expose `POST /solve` endpoint via FastAPI with Pydantic v2 request/response validation
- [x] Write unit tests for: equation correctness, optimizer convergence, failure/penalty path, Pydantic rejection of invalid inputs

### Node.js Backend (`backend/`)
- [x] Implement `LPPLSClient` service (`backend/src/services/lppls.client.ts`):
  - Abstract Python engine `/solve` POST request
  - Implement 30s timeout and strictly typed Zod parsing (`PythonSolveResponseSchema`)
  - Wrap network/Zod failures in `UpstreamError`NGINE_URL/solve` with a 30-second timeout
  - Parse and validate the response with `PythonSolveResponseSchema`
  - Return a typed `PythonSolveResponse` or throw a typed `UpstreamError`
- [ ] Write integration test: mock the Python engine with `nock`, assert typed output

---

## Vertical Slice 2 — Market Data Ingestion

**Goal**: A triggered pipeline that fetches real market data, computes stress sub-scores, and persists everything to PostgreSQL. The admin endpoint becomes functional.

**Exit criteria**: Running `POST /api/v1/admin/trigger-pipeline` with `{ "type": "daily", "force_recalculate": true }` results in populated rows in `daily_prices`, `fundamental_data`, and `stress_index_snapshots`.

### Node.js Backend (`backend/`)
- [ ] Implement `IngestionService` (`backend/src/services/ingestion.service.ts`):
  - Fetch 700 days of OHLCV + market cap for the 7-ticker AI basket using `yahoo-finance2`
  - Bulk UPSERT into `daily_prices` on `(ticker, trade_date)` conflict key
- [ ] Implement `FundamentalDataService` (`backend/src/services/fundamental.service.ts`):
  - Parse and persist SEC 10-Q CapEx and forward P/E data into `fundamental_data`
  - Compute the four macro stress sub-scores ($S_{PE}$, $S_{HHI}$, $S_{corr}$, $S_{CapEx}$)
- [ ] Implement `StressIndexService` (`backend/src/services/stress-index.service.ts`):
  - Compute the composite score: $S_{composite} = 0.25 \times (S_{PE} + S_{HHI} + S_{corr} + S_{CapEx})$
  - Upsert the result into `stress_index_snapshots`
- [ ] Implement `POST /api/v1/admin/trigger-pipeline` controller (`admin.controller.ts`):
  - Validate `Authorization: Bearer` header against `INTERNAL_API_SECRET` using `AdminTriggerPipelineHeadersSchema`
  - Validate request body with `AdminTriggerPipelineRequestSchema`
  - Sequence: `IngestionService` → `FundamentalDataService` → `StressIndexService`
  - Return `202 Accepted` with `{ job_id, type, status, queued_at }`
- [ ] Write service-level unit tests with mocked `yahoo-finance2` and `pg` responses

---

## Vertical Slice 3 — Hazard Synthesis & Caching

**Goal**: The pipeline fully runs end-to-end. A computed hazard rate is stored in PostgreSQL and served hot from Redis. `GET /api/v1/clock` returns a live, valid response.

**Exit criteria**: `GET /api/v1/clock` returns `200 OK` with all required fields. Redis key `hazard:current` exists with a 24h TTL. `hazard_rate_log` has a new row.

### Node.js Backend (`backend/`)
- [ ] Implement `HazardSynthesisService` (`backend/src/services/hazard.service.ts`):
  - Fetch the 500 most recent `adj_close` rows from `daily_prices` for the basket
  - Call `LPPLSClient.solve()` to get fitted parameters
  - Compute temporal proximity: $T_{prox} = \max(0, 1 - (t_c - t_{now}) / t_{window})$
  - Compute raw hazard: $H_{raw} = T_{prox} \times S_{composite} / 100$
  - Apply sigmoid mapping: $H_{sigmoid} = 1 / (1 + e^{-k(H_{raw} - h_0)})$ where $k=12$, $h_0=0.55$
  - Map to clock position: $\text{minutes} = 60 \times H_{sigmoid}$
- [ ] Persist final computation row to `hazard_rate_log` (linking `lppls_result_id` and `stress_snapshot_id` FKs)
- [ ] Write `hazard:current` JSON payload to Redis with `EX 86400` (24h TTL), following cache write-through pattern
- [ ] Wire `HazardSynthesisService` as the final step of the admin pipeline trigger
- [ ] Implement `GET /api/v1/clock` controller (`clock.controller.ts`):
  - Read from Redis `hazard:current`
  - Set `X-Cache: HIT/MISS` and `Cache-Control: public, max-age=30` headers
  - Parse and validate cache payload with `ClockResponseSchema`
  - Return typed `ClockResponse`
- [ ] Add `node-cron` scheduler: fire pipeline daily at `0 17 * * 1-5` (NYSE close + 1h)
- [ ] Write controller-level tests: mock Redis hit/miss, assert correct headers

---

## Vertical Slice 4 — The Public Dashboard (UI)

**Goal**: The live clock face renders in the browser, updates on a 30-second polling cycle, and displays the correct data quality state. All Zustand UI state transitions are functional.

**Exit criteria**: Visiting `http://localhost:3000` shows a rendered SVG clock face with animated hands, a live `minutes_to_midnight` readout, and `data_quality` badge. The clock re-renders every 30 seconds without a full page reload.

### Frontend (`frontend/`)
- [ ] Implement `cn()` utility in `lib/utils.ts` (`clsx` + `tailwind-merge`)
- [ ] Implement `useClockData` hook (`hooks/useClockData.ts`):
  - TanStack Query `useQuery` wrapping `GET /api/v1/clock`
  - `refetchInterval: 30_000` for live polling
  - Expose `data`, `isLoading`, `isError`, `isStale` states
- [ ] Build `ClockFace` component (`components/clock/ClockFace.tsx`):
  - SVG canvas with danger-red (`#FF3B3B`) hour hand
  - Animated `Framer Motion` `animate` transition on `minutes_to_midnight` change
  - ARIA label: `"AI Bubble Doomsday Clock: {N} minutes to midnight"`
- [ ] Build `MinutesReadout` component (`components/clock/MinutesReadout.tsx`):
  - `JetBrains Mono` font, large display — the primary hero number
  - Color-banded: green `< 20`, amber `20-40`, red `> 40`
- [ ] Build `DataQualityBadge` component (`components/clock/DataQualityBadge.tsx`):
  - Renders `full` / `degraded` / `stale` with appropriate icon and color
- [ ] Build `EventTicker` component (`components/ticker/EventTicker.tsx`):
  - Horizontally scrolling ticker reading from `GET /api/v1/events`
  - Each item displays `headline` and color-coded `hazard_delta`
- [ ] Implement Zustand `uiStore` (`store/uiStore.ts`):
  - `isTerminalOpen: boolean`, `toggleTerminal()`, `closeTerminal()`
- [ ] Assemble `DashboardPage` in `app/(dashboard)/page.tsx` wiring all components
- [ ] Write component tests with `@testing-library/react` for `ClockFace` and `DataQualityBadge`

---

## Vertical Slice 5 — The Analytics Terminal (UI)

**Goal**: Clicking "View the Math" opens a full-screen drawer showing live LPPLS parameters, stress sub-scores, and a 90-day historical hazard chart.

**Exit criteria**: The terminal drawer opens/closes via Zustand. It renders all LPPLS parameters in monospace and displays a working Recharts line chart.

### Node.js Backend (`backend/`)
- [ ] Implement `GET /api/v1/model` controller (`model.controller.ts`):
  - Query `lppls_results` and `stress_index_snapshots` for the most recent rows
  - Join with `fundamental_data` for source URLs
  - Validate output with `ModelResponseSchema` before sending
- [ ] Implement `GET /api/v1/history` controller (`history.controller.ts`):
  - Validate `range` query param with `HistoryQuerySchema` — reject invalid values with `422 VALIDATION_ERROR`
  - Aggregate `hazard_rate_log` grouped by day for the requested range
  - Validate output with `HistoryResponseSchema`
- [ ] Write controller-level tests with mocked Drizzle queries

### Frontend (`frontend/`)
- [ ] Implement `useModelData` hook (`hooks/useModelData.ts`):
  - TanStack Query wrapping `GET /api/v1/model`, enabled only when terminal is open
- [ ] Implement `useHistoryData` hook (`hooks/useHistoryData.ts`):
  - Accepts `range` param, wraps `GET /api/v1/history`
- [ ] Build `TerminalDrawer` component (`components/terminal/TerminalDrawer.tsx`):
  - Full-screen overlay, `background: var(--card)`, monospace font throughout
  - Controlled by `uiStore.isTerminalOpen`
  - Close button with keyboard `Escape` support
  - ARIA role `dialog`, `aria-modal="true"`
- [ ] Build `LPPLSParameterTable` component (`components/terminal/LPPLSParameterTable.tsx`):
  - Renders all 10 LPPLS parameters in a two-column table
  - Highlights physics constraint ranges ($m$, $\omega$, $B$) with cyan accent (`#00E5FF`)
- [ ] Build `StressBreakdown` component (`components/terminal/StressBreakdown.tsx`):
  - Visual bar chart of the four sub-score components with amber accent (`#FFB800`)
- [ ] Build `HazardChart` component (`components/terminal/HazardChart.tsx`):
  - Recharts `LineChart` plotting `minutes_to_midnight` over the selected `range`
  - Range toggle: `7d` | `30d` | `90d` | `1y`
- [ ] Write component tests for `TerminalDrawer` open/close behavior

---

## Vertical Slice 6 — Viral Infrastructure

**Goal**: The app is production-deployable, social-shareable, and continuously delivered.

**Exit criteria**: A merged PR to `main` triggers a successful Vercel + Render deploy. The OG image renders correctly when shared on X/LinkedIn.

### Frontend (`frontend/`)
- [x] Implement dynamic OG image route (`app/api/og/route.tsx`):
  - Fetch `GET /api/v1/clock` inside the route handler
  - Render 1200×630px canvas with `@vercel/og`: clock face, minutes readout, update timestamp
  - Cache response: `Cache-Control: public, max-age=3600`
- [x] Add `<meta og:image>` tags to `layout.tsx` pointing to `/api/og`

### CI/CD (`.github/workflows/`)
- [x] Finalize `ci.yml`: run all 4 test gates (Python lint/types/tests, Node lint/types/tests) on every PR
- [x] Configure Vercel project for `frontend/` — set `NEXT_PUBLIC_API_URL` environment variable
- [x] Configure Render service for `backend/` and `engine/` — set all environment variables per `AGENTS.md` contract

### Infrastructure
- [x] Validate production PostgreSQL connection and run `drizzle-kit push` against prod schema
- [x] Validate Upstash Redis connection and confirm `EX 86400` TTL behavior
- [x] Confirm `INTERNAL_API_SECRET` is set and the admin endpoint is unreachable without the token
- [x] Run a manual end-to-end smoke test: trigger pipeline → verify Redis → verify `GET /api/v1/clock` → verify UI renders

---

## Appendix: Definition of Done

A vertical slice is only marked **complete** when:

1. All checkboxes within it are checked.
2. The CI gate passes with zero warnings for that slice's code.
3. The feature can be demonstrated end-to-end in a running Docker environment.
4. The relevant `docs/` file has been updated if any architectural decision was changed during execution.

---

*See also*: [docs/05-architecture.md](05-architecture.md) | [docs/07-api-specification.md](07-api-specification.md) | [docs/06-database-schema.md](06-database-schema.md)
