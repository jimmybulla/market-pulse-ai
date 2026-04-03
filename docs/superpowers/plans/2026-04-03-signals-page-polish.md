# Signals Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `SignalRow`'s expanded panel to show a price-progress tracker and a structured detail panel (drivers, explanation, evidence, historical analog, risk flags).

**Architecture:** Single file change — `frontend/components/signals/SignalRow.tsx`. The collapsed row is untouched. The expanded panel gains a progress section at the top (progress bar + 3 stat labels) and a detail panel below (conditional sub-sections). All data is already in `SignalResponse`.

**Tech Stack:** React, TypeScript, Tailwind CSS, `@testing-library/react`, Jest

---

## File Map

| File | Action |
|---|---|
| `frontend/components/signals/SignalRow.tsx` | Modify — rewrite expanded panel only |
| `frontend/components/signals/__tests__/SignalRow.test.tsx` | Modify — add tests for new expanded panel |

---

### Task 1: Add expanded panel tests (failing first)

**Files:**
- Modify: `frontend/components/signals/__tests__/SignalRow.test.tsx`

- [ ] **Step 1: Add price_at_signal to the existing mock and add a priced mock**

Open `frontend/components/signals/__tests__/SignalRow.test.tsx`.

Change the top of the file so `mockSignal` includes `price_at_signal` and add a second fixture `mockSignalWithPrice` for progress-section tests:

```tsx
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
  price_at_signal: null,
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

// price_at_signal set so actual move = +4% (174.93 → ~181.93 not needed; use clean numbers)
// last_price=182, price_at_signal=175 → actualPct = (182-175)/175*100 = 4.0%
// expected_move_high=0.07 → target = 7% → progress = 4/7*100 ≈ 57%
const mockSignalWithPrice: SignalResponse = {
  ...mockSignal,
  last_price: 182.0,
  price_at_signal: 175.0,
  explanation: 'Strong momentum driven by earnings beat.',
  risk_flags: ['Sector volatility'],
}
```

- [ ] **Step 2: Add new describe block with all new tests**

Append a new `describe` block after the existing one:

```tsx
describe('SignalRow — expanded panel', () => {
  it('shows progress bar when price_at_signal and last_price are present', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('signal-progress-track')).toBeInTheDocument()
  })

  it('hides progress section when price_at_signal is null', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.queryByTestId('signal-progress-track')).not.toBeInTheDocument()
  })

  it('shows actual move percentage', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    // (182-175)/175*100 = 4.0%
    expect(screen.getByTestId('actual-move')).toHaveTextContent('+4.0%')
  })

  it('shows target range', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('target-range')).toHaveTextContent('+3.0% → +7.0%')
  })

  it('shows explanation when present', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByText('Strong momentum driven by earnings beat.')).toBeInTheDocument()
  })

  it('hides explanation when null', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.queryByTestId('explanation-section')).not.toBeInTheDocument()
  })

  it('shows evidence section', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('evidence-section')).toBeInTheDocument()
    expect(screen.getByText('2 articles')).toBeInTheDocument()
  })

  it('shows historical analog section', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('historical-section')).toBeInTheDocument()
    // avg_move=0.05 → +5.0%, hit_rate=0.64 → 64%
    expect(screen.getByText('+5.0%')).toBeInTheDocument()
    expect(screen.getByText('64% hit rate')).toBeInTheDocument()
  })

  it('shows risk flags when present', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByText('Sector volatility')).toBeInTheDocument()
  })

  it('hides risk flags section when array is empty', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.queryByTestId('risk-flags-section')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd frontend && npx jest components/signals/__tests__/SignalRow.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: Several FAIL lines for the new tests (old tests should still pass). If the old tests also fail, check that `price_at_signal: null` was added to `mockSignal` correctly.

- [ ] **Step 4: Commit the failing tests**

```bash
cd frontend && git add components/signals/__tests__/SignalRow.test.tsx
git commit -m "test: add failing tests for SignalRow expanded panel upgrade"
```

---

### Task 2: Implement the upgraded expanded panel

**Files:**
- Modify: `frontend/components/signals/SignalRow.tsx`

- [ ] **Step 1: Replace SignalRow.tsx with the full implementation**

Replace the entire file content with:

```tsx
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

function calcActualPct(signal: SignalResponse): number | null {
  if (signal.last_price == null || signal.price_at_signal == null) return null
  return ((signal.last_price - signal.price_at_signal) / signal.price_at_signal) * 100
}

function calcProgress(direction: SignalDirection, actualPct: number, expectedLow: number, expectedHigh: number): number {
  if (direction === 'bullish') {
    const targetPct = expectedHigh * 100
    return Math.min((actualPct / targetPct) * 100, 100)
  }
  if (direction === 'crash_risk') {
    return Math.min((Math.abs(actualPct) / 10) * 100, 100)
  }
  // bearish
  const targetPct = Math.abs(expectedLow) * 100
  return Math.min((Math.abs(actualPct) / targetPct) * 100, 100)
}

function calcDaysRemaining(createdAt: string, horizonDays: number): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return Math.round(horizonDays - ageDays)
}

function progressBarColor(direction: SignalDirection): string {
  return direction === 'bullish' ? 'bg-brand-cyan' : 'bg-loss'
}

interface SignalRowProps {
  signal: SignalResponse
  isExpanded: boolean
  onToggle: () => void
}

export default function SignalRow({ signal, isExpanded, onToggle }: SignalRowProps) {
  const {
    ticker, stock_name, direction, confidence, rank,
    expected_move_low, expected_move_high, horizon_days,
    drivers, explanation, evidence, historical_analog, risk_flags,
    created_at,
  } = signal

  const actualPct = calcActualPct(signal)
  const progressPct = actualPct != null
    ? calcProgress(direction, actualPct, expected_move_low, expected_move_high)
    : null
  const daysRemaining = calcDaysRemaining(created_at, horizon_days)

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
        <div className="border-t border-white/8">

          {/* Section 1: Progress tracking */}
          {actualPct != null && progressPct != null && (
            <div className="px-4 pt-3 pb-3">
              {/* Progress bar */}
              <div
                data-testid="signal-progress-track"
                className="h-1.5 w-full rounded-full bg-brand-cyan/20 overflow-hidden mb-3"
              >
                <div
                  className={`h-full rounded-full ${progressBarColor(direction)} transition-all`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-500">Actual move</span>
                  <span
                    data-testid="actual-move"
                    className={`font-mono font-medium ${actualPct >= 0 ? 'text-profit' : 'text-loss'}`}
                  >
                    {actualPct >= 0 ? '+' : ''}{actualPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-500">Target</span>
                  <span data-testid="target-range" className="font-mono text-gray-300">
                    +{(expected_move_low * 100).toFixed(1)}% → +{(expected_move_high * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-500">Time left</span>
                  <span className="font-mono text-gray-300">
                    {daysRemaining <= 0 ? 'Expired' : `${daysRemaining}d`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Detail panel */}
          <div className="px-4 pt-3 pb-4 border-t border-white/8 space-y-4">

            {/* Key Drivers */}
            <div>
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

            {/* Explanation */}
            {explanation && (
              <div data-testid="explanation-section">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Analysis
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">{explanation}</p>
              </div>
            )}

            {/* Evidence */}
            {evidence && (
              <div data-testid="evidence-section">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Evidence
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-300">
                  <span>{evidence.article_count} articles</span>
                  <span className="text-gray-600">·</span>
                  <span>
                    Source credibility:{' '}
                    <span className="text-brand-cyan font-mono">
                      {Math.round(evidence.avg_credibility * 100)}%
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Historical Analog */}
            {historical_analog && (
              <div data-testid="historical-section">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Historical Analog
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-300">
                  <span>
                    Avg move:{' '}
                    <span className="font-mono text-profit">
                      +{(historical_analog.avg_move * 100).toFixed(1)}%
                    </span>
                  </span>
                  <span className="text-gray-600">·</span>
                  <span>{Math.round(historical_analog.hit_rate * 100)}% hit rate</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500">{historical_analog.sample_size} signals</span>
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {risk_flags.length > 0 && (
              <div data-testid="risk-flags-section">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Risk Flags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {risk_flags.map((flag, i) => (
                    <span
                      key={i}
                      className="bg-loss/10 text-loss border border-loss/20 text-xs rounded-full px-2 py-0.5"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

```bash
cd frontend && npx jest components/signals/__tests__/SignalRow.test.tsx --no-coverage 2>&1 | tail -30
```

Expected: All tests PASS — both the original 5 and the new 10.

- [ ] **Step 3: Run the full frontend suite to confirm no regressions**

```bash
cd frontend && npx jest --no-coverage 2>&1 | tail -10
```

Expected: All 107+ tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add components/signals/SignalRow.tsx components/signals/__tests__/SignalRow.test.tsx
git commit -m "feat: upgrade SignalRow expanded panel with progress tracker and detail sections"
```

---

## Self-Review

**Spec coverage:**
- ✅ Progress bar showing actual % move vs target — `signal-progress-track` with width based on `calcProgress`
- ✅ 3 stats: actual move, target range, days remaining / Expired
- ✅ Key Drivers — preserved and reformatted
- ✅ Explanation — conditional, `explanation-section` testid
- ✅ Evidence — conditional, `evidence-section` testid, article_count + avg_credibility
- ✅ Historical Analog — conditional, `historical-section` testid, avg_move + hit_rate
- ✅ Risk Flags — conditional, `risk-flags-section` testid, pill chips
- ✅ Progress section omitted when price data unavailable
- ✅ Collapsed row unchanged
- ✅ No new files, no backend changes

**Placeholder scan:** None found.

**Type consistency:** All properties (`actual-move`, `target-range`, `signal-progress-track`, `evidence-section`, `historical-section`, `risk-flags-section`, `explanation-section`) match between test file and implementation.
