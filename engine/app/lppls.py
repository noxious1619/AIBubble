"""
LPPLS (Log-Periodic Power Law Singularity) solver.

Implements the Filimonov & Sornette (2013) closed-form equation using a
linear parameter collapse at each step of the SciPy L-BFGS-B nonlinear
optimization.

Mathematical model:
    ln P(t) = A + B*(tc - t)^m * [1 + C*cos(omega*ln(tc - t) + phi)]

Equivalently (linear decomposition form):
    ln P(t) = A + B*tau^m + C1*tau^m*cos(omega*ln(tau))
                          + C2*tau^m*sin(omega*ln(tau))
    where tau = tc - t, phi = arctan2(C2, C1)

Physics bounds (IMMUTABLE — see AGENTS.md §2.4):
    0.1 < m     < 0.9   — super-exponential acceleration
    4.0 < omega < 25.0  — log-periodic frequency (radians)
    B < 0               — price acceleration toward critical time

Reference:
    Filimonov, V. & Sornette, D. (2013). A stable and robust calibration
    scheme of the log-periodic power law model. Physica A, 392(17), 3698–3707.
    https://doi.org/10.1016/j.physa.2013.04.012
"""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize

# ---------------------------------------------------------------------------
# Immutable LPPLS physics bounds — DO NOT MODIFY without a formal ADR.
# Source: AGENTS.md §2.4
# ---------------------------------------------------------------------------
_M_MIN: float = 0.1
_M_MAX: float = 0.9
_OMEGA_MIN: float = 4.0
_OMEGA_MAX: float = 25.0

# Sentinel value returned by the objective on infeasible / degenerate inputs.
_INFEASIBLE: float = 1e10


def _lppls_objective(
    nonlinear_params: NDArray[np.float64],
    t: NDArray[np.float64],
    log_p: NDArray[np.float64],
) -> float:
    """Penalised SSE objective for the L-BFGS-B optimizer.

    At each optimizer call the three nonlinear parameters (tc, m, omega) are
    fixed and the four linear parameters (A, B, C1, C2) are solved in closed
    form via OLS (Filimonov & Sornette 2013, §2.2).  This collapses a 7D
    search into a 3D one and guarantees a unique global linear solution at
    every nonlinear iterate.

    A large finite penalty (``_INFEASIBLE``) is returned — rather than
    ``np.inf`` or ``NaN`` — on any degenerate configuration so that L-BFGS-B
    can always compute a finite gradient approximation.

    Args:
        nonlinear_params: 1-D array ``[tc, m, omega]`` — the nonlinear
            parameters being optimised.
        t:     1-D array of decimal-year time points (strictly ascending).
        log_p: 1-D array of log-prices ``ln(P(t))``, same length as ``t``.

    Returns:
        Scalar SSE of the best linear fit, or ``_INFEASIBLE`` on failure.
    """
    tc: float = nonlinear_params[0]
    m: float = nonlinear_params[1]
    omega: float = nonlinear_params[2]

    # tc must strictly exceed the last observation time.
    if tc <= t[-1]:
        return _INFEASIBLE

    tau: NDArray[np.float64] = (tc - t).astype(np.float64)

    # Guard against non-positive tau (would make log(tau) undefined).
    if np.any(tau <= 0.0):
        return _INFEASIBLE

    try:
        tau_m: NDArray[np.float64] = np.power(tau, m)
        log_tau: NDArray[np.float64] = np.log(tau)

        # Design matrix — columns: [1, tau^m, tau^m*cos(w*log_tau), tau^m*sin(w*log_tau)]
        X: NDArray[np.float64] = np.column_stack(
            [
                np.ones(len(t), dtype=np.float64),
                tau_m,
                tau_m * np.cos(omega * log_tau),
                tau_m * np.sin(omega * log_tau),
            ]
        )

        # OLS: theta = (X^T X)^{-1} X^T y
        theta: NDArray[np.float64]
        theta, _residuals, _rank, _s = np.linalg.lstsq(X, log_p, rcond=None)
        _A, B, _C1, _C2 = theta

        # Physics invariant: B must be negative.
        if B >= 0.0:
            return _INFEASIBLE

        fit: NDArray[np.float64] = X @ theta
        sse: float = float(np.sum(np.square(log_p - fit)))

        return sse if np.isfinite(sse) else _INFEASIBLE

    except Exception:
        return _INFEASIBLE


def solve_lppls(
    prices: NDArray[np.float64],
    times: NDArray[np.float64],
) -> Dict[str, Any]:
    """Run the LPPLS L-BFGS-B optimisation and return all fitted parameters.

    Uses a multi-start strategy with five equally spaced initial guesses for
    ``omega`` to reduce sensitivity to the starting point.  The best (lowest
    SSE) converged solution is returned.

    Args:
        prices: 1-D array of strictly positive adjusted closing prices
                (length ≥ 100, ≤ 2000).
        times:  1-D array of corresponding decimal-year time points,
                strictly ascending, same length as ``prices``.

    Returns:
        A dictionary with keys:
            ``tc``, ``m``, ``omega``, ``phi``, ``A``, ``B``, ``C1``, ``C2``,
            ``residual_norm``, ``confidence_score``.

    Raises:
        ValueError: If the optimizer fails to find any feasible solution
            across all multi-start attempts (all runs return ``_INFEASIBLE``).
    """
    log_p: NDArray[np.float64] = np.log(prices.astype(np.float64))

    # Baseline SSE used to normalise the confidence score.
    baseline_sse: float = float(np.sum(np.square(log_p - np.mean(log_p))))

    t_start: float = float(times[0])
    t_end: float = float(times[-1])
    t_span: float = t_end - t_start

    # tc search window: (t_end + 1 day) to (t_end + 5 years).
    tc_lo: float = t_end + 1.0 / 365.0
    tc_hi: float = t_end + 5.0
    tc_guess: float = t_end + t_span * 0.1

    bounds = [
        (tc_lo, tc_hi),
        (_M_MIN + 1e-6, _M_MAX - 1e-6),
        (_OMEGA_MIN + 1e-6, _OMEGA_MAX - 1e-6),
    ]

    # Multi-start: vary omega initial guess across its valid range.
    omega_starts = np.linspace(_OMEGA_MIN + 1.0, _OMEGA_MAX - 1.0, 5, dtype=np.float64)

    best_sse: float = _INFEASIBLE
    best_result = None

    for omega_init in omega_starts:
        x0: NDArray[np.float64] = np.array(
            [tc_guess, 0.5, float(omega_init)], dtype=np.float64
        )
        result = minimize(
            _lppls_objective,
            x0,
            args=(times, log_p),
            method="L-BFGS-B",
            bounds=bounds,
            options={"maxiter": 1000, "ftol": 1e-12, "gtol": 1e-8},
        )
        if result.fun < best_sse:
            best_sse = result.fun
            best_result = result

    if best_result is None or best_sse >= _INFEASIBLE:
        raise ValueError(
            "LPPLS optimisation failed to find a feasible solution across all "
            "multi-start attempts. The input series may not exhibit LPPLS structure."
        )

    # Recover linear parameters at the optimal nonlinear point.
    tc: float
    m: float
    omega: float
    tc, m, omega = (float(v) for v in best_result.x)

    tau: NDArray[np.float64] = (tc - times).astype(np.float64)
    tau_m: NDArray[np.float64] = np.power(tau, m)
    log_tau: NDArray[np.float64] = np.log(tau)

    X: NDArray[np.float64] = np.column_stack(
        [
            np.ones(len(times), dtype=np.float64),
            tau_m,
            tau_m * np.cos(omega * log_tau),
            tau_m * np.sin(omega * log_tau),
        ]
    )

    theta: NDArray[np.float64]
    theta, _residuals, _rank, _s = np.linalg.lstsq(X, log_p, rcond=None)
    A: float
    B: float
    C1: float
    C2: float
    A, B, C1, C2 = (float(v) for v in theta)

    # phi ∈ [0, 2π) — phase derived from the linear decomposition.
    phi: float = float(np.arctan2(C2, C1) % (2.0 * np.pi))

    # Confidence score: fraction of variance explained.
    # Clamped to [0, 1] to handle edge cases where best_sse > baseline_sse.
    confidence: float = float(max(0.0, min(1.0, 1.0 - (best_sse / baseline_sse))))

    return {
        "tc": tc,
        "m": m,
        "omega": omega,
        "phi": phi,
        "A": A,
        "B": B,
        "C1": C1,
        "C2": C2,
        "residual_norm": best_sse,
        "confidence_score": confidence,
    }
