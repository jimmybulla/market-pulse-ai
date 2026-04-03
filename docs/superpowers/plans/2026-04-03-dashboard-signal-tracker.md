# Dashboard Signal Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's card grid with a ranked tracker table showing each signal's actual price movement vs its prediction target, with a progress bar and days remaining.

**Architecture:** The `signals` table already stores `price_at_signal` (set on first insert) and the API already returns `last_price` via the stocks join — both fields just need exposing in the `SignalResponse` model. A new `SignalTrackerRow` client component renders each signal as a full-width row with a colored progress bar. The dashboard page is restructured to two stacked sections (Opportunities → Crash Risks) plus news feed below.

**Tech Stack:** FastAPI/Pydantic (backend model change), Next.js Server Component (page), React Client Component (SignalTrackerRow), Tailwind CSS, Jest/RTL (frontend tests).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/app/models/signal.py` | Add `price_at_signal` to `SignalResponse` |
| Modify | `backend/tests/test_signals.py` | Add `price_at_signal` to mock + new test |
| Modify | `frontend/lib/types.ts` | Add `price_at_signal` to `SignalResponse` |
| Create | `frontend/components/signals/SignalTrackerRow.tsx` | Full-width signal row with progress bar |
| Create | `frontend/components/signals/__tests__/SignalTrackerRow.test.tsx` | Tests for SignalTrackerRow |
| Modify | `frontend/app/page.tsx` | Restructure dashboard to two stacked sections |

---

## Task 1: Expose `price_at_signal` in the backend signal API

**Files:**
- Modify: `backend/app/models/signal.py`
- Modify: `backend/tests/test_signals.py`

**Context:** The `signals` table has a `price_at_signal` column (set in `generate_signals` when a signal is first inserted). The router does `select("*", ...)` so the value already comes back from Supabase — it just gets dropped by the Pydantic model because the field isn't declared. Adding it to `SignalResponse` is the only change needed. No router changes required.

- [ ] **Step 1.1: Write a failing test**

Read `backend/tests/test_signals.py` first. Then add this test at the bottom:

```python
def test_list_signals_includes_price_at_signal(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW)
    row["price_at_signal"] = 875.50
    mock_exec = MagicMock()
    mock_exec.data = [row]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    item = response.json()["data"][0]
    assert item["price_at_signal"] == 875.50
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && SUPABASE_URL=http://localhost SUPABASE_KEY=test /Users/chidoziejim/Library/Python/3.9/bin/pytest tests/test_signals.py::test_list_signals_includes_price_at_signal -v
```

Expected: `FAILED` — `price_at_signal` not in response (field not in model).

- [ ] **Step 1.3: Add `price_at_signal` to `SignalResponse`**

Read `backend/app/models/signal.py` first. Add `price_at_signal` after `last_price`:

```python
class SignalResponse(BaseModel):
    id: str
    ticker: str
    stock_name: str
    sector: Optional[str] = None
    last_price: Optional[float] = None
    price_at_signal: Optional[float] = None
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    horizon_days: int
    opportunity_score: float
    crash_risk_score: float
    rank: int
    explanation: Optional[str] = None
    drivers: list[str] = []
    evidence: Optional[dict[str, Any]] = None
    historical_analog: Optional[dict[str, Any]] = None
    risk_flags: list[str] = []
    created_at: datetime
    expires_at: Optional[datetime] = None
```

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && SUPABASE_URL=http://localhost SUPABASE_KEY=test /Users/chidoziejim/Library/Python/3.9/bin/pytest tests/test_signals.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 1.5: Run full backend suite to confirm no regressions**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && SUPABASE_URL=http://localhost SUPABASE_KEY=test /Users/chidoziejim/Library/Python/3.9/bin/pytest --tb=short -q
```

Expected: 126 passed.

- [ ] **Step 1.6: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add backend/app/models/signal.py backend/tests/test_signals.py && git commit -m "feat: expose price_at_signal in SignalResponse"
```

---

## Task 2: SignalTrackerRow frontend component

**Files:**
- Modify: `frontend/lib/types.ts`
- Create: `frontend/components/signals/SignalTrackerRow.tsx`
- Create: `frontend/components/signals/__tests__/SignalTrackerRow.test.tsx`

**Context:** `SignalTrackerRow` is a `'use client'` component (needs `Date.now()` for days-remaining calculation). It receives a `SignalResponse` and renders one full-width row. The existing `SignalCard` is unchanged — it's still used on the signals page.

Read `frontend/AGENTS.md` before writing any Next.js/React code.

- [ ] **Step 2.1: Add `price_at_signal` to `SignalResponse` type in `types.ts`**

Read `frontend/lib/types.ts` first. Add `price_at_signal` after `last_price`:

```ts
export interface SignalResponse {
  id: string
  stock_id: string
  ticker: string
  stock_name: string
  sector: string | null
  last_price: number | null
  price_at_signal: number | null
  direction: SignalDirection
  confidence: number
  expected_move_low: number
  expected_move_high: number
  horizon_days: number
  opportunity_score: number
  crash_risk_score: number
  rank: number
  explanation: string | null
  drivers: string[]
  evidence: SignalEvidence
  historical_analog: SignalHistoricalAnalog
  risk_flags: string[]
  created_at: string
  expires_at: string | null
}
```

- [ ] **Step 2.2: Write failing tests**

Create `frontend/components/signals/__tests__/SignalTrackerRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import SignalTrackerRow from '../SignalTrackerRow'
import type { SignalResponse } from '@/lib/types'

const BASE: SignalResponse = {
  id: '1',
  stock_id: 'abc',
  ticker: 'AAPL',
  stock_name: 'Apple Inc.',
  sector: 'Technology',
  last_price: 205.25,
  price_at_signal: 200.00,
  direction: 'bullish',
  confidence: 0.72,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  opportunity_score: 0.72,
  crash_risk_score: 0.05,
  rank: 1,
  explanation: null,
  drivers: [],
  evidence: { sources: [], article_ids: [], article_count: 0, avg_credibility: 0 },
  historical_analog: { avg_move: 0.05, hit_rate: 0.64, sample_size: 15 },
  risk_flags: [],
  // 2 days ago → 3d left with horizon_days=5
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  expires_at: null,
}

const CRASH: SignalResponse = {
  ...BASE,
  id: '2',
  ticker: 'TSLA',
  stock_name: 'Tesla Inc.',
  direction: 'crash_risk',
  last_price: 194.00,
  price_at_signal: 200.00,
  rank: 1,
  confidence: 0.81,
}

const EXPIRED: SignalResponse = {
  ...BASE,
  id: '3',
  created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
}

const NO_PRICE: SignalResponse = {
  ...BASE,
  id: '4',
  last_price: null,
  price_at_signal: null,
}

describe('SignalTrackerRow', () => {
  it('renders rank, ticker and company name', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
  })

  it('links to stock detail page', () => {
    render(<SignalTrackerRow signal={BASE} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/stock/AAPL')
  })

  it('renders bullish direction badge', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('↑ Bullish')).toBeInTheDocument()
  })

  it('renders crash risk direction badge', () => {
    render(<SignalTrackerRow signal={CRASH} />)
    expect(screen.getByText('⚠ Crash Risk')).toBeInTheDocument()
  })

  it('renders confidence percentage', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('shows days remaining when within horizon', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('3d left')).toBeInTheDocument()
  })

  it('shows Expired when past horizon', () => {
    render(<SignalTrackerRow signal={EXPIRED} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('shows actual move and target range when price data available', () => {
    render(<SignalTrackerRow signal={BASE} />)
    // last_price=205.25, price_at_signal=200 → +2.6%
    expect(screen.getByText(/\+2\.\d%/)).toBeInTheDocument()
    // target range
    expect(screen.getByText('+3.0–7.0%')).toBeInTheDocument()
  })

  it('shows em-dash when no price data', () => {
    render(<SignalTrackerRow signal={NO_PRICE} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a progress bar element', () => {
    render(<SignalTrackerRow signal={BASE} />)
    // The progress track div has a test id
    expect(screen.getByTestId('signal-progress-track')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2.3: Run tests to confirm they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --testPathPattern="signals/__tests__/SignalTrackerRow" --watchAll=false 2>&1 | tail -10
```

Expected: `Cannot find module '../SignalTrackerRow'`

- [ ] **Step 2.4: Create `SignalTrackerRow.tsx`**

Create `frontend/components/signals/SignalTrackerRow.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return '↑ Bullish'
  if (direction === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function directionBadgeClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

function daysRemaining(createdAt: string, horizonDays: number): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.round(horizonDays - ageDays)
}

interface Progress {
  pct: number
  barClass: string
  actualPct: number | null
}

function calcProgress(signal: SignalResponse): Progress {
  const { last_price, price_at_signal, direction, expected_move_high } = signal
  if (!last_price || !price_at_signal) {
    return { pct: 0, barClass: 'bg-surface-elevated', actualPct: null }
  }

  const actualPct = ((last_price - price_at_signal) / price_at_signal) * 100

  if (direction === 'bullish' || direction === 'bearish') {
    const targetPct = expected_move_high * 100
    const pct = Math.min(100, Math.max(0, (actualPct / targetPct) * 100))
    const barClass = actualPct >= 0 ? 'bg-profit' : 'bg-loss'
    return { pct, barClass, actualPct }
  }

  // crash_risk: track downward move, 10% drop = 100%
  const pct = Math.min(100, Math.max(0, (Math.abs(actualPct) / 10) * 100))
  const barClass = actualPct <= 0 ? 'bg-loss' : 'bg-profit'
  return { pct, barClass, actualPct }
}

interface Props {
  signal: SignalResponse
}

export default function SignalTrackerRow({ signal }: Props) {
  const {
    ticker, stock_name, direction, confidence,
    expected_move_low, expected_move_high, horizon_days,
    rank, created_at,
  } = signal

  const progress = calcProgress(signal)
  const daysLeft = daysRemaining(created_at, horizon_days)
  const expired = daysLeft <= 0

  return (
    <Link href={`/stock/${ticker}`} className="block group">
      <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] items-center gap-3 lg:gap-4 px-4 py-3 rounded-lg hover:bg-surface-elevated transition-colors">

        {/* Rank */}
        <span className="text-xs text-gray-600 font-mono text-right">#{rank}</span>

        {/* Ticker + name */}
        <div className="min-w-0">
          <p className="font-mono font-bold text-sm text-white leading-tight">{ticker}</p>
          <p className="text-xs text-gray-500 truncate">{stock_name}</p>
        </div>

        {/* Direction badge */}
        <Badge className={`text-xs shrink-0 ${directionBadgeClass(direction)}`}>
          {directionLabel(direction)}
        </Badge>

        {/* Progress bar + labels */}
        <div className="flex flex-col gap-1 min-w-0">
          <div
            className="w-full bg-surface-elevated rounded-full h-1.5"
            data-testid="signal-progress-track"
          >
            <div
              className={`h-1.5 rounded-full transition-all ${progress.barClass}`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
            {progress.actualPct !== null ? (
              <>
                <span className={progress.actualPct >= 0 ? 'text-profit' : 'text-loss'}>
                  {progress.actualPct >= 0 ? '+' : ''}{progress.actualPct.toFixed(1)}%
                </span>
                {direction !== 'crash_risk' && (
                  <>
                    <span className="text-gray-700">→</span>
                    <span className="text-gray-500">
                      +{(expected_move_low * 100).toFixed(1)}–{(expected_move_high * 100).toFixed(1)}%
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-gray-700">—</span>
            )}
          </div>
        </div>

        {/* Confidence */}
        <span className="text-xs font-mono text-gray-300 text-right">{Math.round(confidence * 100)}%</span>

        {/* Time remaining */}
        <span className={`text-xs text-right shrink-0 ${expired ? 'text-gray-600' : 'text-gray-400'}`}>
          {expired ? 'Expired' : `${daysLeft}d left`}
        </span>

      </div>
    </Link>
  )
}
```

- [ ] **Step 2.5: Run tests to confirm they pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --testPathPattern="signals/__tests__/SignalTrackerRow" --watchAll=false 2>&1 | tail -15
```

Expected: `10 passed`

- [ ] **Step 2.6: Run full frontend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -10
```

Expected: all tests pass (107 total — 97 existing + 10 new).

- [ ] **Step 2.7: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/lib/types.ts frontend/components/signals/SignalTrackerRow.tsx frontend/components/signals/__tests__/SignalTrackerRow.test.tsx && git commit -m "feat: add SignalTrackerRow with progress tracking"
```

---

## Task 3: Restructure dashboard page

**Files:**
- Modify: `frontend/app/page.tsx`

**Context:** Read `frontend/AGENTS.md` before writing Next.js code. The page is a Server Component — no `'use client'`. `SignalTrackerRow` is a Client Component and can be imported directly. The `SignalCard` import is removed from this page (but keep the file — it's used on the signals page). The Quick Stats section is removed; totals are visible from the section headers.

- [ ] **Step 3.1: Rewrite `frontend/app/page.tsx`**

Read the current `frontend/app/page.tsx` first. Then replace it entirely with:

```tsx
// frontend/app/page.tsx
import { getSignals, getNewsFeed } from '@/lib/api'
import SignalTrackerRow from '@/components/signals/SignalTrackerRow'
import NewsFeed from '@/components/news/NewsFeed'
import TopBar from '@/components/layout/TopBar'
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const [bullish, crashRisk, newsFeed] = await Promise.all([
    getSignals({ direction: 'bullish', limit: 10 }),
    getSignals({ direction: 'crash_risk', limit: 10 }),
    getNewsFeed(),
  ])

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${bullish.total + crashRisk.total} active signals · ${newsFeed.length} articles`}
      />

      <div className="p-6 space-y-6">

        {/* Top Opportunities */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-profit" />
            <h2 className="text-sm font-semibold text-gray-300">Top Opportunities</h2>
            <span className="text-xs text-gray-600">({bullish.total})</span>
          </div>

          {bullish.data.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-sm bg-surface-card rounded-xl border border-white/8">
              No bullish signals available
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
              {/* Column header */}
              <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] gap-3 lg:gap-4 px-4 py-2 border-b border-white/8">
                <span className="text-xs text-gray-600">#</span>
                <span className="text-xs text-gray-600">Stock</span>
                <span className="text-xs text-gray-600">Signal</span>
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs text-gray-600 text-right">Conf</span>
                <span className="text-xs text-gray-600 text-right">Time</span>
              </div>
              {bullish.data.map((signal) => (
                <SignalTrackerRow key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Crash Risk Alerts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <h2 className="text-sm font-semibold text-gray-300">Crash Risk Alerts</h2>
            <span className="text-xs text-gray-600">({crashRisk.total})</span>
          </div>

          {crashRisk.data.length === 0 ? (
            <div className="flex items-center gap-2 py-4 px-4 text-profit text-sm bg-surface-card rounded-xl border border-white/8">
              <span>✓</span>
              <span>No crash risks detected</span>
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] gap-3 lg:gap-4 px-4 py-2 border-b border-white/8">
                <span className="text-xs text-gray-600">#</span>
                <span className="text-xs text-gray-600">Stock</span>
                <span className="text-xs text-gray-600">Signal</span>
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs text-gray-600 text-right">Conf</span>
                <span className="text-xs text-gray-600 text-right">Time</span>
              </div>
              {crashRisk.data.map((signal) => (
                <SignalTrackerRow key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Breaking News */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-sm font-semibold text-gray-300">Breaking News</h2>
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8">
            <NewsFeed items={newsFeed} />
          </div>
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Run full frontend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -10
```

Expected: all tests pass (no regressions — `page.tsx` has no tests and the removed `SignalCard` import from this page doesn't break SignalCard's own tests).

- [ ] **Step 3.3: Run full backend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && SUPABASE_URL=http://localhost SUPABASE_KEY=test /Users/chidoziejim/Library/Python/3.9/bin/pytest --tb=short -q 2>&1 | tail -8
```

Expected: 126 passed.

- [ ] **Step 3.4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/page.tsx && git commit -m "feat: restructure dashboard with signal tracker table"
```
