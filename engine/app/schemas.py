"""
Pydantic v2 schemas for the AI Bubble Math Engine.

All models are immutable and fully typed. No I/O is performed here.
"""

from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SolveRequest(BaseModel):
    """Request body for POST /solve.

    Attributes:
        prices: Adjusted closing prices. Must be strictly positive float64 values.
                Minimum 100, maximum 2000 elements.
        dates:  Corresponding ISO-8601 date strings (YYYY-MM-DD). Must be the same
                length as ``prices`` and strictly ascending.
    """

    model_config = ConfigDict(frozen=True, strict=True)

    prices: List[float] = Field(
        ...,
        min_length=100,
        max_length=2000,
        description="Adjusted closing prices — strictly positive.",
    )
    dates: List[str] = Field(
        ...,
        min_length=100,
        max_length=2000,
        description="ISO-8601 date strings (YYYY-MM-DD).",
    )

    @field_validator("prices")
    @classmethod
    def prices_must_be_positive(cls, v: List[float]) -> List[float]:
        """Validate that every price is a finite, strictly positive number.

        Args:
            v: The raw prices list.

        Returns:
            The validated prices list.

        Raises:
            ValueError: If any price is non-positive or non-finite.
        """
        import math

        for i, p in enumerate(v):
            if not math.isfinite(p) or p <= 0.0:
                raise ValueError(
                    f"prices[{i}] = {p} is invalid; all prices must be finite and > 0."
                )
        return v

    @field_validator("dates")
    @classmethod
    def dates_must_be_valid_iso(cls, v: List[str]) -> List[str]:
        """Validate that every date string is a valid ISO-8601 date.

        Args:
            v: The raw dates list.

        Returns:
            The validated dates list.

        Raises:
            ValueError: If any date string cannot be parsed as YYYY-MM-DD.
        """
        for i, d in enumerate(v):
            try:
                date.fromisoformat(d)
            except ValueError:
                raise ValueError(
                    f"dates[{i}] = '{d}' is not a valid ISO-8601 date (YYYY-MM-DD)."
                )
        return v

    @model_validator(mode="after")
    def validate_equal_length_and_ascending(self) -> "SolveRequest":
        """Validate that prices and dates are equal in length and dates are ascending.

        Returns:
            The validated SolveRequest instance.

        Raises:
            ValueError: If lengths differ or dates are not strictly ascending.
        """
        if len(self.prices) != len(self.dates):
            raise ValueError(
                f"prices and dates must have equal length; "
                f"got {len(self.prices)} prices and {len(self.dates)} dates."
            )

        parsed = [date.fromisoformat(d) for d in self.dates]
        for i in range(1, len(parsed)):
            if parsed[i] <= parsed[i - 1]:
                raise ValueError(
                    f"dates must be strictly ascending; "
                    f"dates[{i - 1}]={self.dates[i - 1]} >= dates[{i}]={self.dates[i]}."
                )
        return self


class LPPLSResult(BaseModel):
    """Strictly typed result of the LPPLS L-BFGS-B optimization.

    All fields map directly to Python float64 values — no string-casting
    overhead from PostgreSQL NUMERIC columns.

    Attributes:
        tc:               Critical time as a decimal year (e.g., 2027.192).
        m:                Growth exponent. Physics bounds: 0.1 < m < 0.9.
        omega:            Log-periodic frequency. Physics bounds: 4 < omega < 25.
        phi:              Phase parameter in [0, 2π).
        A:                Price level at singularity (A > 0).
        B:                Amplitude coefficient (B < 0, enforced).
        C1:               B * cos(phi) — linear decomposition component.
        C2:               B * sin(phi) — linear decomposition component.
        residual_norm:    L2 norm of fit residuals (SSE); lower = better fit.
        confidence_score: Fit quality score in [0, 1]; 1 - (SSE / baseline_SSE).
    """

    model_config = ConfigDict(frozen=True)

    tc: float = Field(..., description="Critical time as decimal year.")
    m: float = Field(..., gt=0.1, lt=0.9, description="Growth exponent.")
    omega: float = Field(..., gt=4.0, lt=25.0, description="Log-periodic frequency.")
    phi: float = Field(..., ge=0.0, description="Phase parameter [0, 2π).")
    A: float = Field(..., gt=0.0, description="Price level at singularity.")
    B: float = Field(..., lt=0.0, description="Amplitude coefficient (must be < 0).")
    C1: float = Field(..., description="B·cos(φ) — linear decomposition.")
    C2: float = Field(..., description="B·sin(φ) — linear decomposition.")
    residual_norm: float = Field(..., ge=0.0, description="L2 norm of fit residuals (SSE).")
    confidence_score: float = Field(
        ..., ge=0.0, le=1.0, description="Fit quality score [0, 1]."
    )


class HealthResponse(BaseModel):
    """Response model for GET /health.

    Attributes:
        status:         Service liveness status. Always ``"ok"`` when reachable.
        solver:         Optimization algorithm in use.
        python_version: Python runtime version string.
    """

    model_config = ConfigDict(frozen=True)

    status: str
    solver: str
    python_version: str
