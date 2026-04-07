# Sector Heatmap — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Problem

The dashboard shows individual stock signals but gives no at-a-glance view of which market sectors are most active. A sector heatmap fills this gap.

## Solution

Add a `GET /analytics/sector-heatmap` backend endpoint that aggregates active signal counts by sector. Add a `SectorHeatmap` frontend component and wire it into the dashboard between "Crash Risk Alerts" and "Breaking News".

---

## Section 1 — Backend endpoint

File: `backend/app/routers/analytics.py`

**Route:** `GET /analytics/sector-heatmap`

**Logic:**
1. Query active (non-expired) signals joined to stocks: `signals.select("direction, stocks(sector)").gte("expires_at", now_iso)`
2. Group by `sector` in Python, counting total signals and per-direction counts (`bullish`, `bearish`, `crash_risk`)
3. Return a list of entries — one per sector that has at least one active signal

**Response shape:**
```json
[
  {"sector": "Technology", "signal_count": 5, "bullish": 3, "bearish": 1, "crash_risk": 1},
  {"sector": "Healthcare", "signal_count": 2, "bullish": 2, "bearish": 0, "crash_risk": 0}
]
```

Sectors with zero active signals are omitted from the response (frontend fills them in as empty cells).

---

## Section 2 — Frontend type + API function

File: `frontend/lib/types.ts`

Add:
```typescript
export interface SectorHeatmapEntry {
  sector: string
  signal_count: number
  bullish: number
  bearish: number
  crash_risk: number
}
```

File: `frontend/lib/api.ts`

Add:
```typescript
export async function getSectorHeatmap(): Promise<SectorHeatmapEntry[]> {
  try {
    const res = await fetch(`${BACKEND}/analytics/sector-heatmap`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
```

---

## Section 3 — SectorHeatmap component

File: `frontend/components/analytics/SectorHeatmap.tsx`

**Props:** `data: SectorHeatmapEntry[]`

**Rendering:**
- Hardcoded list of 11 GICS sectors:
  `["Technology", "Healthcare", "Financials", "Consumer Discretionary", "Industrials", "Communication Services", "Consumer Staples", "Energy", "Utilities", "Real Estate", "Materials"]`
- Responsive grid of sector cells (3–4 columns)
- Each cell shows: sector name + signal count (or "—" if zero)
- Color logic per cell (based on dominant direction):
  - No signals → muted gray (`bg-surface-card`)
  - Mostly bullish (bullish > bearish + crash_risk) → green tint (`bg-profit/10`, border `border-profit/30`)
  - Mostly bearish/crash_risk → red tint (`bg-loss/10`, border `border-loss/30`)
  - Mixed (no dominant direction) → amber tint (`bg-amber-500/10`, border `border-amber-500/30`)
- Intensity: cells with more signals get slightly brighter border (use opacity scale: 1–3 signals = /20, 4–6 = /40, 7+ = /60)

---

## Section 4 — Dashboard wiring

File: `frontend/app/page.tsx`

- Add `getSectorHeatmap()` to the existing `Promise.all`
- Render `<SectorHeatmap data={heatmap} />` in a new `<section>` between "Crash Risk Alerts" and "Breaking News"
- Section header: `BarChart2` icon + "Sector Activity" label (matches existing section header style)

---

## Files Changed

| File | Action |
|------|--------|
| `backend/app/routers/analytics.py` | Add `GET /analytics/sector-heatmap` |
| `backend/tests/test_analytics.py` | Add 3 tests for new endpoint |
| `frontend/lib/types.ts` | Add `SectorHeatmapEntry` interface |
| `frontend/lib/api.ts` | Add `getSectorHeatmap()` |
| `frontend/components/analytics/SectorHeatmap.tsx` | New component |
| `frontend/components/analytics/__tests__/SectorHeatmap.test.tsx` | Component tests |
| `frontend/app/page.tsx` | Wire fetch + render |

No DB migration. No new dependencies.
