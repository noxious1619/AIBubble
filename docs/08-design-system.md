# Design System
### AI Bubble Doomsday Clock

> **Document status**: Approved — Source of Truth
> **Version**: 1.0.0
> **Last updated**: 2026-09-17

---

## 1. Design Philosophy

**"Ominous Precision"** — the interface must communicate two things simultaneously and without contradiction:

1. **Scientific credibility**: The platform is built on peer-reviewed econophysics. Every number is real, every formula is visible. The interface must feel like a research instrument, not a toy.
2. **Viral accessibility**: The core signal ("23 minutes to midnight") must land in under 2 seconds for a retail investor with no quant background. The visual language must be so evocative that it compels sharing.

The resolution of this tension is achieved through **information layering**: the default view is viscerally legible (one clock, one number, one color signal), while the "View the Math" layer satisfies the skeptic with full transparency.

**Mood references**: MIT Media Lab + Bulletin of Atomic Scientists (Doomsday Clock) + Bloomberg Terminal dark mode.

---

## 2. Color System

### 2.1 Base Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-deep` | `#0A0A0F` | Page background |
| `--color-bg-surface` | `#12121A` | Card backgrounds, drawer |
| `--color-bg-elevated` | `#1A1A26` | Hover states, elevated cards |
| `--color-border` | `#2A2A3A` | Subtle borders and dividers |
| `--color-border-bright` | `#404055` | Active borders |

### 2.2 Text Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#E8E8F0` | Primary body text, labels |
| `--color-text-secondary` | `#808095` | Secondary descriptions, metadata |
| `--color-text-muted` | `#404055` | Timestamps, disabled states |
| `--color-text-inverse` | `#0A0A0F` | Text on light backgrounds |

### 2.3 Semantic / Accent Palette

| Token | Hex | Risk Band | Usage |
|-------|-----|-----------|-------|
| `--color-critical` | `#EF3535` | < 15 min | Clock hand, critical alert glow |
| `--color-critical-glow` | `#EF353540` | < 15 min | Radial glow behind clock |
| `--color-warning` | `#F59E0B` | 15–30 min | Clock hand, warning state |
| `--color-warning-glow` | `#F59E0B30` | 15–30 min | Radial glow |
| `--color-elevated` | `#EAB308` | 30–45 min | Clock hand, elevated state |
| `--color-elevated-glow` | `#EAB30825` | 30–45 min | Radial glow |
| `--color-safe` | `#22C55E` | > 45 min | Clock hand, safe state |
| `--color-safe-glow` | `#22C55E20` | > 45 min | Radial glow |
| `--color-accent-cyan` | `#00D4FF` | — | Data highlights, links, HUD elements |
| `--color-accent-cyan-dim` | `#00D4FF20` | — | Hover backgrounds on data rows |
| `--color-amber-data` | `#FFB800` | — | Sub-score values in terminal drawer |

### 2.4 Risk Band Mapping (Programmatic)

```
minutes > 45  → --color-safe      (green)
minutes > 30  → --color-elevated  (yellow)
minutes > 15  → --color-warning   (amber)
minutes ≤ 15  → --color-critical  (red)
```

The CSS custom property `--clock-accent` is set dynamically in the `ClockFace` component based on this mapping and applied to the hand, glow ring, and tick mark highlights.

---

## 3. Typography

### 3.1 Font Families

| Role | Font | Weight | Source |
|------|------|--------|--------|
| Display / Monospace | JetBrains Mono | 400, 600 | Google Fonts |
| Headings | Inter | 700, 800 | Google Fonts |
| Body / UI | Inter | 400, 500 | Google Fonts |

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
```

**JetBrains Mono** is used exclusively for:
- The clock face numerals (12, 3, 6, 9 position labels)
- The "minutes to midnight" hero number
- The terminal drawer — all parameter values, formulae, JSON output
- Timestamps throughout the UI

**Inter** is used for all descriptive text, headers, navigation, and UI controls.

### 3.2 Type Scale (Major Third — 1.25 ratio)

| Step | Token | Size | Line Height | Usage |
|------|-------|------|-------------|-------|
| xs | `--text-xs` | 12px | 1.5 | Timestamps, fine print |
| sm | `--text-sm` | 14px | 1.5 | Secondary labels, metadata |
| base | `--text-base` | 16px | 1.6 | Body text |
| lg | `--text-lg` | 20px | 1.4 | Sub-headings |
| xl | `--text-xl` | 25px | 1.3 | Section headings |
| 2xl | `--text-2xl` | 31px | 1.2 | Page-level headings |
| 3xl | `--text-3xl` | 39px | 1.1 | "Minutes to midnight" label |
| hero | `--text-hero` | 80px | 1.0 | Hero clock minute number (JetBrains Mono 600) |

---

## 4. Spacing System

Base unit: **4px**

| Token | Value | Common usage |
|-------|-------|-------------|
| `--space-1` | 4px | Inline gaps between small elements |
| `--space-2` | 8px | Compact padding (badges, tags) |
| `--space-3` | 12px | Button padding vertical |
| `--space-4` | 16px | Standard component padding |
| `--space-5` | 20px | — |
| `--space-6` | 24px | Card padding |
| `--space-8` | 32px | Section gaps |
| `--space-10` | 40px | Large section padding |
| `--space-12` | 48px | Page-level vertical rhythm |
| `--space-16` | 64px | Between major sections |

### 4.1 Layout Grid

| Property | Value |
|----------|-------|
| Column count | 12 |
| Max content width | 1200px |
| Page horizontal padding | `--space-4` (16px) on mobile; `--space-8` (32px) on desktop |
| Column gap | 24px |

### 4.2 Breakpoints

| Name | Min-width | Target devices |
|------|----------|---------------|
| `xs` | 0px | Mobile phones (< 480px) |
| `sm` | 480px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1440px | Full desktop |

---

## 5. Component Specifications

### 5.1 ClockFace

**Path**: `apps/web/src/components/ClockFace/ClockFace.module.css`

**Visual structure**:
```
┌─────────────────────────────────────────────────┐
│                  [Glow Ring]                    │
│           [Outer Bezel Circle]                  │
│      [60 tick marks — 12 major, 48 minor]       │
│         [12 position label: "XII"]              │
│                    ●                            │  ← center pivot
│                   /                             │  ← animated hand
│          [6 position label: "VI"]               │
│                                                 │
│           "23 min to midnight"                  │  ← hero text (JetBrains Mono)
└─────────────────────────────────────────────────┘
```

**SVG specifications**:
- ViewBox: `0 0 400 400`
- Center: `(200, 200)`
- Outer radius: 180px
- Tick circle radius: 160px
- Major tick length: 20px (every 5 minutes)
- Minor tick length: 10px (every 1 minute)
- Major tick stroke-width: 2px; color: `--color-border-bright`
- Minor tick stroke-width: 1px; color: `--color-border`
- Bezel stroke: 2px; color: `--color-border-bright`; no fill
- Glow ring: filter `drop-shadow(0 0 20px var(--clock-accent))`
- Hour labels (XII, III, VI, IX): JetBrains Mono 400, 14px, `--color-text-secondary`

**Clock hand**:
- Length: 120px from center
- Width: 3px stroke; round linecap
- Color: `var(--clock-accent)` (switches by risk band)
- Pivot dot: 8px radius filled circle, same color
- Transform: `rotate({(minutes / 60) * 360}deg)` anchored at center
- Origin: `transform-origin: center`

**Glow pulse animation**:
```css
@keyframes glowPulse {
  0%, 100% { filter: drop-shadow(0 0 8px var(--clock-accent)); }
  50%       { filter: drop-shadow(0 0 24px var(--clock-accent)); }
}

/* Animation duration inversely proportional to hazard rate */
/* hazard 0.0 → 8s period; hazard 1.0 → 1.5s period */
animation: glowPulse calc(8s - (var(--hazard-rate) * 6.5s)) ease-in-out infinite;
```

**Responsive sizes**:

| Breakpoint | Clock SVG size |
|-----------|---------------|
| xs (< 480px) | 320×320px |
| sm (480px) | 360×360px |
| md (768px) | 400×400px |
| lg+ (1024px) | 480×480px |

---

### 5.2 MathDrawer (Terminal Drawer)

**Path**: `apps/web/src/components/MathDrawer/`

**Layout**:
- Mobile: slides up from bottom, full width, 80vh height, scrollable
- Desktop: slides in from right, 480px wide, full viewport height

**Visual treatment**:
- Background: `--color-bg-surface` (`#12121A`)
- Border: 1px solid `--color-border`
- Font: JetBrains Mono throughout
- CRT scanline effect: `background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)`
- Section dividers: 1px dashed `--color-border`

**Section 1 — LPPLS Parameters**:
```
┌─────────────────────────────────────────────┐
│ LPPLS REGRESSION OUTPUT             [?]    │
│ Run: 2026-09-17 22:01:18 UTC               │
│ Confidence: ████████░░ 93.1%               │
├─────────────────────────────────────────────┤
│ tc       2027.19178  → March 12, 2027      │
│ m        0.4823                             │
│ ω (omega) 9.7341                            │
│ φ (phi)   1.2094                            │
│ A         14,823.4412                       │
│ B        -892.5513   ← must be < 0 ✓       │
│ C₁       -412.3308                          │
│ C₂        201.8820                          │
│ ‖residuals‖  0.00341820                     │
└─────────────────────────────────────────────┘
```

**Section 2 — Stress Index**:
Each sub-score displayed as: label + value bar + score badge + [?] icon for formula tooltip.

**Section 3 — Hazard Computation**:
Step-by-step breakdown displayed as a pipeline:
```
T_prox = 0.4096  →  H_raw = 0.2794  →  H_sigmoid = 0.39  →  23.4 min
```

**Section 4 — Data Freshness**: timestamps and source attribution table.

**Section 5 — Export**:
- "Download JSON" button: outlined style, cyan accent, `--space-4` padding
- On click: constructs Blob from API response + triggers `<a download>` click

---

### 5.3 EventTicker

**Path**: `apps/web/src/components/EventTicker/`

**Layout**:
- Horizontal scrolling strip, full width
- Fixed height: 48px
- Background: `--color-bg-surface`
- Top border: 1px solid `--color-border`
- Overflow: hidden

**Item format**:
```
[2026-09-15 14:30]  Amazon announces $220B 2026 capex  |  Δ −2.3 min  ·  [2026-09-10 09:00]  NVDA beats Q3 EPS by 18%  |  Δ −1.8 min  ·
```

**Animation**:
```css
@keyframes tickerScroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }  /* duplicate content for seamless loop */
}
animation: tickerScroll 60s linear infinite;
animation-play-state: running; /* pauses to 'paused' on hover */
```

**Delta badge colors**:
- Negative delta (clock moved closer to midnight): `--color-critical` text
- Positive delta (clock moved further): `--color-safe` text

---

### 5.4 OG Preview Card

**Canvas dimensions**: 1200 × 630px

**Layout zones**:
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                        ││            │
│   AI BUBBLE DOOMSDAY CLOCK                         [Clock SVG]      │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                    300×300px      │
│   23 minutes to midnight                                             │
│                                                                      │
│   Real-time LPPLS + macro stress                                     │
│   AI market fragility model                                          │
│                                                        ││            │
│ ──────────────────────────────────────────────────────────────────── │
│  aibubbleclock.com                    Not Financial Advice           │
└──────────────────────────────────────────────────────────────────────┘
```

**Text specifications**:
- Title: Inter 800, 52px, `#E8E8F0`
- Hero number + "minutes to midnight": JetBrains Mono 600, 80px, colored by risk band
- Body: Inter 400, 28px, `#808095`
- Footer: Inter 400, 22px, `#404055`
- Watermark: Inter 500, 22px, `--color-accent-cyan`

---

### 5.5 TooltipCard

**Trigger**: hover (desktop) or tap (mobile)
**Max width**: 320px
**Delay**: 200ms (prevents accidental triggers)

**Structure**:
```
┌────────────────────────────────────────┐
│ Forward P/E Score: 83.3 / 100          │
│ ─────────────────────────────────────  │
│ Current basket P/E: 45.2               │
│ Fair value benchmark: 20.0 (S&P LR)    │
│                                        │
│ Formula:                               │
│ min(100, (PE - 20) / (50 - 20) × 100) │
│                                        │
│ [View in math drawer →]                │
└────────────────────────────────────────┘
```

---

## 6. Animation Specifications

All animations respect `prefers-reduced-motion: reduce` — static fallbacks are provided for every animated element.

| Element | Property | Duration | Easing | Notes |
|---------|----------|----------|--------|-------|
| Clock hand | `transform: rotate()` | 1000ms | `ease-in-out` | Triggered on data update |
| Glow pulse | `filter: drop-shadow` | 1500–8000ms | `ease-in-out` | Period = f(hazard rate) |
| Drawer open | `transform: translateY/X` | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Material Design standard |
| Drawer close | `transform: translateY/X` | 250ms | `cubic-bezier(0.4, 0, 0.6, 1)` | Slightly faster close |
| Event ticker | `transform: translateX` | 60s | `linear` | Pauses on hover |
| Page load stagger | `opacity: 0 → 1` | 400ms | `ease-out` | 100ms delay between elements |
| Tooltip appear | `opacity: 0 → 1`, `translateY(-4px → 0)` | 150ms | `ease-out` | |
| Risk band color shift | `color`, `filter` CSS | 600ms | `ease` | Cross-fade between risk colors |

### Reduced Motion Fallbacks

```css
@media (prefers-reduced-motion: reduce) {
  .clock-hand       { transition: none; }
  .glow-ring        { animation: none; }
  .math-drawer      { transition: none; }
  .event-ticker     { animation: none; overflow-x: auto; }
  .stagger-element  { opacity: 1; animation: none; }
}
```

---

## 7. Accessibility

### 7.1 Color Contrast

All text/background combinations meet **WCAG 2.1 Level AA** (minimum 4.5:1 for normal text, 3:1 for large text):

| Foreground | Background | Ratio | Pass |
|-----------|-----------|-------|------|
| `#E8E8F0` on `#0A0A0F` | 17.2:1 | ✅ AAA |
| `#808095` on `#0A0A0F` | 5.1:1 | ✅ AA |
| `#EF3535` on `#0A0A0F` | 4.8:1 | ✅ AA |
| `#00D4FF` on `#12121A` | 8.3:1 | ✅ AAA |
| `#22C55E` on `#0A0A0F` | 6.4:1 | ✅ AAA |

### 7.2 ARIA Requirements

| Component | ARIA specification |
|-----------|-------------------|
| Clock face SVG | `role="img"` + `aria-label="Doomsday Clock showing XX minutes to midnight"` |
| Clock minute value | `aria-live="polite"` region updated on polling |
| Math drawer | `role="dialog"` + `aria-label="Mathematical model details"` + `aria-modal="true"` |
| Drawer trigger | `aria-expanded` state + `aria-controls` pointing to drawer ID |
| Tooltip | `role="tooltip"` + `id` referenced by `aria-describedby` |
| Event ticker | `aria-label="Live events affecting the hazard score"` |

### 7.3 Screen Reader Text Alternatives

```html
<!-- Clock face -->
<svg aria-label="Doomsday Clock: 23 minutes to midnight. Risk level: high stress.">
  <title>AI Bubble Doomsday Clock</title>
</svg>

<!-- Visually hidden text alternative -->
<span class="sr-only">
  Current clock reading: 23 minutes to midnight.
  Predicted crash date: March 12, 2027.
  Stress score: 68 out of 100.
</span>
```

---

## 8. Icon System

**Library**: Lucide React (MIT licensed, consistent stroke-weight design)

| Icon | Usage |
|------|-------|
| `Clock` | Page tab icon, drawer section header |
| `FlaskConical` | "View the Math" button icon |
| `Share2` | Share button |
| `Download` | JSON download button |
| `AlertTriangle` | Stale data warning |
| `ExternalLink` | Source URL links in drawer |
| `ChevronUp/Down` | Drawer toggle affordance |
| `Info` | Tooltip trigger |

All icons rendered at **16px** (inline) or **20px** (button) with `stroke-width: 1.5`.

---

*See also*: [docs/02-features.md](02-features.md) | [docs/03-user-stories.md](03-user-stories.md)
