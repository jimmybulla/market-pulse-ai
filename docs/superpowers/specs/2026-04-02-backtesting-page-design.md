# Backtesting Page Design

**Date:** 2026-04-02  
**Status:** Approved

---

## Problem

The backtesting page crashes with a 500 error because `/analytics/backtesting` uses `.neq("was_correct", "null")` — an invalid PostgREST filter for a boolean column (same bug fixed elsewhere in the codebase). No performance-over-time data is available.

---

## Solution

1. Fix the NULL filter bug in `/analytics/backtesting`.
2. Add a new `/analytics/performance-over-time?period=weekly|monthly` endpoint that returns hit rate and signal count bucketed by resolved week or month.
3. Update `BacktestingDashboard` to show a toggle + Recharts line/bar combo chart above the existing stat tables.

---

## Backend

### Fix: `backend/app/routers/analytics.py` — `/analytics/backtesting`

Line 51: replace `.neq("was_correct", "null")` with `.not_.is_("was_correct", "null")`.

### New: `GET /analytics/performance-over-time?period=weekly|monthly`

- Fetches all resolved `signal_history` rows (`.not_.is_("was_correct", "null")`)
- Groups by `created_at` truncated to ISO week (`YYYY-Www`) or calendar month (`YYYY-MM`) depending on `period` param
- Computes per-bucket: `hit_rate = correct / total`, `total = len(bucket)`
- Returns sorted ascending list (ISO strings sort correctly lexicographically):

```json
[
  { "period": "2026-W11", "hit_rate": 0.6667, "total": 6 },
  { "period": "2026-W12", "hit_rate": 0.75,   "total": 8 }
]
```

- Empty result (no resolved signals): returns `[]`
- Invalid `period` param: 422

Response type: `list[PerformanceBucket]`

```python
class PerformanceBucket(BaseModel):
    period: str
    hit_rate: float
    total: int
```

---

## Frontend

### New type: `PerformanceBucket` in `frontend/lib/types.ts`

```ts
export interface PerformanceBucket {
  period: string
  hit_rate: number
  total: number
}

export interface PerformanceData {
  weekly: PerformanceBucket[]
  monthly: PerformanceBucket[]
}
```

### New API function in `frontend/lib/api.ts`

```ts
export async function getPerformanceOverTime(): Promise<PerformanceData>
```

Calls `/analytics/performance-over-time?period=weekly` and `/analytics/performance-over-time?period=monthly` in parallel, returns `{ weekly, monthly }`.

### Updated `frontend/app/backtesting/page.tsx`

Fetches `getBacktestingStats()` and `getPerformanceOverTime()` in parallel via `Promise.all`. Passes both to `BacktestingDashboard`.

### Updated `frontend/components/analytics/BacktestingDashboard.tsx`

New `performanceData: PerformanceData` prop. Layout:

1. **Chart section** (new, at top):
   - `Weekly` / `Monthly` toggle buttons
   - Recharts `ComposedChart` with:
     - `Bar` for `total` signals (left Y axis, gray fill)
     - `Line` for `hit_rate` (right Y axis, 0–1 domain, brand-cyan stroke)
     - `XAxis` shows `period` strings
     - `Tooltip` shows period, hit rate as %, total signals
   - Empty state: "Not enough data yet — check back after signals have been live for 5+ days"

2. **Existing stat cards** (unchanged)

3. **Existing direction/confidence tables** (unchanged)

---

## Error Handling

- If `/analytics/performance-over-time` fails, the page still loads — `getPerformanceOverTime` catches and returns `{ weekly: [], monthly: [] }`
- If `/analytics/backtesting` still returns a server error, the existing empty state message is shown

---

## Testing

### Backend: `backend/tests/test_analytics.py` (new file)

| Test | Assertion |
|------|-----------|
| Weekly grouping: 2 signals in week A, 1 in week B | Returns 2 buckets, correct hit_rate per bucket |
| Monthly grouping: same data | Returns 1 or 2 buckets depending on months |
| No resolved signals | Returns `[]` |
| Invalid period param | Returns 422 |
| Backtesting endpoint NULL fix | Returns 200 (not 500) with mock data |

### Frontend

No new component tests — `BacktestingDashboard` already has tests; chart rendering is Recharts internals with no logic to unit test. Existing tests must still pass.

---

## Scope

- `backend/app/routers/analytics.py` — fix NULL filter + add new endpoint
- `frontend/lib/types.ts` — add `PerformanceBucket`, `PerformanceData`
- `frontend/lib/api.ts` — add `getPerformanceOverTime()`
- `frontend/app/backtesting/page.tsx` — parallel fetch
- `frontend/components/analytics/BacktestingDashboard.tsx` — chart + toggle
- `backend/tests/test_analytics.py` — new test file
