"""
FastAPI application entry point for the AI Bubble Math Engine.

This service is a pure computation layer — it performs no I/O beyond:
  - Accepting inbound HTTP from the Node.js orchestrator
  - Returning typed JSON responses

It reads only PORT and LOG_LEVEL environment variables (AGENTS.md §6).
"""

from __future__ import annotations

import sys
from datetime import date

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app.lppls import solve_lppls
from app.schemas import HealthResponse, LPPLSResult, SolveRequest

app = FastAPI(
    title="AI Bubble Math Engine",
    description=(
        "Pure LPPLS regression service. Accepts a price series, "
        "returns fitted parameters. No external I/O."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness check",
    tags=["ops"],
)
def health_check() -> HealthResponse:
    """Return service liveness status, solver name, and Python version.

    Returns:
        A :class:`HealthResponse` with ``status="ok"``.
    """
    return HealthResponse(
        status="ok",
        solver="lbfgsb",
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    )


@app.post(
    "/solve",
    response_model=LPPLSResult,
    summary="Run LPPLS optimisation",
    tags=["solver"],
)
def solve_endpoint(request: SolveRequest) -> LPPLSResult:
    """Accept a validated price series and return LPPLS fitted parameters.

    The Pydantic :class:`SolveRequest` model enforces all input constraints
    (equal lengths, min/max sizes, positive prices, valid ISO dates, ascending
    order) before this handler executes.

    Args:
        request: Validated :class:`SolveRequest` containing ``prices`` and
            ``dates``.

    Returns:
        A :class:`LPPLSResult` containing ``tc``, ``m``, ``omega``, ``phi``,
        ``A``, ``B``, ``C1``, ``C2``, ``residual_norm``, and
        ``confidence_score``.

    Raises:
        HTTPException 422: If input data passes schema validation but the
            solver rejects it (e.g., non-ascending decimal times).
        HTTPException 500: If an unexpected internal error occurs.
    """
    try:
        prices: np.ndarray = np.array(request.prices, dtype=np.float64)
        times: np.ndarray = np.array(
            [_iso_to_decimal_year(d) for d in request.dates], dtype=np.float64
        )

        # Final guard: decimal-year times must be strictly ascending.
        # (The schema already validated ISO-date ordering; this catches
        # pathological same-day duplicates that parse identically.)
        if not bool(np.all(np.diff(times) > 0.0)):
            raise ValueError("Converted decimal-year times are not strictly ascending.")

        result = solve_lppls(prices, times)
        return LPPLSResult(**result)

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Internal solver error: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Private helpers — not part of the public API surface.
# ---------------------------------------------------------------------------

def _iso_to_decimal_year(iso_date: str) -> float:
    """Convert an ISO-8601 date string to a decimal year.

    Uses the fraction of elapsed days in the year to avoid any dependency
    on wall-clock time, keeping the function deterministic.

    Args:
        iso_date: A valid ISO-8601 date string (YYYY-MM-DD).

    Returns:
        The date expressed as a decimal year (e.g., ``"2027-03-12"`` →
        ``2027.192...``).
    """
    d: date = date.fromisoformat(iso_date)
    year_start: date = date(d.year, 1, 1)
    year_end: date = date(d.year + 1, 1, 1)
    year_length: int = (year_end - year_start).days
    elapsed: int = (d - year_start).days
    return float(d.year) + float(elapsed) / float(year_length)
