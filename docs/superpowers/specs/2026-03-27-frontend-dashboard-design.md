# Phase 2: Frontend Dashboard Design
**Date:** 2026-03-27
**Scope:** Next.js frontend — Home Dashboard + Stock Detail page
**Approach:** shadcn/ui + Tailwind, Next.js API proxy routes, Server Components, placeholder charts

---

## Decisions & Constraints

- **shadcn/ui** as component foundation (Card, Badge, Table, Skeleton, etc.)
- **No real charts yet** — `ChartPlaceholder` components, wired up in Phase 3
- **No Yahoo Finance** — price data comes from Supabase `stocks.last_price` only
- **No polling/SWR** — Server Components fetch at request time; real-time is Phase 3
- **No auth** — all pages public, consistent with backend Phase 1
- **API proxy pattern** — Next.js `/api/*` routes forward to FastAPI at `BACKEND_URL`
- **Dark mode by default** — base `#121212`, cards `#1E1E1E`, brand cyan `#00B4FF`

---

## 1. Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                   ← Root layout: sidebar nav, dark theme, fonts
│   ├── page.tsx                     ← Home Dashboard (Server Component)
│   ├── error.tsx                    ← Global error boundary
│   ├── not-found.tsx                ← 404 page
│   ├── stock/[ticker]/
│   │   └── page.tsx                 ← Stock Detail page (Server Component)
│   └── api/
│       ├── signals/
│       │   └── route.ts             ← Proxy → GET /signals
│       ├── signals/[id]/
│       │   └── route.ts             ← Proxy → GET /signals/{id}
│       ├── stocks/
│       │   └── route.ts             ← Proxy → GET /stocks
│       ├── stocks/[ticker]/
│       │   └── route.ts             ← Proxy → GET /stocks/{ticker}
│       └── news/
│           └── route.ts             ← Proxy → GET /news
├── components/
│   ├── signals/
│   │   ├── SignalCard.tsx           ← Compact card: ticker, direction, confidence, move, horizon
│   │   └── SignalExpanded.tsx       ← Full detail panel: drivers, evidence, historical analog
│   ├── news/
│   │   ├── NewsFeed.tsx             ← List wrapper with empty/loading states
│   │   └── NewsItem.tsx             ← Single article row: headline, ticker badge, time ago
│   ├── charts/
│   │   └── ChartPlaceholder.tsx     ← Grey card with chart title + "Phase 3" label
│   ├── layout/
│   │   ├── Sidebar.tsx              ← Icon nav: Dashboard, Stocks, Signals links
│   │   └── TopBar.tsx               ← Logo, page title, optional search stub
│   └── ui/                          ← shadcn/ui auto-generated primitives
├── lib/
│   └── api.ts                       ← Typed fetch helpers calling /api/* routes
├── tailwind.config.ts               ← Design system color tokens
├── globals.css                      ← CSS variables, dark mode base styles
└── .env.local                       ← BACKEND_URL=http://localhost:8000
```

---

## 2. API Proxy Layer

**Environment variable:**
```
BACKEND_URL=http://localhost:8000
```

**Proxy route pattern** (all routes follow this shape):
```ts
// app/api/signals/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const res = await fetch(`${process.env.BACKEND_URL}/signals?${searchParams}`)
  return Response.json(await res.json(), { status: res.status })
}
```

Routes:
| Next.js Route | Forwards To |
|---|---|
| `GET /api/signals` | `GET /signals` (supports `direction`, `horizon`, `limit`, `offset`) |
| `GET /api/signals/[id]` | `GET /signals/{id}` |
| `GET /api/stocks` | `GET /stocks` (supports `sector`, `limit`, `offset`) |
| `GET /api/stocks/[ticker]` | `GET /stocks/{ticker}` |
| `GET /api/news` | `GET /news` (supports `ticker`, `event_type`, `limit`, `offset`) |

**`lib/api.ts`** typed helpers (called from Server Components):
```ts
getSignals(params?)     → Promise<PaginatedSignals>
getSignal(id: string)   → Promise<SignalResponse>
getStocks(params?)      → Promise<PaginatedStocks>
getStock(ticker: string)→ Promise<StockWithSignal>
getNews(params?)        → Promise<PaginatedNews>
```

All helpers call relative `/api/*` URLs (works in both dev and production).

---

## 3. Home Dashboard (`/`)

### Layout
Bento grid — three-column layout on desktop, stacks on mobile.

```
┌─────────────────────────────────────────────────────┐
│ SIDEBAR │  Top Opportunities          │ Crash Risks  │
│         │  [Signal Card #1] [#2] [#3] │ [PFE ↓ 76%] │
│  Nav    │  [Signal Card #4] [#5]      │ [MRK ↓ 75%] │
│  Links  ├─────────────────────────────┤ [CVX ↓ 75%] │
│         │  Breaking News Feed         ├──────────────┤
│         │  • NVDA: Record revenue...  │ Quick Stats  │
│         │  • AAPL: iPhone demand...   │ 17 signals   │
│         │  • BAC: Exec departure...   │ 42 articles  │
└─────────────────────────────────────────────────────┘
```

### Sections

**Top Opportunities** (main grid, left-center)
- Fetches `GET /api/signals?direction=bullish&limit=10`
- Renders `SignalCard` for each result in a responsive grid (2 cols → 1 col on mobile)
- Skeleton: 6 grey card placeholders while loading
- Empty: "No bullish signals available" message

**Crash Risk Alerts** (right column)
- Fetches `GET /api/signals?direction=crash_risk&limit=5`
- Compact list, red-tinted cards
- Skeleton: 3 narrow card placeholders
- Empty: "No crash risks detected" with a green checkmark

**Breaking News Feed** (bottom-left)
- Fetches `GET /api/news?limit=10`
- Renders `NewsItem` list
- Skeleton: 5 row placeholders
- Empty: "No recent news"

**Quick Stats** (bottom-right, below Crash Risks)
- Derived from signal/news totals returned in pagination metadata
- Shows: total signals count, total articles count, last updated timestamp
- Static — no additional fetch needed

---

## 4. Stock Detail Page (`/stock/[ticker]`)

### Data
- Fetches `GET /api/stocks/[ticker]` → stock + latest_signal
- Fetches `GET /api/news?ticker=[ticker]&limit=10` → related articles
- If stock not found → `notFound()` → 404 page
- If stock found but no signal → show "No signal available" banner, hide explanation panel

### Layout

```
┌──────────────────────────────────────────────────────┐
│ ← Back   TICKER  Company Name    $Price  Sector      │
├──────────────────────────────────────────────────────┤
│  Signal Summary Banner (full-width, direction-tinted) │
│  ↑ Bullish · 100% confidence · +5% to +10% · 5 days  │
│  Rank #3 · Opportunity: 1.0 · Crash Risk: 0.0         │
├─────────────────────────┬────────────────────────────┤
│  Price Chart            │  Key Drivers               │
│  [ChartPlaceholder]     │  • Driver 1                │
│                         │  • Driver 2                │
├─────────────────────────┤  Risk Flags                │
│  Sentiment Chart        │  • Flag 1                  │
│  [ChartPlaceholder]     ├────────────────────────────┤
├─────────────────────────┤  Evidence                  │
│  News Volume Chart      │  N articles · avg cred X%  │
│  [ChartPlaceholder]     │  Historical: +X% avg       │
│                         │  Hit rate: 64% (15 samples)│
├─────────────────────────┴────────────────────────────┤
│  Related Articles                                    │
│  • Headline · Ticker · Event type · Time ago         │
└──────────────────────────────────────────────────────┘
```

### Signal Summary Banner
- Background tint: green (`profit/10` opacity) for bullish, red (`loss/10`) for bearish/crash_risk, grey for no signal
- Displays: direction badge with icon, confidence %, expected move range, horizon, rank, opportunity_score, crash_risk_score
- All numeric values use `tabular-nums`

### Explanation Panel (right column)
- **Key Drivers**: bullet list from `signal.drivers` JSONB array
- **Risk Flags**: bullet list from `signal.risk_flags` array; hidden if empty
- **Evidence**: article count + avg credibility from `signal.evidence` JSONB
- **Historical Analog**: avg_move %, hit_rate %, sample_size from `signal.historical_analog` JSONB

### Charts (left column)
Three `ChartPlaceholder` components:
- "Price Chart" — with note "Live data in Phase 3"
- "Sentiment Trend" — with note "Live data in Phase 3"
- "News Volume" — with note "Live data in Phase 3"

### Related Articles
- `NewsItem` list from `/api/news?ticker=[ticker]`
- Empty state: "No articles found for [TICKER]"

---

## 5. Design Tokens (Tailwind Config)

```ts
colors: {
  anchor: '#0A2540',
  brand: {
    cyan: '#00B4FF',
    mid: '#1A6BCC',
    bright: '#00D4FF',
  },
  surface: {
    base: '#121212',
    card: '#1E1E1E',
    elevated: '#2A2A2A',
  },
  profit: { DEFAULT: '#4CAF50', light: '#198754' },
  loss: { DEFAULT: '#F44336', light: '#DC3545' },
  warning: { DEFAULT: '#FFB300', light: '#FFC107' },
  info: { DEFAULT: '#03A9F4', light: '#0DCAF0' },
}
```

Base CSS: `background: #121212`, `color: #E0E0E0`, `font-family: Inter`.

---

## 6. SignalCard Component

Compact card used in the dashboard grid:

| Field | Display |
|---|---|
| Rank | `#N` badge top-left |
| Ticker | Large monospace, links to `/stock/[ticker]` |
| Company name | Subtitle, truncated |
| Direction | Badge: `↑ Bullish` (green) / `↓ Bearish` (red) / `⚠ Crash Risk` (red) |
| Confidence | Percentage + thin progress bar |
| Expected move | `+5% to +10%` |
| Horizon | `5 days` |

Card: `bg-surface-card`, `rounded-xl`, `border border-white/8`, hover → slight brightness lift.

---

## 7. Error & Loading States

Every data section must implement:
- **Loading**: shadcn `Skeleton` components matching the shape of real content
- **Empty**: descriptive message + icon, no raw "No data" strings
- **Error**: `error.tsx` boundary catches fetch failures, shows "Failed to load data. Try refreshing."
- **404**: `not-found.tsx` for unknown tickers

---

## 8. Out of Scope (Phase 3+)

- Real price charts (Yahoo Finance / Recharts)
- SWR polling / real-time updates
- Alert banners / notifications
- Sector heatmap
- Search functionality
- Authentication
