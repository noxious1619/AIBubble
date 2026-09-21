# AGENTS.md — AI Bubble Doomsday Clock
### Universal Agent & Contributor Instruction Standard
> **This file is the source of truth for all AI agents, human developers, and CI systems working in this repository.**
> Read it fully before making any change. Violating these rules will result in rejected pull requests.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Repo name** | `AIBubble` |
| **GitHub** | [https://github.com/noxious1619/AIBubble](https://github.com/noxious1619/AIBubble) |
| **Description** | A real-time econophysics platform predicting AI market fragility via LPPLS regression and macro stress indexing |
| **Canonical docs path** | `/docs/` |
| **Primary language** | TypeScript (Node.js backend + Next.js frontend), Python (math engine) |
| **Documentation standard** | Specification-Driven Development (SDD) — all architectural changes require a docs update |

---

## 2. Current Project State (as of 2026-09-21)

### 2.1 What Is Built and Working

The following features are **fully implemented and verified running locally via Docker Compose**:

| Feature | Status | Notes |
|---------|--------|-------|
| Python LPPLS Engine (FastAPI) | ✅ Working | `engine/` — `POST /solve`, `GET /health` |
| Node.js Orchestration API | ✅ Working | `backend/` — Express + Drizzle ORM, port 5000 |
| Next.js Frontend | ✅ Working | `frontend/` — Next.js 14 App Router, port 3000 |
| PostgreSQL Database | ✅ Working | Postgres 16-alpine via Docker, port 5434 |
| Redis Cache | ✅ Working | Redis 7-alpine via Docker, port 6380 |
| Data Pipeline (`/admin/trigger-pipeline`) | ✅ Working | yfinance ingestion → LPPLS → hazard rate |
| Doomsday Clock Face UI | ✅ Working | Animated SVG clock with glow, color bands |
| Analytics Drawer | ✅ Working | "View the Math" terminal-style drawer |
| Share Modal + OG Image | ✅ Working | `/api/og` generates live PNG via `@vercel/og` |
| Redis Fallback to Postgres | ✅ Working | Postgres fallback when Redis miss in clock controller |
| Docker Compose full-stack | ✅ Working | All 5 containers start, health-checked |

### 2.2 Known Issues / Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `fundamental_data` table is empty | Medium | CapEx sub-score uses placeholder values until quarterly pipeline runs |
| `ingestion.service.ts` non-atomic inserts | Low | Multi-step insert has no transaction rollback; identified in audit |
| CORS whitelist hardcoded | Low | `ALLOWED_ORIGINS` should be an env var |
| No HTTPS/TLS in Docker | Low | Development only; needs nginx reverse proxy for production |
| `drizzle-orm` / `drizzle-kit` version mismatch | Low | Run `npm update drizzle-orm drizzle-kit` in backend if using Drizzle Studio |

### 2.3 Port Map (Local Docker)

| Service | Internal Port | Host Port |
|---------|--------------|-----------|
| Next.js Frontend | 3000 | 3000 |
| Node.js API | 5000 | 5000 |
| Python Engine | 8000 | 8000 |
| PostgreSQL | 5432 | **5434** |
| Redis | 6379 | **6380** |

---

## 3. Architecture Invariants

These rules are non-negotiable. Any agent or contributor that violates them introduces undefined behavior into the system.

### 3.1 Service Boundary Rule

The system is divided into **two hard-separated compute layers**:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Math Engine** | Python 3.12 + FastAPI | LPPLS matrix regression ONLY |
| **Orchestration API** | Node.js 20 LTS + Express | All I/O, caching, scheduling, REST API |

**The boundary is a network call.** No exceptions.

- The Python engine **never** calls Node.js.
- The Node.js backend calls the Python engine via internal HTTP (`POST /solve`) and treats it as a pure function.
- Frontend **never** calls the Python engine directly.
- The OG Image route (`/api/og`) runs as a Next.js Edge Function and calls the Node API via `INTERNAL_API_URL` (Docker internal hostname `http://backend:5000`). It must **never** call `http://localhost:5000` — that resolves to the container itself, not the backend.

```
[Browser] ──► [Next.js SSR :3000] ──► [Node API :5000] ──► [Python Engine :8000]
                     │  (api/og edge fn)        │                   (pure math only)
                     │  uses INTERNAL_API_URL   ├──► [PostgreSQL :5432]
                     │                          └──► [Redis :6379]
                     └──► [NEXT_PUBLIC_API_URL=http://localhost:5000 (client-side)]
```

### 3.2 Python Purity Constraint

> **RULE: The Python math engine is a pure function. It is categorically forbidden from performing I/O.**

The following are **STRICTLY FORBIDDEN** inside `engine/`:

- ❌ Database connections of any kind (SQLAlchemy, psycopg2, SQLite, etc.)
- ❌ HTTP calls to any external service (requests, httpx, aiohttp)
- ❌ File system reads or writes beyond loading module code
- ❌ Environment variable reads beyond `PORT` and `LOG_LEVEL`
- ❌ Any non-deterministic operations (random without seeding, `datetime.now()` in computation paths)
- ❌ Global mutable state

The following are **REQUIRED**:

- ✅ Full type annotations — `mypy --strict` must pass with zero errors
- ✅ All public functions must have complete docstrings with Args/Returns/Raises
- ✅ Inputs: `numpy` arrays or Python primitives only
- ✅ Outputs: typed dataclasses (`@dataclass`) or Pydantic models
- ✅ All floating-point operations must be deterministic with explicit dtype declarations

### 3.3 Node.js Orchestration Ownership

The Node.js backend has **exclusive ownership** of:

- ✅ All database reads and writes (PostgreSQL via Drizzle ORM)
- ✅ Redis cache reads, writes, and invalidation
- ✅ Cron job scheduling (`node-cron`)
- ✅ External API calls (yfinance wrapper, SEC EDGAR)
- ✅ All inbound HTTP traffic from the browser
- ✅ Rate limiting and authentication middleware

### 3.4 OG Image Generation (Satori Constraints)

The `/api/og` route uses `@vercel/og` (Satori + Yoga layout engine). Satori is **not a browser** — it is a strict subset of CSS. The following rules are **mandatory** for all JSX inside `frontend/src/app/api/og/route.tsx`:

- ❌ **No `calc()` expressions** — use explicit pixel values (parent dims are fixed at 1200×630)
- ❌ **No raw text nodes adjacent to elements** — wrap all text in `<span>`
- ✅ Every `<div>` with more than one child **must** have `display: 'flex'` explicitly set
- ✅ Use `cache: 'no-store'` on any `fetch()` inside the route to prevent stale data
- ✅ Set `INTERNAL_API_URL=http://backend:5000` in the frontend container — never use `localhost` for SSR fetches

### 3.5 LPPLS Mathematical Bounds — **IMMUTABLE CONSTANTS**

> ⛔ **MODIFYING THESE BOUNDS IS STRICTLY FORBIDDEN WITHOUT A FORMAL ADR.**

| Parameter | Symbol | Lower Bound | Upper Bound | Interpretation |
|-----------|--------|------------|------------|---------------|
| Growth exponent | $m$ | **0.1** | **0.9** | Super-exponential acceleration |
| Log-periodic frequency | $\omega$ | **4** | **25** | Oscillation frequency (radians) |
| Acceleration coefficient | $B$ | $-\infty$ | **0** | Must be negative (price acceleration) |

**To modify any bound you MUST:**
1. Open a new ADR in `docs/11-decisions.md` with a sequential ADR number
2. Provide peer-reviewed mathematical justification
3. Provide backtesting evidence against at minimum: dot-com (2000), GFC (2008), and one recent AI-era dataset
4. Get explicit approval in a pull request before merging

---

## 4. Code Standards

### 4.1 Python

- **Style**: PEP 8 enforced via `ruff`
- **Types**: `mypy --strict` must pass — no `Any`, no untyped functions
- **Public API**: No `*args` or `**kwargs` in public function signatures
- **Imports**: Absolute imports only; no `from x import *`
- **Dependencies**: Pinned in `requirements.txt` with exact versions (e.g., `scipy==1.13.1`)
- **Testing**: `pytest` with minimum 95% coverage on the math engine

### 4.2 Node.js / TypeScript

- **Style**: ESLint + Prettier — `npm run lint` must pass with zero warnings
- **Types**: TypeScript strict mode — `noImplicitAny: true`, `strictNullChecks: true`
- **Runtime validation**: All external inputs (API request bodies, env vars, DB rows) must be validated with **Zod schemas** before use
- **Error handling**: No unhandled promise rejections — all async functions must have try/catch or `.catch()` handlers
- **Dependencies**: Pinned in `package-lock.json`

### 4.3 SQL

- **Migrations**: All schema changes via versioned sequential migration files
  - Format: `backend/src/db/migrations/NNN_description.sql`
  - Each migration must have a corresponding rollback section
- **NEVER** run raw `ALTER TABLE` or `DROP TABLE` outside a migration file
- **NEVER** use `SELECT *` in application code — always enumerate columns explicitly

### 4.4 Frontend (Next.js / React)

- **Framework**: Next.js 14 App Router (not Pages Router)
- **Styling**: Tailwind CSS
- **Data fetching**: SWR for client-side, `fetch` with `cache: 'no-store'` for edge/server components
- **Accessibility**: All interactive elements must have ARIA labels; clock face must have a text alternative
- **OG Image**: See §3.4 for Satori constraints — these are bugs, not suggestions

---

## 5. Environment Variables Contract

Each service must **only** read from its approved environment variables. Reading another service's secrets is forbidden.

### Python Engine (`engine/`)
```
PORT=8000
LOG_LEVEL=INFO
```

### Node.js API (`backend/.env`)
```
PORT=5001
DATABASE_URL=postgresql://admin:password@localhost:5434/aibubble
REDIS_URL=redis://localhost:6380
PYTHON_ENGINE_URL=http://localhost:8000
CRON_ENABLED=true
INTERNAL_API_SECRET=<secret>
LOG_LEVEL=info
```

### Next.js Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Docker Compose (overrides the above for container networking)
```
# Backend container
DATABASE_URL=postgresql://admin:password@postgres:5432/aibubble
REDIS_URL=redis://redis:6379
PYTHON_ENGINE_URL=http://engine:8000

# Frontend container
NEXT_PUBLIC_API_URL=http://localhost:5000   # browser-side (stays localhost)
INTERNAL_API_URL=http://backend:5000        # SSR/edge-side (uses Docker DNS)
```

> ⚠️ **NEVER confuse `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL`.**
> `NEXT_PUBLIC_*` variables are baked into the browser bundle at build time and must use `localhost`.
> `INTERNAL_API_URL` is read at server runtime and must use the Docker service hostname.

---

## 6. Branching & Commit Convention

### 6.1 Branching Strategy

- **Trunk-based development**: all work branches off `main` and merges back within 48 hours
- Branch naming: `<type>/<short-description>` (e.g., `feat/lppls-confidence-score`, `fix/redis-stale-cache`)

### 6.2 Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

| Type | When to use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes ONLY |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or modifying tests |
| `chore` | Build tooling, CI, dependency updates |
| `perf` | Performance improvements |

**Scope** should be one of: `math-engine`, `api`, `frontend`, `db`, `ci`, `docker`, `docs`

---

## 7. Documentation Rules

### 7.1 Change Coupling

Every architectural change **must** be accompanied by an update to the relevant `docs/` file:

| Type of Change | Docs file to update |
|----------------|-------------------|
| New API endpoint | `docs/07-api-specification.md` |
| Schema change | `docs/06-database-schema.md` |
| New Redis key | `docs/06-database-schema.md` |
| New feature | `docs/02-features.md` |
| Architectural decision | `docs/11-decisions.md` (new ADR) |
| LPPLS bounds change | `docs/11-decisions.md` **(mandatory ADR)** |
| New component | `docs/08-design-system.md` |
| OG Image / Satori CSS rules | This file, §3.4 |

---

## 8. CI/CD Gates

All pull requests must pass the following checks before merge:

| Gate | Command | Must pass |
|------|---------|-----------|
| Python lint | `ruff check engine/` | ✅ Zero violations |
| Python types | `mypy --strict engine/` | ✅ Zero errors |
| Python tests | `pytest engine/ --cov --cov-fail-under=95` | ✅ ≥95% coverage |
| Node lint | `npm run lint` (in `backend/`) | ✅ Zero warnings |
| Node types | `npm run type-check` (in `backend/`) | ✅ Zero errors |
| Node tests | `npm run test -- --coverage` (in `backend/`) | ✅ ≥85% coverage |
| Docker build | `docker compose build` | ✅ All 5 images build |

---

*Last updated: 2026-09-21 | Maintained by: Systems Architecture team*
