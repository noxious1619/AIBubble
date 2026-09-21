# API Specification
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17
> **Base URL**: `/api/v1`
> **Protocol**: HTTP/1.1 and HTTP/2
> **Format**: All request and response bodies are `application/json` unless otherwise noted

---

## 1. Base URL & Versioning

| Environment | Base URL |
|-------------|---------|
| Production | `https://aibubbleclock.com/api/v1` |
| Development | `http://localhost:3001/api/v1` |
| Docker internal (web → api) | `http://api:3001/api/v1` |

**Versioning strategy**: URL path versioning. When breaking changes are introduced, `/api/v2` will be added while `/api/v1` is maintained for 90 days.

---

## 2. Authentication & Rate Limiting

### 2.1 Public Endpoints

All endpoints except `/admin/*` are public and require no authentication.

### 2.2 Admin Endpoints

Admin endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer {INTERNAL_API_SECRET}
```

Requests without a valid token receive `401 Unauthorized`.

### 2.3 Rate Limiting

Applied to all public endpoints, keyed by client IP address.

| Header | Value | Description |
|--------|-------|-------------|
| `X-RateLimit-Limit` | `60` | Maximum requests per window |
| `X-RateLimit-Remaining` | `N` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp | When the current window resets |
| `Retry-After` | Seconds | Only present on `429` responses |

On limit exceeded:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/json

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before retrying.",
    "retry_after_seconds": 30
  }
}
```

---

## 3. Standard Error Response Schema

All error responses use this envelope:

```json
{
  "error": {
    "code":    "string",   // Machine-readable error code (SCREAMING_SNAKE_CASE)
    "message": "string",   // Human-readable description
    "details": {}          // Optional: additional context (validation errors, etc.)
  }
}
```

### Error Code Reference

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `INVALID_REQUEST` | Malformed request body or query params |
| 401 | `UNAUTHORIZED` | Missing or invalid Bearer token |
| 404 | `NOT_FOUND` | Resource does not exist |
| 422 | `VALIDATION_ERROR` | Valid JSON but schema validation failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit hit |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `UPSTREAM_ERROR` | Python engine or external API unavailable |
| 503 | `SERVICE_UNAVAILABLE` | Database or Redis unreachable |

---

## 4. Public Endpoints

---

### `GET /api/v1/clock`

**Purpose**: Primary clock state endpoint. This is the only endpoint called by the Next.js frontend on page load and every 30-second polling cycle.

**Cache behavior**: Always served from Redis (`hazard:current`). Database is not queried on this path.

**Response headers**:

| Header | Value |
|--------|-------|
| `X-Cache` | `HIT` or `MISS` |
| `X-Cache-Stale` | `true` (only present if data is > 26 hours old) |
| `Cache-Control` | `public, max-age=30` |

**Response — `200 OK`**:

```json
{
  "minutes_to_midnight": 23.4,
  "hazard_rate":         0.71,
  "tc_date":             "2027-03-12",
  "tc_decimal":          2027.19178,
  "stress_score":        68.2,
  "data_quality":        "full",
  "last_updated":        "2026-09-17T22:01:34Z",
  "cache_ttl_seconds":   84723
}
```

**Field descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `minutes_to_midnight` | float [0, 60] | Current clock position. 60 = midnight (crash predicted). |
| `hazard_rate` | float [0, 1] | Raw sigmoid-mapped hazard rate |
| `tc_date` | string (ISO date) | LPPLS predicted critical date in human-readable form |
| `tc_decimal` | float | $t_c$ as decimal year (e.g., 2027.192) |
| `stress_score` | float [0, 100] | Composite macro stress index |
| `data_quality` | enum | `"full"` \| `"degraded"` (solver timeout) \| `"stale"` (> 26h old) |
| `last_updated` | string (ISO 8601) | When the pipeline last wrote to Redis |
| `cache_ttl_seconds` | integer | Seconds until Redis cache expires |

---

### `GET /api/v1/model`

**Purpose**: Full model output for the "View the Math" terminal drawer. Returns LPPLS parameters, stress sub-scores, and hazard computation breakdown in a single payload.

**Cache behavior**: Reads directly from PostgreSQL (most recent rows). Not cached in Redis.

**Response — `200 OK`**:

```json
{
  "lppls": {
    "tc":               2027.19178,
    "tc_date":          "2027-03-12",
    "m":                0.4823,
    "omega":            9.7341,
    "phi":              1.2094,
    "A":                14823.441200,
    "B":                -892.551330,
    "C1":               -412.330821,
    "C2":               201.882047,
    "residual_norm":    0.00341820,
    "confidence_score": 0.9312,
    "window_start":     "2024-07-31",
    "window_end":       "2026-09-17",
    "run_timestamp":    "2026-09-17T22:01:18Z"
  },
  "stress": {
    "composite_score":     68.2,
    "weights": {
      "forward_pe":     0.25,
      "hhi":            0.25,
      "correlation":    0.25,
      "capex_deficit":  0.25
    },
    "components": {
      "forward_pe": {
        "score":        83.3,
        "current_pe":   45.2,
        "fair_value_pe": 20.0,
        "max_hist_pe":  50.0,
        "formula":      "min(100, (current_pe - fair_pe) / (max_pe - fair_pe) * 100)"
      },
      "hhi": {
        "score":        55.6,
        "current_hhi":  0.28,
        "min_hhi":      0.05,
        "max_hhi":      0.50,
        "formula":      "min(100, (hhi - hhi_min) / (hhi_max - hhi_min) * 100)"
      },
      "correlation": {
        "score":        75.0,
        "mean_rho":     0.75,
        "window_days":  60,
        "formula":      "min(100, mean_rho * 100)"
      },
      "capex_deficit": {
        "score":        58.9,
        "deficit_ratio": 3.3,
        "baseline":     0.5,
        "max_ratio":    5.0,
        "formula":      "min(100, (D - D_base) / (D_max - D_base) * 100)"
      }
    },
    "snapshot_date": "2026-09-17"
  },
  "hazard": {
    "t_prox":           0.4096,
    "raw_hazard":       0.2794,
    "sigmoid_k":        12.0,
    "sigmoid_h0":       0.55,
    "sigmoid_hazard":   0.39,
    "minutes_to_midnight": 23.4,
    "computed_at":      "2026-09-17T22:01:34Z"
  },
  "data_sources": {
    "price_data":       "yfinance (Yahoo Finance)",
    "fundamental_data": [
      {
        "ticker":       "AMZN",
        "fiscal_quarter": "2026Q2",
        "source_url":   "https://www.sec.gov/Archives/edgar/..."
      }
    ],
    "price_data_through": "2026-09-17",
    "fundamental_data_as_of": "2026-09-12"
  }
}
```

---

### `GET /api/v1/history`

**Purpose**: Historical hazard rate time series for charting.

**Query parameters**:

| Parameter | Type | Required | Values | Default |
|-----------|------|----------|--------|---------|
| `range` | enum string | No | `7d`, `30d`, `90d`, `1y` | `30d` |

**Response — `200 OK`**:

```json
{
  "range": "30d",
  "data": [
    {
      "date":                "2026-08-18",
      "minutes_to_midnight": 21.1,
      "stress_score":        65.4,
      "tc_date":             "2027-04-02"
    },
    {
      "date":                "2026-08-19",
      "minutes_to_midnight": 21.8,
      "stress_score":        66.0,
      "tc_date":             "2027-03-28"
    }
  ],
  "meta": {
    "count":      30,
    "earliest":   "2026-08-18",
    "latest":     "2026-09-17"
  }
}
```

**Error — invalid range**:

```json
HTTP/1.1 422 Unprocessable Entity

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid range parameter",
    "details": {
      "field": "range",
      "allowed_values": ["7d", "30d", "90d", "1y"],
      "received": "6m"
    }
  }
}
```

---

### `GET /api/v1/og-image`

**Purpose**: Dynamically generated Open Graph preview image for social sharing.

**Query parameters**:

| Parameter | Type | Required | Values | Default |
|-----------|------|----------|--------|---------|
| `theme` | string | No | `dark`, `light` | `dark` |

**Response — `200 OK`**:
```
Content-Type: image/png
Content-Length: {N}
Cache-Control: public, max-age=3600
X-Cache: HIT | MISS

[Binary PNG data — 1200×630px]
```

**Content specifications**:
- Canvas: 1200×630px
- Background: `#0A0A0F` (dark theme) or `#F8F8FF` (light theme)
- Elements:
  1. Simplified SVG clock face (centered, 300×300px)
  2. Text: `"AI BUBBLE DOOMSDAY CLOCK"` — Inter 700, 48px
  3. Text: `"XX minutes to midnight"` — JetBrains Mono 600, 72px, colored by risk band
  4. Text: `"Updated: YYYY-MM-DD"` — Inter 400, 24px, muted color
  5. Footer: `"aibubbleclock.com  |  Not Financial Advice"` — Inter 400, 18px

---

### `GET /api/v1/events`

**Purpose**: Recent live event ticker items with hazard delta values.

**Query parameters**:

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `limit` | integer | No | 20 |
| `category` | string | No | (all categories) |

**Response — `200 OK`**:

```json
{
  "events": [
    {
      "id":           42,
      "event_time":   "2026-09-15T14:30:00Z",
      "headline":     "Amazon announces $220B 2026 capex guidance, beats consensus by 18%",
      "hazard_delta": -2.3,
      "category":     "capex_announcement",
      "source_url":   "https://ir.aboutamazon.com/..."
    }
  ],
  "meta": {
    "count":    20,
    "total":    147
  }
}
```

---

### `GET /api/v1/health`

**Purpose**: Liveness and dependency health check. Used by Docker health checks and monitoring.

**Response — `200 OK` (all healthy)**:

```json
{
  "status":        "ok",
  "uptime_seconds": 86432,
  "dependencies": {
    "postgres": {
      "status":     "ok",
      "latency_ms": 2
    },
    "redis": {
      "status":     "ok",
      "latency_ms": 1
    },
    "python_engine": {
      "status":     "ok",
      "latency_ms": 8
    }
  },
  "cache": {
    "hazard_current_exists": true,
    "hazard_age_seconds":    1847
  }
}
```

**Response — `503 Service Unavailable` (dependency down)**:

```json
{
  "status": "degraded",
  "dependencies": {
    "postgres":       { "status": "ok",   "latency_ms": 2 },
    "redis":          { "status": "down", "error": "Connection refused" },
    "python_engine":  { "status": "ok",   "latency_ms": 8 }
  }
}
```

---

## 5. Admin Endpoints

### `POST /api/v1/admin/trigger-pipeline`

**Purpose**: Manually trigger the data pipeline (daily or quarterly).

**Authentication**: Required — `Authorization: Bearer {INTERNAL_API_SECRET}`

**Request body**:

```json
{
  "type": "daily"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `type` | string | Yes | `"daily"` \| `"quarterly"` |

**Response — `202 Accepted`**:

```json
{
  "job_id":      "a3f2b1c4-8d9e-4f5a-b0c1-d2e3f4a5b6c7",
  "type":        "daily",
  "status":      "queued",
  "queued_at":   "2026-09-17T10:00:00Z"
}
```

**Error — `401 Unauthorized`**:

```json
{
  "error": {
    "code":    "UNAUTHORIZED",
    "message": "Valid Bearer token required for admin endpoints"
  }
}
```

---

## 6. Internal Service API — Python Math Engine

This section documents the internal-only API exposed by the Python engine. It is called exclusively by the Node.js orchestration layer. **No external traffic should ever reach this service.**

**Base URL**: `http://python-engine:8000` (Docker internal network only)

---

### `POST /solve`

**Purpose**: Run LPPLS L-BFGS-B optimization on a price series. Returns fitted parameters.

**Timeout**: The Node.js caller must set a request timeout of **30 seconds**. Exceeding this returns a `504` and the caller falls back to the previous LPPLS result.

**Request body**:

```json
{
  "prices": [14823.44, 14901.22, 14788.03, "...498 more..."],
  "dates":  ["2024-07-31", "2024-08-01", "2024-08-02", "...498 more..."]
}
```

**Validation rules** (enforced by Pydantic v2 before computation):

| Rule | Error |
|------|-------|
| `prices` and `dates` must have equal length | `422` |
| Minimum 100 elements required | `422` |
| Maximum 2000 elements allowed | `422` |
| All prices must be positive floats | `422` |
| Dates must be valid ISO-8601 date strings | `422` |
| Dates must be strictly ascending | `422` |

**Response — `200 OK`**:

```json
{
  "tc":               2027.19178,
  "m":                0.482300,
  "omega":            9.734100,
  "phi":              1.209400,
  "A":                14823.441200,
  "B":                -892.551330,
  "C1":               -412.33082100,
  "C2":               201.88204700,
  "residual_norm":    0.00341820,
  "confidence_score": 0.9312
}
```

**Response — `422 Unprocessable Entity`** (validation failure):

```json
{
  "detail": [
    {
      "loc":   ["body", "prices"],
      "msg":   "Minimum 100 price points required, got 45",
      "type":  "value_error"
    }
  ]
}
```

### `GET /health`

**Purpose**: Python engine liveness check.

**Response — `200 OK`**:

```json
{
  "status": "ok",
  "solver": "lbfgsb",
  "python_version": "3.12.4"
}
```

---

## 7. OpenAPI Schema Location

A machine-readable OpenAPI 3.1 specification will be auto-generated by FastAPI (Python engine) and Express-OpenAPI (Node API) and served at:

- Node API docs: `GET /api/v1/docs` (Swagger UI in development, disabled in production)
- Python engine docs: `GET /docs` (FastAPI built-in, internal network only)

---

*See also*: [docs/05-architecture.md](05-architecture.md) | [docs/06-database-schema.md](06-database-schema.md) | [docs/10-testing-strategy.md](10-testing-strategy.md)
