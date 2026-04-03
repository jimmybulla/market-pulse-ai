# Loading & Error States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add content-shaped loading skeletons and page-specific error states to every route that is missing them, and update the stale dashboard skeleton to match the new tracker table layout.

**Architecture:** Next.js file-based routing — each route gets a `loading.tsx` (Server Component, skeleton UI) and `error.tsx` (`'use client'` component with reset button). No new dependencies; uses the existing `<Skeleton>` component from `@/components/ui/skeleton` and `lucide-react` icons already installed.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, `@/components/ui/skeleton`, `lucide-react`.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `frontend/app/loading.tsx` |
| Create | `frontend/app/stock/[ticker]/error.tsx` |
| Create | `frontend/app/signals/loading.tsx` |
| Create | `frontend/app/signals/error.tsx` |
| Create | `frontend/app/stocks/loading.tsx` |
| Create | `frontend/app/stocks/error.tsx` |
| Create | `frontend/app/news/loading.tsx` |
| Create | `frontend/app/news/error.tsx` |
| Create | `frontend/app/backtesting/loading.tsx` |
| Create | `frontend/app/backtesting/error.tsx` |

---

## Task 1: Update dashboard loading skeleton

**Files:**
- Modify: `frontend/app/loading.tsx`

**Context:** Read `frontend/AGENTS.md` before writing any Next.js code. The dashboard was restructured to two stacked `SignalTrackerRow` tables + news feed. The old skeleton reflects the old 3-col card grid. Update it to match the new layout: TopBar block → two table sections (header row + 5 row skeletons each) → news rows.

- [ ] **Step 1.1: Read the current file**

Read `frontend/app/loading.tsx` first.

- [ ] **Step 1.2: Replace with updated skeleton**

```tsx
// frontend/app/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

function TableSectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40 bg-surface-elevated" />
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-2 border-b border-white/8">
          <Skeleton className="h-3 w-full bg-surface-elevated" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-6 bg-surface-elevated shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20 bg-surface-elevated" />
              <Skeleton className="h-2.5 w-32 bg-surface-elevated" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full bg-surface-elevated shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-1.5 w-full rounded-full bg-surface-elevated" />
              <Skeleton className="h-2.5 w-24 bg-surface-elevated" />
            </div>
            <Skeleton className="h-3 w-8 bg-surface-elevated shrink-0" />
            <Skeleton className="h-3 w-12 bg-surface-elevated shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-28 bg-surface-elevated" />
        <Skeleton className="h-3 w-40 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-6">
        <TableSectionSkeleton rows={5} />
        <TableSectionSkeleton rows={3} />
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 bg-surface-elevated" />
          <div className="bg-surface-card rounded-xl border border-white/8 p-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg bg-surface-elevated" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 1.3: Run frontend tests to confirm no regressions**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -8
```

Expected: 107 passed.

- [ ] **Step 1.4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/loading.tsx && git commit -m "fix: update dashboard loading skeleton to match tracker table layout"
```

---

## Task 2: Stock detail error state

**Files:**
- Create: `frontend/app/stock/[ticker]/error.tsx`

**Context:** Read `frontend/AGENTS.md` before writing any Next.js code. The stock detail route already has `loading.tsx` but no `error.tsx`. The existing `frontend/app/error.tsx` is the pattern to follow exactly — same structure, different icon/copy.

- [ ] **Step 2.1: Create the file**

```tsx
// frontend/app/stock/[ticker]/error.tsx
'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <AlertCircle className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load stock</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        We couldn&apos;t load data for this stock. It may have been delisted or is temporarily unavailable.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 2.2: Run frontend tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -8
```

Expected: 107 passed.

- [ ] **Step 2.3: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/stock/[ticker]/error.tsx && git commit -m "feat: add error state for stock detail page"
```

---

## Task 3: Signals loading + error

**Files:**
- Create: `frontend/app/signals/loading.tsx`
- Create: `frontend/app/signals/error.tsx`

**Context:** Read `frontend/AGENTS.md` before writing any Next.js code. The signals page renders `<SignalList>` which uses `<SignalRow>` — a full-width row per signal. The skeleton should look like 8 full-width rows matching the 6-column `SignalTrackerRow` grid (rank, ticker+name, badge, progress bar, confidence, time).

- [ ] **Step 3.1: Create `frontend/app/signals/loading.tsx`**

```tsx
// frontend/app/signals/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function SignalsLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-24 bg-surface-elevated" />
        <Skeleton className="h-3 w-48 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-3">
        <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/8">
            <Skeleton className="h-3 w-full bg-surface-elevated" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-6 bg-surface-elevated shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20 bg-surface-elevated" />
                <Skeleton className="h-2.5 w-32 bg-surface-elevated" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-surface-elevated shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-1.5 w-full rounded-full bg-surface-elevated" />
                <Skeleton className="h-2.5 w-24 bg-surface-elevated" />
              </div>
              <Skeleton className="h-3 w-8 bg-surface-elevated shrink-0" />
              <Skeleton className="h-3 w-12 bg-surface-elevated shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Create `frontend/app/signals/error.tsx`**

```tsx
// frontend/app/signals/error.tsx
'use client'

import { useEffect } from 'react'
import { TrendingUp } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <TrendingUp className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load signals</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        The signal feed is temporarily unavailable. Check back in a few minutes.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 3.3: Run frontend tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -8
```

Expected: 107 passed.

- [ ] **Step 3.4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/signals/loading.tsx frontend/app/signals/error.tsx && git commit -m "feat: add loading and error states for signals page"
```

---

## Task 4: Stocks loading + error

**Files:**
- Create: `frontend/app/stocks/loading.tsx`
- Create: `frontend/app/stocks/error.tsx`

**Context:** Read `frontend/AGENTS.md` before writing any Next.js code. The stocks page renders `<StocksTable>` which has a search bar + sortable table with columns: ticker, name, sector, price. The skeleton shows a search/filter bar + 6 table rows with those columns.

- [ ] **Step 4.1: Create `frontend/app/stocks/loading.tsx`**

```tsx
// frontend/app/stocks/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function StocksLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-24 bg-surface-elevated" />
        <Skeleton className="h-3 w-36 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-4">
        {/* Search + filter bar */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64 rounded-lg bg-surface-elevated" />
          <Skeleton className="h-10 w-40 rounded-lg bg-surface-elevated" />
        </div>
        {/* Table */}
        <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex gap-6">
            <Skeleton className="h-3 w-16 bg-surface-elevated" />
            <Skeleton className="h-3 w-32 bg-surface-elevated" />
            <Skeleton className="h-3 w-24 bg-surface-elevated" />
            <Skeleton className="h-3 w-16 bg-surface-elevated ml-auto" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-6 border-b border-white/5 last:border-0">
              <Skeleton className="h-4 w-14 bg-surface-elevated shrink-0" />
              <Skeleton className="h-3 w-40 bg-surface-elevated flex-1" />
              <Skeleton className="h-5 w-24 rounded-full bg-surface-elevated" />
              <Skeleton className="h-4 w-16 bg-surface-elevated ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.2: Create `frontend/app/stocks/error.tsx`**

```tsx
// frontend/app/stocks/error.tsx
'use client'

import { useEffect } from 'react'
import { BarChart3 } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <BarChart3 className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load stocks</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        We couldn&apos;t reach the stocks data. Try refreshing the page.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 4.3: Run frontend tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -8
```

Expected: 107 passed.

- [ ] **Step 4.4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/stocks/loading.tsx frontend/app/stocks/error.tsx && git commit -m "feat: add loading and error states for stocks page"
```

---

## Task 5: News loading + error

**Files:**
- Create: `frontend/app/news/loading.tsx`
- Create: `frontend/app/news/error.tsx`

**Context:** Read `frontend/AGENTS.md` before writing any Next.js code. The news page renders `<NewsFeed>` which shows filter dropdowns + a list of `<NewsCard>` rows. Each card is ~h-20 with a left-side content block (headline + meta). The skeleton shows 2 filter bar skeletons + 8 card-height rows.

- [ ] **Step 5.1: Create `frontend/app/news/loading.tsx`**

```tsx
// frontend/app/news/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function NewsLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-20 bg-surface-elevated" />
        <Skeleton className="h-3 w-44 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-4">
        {/* Filter bar */}
        <div className="flex gap-3">
          <Skeleton className="h-9 w-36 rounded-lg bg-surface-elevated" />
          <Skeleton className="h-9 w-36 rounded-lg bg-surface-elevated" />
        </div>
        {/* News cards */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface-card rounded-xl border border-white/8 px-4 py-3 flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full bg-surface-elevated" />
                <Skeleton className="h-3 w-3/4 bg-surface-elevated" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16 bg-surface-elevated" />
                  <Skeleton className="h-3 w-20 bg-surface-elevated" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-surface-elevated shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5.2: Create `frontend/app/news/error.tsx`**

```tsx
// frontend/app/news/error.tsx
'use client'

import { useEffect } from 'react'
import { Newspaper } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <Newspaper className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load news</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        The news feed is temporarily unavailable. Check back in a few minutes.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 5.3: Run frontend tests**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -8
```

Expected: 107 passed.

- [ ] **Step 5.4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/news/loading.tsx frontend/app/news/error.tsx && git commit -m "feat: add loading and error states for news page"
```

---

## Task 6: Backtesting loading + error

**Files:**
- Create: `frontend/app/backtesting/loading.tsx`
- Create: `frontend/app/backtesting/error.tsx`

**Context:** Read `frontend/AGENTS.md` before writing any Next.js code. The backtesting page renders `<BacktestingDashboard>` which has: stat cards at top, a chart section (weekly/monthly toggle + ComposedChart), then by-direction and by-confidence tables. The skeleton shows 3 stat card blocks + chart block + 2 table blocks.

- [ ] **Step 6.1: Create `frontend/app/backtesting/loading.tsx`**

```tsx
// frontend/app/backtesting/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function BacktestingLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-28 bg-surface-elevated" />
        <Skeleton className="h-3 w-44 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-2">
              <Skeleton className="h-3 w-24 bg-surface-elevated" />
              <Skeleton className="h-8 w-20 bg-surface-elevated" />
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg bg-surface-elevated" />
            <Skeleton className="h-7 w-20 rounded-lg bg-surface-elevated" />
          </div>
          <Skeleton className="h-56 w-full rounded-lg bg-surface-elevated" />
        </div>
        {/* Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
            <Skeleton className="h-4 w-28 bg-surface-elevated" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-surface-elevated" />
                <Skeleton className="h-3 w-16 bg-surface-elevated" />
              </div>
            ))}
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
            <Skeleton className="h-4 w-32 bg-surface-elevated" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-surface-elevated" />
                <Skeleton className="h-3 w-16 bg-surface-elevated" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Create `frontend/app/backtesting/error.tsx`**

```tsx
// frontend/app/backtesting/error.tsx
'use client'

import { useEffect } from 'react'
import { FlaskConical } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <FlaskConical className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load backtesting data</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Accuracy data couldn&apos;t be loaded. Try refreshing the page.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 6.3: Run full frontend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -8
```

Expected: 107 passed.

- [ ] **Step 6.4: Run full backend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && SUPABASE_URL=http://localhost SUPABASE_KEY=test /Users/chidoziejim/Library/Python/3.9/bin/pytest --tb=short -q 2>&1 | tail -5
```

Expected: 126 passed.

- [ ] **Step 6.5: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/backtesting/loading.tsx frontend/app/backtesting/error.tsx && git commit -m "feat: add loading and error states for backtesting page"
```
