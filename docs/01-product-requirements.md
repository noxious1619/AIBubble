# Product Requirements Document
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17
> **Owner**: Systems Architecture

---

## 1. Executive Summary

The AI Bubble Doomsday Clock is a real-time data platform that applies statistical physics and macroeconomic fundamentals to quantify systemic fragility in the generative AI infrastructure buildout. It computes the probability-weighted date of a market rupture in AI-exposed equities and presents the result as a single, viscerally legible metric: **minutes to midnight on a doomsday clock face**. The platform is designed simultaneously as a viral public utility for retail investors and a production-grade portfolio centerpiece demonstrating full-stack systems design at scale.

---

## 2. Problem Statement

### 2.1 The AI CapEx Supercycle

Between 2023 and 2026, the four largest hyperscalers (Microsoft, Alphabet, Amazon, Meta) have collectively committed over **$800 billion** in capital expenditure toward AI infrastructure — GPU clusters, custom silicon, data centers, and power infrastructure. This buildout is occurring in advance of any corresponding revenue realization:

- Amazon's 2026 cash CapEx guidance: ~$220 billion
- Alphabet's 2026 cash CapEx guidance: ~$200 billion
- AI-specific operating revenue materially lags investment timelines

This creates a structural CapEx-to-revenue deficit that, combined with historically elevated valuation multiples and extreme market concentration, exhibits the hallmarks of a classic investment bubble.

### 2.2 Why Existing Tools Fail

| Tool | Limitation |
|------|-----------|
| VIX (implied volatility) | Reactive — spikes after the crash begins, not before |
| P/E ratio screens | Single-dimensional; ignores market structure dynamics |
| Analyst price targets | Consensus-driven; subject to anchoring bias |
| Traditional RSI/MACD | Lagging indicators; no model of endogenous crash dynamics |

**Gap**: No publicly accessible tool combines super-exponential price trajectory modeling (econophysics) with real-time fundamental stress scoring into a single, real-time, explainable prediction.

---

## 3. Vision & Objectives

### 3.1 Primary Objective
Compute and continuously update the Log-Periodic Power Law Singularity (LPPLS) critical time $t_c$ — the exact future date at which the AI sector's super-exponential price growth goes vertical and breaks — with measurable accuracy.

> **Success criterion**: $t_c$ prediction falls within **±30 trading days** of the realized peak-to-20%-drawdown event, as measured against a historical backtesting suite (dot-com 2000, GFC 2008, 2021 meme-stock bubble).

### 3.2 Secondary Objective
Democratize econophysics research. The "View the Math" terminal drawer must expose every model parameter, formula, and data source to any user who requests it, transforming a black-box number into a fully auditable scientific output.

### 3.3 Tertiary Objective
Serve as a compelling, differentiated portfolio artifact for the 2027 placement cycle, demonstrating:
- Decoupled microservice architecture
- Mathematical rigor (LPPLS, HHI, logistic hazard mapping)
- Production engineering (Docker, Redis, cron, type safety)
- Viral product design (dynamic OG images, shareability)

---

## 4. Target Audience

### 4.1 Primary — Retail Investor / Fintwit Community
- **Profile**: Technically literate, active on X (Twitter), Reddit (r/wallstreetbets, r/investing), LinkedIn
- **Need**: A single number that tells them whether to be scared
- **Behavior**: Shares striking visuals; does not read whitepapers
- **Key requirement**: Clock face must convey urgency without requiring explanation

### 4.2 Secondary — Quantitative Finance Researchers
- **Profile**: PhD-level or practitioner quants; familiar with Sornette (2003), Johansen (2000)
- **Need**: Verifiable model outputs, downloadable data, reproducible methodology
- **Behavior**: Will scrutinize parameters and challenge the model
- **Key requirement**: Full mathematical transparency; JSON export; formula citations

### 4.3 Tertiary — Hiring Managers / Technical Evaluators
- **Profile**: Senior engineers and engineering managers evaluating 2027 new grad candidates
- **Need**: Evidence of production-quality systems design and mathematical competence
- **Behavior**: Will inspect the architecture docs, CI pipeline, and code structure
- **Key requirement**: Clean service separation; comprehensive docs; measurable test coverage

### 4.4 Quaternary — Tech Journalists & Financial Media
- **Profile**: Writers at Bloomberg, FT Alphaville, The Information, Hacker News
- **Need**: A shareable hook; a quotable data point
- **Behavior**: Pastes links; generates screenshots
- **Key requirement**: Dynamic OG images with live minute count; accessible plain-English explainers

---

## 5. Success Metrics (KPIs)

### 5.1 Mathematical Accuracy

| Metric | Target |
|--------|--------|
| $t_c$ prediction error (backtesting) | ≤ ±30 trading days of realized peak |
| Stress Index correlation with VIX | Pearson $r$ > 0.70 |
| LPPLS confidence score on synthetic data | Residual norm < 0.05 on known-parameter datasets |
| False positive rate | < 20% (clock at >30 min when no correction occurs within 60 days) |

### 5.2 Performance

| Metric | Target |
|--------|--------|
| `/api/v1/clock` p50 latency | < 10ms (Redis cache hit) |
| `/api/v1/clock` p95 latency | < 200ms |
| `/api/v1/model` p95 latency | < 500ms |
| Concurrent user capacity | 10,000 simultaneous connections without degradation |
| Daily pipeline completion time | < 60 seconds after market close trigger |
| LPPLS solve latency (Python engine) | p50 < 2s, p99 < 10s |

### 5.3 Reliability

| Metric | Target |
|--------|--------|
| API uptime | ≥ 99.5% monthly |
| Pipeline success rate | ≥ 99% of trading days |
| Stale cache serve (on pipeline failure) | Graceful degradation; stale data served with `X-Cache-Stale: true` header |

### 5.4 Virality

| Metric | Target |
|--------|--------|
| Unique visitors (first viral cycle) | ≥ 100,000 |
| Social share rate | ≥ 5% of landing page visitors |
| OG image render time | < 1 second |
| Bounce rate | < 60% |

---

## 6. Scope & Constraints

### 6.1 In-Scope (MVP — Phase 1–5)

- LPPLS regression on Nasdaq-100 (NDX) as AI sector proxy
- Macro stress index with four sub-components (Forward P/E, HHI, correlation, CapEx deficit)
- Hazard rate synthesis via logistic S-curve
- Daily automated data pipeline (yfinance)
- Quarterly fundamental data update workflow
- Public REST API (6 endpoints)
- Next.js frontend with animated clock face
- "View the Math" terminal drawer
- Dynamic OG image generation
- Docker Compose deployment

### 6.2 Out-of-Scope (Post-MVP)

- Individual stock-level LPPLS analysis (sector-level only in MVP)
- Push/email alert subscriptions
- User accounts or authentication
- Paid tier or monetization
- Historical backtesting interactive dashboard
- Embeddable iframe widget
- Mobile native application
- Real-time streaming WebSocket API

### 6.3 Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Data sources** | Open-source only (yfinance, SEC EDGAR) — no paid Bloomberg/Refinitiv APIs |
| **Infrastructure** | Single-server Docker Compose for MVP; must support horizontal scaling post-MVP |
| **Python engine** | Stateless; no persistent storage; designed for horizontal replication |
| **LPPLS window** | Fixed 500 trading days of Nasdaq-100 adjusted closing prices |
| **Language versions** | Python ≥ 3.12; Node.js ≥ 20 LTS; PostgreSQL 16; Redis 7 |

### 6.4 Legal & Compliance

- The platform must display a prominent **"Not Financial Advice"** disclaimer on every page
- All data attributions (yfinance, SEC EDGAR) must be visible in the footer and the `/api/v1/model` response
- No user financial data is collected; privacy policy required pre-launch
- CapEx figures cited from public SEC filings must include source URLs stored in `fundamental_data.source_url`

---

## 7. Assumptions & Dependencies

| Assumption | Risk if wrong | Mitigation |
|-----------|--------------|-----------|
| yfinance provides reliable daily OHLCV for NDX constituents | Pipeline fails silently | Retry with exponential backoff; alert on 3 consecutive failures |
| SEC EDGAR 10-Q filings are machine-readable | Quarterly update requires manual intervention | Build manual override API endpoint |
| Nasdaq-100 is a sufficient proxy for AI sector exposure | Model misses non-NDX AI exposure (e.g., private cloud) | Document assumption in ADR; add HHI concentration metric as correction |
| Redis instance fits hazard cache in memory | Cache eviction causes latency spikes | Set `maxmemory-policy allkeys-lru`; monitor memory usage |
| Docker Compose is sufficient for MVP traffic | Viral event overwhelms single server | Design stateless services from day 1; document K8s migration path |

---

*See also*: [docs/02-features.md](02-features.md) | [docs/05-architecture.md](05-architecture.md) | [docs/11-decisions.md](11-decisions.md)
