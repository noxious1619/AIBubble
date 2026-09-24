# AI Bubble Doomsday Clock — Project Overview

**Live econophysics platform predicting AI market fragility in real-time**
[github.com/noxious1619/AIBubble](https://github.com/noxious1619/AIBubble)

---

## What It Does

A full-stack web application that applies the **Log-Periodic Power Law Singularity (LPPLS)** model — a peer-reviewed mathematical framework by physicist Didier Sornette — to detect super-exponential bubble patterns in AI equities (NVDA, MSFT, GOOGL, META, AMZN, AMD). It synthesizes LPPLS regression output with a composite macro stress index into a single "hours to midnight" reading displayed as an animated doomsday clock.

---

## Tech Stack

### Frontend — Next.js 14 (App Router)
Built with **Next.js 14** using the App Router paradigm. Client-side data polling is handled with **SWR** for automatic revalidation. The animated SVG clock face uses React state-driven transforms. A dynamic social share card is generated server-side via **`@vercel/og` (Satori)** — a custom Edge Function that renders JSX to a 1200×630 PNG on every request using live API data.

### Backend — Node.js + Express + TypeScript
RESTful API built in **TypeScript** with strict mode enforced (`noImplicitAny`, `strictNullChecks`). All database access is handled through **Drizzle ORM** with versioned SQL migrations. Runtime inputs are validated with **Zod schemas**. A **node-cron** scheduler runs the full data pipeline nightly after NYSE close. **Redis (ioredis)** caches the live hazard payload with a 24-hour TTL, with automatic Postgres fallback on cache miss.

### Math Engine — Python 3.12 + FastAPI
A stateless **FastAPI** microservice implementing the LPPLS nonlinear optimization. Uses **NumPy** for vectorized matrix operations and **SciPy (L-BFGS-B)** for bounded 3-parameter search with a multi-start strategy. The 7-parameter system is collapsed to 3 unknowns using OLS linear parameter slaving (`numpy.linalg.lstsq`). Fully type-annotated; `mypy --strict` clean.

### Data & Infrastructure
- **PostgreSQL 16** — stores LPPLS results, stress snapshots, and hazard rate logs with a normalized relational schema
- **Redis 7** — sub-millisecond clock reads; LRU eviction policy
- **Docker Compose** — 5-container orchestration (frontend, backend, engine, postgres, redis) with health checks and dependency ordering
- **yfinance** — daily ingestion of 500 trading days of adjusted closing prices

---

## Key Engineering Decisions
- Hard service boundary: Python engine is a **pure function** — no I/O, no shared state
- OG Image route uses `INTERNAL_API_URL` (Docker DNS) for SSR, `NEXT_PUBLIC_API_URL` for client — preventing the localhost-in-container networking trap
- CORS whitelist is environment-configurable, not hardcoded
