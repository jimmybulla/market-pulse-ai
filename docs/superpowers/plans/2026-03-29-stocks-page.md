# Stocks Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/stocks` page showing all tracked stocks in a searchable, filterable, sortable table where each ticker links to `/stock/[ticker]`.

**Architecture:** The server fetches all stocks once with `getStocks({ limit: 200 })` and passes the full array to a `'use client'` `StocksTable` component. Search (ticker/name), sector filter, and column sort are all applied client-side in JS with no additional network requests — identical to the `SignalList` and `NewsFeed` patterns already in the codebase.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS, Jest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/components/stocks/StocksTable.tsx` | Create | `'use client'` — owns filter/sort state, renders table |
| `frontend/components/stocks/__tests__/StocksTable.test.tsx` | Create | 7 unit tests |
| `frontend/app/stocks/page.tsx` | Create | Async server component — fetches stocks, renders `<StocksTable>` |

No backend changes. No type changes (`StockResponse` and `getStocks` already exist).

---

### Task 1: StocksTable component

**Files:**
- Create: `frontend/components/stocks/StocksTable.tsx`
- Create: `frontend/components/stocks/__tests__/StocksTable.test.tsx`

- [ ] **Step 1: Create the test file with a `makeStock` factory and 7 failing tests**

```tsx
// frontend/components/stocks/__tests__/StocksTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import StocksTable from '../StocksTable'
import type { StockResponse } from '@/lib/types'

const makeStock = (overrides: Partial<StockResponse> = {}): StockResponse => ({
  id: 'stock-1',
  ticker: 'AAPL',
  name: 'Apple Inc.',
  sector: 'Technology',
  market_cap: 3000000000000,
  last_price: 175.00,
  updated_at: '2026-03-29T00:00:00Z',
  ...overrides,
})

describe('StocksTable', () => {
  it('renders all stocks when no filters active', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', name: 'Apple Inc.' }),
      makeStock({ id: 'stock-2', ticker: 'MSFT', name: 'Microsoft Corp.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
  })

  it('search by ticker hides non-matching rows', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', name: 'Apple Inc.' }),
      makeStock({ id: 'stock-2', ticker: 'MSFT', name: 'Microsoft Corp.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'AAPL' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
  })

  it('search by name hides non-matching rows', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', name: 'Apple Inc.' }),
      makeStock({ id: 'stock-2', ticker: 'MSFT', name: 'Microsoft Corp.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Apple' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
  })

  it('sector filter hides non-matching rows', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', sector: 'Technology' }),
      makeStock({ id: 'stock-2', ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' }),
    ]
    render(<StocksTable stocks={stocks} />)
    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: 'Technology' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('JPM')).not.toBeInTheDocument()
  })

  it('clicking ticker column header sorts ascending by default then descending on second click', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'MSFT', name: 'Microsoft Corp.' }),
      makeStock({ id: 'stock-2', ticker: 'AAPL', name: 'Apple Inc.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    // Default sort is asc by ticker — AAPL < MSFT
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('AAPL')
    expect(rows[2]).toHaveTextContent('MSFT')
    // Click ticker header to toggle to desc
    fireEvent.click(screen.getByRole('columnheader', { name: /Ticker/ }))
    const rowsDesc = screen.getAllByRole('row')
    expect(rowsDesc[1]).toHaveTextContent('MSFT')
    expect(rowsDesc[2]).toHaveTextContent('AAPL')
  })

  it('each row ticker is a link to /stock/[ticker]', () => {
    render(<StocksTable stocks={[makeStock({ ticker: 'AAPL' })]} />)
    const link = screen.getByRole('link', { name: 'AAPL' })
    expect(link).toHaveAttribute('href', '/stock/AAPL')
  })

  it('shows empty state when no stocks match filters', () => {
    render(<StocksTable stocks={[makeStock({ ticker: 'AAPL', name: 'Apple Inc.' })]} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ZZZZ' } })
    expect(screen.getByText('No stocks found')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
cd frontend && npx jest components/stocks/__tests__/StocksTable.test.tsx --no-coverage
```

Expected: 7 failures — `Cannot find module '../StocksTable'`

- [ ] **Step 3: Create `StocksTable.tsx`**

```tsx
// frontend/components/stocks/StocksTable.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { StockResponse } from '@/lib/types'

type SortKey = 'ticker' | 'name' | 'sector' | 'last_price'

export default function StocksTable({ stocks }: { stocks: StockResponse[] }) {
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ticker')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sectorOptions = Array.from(
    new Set(stocks.map((s) => s.sector).filter(Boolean))
  ).sort() as string[]

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function indicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const filtered = stocks
    .filter(
      (s) =>
        s.ticker.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((s) => !sector || s.sector === sector)

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal === null) return 1
    if (bVal === null) return -1
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3">
        <input
          aria-label="Search"
          placeholder="Search ticker or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20 w-64"
        />
        <select
          aria-label="Sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Sectors</option>
          {sectorOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-600">No stocks found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-gray-500">
                <th
                  className="pb-3 pr-6 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('ticker')}
                >
                  Ticker{indicator('ticker')}
                </th>
                <th
                  className="pb-3 pr-6 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('name')}
                >
                  Name{indicator('name')}
                </th>
                <th
                  className="pb-3 pr-6 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('sector')}
                >
                  Sector{indicator('sector')}
                </th>
                <th
                  className="pb-3 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('last_price')}
                >
                  Last Price{indicator('last_price')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock) => (
                <tr key={stock.id} className="border-b border-white/4 hover:bg-white/2">
                  <td className="py-3 pr-6">
                    <Link
                      href={`/stock/${stock.ticker}`}
                      className="font-mono font-bold text-cyan-400 hover:text-cyan-300"
                    >
                      {stock.ticker}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-gray-300">{stock.name}</td>
                  <td className="py-3 pr-6 text-gray-400">{stock.sector ?? '—'}</td>
                  <td className="py-3 text-gray-300">
                    {stock.last_price !== null ? `$${stock.last_price.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all 7 pass**

```bash
cd frontend && npx jest components/stocks/__tests__/StocksTable.test.tsx --no-coverage
```

Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
cd frontend && git add components/stocks/StocksTable.tsx components/stocks/__tests__/StocksTable.test.tsx
git commit -m "feat: add StocksTable component with search, sector filter, and sort"
```

---

### Task 2: Stocks page

**Files:**
- Create: `frontend/app/stocks/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// frontend/app/stocks/page.tsx
import { getStocks } from '@/lib/api'
import StocksTable from '@/components/stocks/StocksTable'
import TopBar from '@/components/layout/TopBar'

export default async function StocksPage() {
  const { data } = await getStocks({ limit: 200 })
  return (
    <div>
      <TopBar title="Stocks" subtitle="All tracked stocks" />
      <div className="p-6">
        <StocksTable stocks={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
cd frontend && npx jest --no-coverage
```

Expected: all tests passing (previously 82, now 89)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/stocks/page.tsx
git commit -m "feat: add /stocks page"
```
