# Signals Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/signals` page showing all active signals ranked by opportunity score, with accordion-style inline expansion revealing key drivers and a client-side direction filter.

**Architecture:** A Next.js Server Component fetches up to 100 signals and passes them to a `'use client'` `SignalList` component that owns filter + expand state. Each signal renders as a `SignalRow` — a compact row with a toggle button that reveals the drivers list in-place. Only one row is open at a time.

**Tech Stack:** Next.js App Router (Server + Client Components), TypeScript, React Testing Library, Tailwind CSS, lucide-react.

---

## File Map

**Create:**
- `frontend/components/signals/SignalRow.tsx`
- `frontend/components/signals/__tests__/SignalRow.test.tsx`
- `frontend/components/signals/SignalList.tsx`
- `frontend/components/signals/__tests__/SignalList.test.tsx`
- `frontend/app/signals/page.tsx`

**Modify:** none.

---

## Task 1: SignalRow component

**Files:**
- Create: `frontend/components/signals/SignalRow.tsx`
- Create: `frontend/components/signals/__tests__/SignalRow.test.tsx`

**Context:** `SignalRow` is a pure presentational component. It takes `signal`, `isExpanded`, and `onToggle` props. The collapsed header shows: rank badge, ticker link, stock name, direction label, confidence %, expected move range, horizon, and a chevron toggle button. The expanded panel (rendered only when `isExpanded=true`) shows the Key Drivers list. The chevron button calls `onToggle`. The ticker is a `<Link>` that stops click propagation so navigating to the stock page does not also fire `onToggle`.

Currently 73 frontend tests pass.

- [ ] **Step 1: Write failing tests**

Create `frontend/components/signals/__tests__/SignalRow.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import SignalRow from '../SignalRow'
import type { SignalResponse } from '@/lib/types'

const mockSignal: SignalResponse = {
  id: 'sig-1',
  stock_id: 'abc',
  ticker: 'AAPL',
  stock_name: 'Apple Inc.',
  sector: 'Technology',
  last_price: 175.0,
  direction: 'bullish',
  confidence: 0.72,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  opportunity_score: 0.85,
  crash_risk_score: 0.05,
  rank: 1,
  explanation: null,
  drivers: ['Strong earnings beat', 'Positive guidance'],
  evidence: { sources: ['Bloomberg'], article_ids: ['x'], article_count: 2, avg_credibility: 0.9 },
  historical_analog: { avg_move: 0.05, hit_rate: 0.64, sample_size: 10 },
  risk_flags: [],
  created_at: '2026-03-29T00:00:00Z',
  expires_at: null,
}

describe('SignalRow', () => {
  it('renders rank, ticker, and direction in collapsed state', () => {
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={() => {}} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('↑ Bullish')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('does not show drivers when collapsed', () => {
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={() => {}} />)
    expect(screen.queryByText('Strong earnings beat')).not.toBeInTheDocument()
  })

  it('calls onToggle when chevron button is clicked', () => {
    const onToggle = jest.fn()
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /toggle AAPL/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows drivers list when isExpanded is true', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByText('Strong earnings beat')).toBeInTheDocument()
    expect(screen.getByText('Positive guidance')).toBeInTheDocument()
  })

  it('ticker is a link to /stock/[ticker]', () => {
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={() => {}} />)
    const link = screen.getByRole('link', { name: /AAPL/i })
    expect(link).toHaveAttribute('href', '/stock/AAPL')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --testPathPattern="signals/__tests__/SignalRow" --watchAll=false 2>&1 | tail -5
```
Expected: `Cannot find module '../SignalRow'`

- [ ] **Step 3: Implement SignalRow**

Create `frontend/components/signals/SignalRow.tsx`:

```typescript
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionLabel(d: SignalDirection) {
  if (d === 'bullish') return '↑ Bullish'
  if (d === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function directionColor(d: SignalDirection) {
  return d === 'bullish' ? 'text-profit' : 'text-loss'
}

interface SignalRowProps {
  signal: SignalResponse
  isExpanded: boolean
  onToggle: () => void
}

export default function SignalRow({ signal, isExpanded, onToggle }: SignalRowProps) {
  const {
    ticker, stock_name, direction, confidence, rank,
    expected_move_low, expected_move_high, horizon_days, drivers,
  } = signal

  return (
    <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Rank */}
        <span className="text-xs font-mono text-gray-500 w-6 shrink-0">#{rank}</span>

        {/* Ticker + name */}
        <div className="min-w-0 w-24 shrink-0">
          <Link
            href={`/stock/${ticker}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono font-bold text-white hover:text-brand-cyan transition-colors text-sm"
          >
            {ticker}
          </Link>
          <p className="text-xs text-gray-500 truncate">{stock_name}</p>
        </div>

        {/* Direction */}
        <span className={`text-xs font-medium shrink-0 ${directionColor(direction)}`}>
          {directionLabel(direction)}
        </span>

        {/* Confidence */}
        <span className="font-mono text-sm text-white shrink-0">
          {Math.round(confidence * 100)}%
        </span>

        {/* Expected move */}
        <span className="font-mono text-xs text-gray-400 hidden sm:block shrink-0">
          +{(expected_move_low * 100).toFixed(1)}%–+{(expected_move_high * 100).toFixed(1)}%
        </span>

        {/* Horizon */}
        <span className="text-xs text-gray-500 hidden md:block shrink-0">
          {horizon_days}d
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toggle button */}
        <button
          onClick={onToggle}
          aria-label={`Toggle ${ticker} signal`}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/8 pt-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Key Drivers
          </h3>
          {drivers.length === 0 ? (
            <p className="text-sm text-gray-600">No drivers listed</p>
          ) : (
            <ul className="space-y-1.5">
              {drivers.map((driver, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-brand-cyan mt-0.5 shrink-0">•</span>
                  {driver}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run SignalRow tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --testPathPattern="signals/__tests__/SignalRow" --watchAll=false 2>&1 | tail -5
```
Expected: `5 passed`

- [ ] **Step 5: Run full frontend suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -5
```
Expected: `78 passed`

- [ ] **Step 6: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/components/signals/SignalRow.tsx "frontend/components/signals/__tests__/SignalRow.test.tsx" && git commit -m "feat: add SignalRow component"
```

---

## Task 2: SignalList component

**Files:**
- Create: `frontend/components/signals/SignalList.tsx`
- Create: `frontend/components/signals/__tests__/SignalList.test.tsx`

**Context:** `SignalList` is `'use client'`. It owns two state values: `expandedId: string | null` (accordion — only one row open) and `direction: string` (filter, default `""`). The toggle handler sets `expandedId` to the clicked signal's `id` if it isn't already expanded, or to `null` if it is (closing it). The direction select has `aria-label="Direction"`. Use `fireEvent.change` for select interaction — `@testing-library/user-event` is NOT installed.

Currently 78 frontend tests pass.

- [ ] **Step 1: Write failing tests**

Create `frontend/components/signals/__tests__/SignalList.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import SignalList from '../SignalList'
import type { SignalResponse } from '@/lib/types'

const makeSignal = (overrides: Partial<SignalResponse> = {}): SignalResponse => ({
  id: 'sig-1',
  stock_id: 'abc',
  ticker: 'AAPL',
  stock_name: 'Apple Inc.',
  sector: 'Technology',
  last_price: 175.0,
  direction: 'bullish',
  confidence: 0.72,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  opportunity_score: 0.85,
  crash_risk_score: 0.05,
  rank: 1,
  explanation: null,
  drivers: ['Strong earnings'],
  evidence: { sources: [], article_ids: [], article_count: 0, avg_credibility: 0 },
  historical_analog: { avg_move: 0.05, hit_rate: 0.6, sample_size: 5 },
  risk_flags: [],
  created_at: '2026-03-29T00:00:00Z',
  expires_at: null,
  ...overrides,
})

describe('SignalList', () => {
  it('renders empty state when signals is empty', () => {
    render(<SignalList signals={[]} />)
    expect(screen.getByText('No signals yet')).toBeInTheDocument()
  })

  it('renders all signals when no filter is active', () => {
    const signals = [
      makeSignal({ id: 'sig-1', ticker: 'AAPL', rank: 1 }),
      makeSignal({ id: 'sig-2', ticker: 'NVDA', rank: 2, direction: 'bearish' }),
    ]
    render(<SignalList signals={signals} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })

  it('direction filter hides non-matching rows', () => {
    const signals = [
      makeSignal({ id: 'sig-1', ticker: 'AAPL', direction: 'bullish', rank: 1 }),
      makeSignal({ id: 'sig-2', ticker: 'NVDA', direction: 'bearish', rank: 2 }),
    ]
    render(<SignalList signals={signals} />)
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'bullish' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('NVDA')).not.toBeInTheDocument()
  })

  it('opening a second row closes the first', () => {
    const signals = [
      makeSignal({ id: 'sig-1', ticker: 'AAPL', rank: 1, drivers: ['Driver A'] }),
      makeSignal({ id: 'sig-2', ticker: 'NVDA', rank: 2, drivers: ['Driver B'] }),
    ]
    render(<SignalList signals={signals} />)
    // Open first row
    fireEvent.click(screen.getByRole('button', { name: /toggle AAPL/i }))
    expect(screen.getByText('Driver A')).toBeInTheDocument()
    // Open second row — first should close
    fireEvent.click(screen.getByRole('button', { name: /toggle NVDA/i }))
    expect(screen.queryByText('Driver A')).not.toBeInTheDocument()
    expect(screen.getByText('Driver B')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --testPathPattern="signals/__tests__/SignalList" --watchAll=false 2>&1 | tail -5
```
Expected: `Cannot find module '../SignalList'`

- [ ] **Step 3: Implement SignalList**

Create `frontend/components/signals/SignalList.tsx`:

```typescript
'use client'
import { useState } from 'react'
import type { SignalResponse } from '@/lib/types'
import SignalRow from './SignalRow'

export default function SignalList({ signals }: { signals: SignalResponse[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [direction, setDirection] = useState('')

  const filtered = signals.filter((s) => !direction || s.direction === direction)

  function handleToggle(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3">
        <select
          aria-label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Directions</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="crash_risk">Crash Risk</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-600">No signals yet</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((signal) => (
            <SignalRow
              key={signal.id}
              signal={signal}
              isExpanded={expandedId === signal.id}
              onToggle={() => handleToggle(signal.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run SignalList tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --testPathPattern="signals/__tests__/SignalList" --watchAll=false 2>&1 | tail -5
```
Expected: `4 passed`

- [ ] **Step 5: Run full frontend suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -5
```
Expected: `82 passed`

- [ ] **Step 6: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/components/signals/SignalList.tsx "frontend/components/signals/__tests__/SignalList.test.tsx" && git commit -m "feat: add SignalList component with accordion expand and direction filter"
```

---

## Task 3: Signals page

**Files:**
- Create: `frontend/app/signals/page.tsx`

**Context:** Async Server Component. No `'use client'`. Calls `getSignals({ limit: 100 })` from `@/lib/api`, which returns `PaginatedSignals` — use the `.data` array. `TopBar` accepts `title: string` and `subtitle?: string`. `Sidebar.tsx` already has the `/signals` nav link — no changes needed.

Currently 82 frontend tests pass.

- [ ] **Step 1: Create the signals page**

Create `frontend/app/signals/page.tsx`:

```typescript
import { getSignals } from '@/lib/api'
import SignalList from '@/components/signals/SignalList'
import TopBar from '@/components/layout/TopBar'

export default async function SignalsPage() {
  const { data } = await getSignals({ limit: 100 })
  return (
    <div>
      <TopBar title="Signals" subtitle="All active signals ranked by opportunity score" />
      <div className="p-6">
        <SignalList signals={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full frontend suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -5
```
Expected: `82 passed` (no new tests for the page — thin server component)

- [ ] **Step 3: Run full backend suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && .venv/bin/pytest --tb=short -q 2>&1 | tail -3
```
Expected: `105 passed` (unchanged)

- [ ] **Step 4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/signals/page.tsx && git commit -m "feat: add /signals page"
```
