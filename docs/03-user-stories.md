# User Stories
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17

---

## 1. Personas

### 1.1 Alex — The Retail Investor

> *"I don't understand quant finance, but I know the AI bubble is real. I just want someone to tell me when to sell."*

- **Technical level**: Non-technical; uses Robinhood, follows fintwit
- **Primary device**: Mobile (iPhone)
- **Behavior**: Shares screenshots; reads headlines; does not open drawers or read equations
- **Core need**: A single, unambiguous signal they can act on — and share

### 1.2 Dr. Priya — The Quantitative Researcher

> *"I'm familiar with Sornette's work. I want to verify your parameter bounds are correct and your residuals aren't overfitted."*

- **Technical level**: PhD in financial mathematics; familiar with LPPLS, scipy, pandas
- **Primary device**: Desktop (laptop)
- **Behavior**: Will open the math drawer immediately; will attempt to replicate the calculation; will scrutinize the CapEx figures against SEC filings
- **Core need**: Full transparency and auditability; exportable raw data

### 1.3 Jordan — The Engineering Hiring Manager

> *"I'm reviewing this portfolio project. I want to understand the architectural decisions and see real production quality — not just a demo."*

- **Technical level**: Senior software engineer / engineering manager
- **Primary device**: Desktop
- **Behavior**: Will read the README and AGENTS.md; will browse the `/docs` folder; will look at CI configuration
- **Core need**: Evidence of systems thinking, clean service boundaries, and comprehensive tests

### 1.4 Sam — The Tech Journalist

> *"This is a great story. I need a quotable number and a good screenshot for the article."*

- **Technical level**: Non-technical
- **Primary device**: Desktop (writing) + mobile (preview)
- **Behavior**: Pastes the URL into Slack/Twitter to preview the OG image; copies the "minutes to midnight" figure into their article
- **Core need**: A compelling, shareable visual with a clear, quotable headline

---

## 2. Epic: Clock Consumption

### US-001 — Instant Risk Signal
```
As Alex (retail investor),
I want to see the current "minutes to midnight" value immediately when I land on the page
So that I can gauge AI market risk at a glance without reading any explanatory text.

Acceptance Criteria:
  Given I navigate to the homepage
  When the page finishes loading (< 3 seconds on 4G)
  Then the clock face is fully rendered with the animated minute hand at the correct position
  And the text readout "XX min to midnight" is visible below the clock
  And no login or interaction is required

Priority: P0 | Feature: F-005 | Sprint: 6
```

### US-002 — Plain-English Interpretation
```
As Alex (retail investor),
I want to understand what "minutes to midnight" actually means in plain language
So that I can make an informed decision without needing a finance degree.

Acceptance Criteria:
  Given I hover over (or tap on) the clock on mobile
  When the tooltip appears
  Then it displays a plain-English explanation of the current risk band:
    - < 15 min: "Critical — multiple indicators suggest severe AI market fragility"
    - 15–30 min: "High stress — elevated risk of significant correction"
    - 30–45 min: "Moderate — some stress indicators elevated, watch closely"
    - > 45 min: "Low — no imminent systemic signal detected"
  And the tooltip cites the two primary inputs (LPPLS tc date and Stress Score)

Priority: P1 | Feature: F-005 | Sprint: 6
```

### US-003 — Social Sharing with Live Preview
```
As Sam (tech journalist),
I want to paste the clock URL into social media or messaging apps
And see a rich preview card that shows the current "minutes to midnight" value
So that my audience understands the story before clicking.

Acceptance Criteria:
  Given I share the URL https://aibubbleclock.com on Twitter or LinkedIn
  When the platform fetches the OG metadata
  Then the preview card shows:
    - og:title: "AI Bubble Doomsday Clock — XX min to Midnight"
    - og:description: "Real-time LPPLS + macro stress model tracking AI market fragility"
    - og:image: A dynamically generated 1200×630px clock image with current value
  And the og:image reflects the clock value at time of share (cached max 1 hour)

Priority: P1 | Feature: F-007 | Sprint: 7
```

### US-004 — Mobile Responsive Experience
```
As Alex (retail investor),
I want the clock to look stunning and be fully functional on my iPhone
So that I can check it on the go and share it from my phone.

Acceptance Criteria:
  Given I load the page on a 375px-wide viewport (iPhone SE)
  When the page renders
  Then the clock face scales to fill the viewport width with 16px margins
  And the "View the Math" button is visible without scrolling
  And the event ticker is readable
  And no horizontal scroll is present

Priority: P1 | Feature: F-005 | Sprint: 6
```

---

## 3. Epic: Mathematical Transparency

### US-005 — Open the Math Drawer
```
As Dr. Priya (quant researcher),
I want to open a "View the Math" panel
And see the exact LPPLS fitted parameters with confidence metrics
So that I can evaluate whether the model output is credible.

Acceptance Criteria:
  Given I am on the homepage
  When I click the "View the Math" button
  Then a panel slides into view within 300ms
  And it displays the following LPPLS parameters in a table:
    - tc (as human-readable date, e.g., "March 12, 2027")
    - m (to 4 decimal places)
    - ω (to 4 decimal places)
    - φ (to 4 decimal places)
    - A, B, C1, C2 (to 6 significant figures)
    - residual_norm (to 8 decimal places)
    - confidence_score (as percentage, e.g., "94.3%")

Priority: P1 | Feature: F-006 | Sprint: 7
```

### US-006 — View Stress Index Sub-Scores
```
As Dr. Priya (quant researcher),
I want to see each of the four stress index sub-components individually
With their underlying formula and current input values
So that I can independently verify the calculation.

Acceptance Criteria:
  Given the math drawer is open
  When I scroll to the "Stress Index" section
  Then I see four sub-score rows:
    - Forward P/E Score: current P/E value, score, formula reference
    - HHI Concentration: current HHI value, score, formula reference
    - Pairwise Correlation: current mean ρ, score, formula reference
    - CapEx Deficit Ratio: current D value, score, formula reference
  And the composite score is shown with the weighting formula (0.25 × each)
  And each row has an expandable tooltip showing the exact formula in LaTeX notation

Priority: P1 | Feature: F-006 | Sprint: 7
```

### US-007 — Download Raw JSON Payload
```
As Dr. Priya (quant researcher),
I want to download the full model output as a JSON file
So that I can replicate and validate the calculations in my own environment.

Acceptance Criteria:
  Given the math drawer is open
  When I click "Download JSON"
  Then a browser file download is triggered with filename: "doomsday-clock-{YYYY-MM-DD}.json"
  And the JSON contains the full payload from GET /api/v1/model including:
    - LPPLS parameters
    - stress index sub-scores and inputs
    - hazard rate computation steps
    - data freshness timestamps
    - data source attributions (yfinance version, SEC filing URLs)

Priority: P1 | Feature: F-006 | Sprint: 7
```

### US-008 — Verify Data Freshness
```
As Dr. Priya (quant researcher),
I want to see when the model was last run and what data it used
So that I know if the clock reflects today's market or stale data.

Acceptance Criteria:
  Given the math drawer is open
  When I look at the "Data Freshness" section
  Then I see:
    - Last pipeline run: timestamp in local timezone
    - Price data through: most recent trade date in the database
    - Fundamental data as of: most recent 10-Q filing date
    - Cache age: seconds since Redis cache was last written
  And if data is stale (> 26 hours since last pipeline), a yellow warning badge is shown

Priority: P1 | Feature: F-006 | Sprint: 7
```

---

## 4. Epic: System Reliability

### US-009 — Daily Pipeline Completion
```
As the automated system,
I want the daily data pipeline to complete within 60 seconds of market close
So that the clock reflects today's data before US prime-time web traffic.

Acceptance Criteria:
  Given 22:00 UTC has passed on a weekday (Monday–Friday)
  When the cron job triggers
  Then within 60 seconds:
    - new row in lppls_results with today's run_timestamp
    - new row in stress_index_snapshots with today's snapshot_date
    - Redis key hazard:current updated with new updated_at timestamp
  And if the pipeline fails after 3 retries:
    - a structured error log is emitted with code PIPELINE_FETCH_FAILED
    - Redis continues serving stale data with X-Cache-Stale: true header

Priority: P0 | Feature: F-004 | Sprint: 3
```

### US-010 — Sub-5ms Cache Reads
```
As the serving infrastructure,
I want the clock endpoint to read from Redis cache with < 5ms latency
So that the system can sustain 10,000 concurrent users without hitting the database.

Acceptance Criteria:
  Given the Redis key hazard:current is populated
  When GET /api/v1/clock receives a request
  Then the response is served from Redis (X-Cache: HIT header present)
  And response time is < 5ms measured from Redis GET to response serialization
  And the PostgreSQL database is NOT queried on this request path

Priority: P0 | Feature: F-003 | Sprint: 5
```

### US-011 — Graceful Degradation on Pipeline Failure
```
As a visitor during a pipeline outage,
I want to still see the clock with a visible data-freshness warning
Rather than an error page
So that the site remains useful even when data is stale.

Acceptance Criteria:
  Given the daily pipeline has not successfully completed in > 26 hours
  When I load the homepage
  Then the clock is displayed using the last cached value
  And a yellow banner reads: "Data may be delayed. Last updated: {timestamp}"
  And the HTTP response includes header: X-Cache-Stale: true
  And no 500 error is returned

Priority: P1 | Feature: F-004 | Sprint: 5
```

---

## 5. Epic: Portfolio Showcase

### US-012 — Architectural Clarity for Evaluators
```
As Jordan (hiring manager),
I want to review the project's architectural documentation
And immediately understand why Python and Node.js are separate services
So that I can assess the candidate's systems design judgment.

Acceptance Criteria:
  Given I open the docs/ directory
  When I read docs/05-architecture.md and docs/11-decisions.md
  Then ADR-001 clearly explains the rationale for Python/Node separation
  And a C4 container diagram visually shows the service boundaries
  And the AGENTS.md file documents the immutable architectural rules
  And the constraint that Python has no DB connections is explicitly enforced in CI

Priority: P1 | Non-functional | Sprint: 1
```

### US-013 — CI/CD Pipeline Visibility
```
As Jordan (hiring manager),
I want to see a comprehensive CI/CD pipeline with clear quality gates
So that I know the project meets production engineering standards.

Acceptance Criteria:
  Given I open the GitHub repository
  When I look at the Actions tab
  Then I see a pipeline that runs on every pull request:
    - Python: ruff lint + mypy type check + pytest (≥95% coverage)
    - Node: ESLint + TypeScript check + Jest/Vitest (≥85% coverage)
    - Frontend: React Testing Library (≥80% coverage)
    - Docker: all images build successfully
  And the main branch is protected (merge blocked if any gate fails)

Priority: P1 | Non-functional | Sprint: 1
```

---

*See also*: [docs/02-features.md](02-features.md) | [docs/04-user-flows.md](04-user-flows.md) | [docs/10-testing-strategy.md](10-testing-strategy.md)
