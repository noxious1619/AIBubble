<div align="center">

# 🕛 AI Bubble Doomsday Clock

**A real-time econophysics platform predicting AI market fragility**

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)

*Not Financial Advice. This is an econophysics research model.*

</div>

---

## 🧠 What Is This?

The AI Bubble Doomsday Clock is a live dashboard that applies the **Log-Periodic Power Law Singularity (LPPLS)** model — a peer-reviewed econophysics framework by Didier Sornette — to detect super-exponential growth patterns in AI-related equities (Nasdaq-100, NVDA, MSFT, AMZN, GOOGL, META, TSLA, AMD).

It synthesizes three signals into a single "minutes to midnight" metric:

| Signal | Model | Source |
|--------|-------|--------|
| **Critical Time (T_c)** | LPPLS matrix regression | Daily Nasdaq-100 prices |
| **Macro Stress Index** | Composite of 4 sub-scores | yfinance market data + SEC filings |
| **Hazard Rate** | Logistic sigmoid synthesis | Combines T_c proximity + Stress |

The result is displayed as a doomsday clock: the closer the hands are to midnight, the higher the model's assessed fragility of the current AI market cycle.

---

## 🏗️ Architecture

```
[Browser]
    │
    ▼
[Next.js Frontend :3000]  ──(SSR fetch via INTERNAL_API_URL)──►  [Node.js API :5000]
    │ (client-side SWR via NEXT_PUBLIC_API_URL)                         │
    └────────────────────────────────────────────────────────────────────┤
                                                                         ├──► [Python Engine :8000]  (pure LPPLS math)
                                                                         ├──► [PostgreSQL :5432]
                                                                         └──► [Redis :6379]
```

| Service | Technology | Role |
|---------|-----------|------|
| **Frontend** | Next.js 14 App Router + Tailwind | Animated clock UI, analytics drawer, share modal |
| **API** | Node.js 22 + Express + Drizzle ORM | Orchestration, caching, scheduling, REST API |
| **Engine** | Python 3.12 + FastAPI + SciPy | Pure LPPLS regression (stateless pure function) |
| **Database** | PostgreSQL 16 | LPPLS results, stress snapshots, hazard log |
| **Cache** | Redis 7 | `hazard:current` key, 24h TTL, Postgres fallback |

---

## ⚙️ The Math

### LPPLS Model

$$\ln P(t) = A + B(t_c - t)^m \left[1 + C\cos\left(\omega \ln(t_c - t) + \phi\right)\right]$$

- **$t_c$** — Predicted crash date (primary output)
- **$m \in [0.1, 0.9]$** — Super-exponential growth exponent
- **$\omega \in [4, 25]$** — Log-periodic oscillation frequency
- **$B < 0$** — Price acceleration (enforced bound)

The 7-parameter system is decomposed into linear ($A$, $B\cos\phi$, $B\sin\phi$) and nonlinear ($t_c$, $m$, $\omega$) parameters using OLS slaving, reducing the optimization to a 3-parameter L-BFGS-B search.

### Hazard Rate Synthesis

$$T_{prox} = \max\left(0, 1 - \frac{t_c - t_{now}}{2.0}\right)$$

$$H_{raw} = T_{prox} \times \frac{S_{composite}}{100}$$

$$\text{Minutes to Midnight} = 60 \times \frac{1}{1 + e^{-12(H_{raw} - 0.55)}}$$

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- Git

### 1. Clone

```bash
git clone https://github.com/noxious1619/AIBubble.git
cd AIBubble
```

### 2. Start All Services

```bash
docker compose up -d
```

This spins up all 5 containers with health checks. The first run pulls images (~2 min). Subsequent starts are instant.

### 3. Run the Data Pipeline

Seed the database with live market data:

```bash
curl -X POST http://localhost:5000/api/v1/admin/trigger-pipeline \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: doomsday_admin_secret_2026" \
  -d '{"type": "daily"}'
```

### 4. Open the App

| URL | Service |
|-----|---------|
| [http://localhost:3000](http://localhost:3000) | Doomsday Clock Dashboard |
| [http://localhost:5000/api/v1/clock](http://localhost:5000/api/v1/clock) | Live Clock API |
| [http://localhost:8000/docs](http://localhost:8000/docs) | Python Engine Swagger |
| [http://localhost:3000/api/og](http://localhost:3000/api/og) | OG Image Preview |

---

## 📂 Project Structure

```
AIBubble/
├── frontend/               # Next.js 14 App Router
│   ├── src/app/            # Pages + API routes (including /api/og)
│   ├── src/components/     # ClockFace, AnalyticsDrawer, ShareModal
│   └── src/hooks/          # useClockData, useAnalyticsData (SWR)
│
├── backend/                # Node.js + Express + Drizzle ORM
│   ├── src/controllers/    # clock, admin, analytics, history, model
│   ├── src/services/       # hazard, ingestion, lppls-client, stress-index
│   ├── src/db/             # Drizzle schema + migrations
│   └── src/scheduler.ts    # node-cron daily pipeline
│
├── engine/                 # Python 3.12 + FastAPI
│   ├── app/lppls.py        # Core LPPLS regression solver
│   ├── app/main.py         # FastAPI routes: POST /solve, GET /health
│   └── app/schemas.py      # Pydantic input/output models
│
├── docs/                   # Architecture, API spec, DB schema, ADRs
├── docker-compose.yml      # Full-stack local orchestration
├── AGENTS.md               # Source of truth for contributors & AI agents
└── .env.example            # Environment variable template
```

---

## 🔌 Key API Endpoints

### `GET /api/v1/clock`
Returns the current hazard state (from Redis cache, falls back to Postgres).

```json
{
  "minutes_to_midnight": 5.9,
  "hazard_rate": 0.001537,
  "tc_date": "2029-03-10T00:00:00.000Z",
  "stress_score": 70.75,
  "data_quality": "full",
  "last_updated": "2026-09-21T04:38:14.431Z"
}
```

### `GET /api/v1/model`
Returns full LPPLS parameters, stress sub-scores, and hazard breakdown.

### `POST /api/v1/admin/trigger-pipeline`
Triggers the full data ingestion pipeline (requires `X-Admin-Secret` header).

### `GET /api/og`
Generates a live 1200×630px PNG social card (rendered via `@vercel/og` / Satori).

---

## 🗃️ Database Schema

| Table | Description |
|-------|-------------|
| `lppls_results` | LPPLS model outputs per run (`tc`, `m`, `omega`, `confidence`) |
| `stress_index_snapshots` | Composite stress score + 4 sub-scores per pipeline run |
| `hazard_rate_log` | Synthesized hazard rate + minutes-to-midnight log |
| `daily_prices` | Historical OHLCV data per ticker |
| `fundamental_data` | Quarterly CapEx + AI revenue per company (SEC filings) |

Migrations are in `backend/src/db/migrations/`.

---

## 🔒 Security Notes

- The `INTERNAL_API_SECRET` in `docker-compose.yml` is a **development default**. Change it before any public deployment.
- `.env` files are git-ignored. Use `.env.example` as your template.
- Never expose the Python engine port (8000) publicly — it has no authentication.

---

## 📖 Documentation

Full specification-driven documentation lives in `/docs/`:

| Doc | Contents |
|-----|----------|
| [`01-product-requirements.md`](docs/01-product-requirements.md) | PRD, success metrics |
| [`02-features.md`](docs/02-features.md) | Feature specs with full math |
| [`05-architecture.md`](docs/05-architecture.md) | System architecture + ADRs |
| [`06-database-schema.md`](docs/06-database-schema.md) | Full Postgres schema |
| [`07-api-specification.md`](docs/07-api-specification.md) | REST API contracts |
| [`11-decisions.md`](docs/11-decisions.md) | Architecture Decision Records |

---

## 📜 License

This project is for educational and research purposes. Not Financial Advice.

---

<div align="center">
<sub>Built with econophysics, caffeine, and a healthy fear of bubble dynamics.</sub>
</div>
