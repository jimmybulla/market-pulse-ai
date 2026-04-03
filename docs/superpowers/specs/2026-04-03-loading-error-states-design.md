# Loading & Error States Design

**Date:** 2026-04-03
**Status:** Approved

---

## Problem

Five routes (signals, stocks, news, backtesting, stock detail) have no `loading.tsx` or `error.tsx`. The dashboard `loading.tsx` is stale — it still reflects the old 3-column card grid, not the new tracker table layout. When data fetches are slow or fail, users see a blank page or an unhandled error.

---

## Solution

Fix the dashboard skeleton to match the new layout, and add content-shaped skeletons and page-specific error states to all remaining routes.

---

## Scope

| Route | Action |
|---|---|
| `app/loading.tsx` | Update to match new tracker table layout |
| `app/error.tsx` | Already exists — no change |
| `app/stock/[ticker]/loading.tsx` | Already exists — no change |
| `app/stock/[ticker]/error.tsx` | Add new |
| `app/signals/loading.tsx` | Add new |
| `app/signals/error.tsx` | Add new |
| `app/stocks/loading.tsx` | Add new |
| `app/stocks/error.tsx` | Add new |
| `app/news/loading.tsx` | Add new |
| `app/news/error.tsx` | Add new |
| `app/backtesting/loading.tsx` | Add new |
| `app/backtesting/error.tsx` | Add new |

---

## Loading Skeletons

All `loading.tsx` files are Server Components. They use the existing `<Skeleton>` component from `@/components/ui/skeleton` with `bg-surface-elevated` fill. Each skeleton includes a TopBar skeleton (h-14 block) at the top.

### Dashboard (`app/loading.tsx`)

Two stacked table sections + news rows:
- TopBar skeleton (h-14)
- Section 1: label skeleton + header row skeleton + 5 full-width row skeletons (matching `SignalTrackerRow` 6-col grid)
- Section 2: same structure as Section 1
- Section 3: label skeleton + 5 news row skeletons (h-14 each)

### Signals (`app/signals/loading.tsx`)

- TopBar skeleton
- Label skeleton
- Header row skeleton
- 8 full-width row skeletons (matching `SignalTrackerRow` grid: rank, ticker+name, badge, progress, conf, time)

### Stocks (`app/stocks/loading.tsx`)

- TopBar skeleton
- Search/filter bar skeleton (h-10)
- 6 row skeletons with 3 columns: ticker block, price block, badge

### News (`app/news/loading.tsx`)

- TopBar skeleton
- 8 card skeletons (h-20 each), each with a thumbnail block on the left and text lines on the right

### Backtesting (`app/backtesting/loading.tsx`)

- TopBar skeleton
- 3 stat card skeletons side by side (h-24 each)
- Chart area skeleton (h-56)
- 2 table skeletons (h-32 each)

---

## Error States

All `error.tsx` files are `'use client'` components. They receive `{ error, reset }` props. Layout: centered vertically in min-h-[60vh], icon + heading + message + "Try again" button. Button calls `reset()`. Identical structure to the existing dashboard `error.tsx`.

### Stock detail (`app/stock/[ticker]/error.tsx`)

- Icon: `AlertCircle` (`text-loss`)
- Heading: "Failed to load stock"
- Message: "We couldn't load data for this stock. It may have been delisted or is temporarily unavailable."

### Signals (`app/signals/error.tsx`)

- Icon: `TrendingUp` (`text-loss`)
- Heading: "Failed to load signals"
- Message: "The signal feed is temporarily unavailable. Check back in a few minutes."

### Stocks (`app/stocks/error.tsx`)

- Icon: `BarChart3` (`text-loss`)
- Heading: "Failed to load stocks"
- Message: "We couldn't reach the stocks data. Try refreshing the page."

### News (`app/news/error.tsx`)

- Icon: `Newspaper` (`text-loss`)
- Heading: "Failed to load news"
- Message: "The news feed is temporarily unavailable. Check back in a few minutes."

### Backtesting (`app/backtesting/error.tsx`)

- Icon: `FlaskConical` (`text-loss`)
- Heading: "Failed to load backtesting data"
- Message: "Accuracy data couldn't be loaded. Try refreshing the page."

---

## Error State Template

All `error.tsx` files follow this pattern (icon, heading, message vary per page):

```tsx
'use client'

import { useEffect } from 'react'
import { <Icon> } from 'lucide-react'

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
      <<Icon> className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white"><Heading></h2>
      <p className="text-sm text-gray-500 max-w-sm"><Message></p>
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

---

## Testing

No new unit tests — loading and error components have no logic to test. Existing frontend tests must continue to pass (107 tests, 21 suites).

---

## Constraints

- No new dependencies — uses existing `Skeleton`, `lucide-react`, Tailwind tokens
- `loading.tsx` files are Server Components (no `'use client'`)
- `error.tsx` files must be `'use client'` (Next.js requirement)
- Skeletons must not import client components
