# Signals Page — Design Spec

**Date:** 2026-03-29
**Status:** Approved

---

## Goal

Expose a `/signals` page showing all active signals ranked by opportunity score, with a direction filter and accordion-style inline expansion revealing each signal's key drivers.

---

## Approach

**Accordion rows:** Each signal renders as a compact row. Clicking a row expands it in-place to reveal the drivers list. Only one row is open at a time — opening a new row closes the previous one.

**Client-side filtering:** The page fetches all signals on load (no direction filter). A direction `<select>` filters the list in JS without additional network requests.

**No new backend work:** `getSignals()` already exists and supports `limit` and `direction` params. The page calls it with `limit: 100` and no direction filter.

---

## Data Layer

### Existing: `getSignals()`

```typescript
getSignals({ limit: 100 }): Promise<PaginatedSignals>
```

Called in the Server Component with no direction filter. Returns up to 100 signals ordered by `rank` (opportunity score DESC) from the backend.

No new endpoints, models, or types needed.

---

## Frontend

### New Files

- `frontend/app/signals/page.tsx` — async Server Component, calls `getSignals()`, passes result to `<SignalList>`
- `frontend/components/signals/SignalList.tsx` — `'use client'`, owns filter + expand state, renders `<SignalRow>` per item
- `frontend/components/signals/SignalRow.tsx` — presentational, collapsed + expanded states
- `frontend/components/signals/__tests__/SignalRow.test.tsx`
- `frontend/components/signals/__tests__/SignalList.test.tsx`

### Modified Files

None.

> Note: `SignalCard`, `SignalExpanded`, and `SignalHistory` are not modified. `SignalExpanded` is not reused — the expand panel here shows drivers only (no evidence, risk flags, or historical analog).

---

### Page: `app/signals/page.tsx`

Async server component:

```tsx
const { data } = await getSignals({ limit: 100 })
return (
  <div>
    <TopBar title="Signals" subtitle="All active signals ranked by opportunity score" />
    <div className="p-6">
      <SignalList signals={data} />
    </div>
  </div>
)
```

---

### Component: `SignalList.tsx`

- `'use client'`
- Accepts `signals: SignalResponse[]` prop (no fetch)
- State: `expandedId: string | null` (default `null`) — only one row open at a time
- State: `direction: string` (default `""`) — direction filter
- Filter bar: one `<select>` with `aria-label="Direction"`
  - Options: All / Bullish / Bearish / Crash Risk
- Filtering: `signal.direction === direction` (skip if `direction === ""`)
- Empty state: "No signals yet"
- Renders `<SignalRow>` for each filtered signal, passing `isExpanded` and `onToggle`
- `onToggle(id)`: sets `expandedId` to `id` if closed, or `null` if already open (toggle)

---

### Component: `SignalRow.tsx`

Presentational. Accepts:
- `signal: SignalResponse`
- `isExpanded: boolean`
- `onToggle: () => void`

**Collapsed state (always visible):**
- Rank badge: `#N` (from `signal.rank`)
- Ticker: a `<Link href="/stock/[ticker]">` — clicking navigates, does not toggle
- Stock name: small secondary text
- Direction badge: `↑ Bullish` / `↓ Bearish` / `⚠ Crash Risk`, color-coded
- Confidence: `72%`
- Expected move: `+3.0% to +7.0%`
- Horizon: `5 days`
- Chevron icon: `▶` collapsed / `▼` expanded
- Clicking anywhere on the row **except the ticker link** toggles expand

**Expanded state (revealed below the row header):**
- Section heading: "Key Drivers"
- Bulleted list of `signal.drivers`
- If `drivers` is empty: "No drivers listed"

---

## Sidebar

No changes needed — `Sidebar.tsx` already has `{ href: '/signals', label: 'Signals', icon: TrendingUp }`.

---

## Testing

### `SignalRow.test.tsx`

- Renders ticker, confidence, direction badge in collapsed state
- Drivers are not visible when collapsed
- Clicking row calls `onToggle`
- When `isExpanded=true`, drivers list is visible
- Ticker is a link to `/stock/[ticker]`

### `SignalList.test.tsx`

- Renders all items when no filter active
- Direction filter hides non-matching rows
- Opening a second row closes the first (only one expanded at a time)
- Empty state shown when signals list is empty

---

## Out of Scope

- Sorting by fields other than opportunity score (already sorted server-side)
- Pagination (100 signals is sufficient for MVP)
- Evidence links, risk flags, historical analog in the expand panel
- Editing or dismissing signals
