# AGENTS.md — AI Bubble Doomsday Clock
### Universal Agent & Contributor Instruction Standard
> **This file is the source of truth for all AI agents, human developers, and CI systems working in this repository.**
> Read it fully before making any change. Violating these rules will result in rejected pull requests.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Repo name** | `ai-bubble-doomsday-clock` |
| **Description** | A real-time econophysics platform predicting AI market fragility via LPPLS regression and macro stress indexing |
| **Canonical docs path** | `/docs/` |
| **Primary language** | TypeScript (Node.js backend + Next.js frontend), Python (math engine) |
| **Documentation standard** | Specification-Driven Development (SDD) — all architectural changes require a docs update |

---

## 2. Architecture Invariants

These rules are non-negotiable. Any agent or contributor that violates them introduces undefined behavior into the system.

### 2.1 Service Boundary Rule

The system is divided into **two hard-separated compute layers**:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Math Engine** | Python 3.12 + FastAPI | LPPLS matrix regression ONLY |
| **Orchestration API** | Node.js 20 LTS + Express | All I/O, caching, scheduling, REST API |

**The boundary is a network call.** No exceptions.

- The Python engine **never** calls Node.js.
- The Node.js backend calls the Python engine via internal HTTP (`POST /solve`) and treats it as a pure function.
- Frontend **never** calls the Python engine directly.

```
[Browser] ──► [Next.js SSR] ──► [Node API :3001] ──► [Python Engine :8000]
                                      │                        (pure math only)
                                      ├──► [PostgreSQL :5432]
                                      └──► [Redis :6379]
```

### 2.2 Python Purity Constraint

> **RULE: The Python math engine is a pure function. It is categorically forbidden from performing I/O.**

The following are **STRICTLY FORBIDDEN** inside `services/python-engine/`:

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

### 2.3 Node.js Orchestration Ownership

The Node.js backend has **exclusive ownership** of:

- ✅ All database reads and writes (PostgreSQL via `pg`)
- ✅ Redis cache reads, writes, and invalidation
- ✅ Cron job scheduling (`node-cron`)
- ✅ External API calls (yfinance wrapper, SEC EDGAR)
- ✅ All inbound HTTP traffic from the browser
- ✅ OG image generation
- ✅ Rate limiting and authentication middleware

### 2.4 LPPLS Mathematical Bounds — **IMMUTABLE CONSTANTS**

> ⛔ **MODIFYING THESE BOUNDS IS STRICTLY FORBIDDEN WITHOUT A FORMAL ADR.**

The LPPLS model optimization is constrained by the following bounds, derived from Sornette (2003) and validated against historical crash data:

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

## 3. Code Standards

### 3.1 Python

- **Style**: PEP 8 enforced via `ruff`
- **Types**: `mypy --strict` must pass — no `Any`, no untyped functions
- **Public API**: No `*args` or `**kwargs` in public function signatures
- **Imports**: Absolute imports only; no `from x import *`
- **Dependencies**: Pinned in `requirements.txt` with exact versions (e.g., `scipy==1.13.1`)
- **Testing**: `pytest` with minimum 95% coverage on the math engine

### 3.2 Node.js / TypeScript

- **Style**: ESLint + Prettier — `npm run lint` must pass with zero warnings
- **Types**: TypeScript strict mode — `noImplicitAny: true`, `strictNullChecks: true`
- **Runtime validation**: All external inputs (API request bodies, env vars, DB rows) must be validated with **Zod schemas** before use
- **Error handling**: No unhandled promise rejections — all async functions must have try/catch or `.catch()` handlers
- **Dependencies**: Pinned in `package-lock.json`

### 3.3 SQL

- **Migrations**: All schema changes via versioned sequential migration files
  - Format: `migrations/NNN_description.sql` (e.g., `migrations/001_init_schema.sql`)
  - Each migration must have a corresponding rollback section
- **NEVER** run raw `ALTER TABLE` or `DROP TABLE` outside a migration file
- **NEVER** use `SELECT *` in application code — always enumerate columns explicitly

### 3.4 Frontend (Next.js / React)

- **Framework**: Next.js App Router (not Pages Router)
- **Styling**: Tailwind CSS
- **Data fetching**: SWR for client-side, `fetch` with `cache` for server components
- **Accessibility**: All interactive elements must have ARIA labels; clock face must have a text alternative

---

## 4. Branching & Commit Convention

### 4.1 Branching Strategy

- **Trunk-based development**: all work branches off `main` and merges back within 48 hours
- **Feature flags** over long-lived feature branches — ship dark by default
- Branch naming: `<type>/<short-description>` (e.g., `feat/lppls-confidence-score`, `fix/redis-stale-cache`)

### 4.2 Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
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

## 5. Documentation Rules

### 5.1 Change Coupling

Every architectural change **must** be accompanied by an update to the relevant `docs/` file in the same pull request:

| Type of Change | Docs file to update |
|----------------|-------------------|
| New API endpoint | `docs/07-api-specification.md` |
| Schema change | `docs/06-database-schema.md` |
| New Redis key | `docs/06-database-schema.md` |
| New feature | `docs/02-features.md` |
| Architectural decision | `docs/11-decisions.md` (new ADR) |
| LPPLS bounds change | `docs/11-decisions.md` **(mandatory ADR)** |
| New component | `docs/08-design-system.md` |

### 5.2 Mathematical Notation

All mathematical formulae in documentation must use **LaTeX notation** within Markdown fenced blocks or inline `$...$` delimiters:

```markdown
The LPPLS model is defined as:
$$\ln P(t) = A + B(t_c - t)^m [1 + C\cos(\omega \ln(t_c - t) + \phi)]$$
```

### 5.3 No Vague Placeholders

Documentation must contain **exact** values, types, and constraints — never:
- ❌ "some number" → ✅ `NUMERIC(12,6)`
- ❌ "fast response" → ✅ `p95 < 200ms`
- ❌ "approximately weekly" → ✅ `0 17 * * 1-5` (cron expression)

---

## 6. Environment Variables Contract

Each service must **only** read from its approved environment variables. Reading another service's secrets is forbidden.

### Python Engine (`services/python-engine/.env`)
```
PORT=8000
LOG_LEVEL=INFO
```

### Node.js API (`services/api/.env`)
```
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
PYTHON_ENGINE_URL=http://python-engine:8000
CRON_ENABLED=true
INTERNAL_API_SECRET=<secret>
LOG_LEVEL=info
```

### Next.js Frontend (`frontend/.env`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 7. CI/CD Gates

All pull requests must pass the following checks before merge is allowed:

| Gate | Command | Must pass |
|------|---------|-----------|
| Python lint | `ruff check services/python-engine` | ✅ Zero violations |
| Python types | `mypy --strict services/python-engine` | ✅ Zero errors |
| Python tests | `pytest services/python-engine --cov --cov-fail-under=95` | ✅ ≥95% coverage |
| Node lint | `npm run lint` | ✅ Zero warnings |
| Node types | `npm run type-check` | ✅ Zero errors |
| Node tests | `npm run test -- --coverage` | ✅ ≥85% coverage |
| Frontend tests | `npm run test:ui -- --coverage` | ✅ ≥80% coverage |
| Build | `docker compose build` | ✅ All images build |

---

*Last updated: 2026-09-17 | Maintained by: Systems Architecture team*
