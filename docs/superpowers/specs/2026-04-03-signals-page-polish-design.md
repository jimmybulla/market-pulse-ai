# Signals Page Polish Design

**Date:** 2026-04-03
**Status:** Approved

---

## Problem

The signals page uses an expand/collapse pattern (`SignalRow`) that predates the dashboard tracker redesign. The collapsed row is fine, but the expanded state is minimal — just a bulleted drivers list with cyan dots. Users can't see price progress or the full signal context without leaving the page.

---

## Solution

Keep the collapsed row unchanged. Upgrade the expanded panel to two sections: a progress tracker at the top and a structured detail panel below. All data is already in `SignalResponse` — no backend changes required.

---

## Scope

| File | Action |
|---|---|
| `frontend/components/signals/SignalRow.tsx` | Update expanded panel — only file that changes |

No new files. No backend changes.

---

## Expanded Panel Design

### Section 1 — Progress Tracking

A progress bar using the same `calcProgress` logic as `SignalTrackerRow`:
- Bullish: `actualPct / expected_move_high * 100` (capped at 100)
- Crash risk: `Math.abs(actualPct) / 10 * 100` (capped at 100)
- Bearish: `Math.abs(actualPct) / Math.abs(expected_move_low) * 100` (capped at 100)

Below the bar, a row of 3 stats:
- **Actual move** — `last_price` vs `price_at_signal`, formatted as `+2.4%` (green if bullish progress, red if bearish/crash progress)
- **Target range** — `expected_move_low% → expected_move_high%`
- **Time left** — days remaining until horizon expires; shows `Expired` if past horizon

`price_at_signal` and `last_price` are already in `SignalResponse`. If either is null, the progress section is omitted.

### Section 2 — Detail Panel

Each sub-section only renders if its data is present:

- **Key Drivers** — existing `drivers` array, reformatted with a section label and better spacing (no change to data)
- **Explanation** — `explanation` string rendered as a paragraph (if present)
- **Evidence** — from `evidence` field: article count + source credibility score (if present)
- **Historical Analog** — from `historical_analog` field: avg move % and hit rate (if present)
- **Risk Flags** — `risk_flags` array rendered as warning pills (if non-empty)

---

## Progress Calculation

```ts
function calcActualPct(signal: SignalResponse): number | null {
  if (signal.last_price == null || signal.price_at_signal == null) return null
  return ((signal.last_price - signal.price_at_signal) / signal.price_at_signal) * 100
}

function calcProgress(signal: SignalResponse, actualPct: number): number {
  if (signal.direction === 'bullish') {
    return Math.min((actualPct / signal.expected_move_high) * 100, 100)
  }
  if (signal.direction === 'crash_risk') {
    return Math.min((Math.abs(actualPct) / 10) * 100, 100)
  }
  // bearish
  return Math.min((Math.abs(actualPct) / Math.abs(signal.expected_move_low)) * 100, 100)
}

function calcDaysRemaining(signal: SignalResponse): number {
  const ageDays = (Date.now() - new Date(signal.created_at).getTime()) / 86400000
  return Math.round(signal.horizon_days - ageDays)
}
```

---

## Visual Treatment

- Progress bar: `bg-brand-cyan/20` track, `bg-brand-cyan` fill (bullish), `bg-loss` fill (crash/bearish)
- Actual move stat: `text-gain` if positive, `text-loss` if negative
- Section labels: `text-xs text-gray-500 uppercase tracking-wider`
- Risk flag pills: `bg-loss/10 text-loss border border-loss/20 text-xs rounded-full px-2 py-0.5`
- Divider between sections: `border-t border-white/8`

---

## Testing

No new unit tests — component has no logic beyond UI rendering. Existing frontend tests (107/21 suites) must continue to pass.

---

## Constraints

- No new dependencies
- No backend changes
- No new files — `SignalRow.tsx` only
- Progress section gracefully omitted when price data is unavailable
