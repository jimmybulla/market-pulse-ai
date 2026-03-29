# Stocks Page — Design Spec

**Date:** 2026-03-29
**Status:** Approved

---

## Goal

Expose a `/stocks` page showing all tracked stocks in a searchable, filterable, sortable table. Each row links to `/stock/[ticker]`.

---

## Approach

**All client-side:** The server fetches all stocks once (`limit: 200`) and passes the full list to a `'use client'` component. Search, sector filter, and column sort are all applied in JS on the pre-fetched array — no additional network requests. Consistent with `NewsFeed` and `SignalList` patterns in this codebase.

---

## Data Layer

### Existing: `getStocks()`

```typescript
getStocks({ limit: 200 }): Promise<PaginatedStocks>
```

Called in the Server Component. Returns `StockResponse[]`:

```typescript
interface StockResponse {
  id: string
  ticker: string
  name: string
  sector: string | null
  market_cap: number | null
  last_price: number | null
  updated_at: string
}
```

Sector options for the dropdown are derived client-side: `Array.from(new Set(stocks.map(s => s.sector).filter(Boolean))).sort()`.

No new endpoints, models, or types needed.

---

## Frontend

### New Files

- `frontend/app/stocks/page.tsx` — async Server Component, calls `getStocks()`, passes result to `<StocksTable>`
- `frontend/components/stocks/StocksTable.tsx` — `'use client'`, owns filter/sort state, renders table
- `frontend/components/stocks/__tests__/StocksTable.test.tsx`

### Modified Files

None.

> Note: `Sidebar.tsx` already has `{ href: '/stocks', label: 'Stocks', icon: BarChart3 }` — no changes needed.

---

### Page: `app/stocks/page.tsx`

Async server component:

```tsx
const { data } = await getStocks({ limit: 200 })
return (
  <div>
    <TopBar title="Stocks" subtitle="All tracked stocks" />
    <div className="p-6">
      <StocksTable stocks={data} />
    </div>
  </div>
)
```

---

### Component: `StocksTable.tsx`

- `'use client'`
- Accepts `stocks: StockResponse[]` prop (no fetch)
- State:
  - `search: string` (default `""`) — filters by ticker or name (case-insensitive)
  - `sector: string` (default `""`) — filters by sector exact match
  - `sortKey: 'ticker' | 'name' | 'sector' | 'last_price'` (default `'ticker'`)
  - `sortDir: 'asc' | 'desc'` (default `'asc'`)
- Sector options: derived from `stocks` prop (unique non-null sectors, sorted alphabetically)
- Filter bar: text `<input>` with `placeholder="Search ticker or name..."` and `aria-label="Search"` + sector `<select>` with `aria-label="Sector"`
- Filter logic: apply search filter first, then sector filter
  - Search: `stock.ticker.toLowerCase().includes(search.toLowerCase()) || stock.name.toLowerCase().includes(search.toLowerCase())`
  - Sector: `!sector || stock.sector === sector`
- Sort logic: applied after filtering; null values sort last
- Clicking a column header sets `sortKey` to that column; if already the active sort key, toggles `sortDir`; indicator: `↑` (asc) or `↓` (desc) next to active column header
- Table columns: **Ticker** | **Name** | **Sector** | **Last Price**
  - Ticker: `<Link href="/stock/[ticker]">` — monospace bold
  - Name: plain text
  - Sector: plain text, `—` if null
  - Last Price: `$175.00` format, `—` if null
- Empty state (filtered list empty): "No stocks found"
- Each row links via the ticker column only (not the full row)

---

## Sidebar

No changes needed — `Sidebar.tsx` already has `{ href: '/stocks', label: 'Stocks', icon: BarChart3 }`.

---

## Testing

### `StocksTable.test.tsx`

- Renders all stocks when no filters active
- Search by ticker hides non-matching rows
- Search by name hides non-matching rows
- Sector filter hides non-matching rows
- Clicking ticker column header sorts ascending; clicking again sorts descending
- Each row's ticker is a link to `/stock/[ticker]`
- Empty state shown when no stocks match filters

---

## Out of Scope

- Pagination (200 stocks fits comfortably in one load for MVP)
- Market cap column (not requested)
- Signal status column (not requested)
- Bulk actions
