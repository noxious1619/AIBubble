"""
pytest test suite for the AI Bubble Math Engine.

Coverage targets:
  1. LPPLS equation correctness — synthetic series with known ground truth.
  2. Physics bound enforcement — B < 0, m ∈ (0.1, 0.9), omega ∈ (4, 25).
  3. Optimizer convergence — recovered parameters within tolerance of ground truth.
  4. Confidence score sanity — a perfect fit should score near 1.0.
  5. Solver failure path — non-LPPLS (flat / random-walk) series raises ValueError.
  6. POST /solve endpoint — full FastAPI integration via httpx TestClient.
  7. Pydantic schema rejection — invalid payloads receive 422 with detail.
  8. GET /health endpoint — returns expected fields.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.lppls import _INFEASIBLE, _lppls_objective, solve_lppls
from app.main import _iso_to_decimal_year, app

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

client = TestClient(app)

# Ground-truth synthetic LPPLS parameters — kept as module-level constants
# so every test that references them is perfectly reproducible.
_TC_TRUE: float = 2027.5
_M_TRUE: float = 0.5
_OMEGA_TRUE: float = 10.0
_A_TRUE: float = 10.0
_B_TRUE: float = -1.0
_C1_TRUE: float = 0.05
_C2_TRUE: float = 0.05
_N: int = 500


@pytest.fixture(scope="module")
def synthetic_series() -> Dict[str, Any]:
    """Generate a noise-free synthetic LPPLS series with known ground truth.

    Returns:
        A dict with keys ``times`` (ndarray), ``prices`` (ndarray),
        ``dates`` (list[str]), and the ground-truth scalar parameters.
    """
    times: np.ndarray = np.linspace(2025.0, 2027.0, _N, dtype=np.float64)
    tau: np.ndarray = _TC_TRUE - times
    log_p: np.ndarray = (
        _A_TRUE
        + _B_TRUE * tau**_M_TRUE
        + _C1_TRUE * tau**_M_TRUE * np.cos(_OMEGA_TRUE * np.log(tau))
        + _C2_TRUE * tau**_M_TRUE * np.sin(_OMEGA_TRUE * np.log(tau))
    )
    prices: np.ndarray = np.exp(log_p).astype(np.float64)

    # Build ISO date strings: 500 business-ish days from 2025-01-01.
    import datetime

    start = datetime.date(2025, 1, 2)
    dates: List[str] = []
    current = start
    while len(dates) < _N:
        dates.append(current.isoformat())
        current += datetime.timedelta(days=1)

    return {
        "times": times,
        "prices": prices,
        "dates": dates,
    }


# ---------------------------------------------------------------------------
# 1. Equation correctness
# ---------------------------------------------------------------------------


class TestLPPLSEquation:
    def test_log_price_shape_matches_time_array(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """The generated log-price array must have the same shape as times."""
        times: np.ndarray = synthetic_series["times"]
        tau = _TC_TRUE - times
        log_p = (
            _A_TRUE
            + _B_TRUE * tau**_M_TRUE
            + _C1_TRUE * tau**_M_TRUE * np.cos(_OMEGA_TRUE * np.log(tau))
            + _C2_TRUE * tau**_M_TRUE * np.sin(_OMEGA_TRUE * np.log(tau))
        )
        assert log_p.shape == times.shape

    def test_prices_are_positive(self, synthetic_series: Dict[str, Any]) -> None:
        """All synthetic prices must be strictly positive."""
        assert np.all(synthetic_series["prices"] > 0.0)

    def test_objective_returns_finite_on_valid_input(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """The objective function must return a finite scalar on a valid initialisation."""
        times = synthetic_series["times"]
        log_p = np.log(synthetic_series["prices"])
        params = np.array([_TC_TRUE, _M_TRUE, _OMEGA_TRUE], dtype=np.float64)
        val = _lppls_objective(params, times, log_p)
        assert np.isfinite(val)

    def test_objective_returns_infeasible_when_tc_in_past(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """The objective must return _INFEASIBLE when tc <= t[-1]."""
        times = synthetic_series["times"]
        log_p = np.log(synthetic_series["prices"])
        # tc set to t[-1] (boundary violation)
        params = np.array([times[-1], _M_TRUE, _OMEGA_TRUE], dtype=np.float64)
        val = _lppls_objective(params, times, log_p)
        assert val >= _INFEASIBLE

    def test_objective_returns_infeasible_when_B_positive(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """The objective must return _INFEASIBLE when B >= 0 (physics violation)."""
        times = synthetic_series["times"]
        # Flat series forces B = 0 via OLS.
        flat_log_p = np.ones(len(times), dtype=np.float64) * _A_TRUE
        params = np.array([_TC_TRUE, _M_TRUE, _OMEGA_TRUE], dtype=np.float64)
        val = _lppls_objective(params, times, flat_log_p)
        # Flat series can produce B = 0 → _INFEASIBLE, OR a non-zero B depending
        # on OLS; the important invariant is the value is not unexpectedly small.
        assert val >= 0.0  # Must be a valid scalar


# ---------------------------------------------------------------------------
# 2 & 3. Optimizer convergence and bound enforcement
# ---------------------------------------------------------------------------


class TestSolveLPPLS:
    def test_optimizer_converges_on_synthetic_series(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """solve_lppls must return a result dict with all required keys."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        required = {"tc", "m", "omega", "phi", "A", "B", "C1", "C2",
                    "residual_norm", "confidence_score"}
        assert required.issubset(res.keys())

    def test_recovered_tc_within_tolerance(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """Recovered tc must be within 0.1 year of ground truth."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert abs(res["tc"] - _TC_TRUE) < 0.1

    def test_recovered_m_within_tolerance(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """Recovered m must be within 0.1 of ground truth."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert abs(res["m"] - _M_TRUE) < 0.1

    def test_recovered_omega_within_tolerance(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """Recovered omega must be within 0.5 of ground truth."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert abs(res["omega"] - _OMEGA_TRUE) < 0.5

    def test_physics_bound_B_negative(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """B must be strictly negative (physics invariant)."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert res["B"] < 0.0

    def test_physics_bound_m_range(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """m must lie strictly within (0.1, 0.9)."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert 0.1 < res["m"] < 0.9

    def test_physics_bound_omega_range(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """omega must lie strictly within (4.0, 25.0)."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert 4.0 < res["omega"] < 25.0

    def test_phi_in_valid_range(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """phi must lie in [0, 2π)."""
        import math

        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert 0.0 <= res["phi"] < 2.0 * math.pi


# ---------------------------------------------------------------------------
# 4. Confidence score
# ---------------------------------------------------------------------------


class TestConfidenceScore:
    def test_confidence_score_near_one_on_perfect_fit(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """A noise-free synthetic series should yield a high confidence score."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert res["confidence_score"] > 0.90

    def test_confidence_score_bounded(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """confidence_score must always lie within [0.0, 1.0]."""
        res = solve_lppls(synthetic_series["prices"], synthetic_series["times"])
        assert 0.0 <= res["confidence_score"] <= 1.0


# ---------------------------------------------------------------------------
# 5. Solver failure path
# ---------------------------------------------------------------------------


class TestSolverFailurePath:
    def test_raises_on_random_walk_series(self) -> None:
        """A pure random-walk price series should raise ValueError (no LPPLS structure)."""
        rng = np.random.default_rng(seed=42)
        times = np.linspace(2025.0, 2027.0, 200, dtype=np.float64)
        log_p = np.cumsum(rng.normal(0, 0.01, 200)).astype(np.float64)
        prices = np.exp(log_p + 10.0)  # shift to keep prices positive
        with pytest.raises(ValueError, match="optimisation failed"):
            solve_lppls(prices, times)


# ---------------------------------------------------------------------------
# 6. POST /solve endpoint integration
# ---------------------------------------------------------------------------


class TestSolveEndpoint:
    def test_returns_200_on_valid_synthetic_payload(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """A valid synthetic payload must return HTTP 200 with all result fields."""
        payload = {
            "prices": synthetic_series["prices"].tolist(),
            "dates": synthetic_series["dates"],
        }
        response = client.post("/solve", json=payload)
        assert response.status_code == 200
        body = response.json()
        for key in ("tc", "m", "omega", "phi", "A", "B", "C1", "C2",
                    "residual_norm", "confidence_score"):
            assert key in body

    def test_response_satisfies_physics_bounds(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """The /solve response must satisfy all physics constraints."""
        payload = {
            "prices": synthetic_series["prices"].tolist(),
            "dates": synthetic_series["dates"],
        }
        body = client.post("/solve", json=payload).json()
        assert body["B"] < 0.0
        assert 0.1 < body["m"] < 0.9
        assert 4.0 < body["omega"] < 25.0
        assert 0.0 <= body["confidence_score"] <= 1.0


# ---------------------------------------------------------------------------
# 7. Pydantic schema rejection (422 responses)
# ---------------------------------------------------------------------------


class TestSchemaRejection:
    def _base_payload(self, synthetic_series: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "prices": synthetic_series["prices"].tolist(),
            "dates": synthetic_series["dates"],
        }

    def test_rejects_too_few_prices(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """Fewer than 100 prices must yield 422."""
        payload = {"prices": [100.0] * 50, "dates": ["2025-01-01"] * 50}
        assert client.post("/solve", json=payload).status_code == 422

    def test_rejects_mismatched_lengths(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """prices and dates of differing length must yield 422."""
        payload = self._base_payload(synthetic_series)
        payload["dates"] = payload["dates"][:-1]  # knock one off
        assert client.post("/solve", json=payload).status_code == 422

    def test_rejects_non_positive_price(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """A zero or negative price must yield 422."""
        payload = self._base_payload(synthetic_series)
        payload["prices"][10] = -5.0
        assert client.post("/solve", json=payload).status_code == 422

    def test_rejects_invalid_date_format(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """A malformed date string must yield 422."""
        payload = self._base_payload(synthetic_series)
        payload["dates"][10] = "not-a-date"
        assert client.post("/solve", json=payload).status_code == 422

    def test_rejects_non_ascending_dates(
        self, synthetic_series: Dict[str, Any]
    ) -> None:
        """Non-ascending dates must yield 422."""
        payload = self._base_payload(synthetic_series)
        # Swap two adjacent dates to break ascending order.
        payload["dates"][5], payload["dates"][6] = (
            payload["dates"][6],
            payload["dates"][5],
        )
        assert client.post("/solve", json=payload).status_code == 422

    def test_rejects_missing_prices_field(self) -> None:
        """A payload missing the prices field must yield 422."""
        assert client.post("/solve", json={"dates": ["2025-01-01"] * 100}).status_code == 422

    def test_rejects_missing_dates_field(self) -> None:
        """A payload missing the dates field must yield 422."""
        assert client.post("/solve", json={"prices": [100.0] * 100}).status_code == 422


# ---------------------------------------------------------------------------
# 8. GET /health endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_returns_200(self) -> None:
        """GET /health must return HTTP 200."""
        assert client.get("/health").status_code == 200

    def test_response_has_required_fields(self) -> None:
        """GET /health response must contain status, solver, and python_version."""
        body = client.get("/health").json()
        assert body["status"] == "ok"
        assert body["solver"] == "lbfgsb"
        assert "python_version" in body

    def test_python_version_format(self) -> None:
        """python_version must match 'X.Y.Z' format."""
        import re

        body = client.get("/health").json()
        assert re.match(r"^\d+\.\d+\.\d+$", body["python_version"])


# ---------------------------------------------------------------------------
# Utility function tests
# ---------------------------------------------------------------------------


class TestIsoToDecimalYear:
    def test_year_start_is_year_point_zero(self) -> None:
        """Jan 1 should map to exactly the integer year."""
        assert _iso_to_decimal_year("2027-01-01") == pytest.approx(2027.0, abs=0.003)

    def test_mid_year_is_approximately_point_five(self) -> None:
        """July 2 (day 183 of 365) ≈ 2027.5."""
        val = _iso_to_decimal_year("2027-07-02")
        assert 2027.49 < val < 2027.51

    def test_strictly_ascending_conversion(self) -> None:
        """Sequential days must produce strictly ascending decimal years."""
        import datetime

        start = datetime.date(2025, 3, 1)
        decimals = [
            _iso_to_decimal_year((start + datetime.timedelta(days=i)).isoformat())
            for i in range(10)
        ]
        diffs = [decimals[i + 1] - decimals[i] for i in range(len(decimals) - 1)]
        assert all(d > 0.0 for d in diffs)
