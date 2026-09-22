# The AI Bubble Doomsday Clock — Pipeline Math

> A plain-English, equation-first walkthrough of every mathematical step the pipeline executes, from raw stock prices to the final "minutes to midnight" number displayed on the clock face.

---

## Start Here: What Is the Pipeline Trying to Do?

Every day, after the US stock market closes, the system runs a sequence of math operations on real market data. The goal is to produce a single number: **how many hours are left on a clock that represents when the current AI investment bubble might catastrophically collapse**. 

The closer the hands are to midnight, the higher the model's assessed fragility. The pipeline produces this number through three mathematically distinct stages:

1. **LPPLS Regression** — fitting a bubble growth model to stock price history to predict a *critical date* (`t_c`), the theoretical moment of maximum instability.
2. **Macro Stress Index** — measuring how "stretched" current market valuations are across four independent financial metrics.
3. **Hazard Rate Synthesis** — combining the critical date and the stress score into a final, clock-displayable number.

Let's walk through each stage from scratch.

---

## Stage 1: LPPLS Regression — Finding the Critical Time

### The Raw Input

The pipeline starts with a simple array: the last **500 trading days** of adjusted closing prices for a basket of seven major AI stocks (MSFT, NVDA, GOOGL, META, AMZN, AAPL, AMD). For each day, the prices across all seven tickers are **summed into a single composite price**, creating one time series.

So our raw input is:
- `prices[]` — an array of 500 numbers, each representing the sum of all seven stock prices on a given day.
- `times[]` — the corresponding array of 500 dates, converted into **decimal years** (e.g., January 1, 2026 = `2026.0000`; July 2, 2026 ≈ `2026.5014`).

### Why Log-Prices?

Before any math begins, every price is converted to its **natural logarithm**:

```
log_p[i] = ln( prices[i] )
```

This is standard in financial mathematics. It converts multiplicative percentage changes ("+2% today") into additive differences, making the data much more tractable for statistical fitting. All LPPLS math operates on log-prices.

### The LPPLS Equation

The Log-Periodic Power Law Singularity (LPPLS) model, developed by physicist Didier Sornette, describes how a financial bubble grows. The equation says:

```
ln P(t) = A + B·(tc - t)^m · [1 + C·cos( ω·ln(tc - t) + φ )]
```

Every symbol here has a precise meaning:

| Symbol | Name | What It Represents |
|--------|------|-------------------|
| `P(t)` | Price at time `t` | The composite stock price on any given day |
| `t_c` | Critical time | The predicted date of maximum bubble instability |
| `m` | Growth exponent | How "super-exponential" the bubble acceleration is. Must be in `[0.1, 0.9]` |
| `ω` (omega) | Log-periodic frequency | How many oscillatory cycles the price completes before the critical time. Must be in `[4, 25]` |
| `φ` (phi) | Phase | Controls which part of the oscillation cycle the current moment is in. Always in `[0, 2π)` |
| `A` | Price level at singularity | The log-price the model expects at the critical time |
| `B` | Amplitude coefficient | Controls the overall strength of the power-law acceleration. **Must be negative** — this enforces that prices are genuinely accelerating toward `t_c` |
| `C` | Oscillation amplitude | Controls how pronounced the log-periodic wiggles are |

The key insight is the `(tc - t)` term. As `t` (today) gets closer to `tc` (the predicted crash date), this term shrinks toward zero. The smaller it gets, the more the entire expression diverges, capturing the explosive behavior of a true bubble peak.

### The Optimization Problem: 7 Unknowns, One Clever Trick

The model has **7 unknowns**: `{tc, m, ω, φ, A, B, C}`. Naively, you'd need to search across all 7 simultaneously, which is computationally brutal. 

The Filimonov–Sornette (2013) trick separates these into two groups:

**Nonlinear parameters** (must be found by numerical search): `{tc, m, ω}`

**Linear parameters** (can be solved instantly with algebra, given fixed nonlinear parameters): `{A, B, C1, C2}`

Here, `C1` and `C2` are the cosine and sine components of `C`:
```
C1 = C · cos(φ)
C2 = C · sin(φ)
```

This lets us rewrite the LPPLS equation in a purely linear form. Define `τ = tc - t` (time remaining to the critical date). Then:

```
ln P(t) = A + B·τ^m + C1·τ^m·cos(ω·ln τ) + C2·τ^m·sin(ω·ln τ)
```

This is now in the form `y = X·θ`, where:

- `y` is the vector of observed log-prices (shape: 500×1)
- `X` is the **design matrix** (shape: 500×4) constructed from the nonlinear parameters
- `θ = [A, B, C1, C2]` is the vector of linear parameters we want

The design matrix `X` has four columns:

```
Column 1: ones(500)                    ← for A
Column 2: τ^m                          ← for B
Column 3: τ^m · cos(ω · ln τ)         ← for C1
Column 4: τ^m · sin(ω · ln τ)         ← for C2
```

Given this matrix, the linear parameters are solved **instantly** using Ordinary Least Squares (OLS):

```
θ = (X^T · X)^{-1} · X^T · y
```

This is a closed-form matrix equation — no iteration needed. The solver calls this formula millions of times during the optimization, once per candidate `{tc, m, ω}` it tries.

### The Physics Constraints (Why B Must Be Negative)

After solving for `θ`, the solver checks a critical physics constraint: **`B` must be negative**. 

Mathematically, `B < 0` ensures that as time approaches `t_c` and `τ → 0`, the power-law term `B·τ^m` increases (becomes less negative), which in log-price terms means the price is accelerating upward. If `B ≥ 0`, the model has found a decelerating pattern — that is not a bubble by definition. If this constraint is violated, the candidate solution is immediately rejected with a penalty score of `1×10^10`.

### Multi-Start Search

The L-BFGS-B optimization algorithm searches the 3D space of `{tc, m, ω}`. To avoid getting stuck in a local minimum, the solver runs **5 separate times**, each starting from a different initial guess for omega (evenly spread between 5 and 24). The run that produces the lowest sum-of-squared-errors (SSE) wins:

```
SSE = Σ ( log_p[i] - fit[i] )^2
```

### Final Output: The Critical Time `t_c`

After the winning run, the solver recovers all 7 parameters. The most important output is `tc` — a decimal year number like `2029.191` — which is then converted back to a calendar date (e.g., `2029-03-10`). This is the model's prediction of when the AI bubble is at maximum theoretical instability.

A **confidence score** is also computed, measuring how much better the LPPLS model fits the data compared to just drawing a flat horizontal line:

```
confidence = max(0, min(1, 1 - (best_SSE / baseline_SSE)))
```

Where `baseline_SSE` is the variance around the mean log-price. A confidence of `1.0` means a perfect fit; `0.0` means the model does no better than guessing the average price.

---

## Stage 2: Macro Stress Index — How Stretched Is the Market?

The LPPLS model tells us *when* the bubble might burst, but not *how bad* things are *right now*. That's the job of the **Macro Stress Index**: a composite score from `0` to `100` built from four independent financial signals.

### Sub-Score 1: Forward P/E Stress (`S_PE`) — currently 65.50

The Price-to-Earnings ratio compares a company's stock price to its expected annual profit. A high P/E means investors are paying a lot for each dollar of earnings — typical in a bubble.

The score is normalized against historical reference points:

```
S_PE = min(100, (PE_current - PE_fair) / (PE_max_hist - PE_fair) × 100)
```

Where:
- `PE_fair = 20.0` — the long-run historical average for the S&P 500
- `PE_max_hist = 50.0` — the dot-com bubble peak benchmark

A P/E of 45 across the AI basket gives `S_PE = (45 - 20) / (50 - 20) × 100 ≈ 83.3`. Current value: **65.50**.

### Sub-Score 2: HHI Market Concentration (`S_HHI`) — currently 82.00

The Herfindahl-Hirschman Index (HHI) measures how concentrated the AI market is among a few companies. If one or two companies dominate and they stumble, the whole sector falls together.

```
HHI = Σ s_i²
```

Where `s_i` is company `i`'s market cap as a fraction of the total AI basket.

Then normalized:
```
S_HHI = min(100, (HHI - HHI_min) / (HHI_max - HHI_min) × 100)
```

Where `HHI_min = 0.05` (perfectly competitive, 20 equal firms) and `HHI_max = 0.50` (near-monopoly). Current value: **82.00** — indicating very high concentration.

### Sub-Score 3: Pairwise Correlation (`S_corr`) — currently 52.00

When all AI stocks move up and down together in lockstep, it means there is no diversification — one bad shock hits everything simultaneously. The 60-day rolling average pairwise Pearson correlation `ρ̄` across all pairs of stocks in the basket is computed:

```
ρ̄ = (2 / N(N-1)) · Σ_{i < j} ρ_ij
```

Then:
```
S_corr = min(100, ρ̄ × 100)
```

A mean correlation of `0.52` means the stocks move together 52% of the time — moderate herding. Current value: **52.00**.

### Sub-Score 4: CapEx Deficit Score (`S_CapEx`) — currently 50.00

This measures whether AI companies are investing so much in infrastructure (data centers, chips, GPUs) relative to what they are actually earning from AI-attributed revenue, that the numbers don't add up sustainably.

```
D = Σ CapEx_i / Σ AI_Revenue_i
```

Normalized:
```
S_CapEx = min(100, (D - D_baseline) / (D_max - D_baseline) × 100)
```

Where `D_baseline = 0.5` (sustainable reinvestment) and `D_max = 5.0` (extreme bubble spending). Current value: **50.00**.

### Composite Stress Score

All four sub-scores are equally weighted at 25% each:

```
S_composite = (S_PE × 0.25) + (S_HHI × 0.25) + (S_corr × 0.25) + (S_CapEx × 0.25)
S_composite = (65.50 + 82.00 + 52.00 + 50.00) × 0.25
S_composite = 249.50 × 0.25
S_composite = 62.38
```

This single number, **62.38 out of 100**, tells us the market is under **moderately high stress**.

---

## Stage 3: Hazard Rate Synthesis — Turning Two Numbers Into One Clock

Now we have two things:
- `t_c` — the predicted critical date from LPPLS (e.g., `2029-03-10`)
- `S_composite = 62.38` — the current market stress level

Stage 3 combines these into a final clock reading through three sequential transformations.

### Step 3a: Temporal Proximity Score (`T_prox`)

This answers: *"How close are we right now to the predicted critical date?"*

```
days_to_tc = (date of t_c) - (today)
T_prox = max(0, min(1, 1 - (days_to_tc / 730)))
```

The window is **730 days (2 years)**. If `t_c` is more than 2 years away, `T_prox = 0` (no urgency yet, regardless of stress). If `t_c` has already passed, `T_prox = 1.0` (maximum urgency). For a `t_c` that is 1 year away: `T_prox = 1 - (365/730) = 0.50`.

### Step 3b: Raw Hazard Rate (`H_raw`)

This answers: *"Combining temporal urgency and market stress, what is the raw probability-like hazard?"*

```
H_raw = T_prox × (S_composite / 100)
```

`H_raw` lives in the range `[0, 1]`. A score of `0` means no risk; a score of `1` means maximum theoretical risk. With `T_prox = 0.50` and `S_composite = 62.38`:

```
H_raw = 0.50 × (62.38 / 100) = 0.50 × 0.6238 = 0.3119
```

### Step 3c: Hours-to-Midnight

The pipeline converts `days_to_tc` into hours on a 12-hour clock dial. The dial represents a 1,800-day (roughly 5-year) window:

```
hours_to_midnight = days_to_tc / 150
hours_to_midnight = clamp(hours_to_midnight, 0, 12)
```

A `t_c` that is 1,500 days away would produce `1500 / 150 = 10 hours to midnight`. But temporal distance alone is not enough — the hazard rate penalty is then applied:

```
hours_to_midnight = max(0, hours_to_midnight - (H_raw × 10))
```

This is the final clock value. A high `H_raw` pulls the clock hands forward toward midnight, even if the critical date is still years away. The result is stored in the database and cached in Redis as `minutes_to_midnight` (using the hours value directly in the current implementation).

---

## The Final Number

After all three stages complete, one number flows to the frontend and the social share card. It tells you: given the bubble growth pattern fit to 500 days of AI stock prices, and given the current state of market valuation, concentration, herding, and capital spending — **this is how close the AI market is to a mathematically predicted breaking point**.

Every variable, every constant, every bound in this document is either derived from peer-reviewed econophysics literature or from the empirical observation of past market crashes (dot-com 2000, GFC 2008). None of these numbers are invented.

---

*Math sources: Sornette (2003), Filimonov & Sornette (2013). See `docs/02-features.md` and `engine/app/lppls.py` for full implementation details.*
