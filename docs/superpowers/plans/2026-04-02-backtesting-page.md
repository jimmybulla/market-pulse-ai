# Backtesting Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the crashing `/analytics/backtesting` endpoint and add a weekly/monthly hit-rate chart to the backtesting page.

**Architecture:** Fix the PostgREST NULL filter bug in `analytics.py`, add a new `/analytics/performance-over-time?period=weekly|monthly` endpoint, add `PerformanceBucket`/`PerformanceData` types and `getPerformanceOverTime()` to the frontend, then update `BacktestingDashboard` to show a Recharts combo chart (bar for signal count, line for hit rate) with a weekly/monthly toggle.

**Tech Stack:** Python/FastAPI (backend), Next.js App Router + TypeScript + Recharts (frontend), Jest + @testing-library/react (frontend tests), pytest (backend tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `backend/app/routers/analytics.py` | Fix NULL filter; add `/performance-over-time` endpoint |
| Modify | `backend/tests/test_analytics.py` | Tests for NULL fix + new endpoint |
| Modify | `frontend/lib/types.ts` | Add `PerformanceBucket`, `PerformanceData` |
| Modify | `frontend/lib/api.ts` | Add `getPerformanceOverTime()` |
| Modify | `frontend/app/backtesting/page.tsx` | Parallel-fetch stats + performance data |
| Modify | `frontend/components/analytics/BacktestingDashboard.tsx` | Chart + toggle |

---

## Task 1: Fix NULL filter and add `/analytics/performance-over-time`

**Files:**
- Modify: `backend/app/routers/analytics.py`
- Modify: `backend/tests/test_analytics.py`

- [ ] **Step 1.1: Write failing tests**

Append to `backend/tests/test_analytics.py`:

```python
# ── /analytics/backtesting NULL fix ───────────────────────────────────

def test_backtesting_returns_200_not_500(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 0
    assert body["overall_hit_rate"] == 0.0


def test_backtesting_calculates_hit_rate(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"direction": "bullish", "confidence": 0.85, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": 0.05, "was_correct": True},
        {"direction": "bullish", "confidence": 0.75, "expected_move_low": 0.02,
         "expected_move_high": 0.05, "actual_move": -0.01, "was_correct": False},
        {"direction": "bearish", "confidence": 0.65, "expected_move_low": 0.02,
         "expected_move_high": 0.04, "actual_move": -0.03, "was_correct": True},
    ]
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 3
    assert body["overall_hit_rate"] == pytest.approx(2 / 3, abs=1e-4)
    assert "bullish" in body["by_direction"]
    assert body["by_direction"]["bullish"]["hit_rate"] == pytest.approx(0.5, abs=1e-4)


# ── /analytics/performance-over-time ─────────────────────────────────

def test_performance_weekly_groups_by_iso_week(client):
    c, mock_db = client
    mock_exec = MagicMock()
    # Two signals in week 2026-W12, one in 2026-W11
    mock_exec.data = [
        {"was_correct": True,  "created_at": "2026-03-16T10:00:00"},  # W11
        {"was_correct": True,  "created_at": "2026-03-23T10:00:00"},  # W12
        {"was_correct": False, "created_at": "2026-03-24T10:00:00"},  # W12
    ]
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/performance-over-time?period=weekly")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["period"] == "2026-W11"
    assert data[0]["hit_rate"] == 1.0
    assert data[0]["total"] == 1
    assert data[1]["period"] == "2026-W12"
    assert data[1]["hit_rate"] == pytest.approx(0.5, abs=1e-4)
    assert data[1]["total"] == 2


def test_performance_monthly_groups_by_month(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"was_correct": True,  "created_at": "2026-02-15T10:00:00"},  # 2026-02
        {"was_correct": True,  "created_at": "2026-03-10T10:00:00"},  # 2026-03
        {"was_correct": False, "created_at": "2026-03-20T10:00:00"},  # 2026-03
    ]
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/performance-over-time?period=monthly")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["period"] == "2026-02"
    assert data[0]["hit_rate"] == 1.0
    assert data[1]["period"] == "2026-03"
    assert data[1]["hit_rate"] == pytest.approx(0.5, abs=1e-4)


def test_performance_empty_returns_empty_list(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/performance-over-time?period=weekly")
    assert response.status_code == 200
    assert response.json() == []


def test_performance_invalid_period_returns_422(client):
    c, mock_db = client
    response = c.get("/analytics/performance-over-time?period=daily")
    assert response.status_code == 422
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && python -m pytest tests/test_analytics.py::test_backtesting_returns_200_not_500 tests/test_analytics.py::test_performance_weekly_groups_by_iso_week -v 2>&1 | tail -15
```

Expected: both FAIL — `test_backtesting_returns_200_not_500` returns 500, `test_performance_weekly_groups_by_iso_week` gets 404.

- [ ] **Step 1.3: Update `analytics.py`**

Replace the entire contents of `backend/app/routers/analytics.py`:

```python
# backend/app/routers/analytics.py
from collections import defaultdict
from datetime import datetime
from statistics import mean
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from supabase import Client

from app.database import get_db

router = APIRouter()


# ── /accuracy ─────────────────────────────────────────────────────────

@router.get("/accuracy")
def get_accuracy(db: Client = Depends(get_db)):
    result = db.table("signal_history").select("*").execute()
    rows = result.data

    resolved = [r for r in rows if r.get("was_correct") is not None]
    if not resolved:
        return {"total_resolved": 0, "overall_accuracy": None, "by_direction": {}}

    correct = [r for r in resolved if r["was_correct"]]
    overall_accuracy = round(len(correct) / len(resolved), 4)

    by_direction: dict = {}
    for direction in ("bullish", "bearish", "crash_risk"):
        d_rows = [r for r in resolved if r["direction"] == direction]
        if not d_rows:
            continue
        d_correct = [r for r in d_rows if r["was_correct"]]
        moves = [r["actual_move"] for r in d_rows if r.get("actual_move") is not None]
        by_direction[direction] = {
            "count": len(d_rows),
            "hit_rate": round(len(d_correct) / len(d_rows), 6),
            "avg_actual_move": round(sum(moves) / len(moves), 4) if moves else None,
        }

    return {
        "total_resolved": len(resolved),
        "overall_accuracy": overall_accuracy,
        "by_direction": by_direction,
    }


# ── /backtesting ──────────────────────────────────────────────────────

@router.get("/backtesting")
def get_backtesting(db: Client = Depends(get_db)):
    rows = (
        db.table("signal_history")
        .select(
            "direction, confidence, expected_move_low, expected_move_high, "
            "actual_move, was_correct"
        )
        .not_.is_("was_correct", "null")
        .execute()
        .data or []
    )

    if not rows:
        return {
            "total_resolved": 0,
            "overall_hit_rate": 0.0,
            "by_direction": {},
            "by_confidence_tier": {},
            "avg_predicted_move": 0.0,
            "avg_actual_move": 0.0,
        }

    total = len(rows)
    correct_count = sum(1 for r in rows if r["was_correct"])

    by_direction: dict = {}
    for d in ("bullish", "bearish", "crash_risk"):
        d_rows = [r for r in rows if r["direction"] == d]
        if d_rows:
            by_direction[d] = {
                "total": len(d_rows),
                "hit_rate": round(sum(1 for r in d_rows if r["was_correct"]) / len(d_rows), 4),
            }

    def _tier(conf: float) -> str:
        if conf >= 0.8:
            return "high"
        if conf >= 0.6:
            return "medium"
        return "low"

    by_confidence_tier: dict = {}
    for t in ("high", "medium", "low"):
        t_rows = [r for r in rows if _tier(r["confidence"]) == t]
        if t_rows:
            by_confidence_tier[t] = {
                "total": len(t_rows),
                "hit_rate": round(sum(1 for r in t_rows if r["was_correct"]) / len(t_rows), 4),
            }

    avg_predicted = mean(
        (r["expected_move_low"] + r["expected_move_high"]) / 2 for r in rows
    )
    correct_rows = [r for r in rows if r["was_correct"] and r.get("actual_move") is not None]
    avg_actual = mean(abs(r["actual_move"]) for r in correct_rows) if correct_rows else 0.0

    return {
        "total_resolved": total,
        "overall_hit_rate": round(correct_count / total, 4),
        "by_direction": by_direction,
        "by_confidence_tier": by_confidence_tier,
        "avg_predicted_move": round(avg_predicted, 4),
        "avg_actual_move": round(avg_actual, 4),
    }


# ── /performance-over-time ────────────────────────────────────────────

class PerformanceBucket(BaseModel):
    period: str
    hit_rate: float
    total: int


PeriodParam = Literal["weekly", "monthly"]


@router.get("/performance-over-time", response_model=list[PerformanceBucket])
def get_performance_over_time(
    period: PeriodParam = Query(...),
    db: Client = Depends(get_db),
):
    rows = (
        db.table("signal_history")
        .select("was_correct, created_at")
        .not_.is_("was_correct", "null")
        .execute()
        .data or []
    )

    if not rows:
        return []

    buckets: dict[str, list[bool]] = defaultdict(list)
    for row in rows:
        dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
        if period == "weekly":
            key = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
        else:
            key = dt.strftime("%Y-%m")
        buckets[key].append(row["was_correct"])

    return [
        PerformanceBucket(
            period=key,
            hit_rate=round(sum(vals) / len(vals), 4),
            total=len(vals),
        )
        for key, vals in sorted(buckets.items())
    ]
```

- [ ] **Step 1.4: Run all analytics tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && python -m pytest tests/test_analytics.py -v 2>&1 | tail -20
```

Expected: all 8 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add backend/app/routers/analytics.py backend/tests/test_analytics.py && git commit -m "feat: fix backtesting NULL filter and add performance-over-time endpoint"
```

---

## Task 2: Frontend types, API function, and page fetch

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/backtesting/page.tsx`

- [ ] **Step 2.1: Add types to `frontend/lib/types.ts`**

Append to the end of `frontend/lib/types.ts`:

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

- [ ] **Step 2.2: Add `getPerformanceOverTime` to `frontend/lib/api.ts`**

Add this import at the top of `frontend/lib/api.ts` (update the existing import line):

```ts
import type {
  PaginatedSignals, SignalResponse,
  PaginatedStocks, StockWithSignal,
  PaginatedNews, SignalDirection,
  SignalHistoryEntry, BacktestingStats,
  NewsFeedItem, PerformanceData,
} from './types'
```

Append this function at the end of `frontend/lib/api.ts`:

```ts
export async function getPerformanceOverTime(): Promise<PerformanceData> {
  try {
    const [weeklyRes, monthlyRes] = await Promise.all([
      fetch(`${BACKEND}/analytics/performance-over-time?period=weekly`, { next: { revalidate: 300 } }),
      fetch(`${BACKEND}/analytics/performance-over-time?period=monthly`, { next: { revalidate: 300 } }),
    ])
    const weekly = weeklyRes.ok ? await weeklyRes.json() : []
    const monthly = monthlyRes.ok ? await monthlyRes.json() : []
    return { weekly, monthly }
  } catch {
    return { weekly: [], monthly: [] }
  }
}
```

- [ ] **Step 2.3: Update `frontend/app/backtesting/page.tsx`**

Replace the file contents:

```tsx
import { getBacktestingStats, getPerformanceOverTime } from '@/lib/api'
import BacktestingDashboard from '@/components/analytics/BacktestingDashboard'
import TopBar from '@/components/layout/TopBar'

export default async function BacktestingPage() {
  const [stats, performanceData] = await Promise.all([
    getBacktestingStats(),
    getPerformanceOverTime(),
  ])
  return (
    <div>
      <TopBar title="Backtesting" subtitle="Signal accuracy tracking" />
      <div className="p-6">
        <BacktestingDashboard stats={stats} performanceData={performanceData} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2.4: Verify TypeScript compiles**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (BacktestingDashboard will error until Task 3 — that's fine, fix in next step).

- [ ] **Step 2.5: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/lib/types.ts frontend/lib/api.ts "frontend/app/backtesting/page.tsx" && git commit -m "feat: add PerformanceData types, getPerformanceOverTime(), parallel page fetch"
```

---

## Task 3: Update `BacktestingDashboard` with chart + toggle

**Files:**
- Modify: `frontend/components/analytics/BacktestingDashboard.tsx`

- [ ] **Step 3.1: Replace `BacktestingDashboard.tsx`**

Replace the full contents of `frontend/components/analytics/BacktestingDashboard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { BacktestingStats, PerformanceData, PerformanceBucket } from '@/lib/types'

interface Props {
  stats: BacktestingStats
  performanceData: PerformanceData
}

function PerformanceChart({ data }: { data: PerformanceBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-600">
        Not enough data yet — check back after signals have been live for 5+ days
      </div>
    )
  }

  const chartData = data.map((d) => ({
    period: d.period,
    'Hit Rate': Math.round(d.hit_rate * 100),
    Signals: d.total,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="period"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit=""
          domain={[0, 'auto']}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb', marginBottom: 4 }}
          itemStyle={{ color: '#9ca3af' }}
          formatter={(value: number, name: string) =>
            name === 'Hit Rate' ? [`${value}%`, name] : [value, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
        <Bar yAxisId="left" dataKey="Signals" fill="rgba(255,255,255,0.08)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="Hit Rate"
          stroke="#00B4FF"
          strokeWidth={2}
          dot={{ fill: '#00B4FF', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function BacktestingDashboard({ stats, performanceData }: Props) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')

  if (stats.total_resolved === 0 && performanceData.weekly.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-600">
        No resolved signals yet — check back after signals have been live for 5+ days
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Performance chart */}
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Hit Rate Over Time</h2>
          <div className="flex gap-1">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-brand-cyan/10 text-brand-cyan'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <PerformanceChart data={performanceData[period]} />
        </div>
      </div>

      {/* Stat cards */}
      {stats.total_resolved > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-xl border border-white/8 p-5">
              <p className="text-xs text-gray-500 mb-1">Overall Hit Rate</p>
              <p className="text-3xl font-mono font-bold text-white">
                {(stats.overall_hit_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-surface-card rounded-xl border border-white/8 p-5">
              <p className="text-xs text-gray-500 mb-1">Total Resolved</p>
              <p className="text-3xl font-mono font-bold text-white">{stats.total_resolved}</p>
            </div>
            <div className="bg-surface-card rounded-xl border border-white/8 p-5">
              <p className="text-xs text-gray-500 mb-1">Avg Actual Move (correct)</p>
              <p className="text-3xl font-mono font-bold text-profit">
                +{(stats.avg_actual_move * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* By Direction */}
          <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8">
              <h2 className="text-sm font-semibold text-gray-300">By Direction</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Direction</th>
                  <th className="text-right px-5 py-3 font-medium">Signals</th>
                  <th className="text-right px-5 py-3 font-medium">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.by_direction).map(([dir, data]) => (
                  <tr key={dir} className="border-b border-white/4 last:border-0">
                    <td className="px-5 py-3 text-gray-300">{dir.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-400">{data.total}</td>
                    <td className="px-5 py-3 text-right font-mono text-white">
                      {(data.hit_rate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Confidence Tier */}
          <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8">
              <h2 className="text-sm font-semibold text-gray-300">By Confidence Tier</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Tier</th>
                  <th className="text-right px-5 py-3 font-medium">Signals</th>
                  <th className="text-right px-5 py-3 font-medium">Hit Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.by_confidence_tier).map(([tier, data]) => (
                  <tr key={tier} className="border-b border-white/4 last:border-0">
                    <td className="px-5 py-3 text-gray-300 capitalize">
                      {tier}{' '}
                      <span className="text-gray-600 text-xs">
                        {tier === 'high' ? '(≥80%)' : tier === 'medium' ? '(60–80%)' : '(<60%)'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-400">{data.total}</td>
                    <td className="px-5 py-3 text-right font-mono text-white">
                      {(data.hit_rate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3.2: Run existing frontend tests to check for regressions**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx jest components/analytics --no-coverage 2>&1 | tail -20
```

The existing `BacktestingDashboard.test.tsx` tests will fail because they don't pass `performanceData`. Fix them by updating the test file — add `performanceData` to every `render()` call:

Find the import line at the top of `frontend/components/analytics/__tests__/BacktestingDashboard.test.tsx`:

```tsx
import type { BacktestingStats } from '@/lib/types'
```

Replace with:
```tsx
import type { BacktestingStats, PerformanceData } from '@/lib/types'
```

Add this constant below `richStats`:
```tsx
const emptyPerf: PerformanceData = { weekly: [], monthly: [] }
```

Then update every `render(<BacktestingDashboard stats={...} />)` call to include `performanceData={emptyPerf}`:

```tsx
// Before:
render(<BacktestingDashboard stats={emptyStats} />)
// After:
render(<BacktestingDashboard stats={emptyStats} performanceData={emptyPerf} />)
```

Apply this to all 5 render calls in the test file.

- [ ] **Step 3.3: Run tests again**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx jest components/analytics --no-coverage 2>&1 | tail -20
```

Expected: all 5 existing tests PASS. Note: the empty-state test (`renders empty state when total_resolved is 0`) will now only show empty state when BOTH `total_resolved === 0` AND `performanceData.weekly.length === 0` — this is correct per the design.

- [ ] **Step 3.4: Verify TypeScript**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3.5: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add "frontend/components/analytics/BacktestingDashboard.tsx" "frontend/components/analytics/__tests__/BacktestingDashboard.test.tsx" && git commit -m "feat: add weekly/monthly hit rate chart to BacktestingDashboard"
```
