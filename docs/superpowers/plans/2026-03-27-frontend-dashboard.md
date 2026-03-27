# Frontend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js frontend dashboard (Home + Stock Detail pages) consuming the live FastAPI backend via proxy routes, styled with the Market Pulse AI dark design system.

**Architecture:** Next.js 15 App Router with Server Components fetching data from `BACKEND_URL` directly via `lib/api.ts`. Five Next.js API proxy routes handle any future client-side requests. Visual leaf components use `'use client'` for testability. shadcn/ui provides Card, Badge, Skeleton, Progress primitives.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v3, shadcn/ui, Jest + React Testing Library, Inter + IBM Plex Mono (next/font/google)

---

## File Map

| File | Responsibility |
|---|---|
| `frontend/lib/types.ts` | TypeScript interfaces matching backend Pydantic models |
| `frontend/lib/api.ts` | Typed fetch helpers calling `BACKEND_URL` directly |
| `frontend/app/api/signals/route.ts` | Proxy → `GET /signals` |
| `frontend/app/api/signals/[id]/route.ts` | Proxy → `GET /signals/{id}` |
| `frontend/app/api/stocks/route.ts` | Proxy → `GET /stocks` |
| `frontend/app/api/stocks/[ticker]/route.ts` | Proxy → `GET /stocks/{ticker}` |
| `frontend/app/api/news/route.ts` | Proxy → `GET /news` |
| `frontend/app/layout.tsx` | Root layout: dark theme, fonts, Sidebar |
| `frontend/app/page.tsx` | Home Dashboard Server Component |
| `frontend/app/stock/[ticker]/page.tsx` | Stock Detail Server Component |
| `frontend/app/error.tsx` | Global error boundary (client) |
| `frontend/app/not-found.tsx` | 404 page |
| `frontend/components/layout/Sidebar.tsx` | Left nav with brand logo + links |
| `frontend/components/layout/TopBar.tsx` | Page title bar |
| `frontend/components/signals/SignalCard.tsx` | Compact signal card for dashboard grid |
| `frontend/components/signals/SignalExpanded.tsx` | Full detail: drivers, evidence, historical |
| `frontend/components/news/NewsFeed.tsx` | Article list with empty/loading states |
| `frontend/components/news/NewsItem.tsx` | Single article row |
| `frontend/components/charts/ChartPlaceholder.tsx` | Grey placeholder card |
| `frontend/tailwind.config.ts` | Design system color tokens |
| `frontend/app/globals.css` | Dark base styles, CSS vars |
| `frontend/jest.config.ts` | Jest + next/jest config |
| `frontend/jest.setup.ts` | @testing-library/jest-dom setup |

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `frontend/` (entire project)
- Create: `frontend/.env.local`
- Create: `frontend/jest.config.ts`
- Create: `frontend/jest.setup.ts`

- [ ] **Step 1: Scaffold the project**

Run from the repo root (`Market Pulse AI/`):
```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

- [ ] **Step 2: Install test dependencies**

```bash
cd frontend
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest
```

- [ ] **Step 3: Create jest.config.ts**

```ts
// frontend/jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 4: Create jest.setup.ts**

```ts
// frontend/jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create .env.local**

```bash
# frontend/.env.local
BACKEND_URL=http://localhost:8000
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```
Expected: Build completes with no errors. Ignore ESLint warnings on generated files.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffold Next.js frontend project"
```

---

## Task 2: Tailwind design tokens + globals.css + fonts

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Replace tailwind.config.ts**

```ts
// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
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
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Replace globals.css**

```css
/* frontend/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 7%;
    --foreground: 0 0% 88%;
    --card: 0 0% 12%;
    --card-foreground: 0 0% 88%;
    --border: 0 0% 100% / 0.08;
    --radius: 0.75rem;
  }

  * {
    border-color: rgba(255, 255, 255, 0.08);
  }

  html {
    @apply dark;
  }

  body {
    @apply bg-surface-base text-gray-200 font-sans;
    font-variant-numeric: tabular-nums;
  }

  /* Monospace for all numeric data cells */
  .numeric {
    @apply font-mono;
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 3: Verify Tailwind tokens compile**

```bash
cd frontend && npm run build
```
Expected: Build succeeds, no CSS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.ts frontend/app/globals.css
git commit -m "feat: configure design system tokens and dark base styles"
```

---

## Task 3: shadcn/ui init + install components

**Files:**
- Create: `frontend/components/ui/` (auto-generated by shadcn CLI)
- Create: `frontend/components.json`
- Create: `frontend/lib/utils.ts`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd frontend
npx shadcn@latest init \
  --defaults \
  --yes
```

When prompted:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

- [ ] **Step 2: Install required components**

```bash
npx shadcn@latest add card badge skeleton progress separator
```

- [ ] **Step 3: Verify components exist**

```bash
ls components/ui/
```
Expected: `card.tsx  badge.tsx  skeleton.tsx  progress.tsx  separator.tsx` all present.

- [ ] **Step 4: Commit**

```bash
git add components.json lib/utils.ts components/ui/
git commit -m "feat: init shadcn/ui with card, badge, skeleton, progress"
```

---

## Task 4: TypeScript types

**Files:**
- Create: `frontend/lib/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// frontend/lib/types.ts

export interface SignalEvidence {
  sources: string[]
  article_ids: string[]
  article_count: number
  avg_credibility: number
}

export interface SignalHistoricalAnalog {
  avg_move: number
  hit_rate: number
  sample_size: number
}

export type SignalDirection = 'bullish' | 'bearish' | 'crash_risk'

export interface SignalResponse {
  id: string
  stock_id: string
  ticker: string
  stock_name: string
  sector: string | null
  last_price: number | null
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

export interface PaginatedSignals {
  data: SignalResponse[]
  total: number
  limit: number
  offset: number
}

export interface StockResponse {
  id: string
  ticker: string
  name: string
  sector: string | null
  market_cap: number | null
  last_price: number | null
  updated_at: string
}

export interface StockWithSignal extends StockResponse {
  latest_signal: SignalResponse | null
}

export interface PaginatedStocks {
  data: StockResponse[]
  total: number
  limit: number
  offset: number
}

export interface NewsArticleResponse {
  id: string
  source_id: string | null
  headline: string
  body: string | null
  url: string | null
  published_at: string | null
  fetched_at: string
  tickers: string[]
  sentiment_score: number | null
  event_type: string | null
  novelty_score: number
  credibility_score: number
  severity: number
}

export interface PaginatedNews {
  data: NewsArticleResponse[]
  total: number
  limit: number
  offset: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat: add TypeScript types matching backend Pydantic models"
```

---

## Task 5: API proxy routes

**Files:**
- Create: `frontend/app/api/signals/route.ts`
- Create: `frontend/app/api/signals/[id]/route.ts`
- Create: `frontend/app/api/stocks/route.ts`
- Create: `frontend/app/api/stocks/[ticker]/route.ts`
- Create: `frontend/app/api/news/route.ts`

All routes are thin proxies. They forward query params to the backend and return the response unchanged. They exist for future client-side usage.

- [ ] **Step 1: Create signals list proxy**

```ts
// frontend/app/api/signals/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const res = await fetch(
    `${process.env.BACKEND_URL}/signals?${searchParams}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
```

- [ ] **Step 2: Create signal detail proxy**

```ts
// frontend/app/api/signals/[id]/route.ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const res = await fetch(
    `${process.env.BACKEND_URL}/signals/${id}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
```

- [ ] **Step 3: Create stocks list proxy**

```ts
// frontend/app/api/stocks/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const res = await fetch(
    `${process.env.BACKEND_URL}/stocks?${searchParams}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
```

- [ ] **Step 4: Create stock detail proxy**

```ts
// frontend/app/api/stocks/[ticker]/route.ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const res = await fetch(
    `${process.env.BACKEND_URL}/stocks/${ticker.toUpperCase()}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
```

- [ ] **Step 5: Create news proxy**

```ts
// frontend/app/api/news/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const res = await fetch(
    `${process.env.BACKEND_URL}/news?${searchParams}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
```

- [ ] **Step 6: Verify build**

```bash
cd frontend && npm run build
```
Expected: All 5 API routes compile cleanly.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/api/
git commit -m "feat: add Next.js API proxy routes for all backend endpoints"
```

---

## Task 6: lib/api.ts helpers + tests

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/__tests__/api.test.ts`

`lib/api.ts` calls `BACKEND_URL` directly (server-side only — called from Server Components).

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/lib/__tests__/api.test.ts
import { getSignals, getStock, getNews } from '../api'

const mockSignalsResponse = {
  data: [{ id: '1', ticker: 'AAPL', direction: 'bullish', rank: 1 }],
  total: 1, limit: 10, offset: 0,
}

const mockStockResponse = {
  id: '1', ticker: 'NVDA', name: 'NVIDIA Corporation',
  sector: 'Technology', market_cap: 2800000000000, last_price: 875.5,
  updated_at: '2026-03-27T00:00:00Z', latest_signal: null,
}

const mockNewsResponse = {
  data: [{ id: '1', headline: 'NVDA earnings beat', tickers: ['NVDA'] }],
  total: 1, limit: 10, offset: 0,
}

beforeEach(() => {
  process.env.BACKEND_URL = 'http://localhost:8000'
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('getSignals', () => {
  it('fetches signals with no params', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSignalsResponse,
    })

    const result = await getSignals()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/signals',
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('fetches signals with direction filter', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSignalsResponse,
    })

    await getSignals({ direction: 'bullish', limit: 5 })

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('direction=bullish')
    expect(calledUrl).toContain('limit=5')
  })

  it('throws on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    await expect(getSignals()).rejects.toThrow('Failed to fetch signals')
  })
})

describe('getStock', () => {
  it('fetches a single stock by ticker', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStockResponse,
    })

    const result = await getStock('nvda')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/stocks/NVDA',
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(result.ticker).toBe('NVDA')
  })

  it('throws on 404', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    })

    await expect(getStock('FAKE')).rejects.toThrow('Failed to fetch stock')
  })
})

describe('getNews', () => {
  it('fetches news with ticker filter', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNewsResponse,
    })

    await getNews({ ticker: 'NVDA' })

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('ticker=NVDA')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx jest lib/__tests__/api.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../api'`

- [ ] **Step 3: Implement lib/api.ts**

```ts
// frontend/lib/api.ts
import type {
  PaginatedSignals, SignalResponse,
  PaginatedStocks, StockWithSignal,
  PaginatedNews, SignalDirection,
} from './types'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000'

export interface SignalParams {
  direction?: SignalDirection
  horizon?: number
  limit?: number
  offset?: number
}

export interface StockParams {
  sector?: string
  limit?: number
  offset?: number
}

export interface NewsParams {
  ticker?: string
  event_type?: string
  limit?: number
  offset?: number
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${BACKEND}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })
  }
  return url.toString()
}

export async function getSignals(params?: SignalParams): Promise<PaginatedSignals> {
  const url = buildUrl('/signals', params as Record<string, string | number | undefined>)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch signals: ${res.status}`)
  return res.json()
}

export async function getSignal(id: string): Promise<SignalResponse> {
  const res = await fetch(`${BACKEND}/signals/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch signal: ${res.status}`)
  return res.json()
}

export async function getStocks(params?: StockParams): Promise<PaginatedStocks> {
  const url = buildUrl('/stocks', params as Record<string, string | number | undefined>)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch stocks: ${res.status}`)
  return res.json()
}

export async function getStock(ticker: string): Promise<StockWithSignal> {
  const res = await fetch(`${BACKEND}/stocks/${ticker.toUpperCase()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch stock: ${res.status}`)
  return res.json()
}

export async function getNews(params?: NewsParams): Promise<PaginatedNews> {
  const url = buildUrl('/news', params as Record<string, string | number | undefined>)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch news: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest lib/__tests__/api.test.ts --no-coverage
```
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/__tests__/
git commit -m "feat: add typed API helpers with tests"
```

---

## Task 7: Root layout + Sidebar + TopBar

**Files:**
- Create: `frontend/components/layout/Sidebar.tsx`
- Create: `frontend/components/layout/TopBar.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create Sidebar**

```tsx
// frontend/components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, TrendingUp, Newspaper, LayoutDashboard } from 'lucide-react'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: TrendingUp },
  { href: '/stocks', label: 'Stocks', icon: BarChart3 },
  { href: '/news', label: 'News', icon: Newspaper },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-surface-card border-r border-white/8 fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/8">
        <div className="w-8 h-8 rounded-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1A6BCC 50%, #00D4FF 100%)' }}
        />
        <span className="hidden lg:block font-bold text-sm text-white">
          Market Pulse{' '}
          <span style={{
            background: 'linear-gradient(90deg, #1A6BCC, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>AI</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-elevated'
                }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Install lucide-react**

```bash
cd frontend && npm install lucide-react
```

- [ ] **Step 3: Create TopBar**

```tsx
// frontend/components/layout/TopBar.tsx
interface TopBarProps {
  title: string
  subtitle?: string
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/8 bg-surface-card/50 backdrop-blur-sm">
      <div>
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Replace app/layout.tsx**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from 'next'
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Market Pulse AI',
  description: 'AI-powered stock market intelligence and prediction engine',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${ibmPlexMono.variable} font-sans bg-surface-base`}>
        <Sidebar />
        <main className="ml-16 lg:ml-56 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```
Expected: Build succeeds, no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/layout/ frontend/app/layout.tsx
git commit -m "feat: add Sidebar, TopBar, and root layout with fonts"
```

---

## Task 8: ChartPlaceholder component + test

**Files:**
- Create: `frontend/components/charts/ChartPlaceholder.tsx`
- Create: `frontend/components/charts/__tests__/ChartPlaceholder.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/charts/__tests__/ChartPlaceholder.test.tsx
import { render, screen } from '@testing-library/react'
import ChartPlaceholder from '../ChartPlaceholder'

describe('ChartPlaceholder', () => {
  it('renders the chart title', () => {
    render(<ChartPlaceholder title="Price Chart" />)
    expect(screen.getByText('Price Chart')).toBeInTheDocument()
  })

  it('renders the phase note', () => {
    render(<ChartPlaceholder title="Sentiment Trend" />)
    expect(screen.getByText('Live data in Phase 3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && npx jest components/charts/__tests__/ChartPlaceholder.test.tsx --no-coverage
```
Expected: FAIL — `Cannot find module '../ChartPlaceholder'`

- [ ] **Step 3: Implement ChartPlaceholder**

```tsx
// frontend/components/charts/ChartPlaceholder.tsx
'use client'

import { BarChart2 } from 'lucide-react'

interface ChartPlaceholderProps {
  title: string
  height?: string
}

export default function ChartPlaceholder({ title, height = 'h-48' }: ChartPlaceholderProps) {
  return (
    <div className={`${height} rounded-xl bg-surface-card border border-white/8 flex flex-col items-center justify-center gap-2`}>
      <BarChart2 className="w-8 h-8 text-gray-600" />
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="text-xs text-gray-600">Live data in Phase 3</p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest components/charts/__tests__/ChartPlaceholder.test.tsx --no-coverage
```
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/charts/
git commit -m "feat: add ChartPlaceholder component"
```

---

## Task 9: SignalCard component + tests

**Files:**
- Create: `frontend/components/signals/SignalCard.tsx`
- Create: `frontend/components/signals/__tests__/SignalCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/components/signals/__tests__/SignalCard.test.tsx
import { render, screen } from '@testing-library/react'
import SignalCard from '../SignalCard'
import type { SignalResponse } from '@/lib/types'

const bullishSignal: SignalResponse = {
  id: '1',
  stock_id: 'abc',
  ticker: 'NVDA',
  stock_name: 'NVIDIA Corporation',
  sector: 'Technology',
  last_price: 875.5,
  direction: 'bullish',
  confidence: 0.85,
  expected_move_low: 0.05,
  expected_move_high: 0.10,
  horizon_days: 5,
  opportunity_score: 0.85,
  crash_risk_score: 0.05,
  rank: 3,
  explanation: 'AI analysis pending',
  drivers: ['Strong earnings'],
  evidence: { sources: ['Bloomberg'], article_ids: ['x'], article_count: 1, avg_credibility: 0.92 },
  historical_analog: { avg_move: 0.075, hit_rate: 0.64, sample_size: 15 },
  risk_flags: [],
  created_at: '2026-03-27T00:00:00Z',
  expires_at: null,
}

const crashSignal: SignalResponse = {
  ...bullishSignal,
  id: '2',
  ticker: 'PFE',
  stock_name: 'Pfizer Inc.',
  direction: 'crash_risk',
  confidence: 0.76,
  rank: 11,
}

describe('SignalCard', () => {
  it('renders ticker and company name', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('NVIDIA Corporation')).toBeInTheDocument()
  })

  it('renders rank badge', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('renders bullish direction with up arrow', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('↑ Bullish')).toBeInTheDocument()
  })

  it('renders crash risk direction with warning icon', () => {
    render(<SignalCard signal={crashSignal} />)
    expect(screen.getByText('⚠ Crash Risk')).toBeInTheDocument()
  })

  it('renders confidence percentage', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('renders expected move range', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('+5.0% to +10.0%')).toBeInTheDocument()
  })

  it('renders horizon', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('5 days')).toBeInTheDocument()
  })

  it('links to stock detail page', () => {
    render(<SignalCard signal={bullishSignal} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/stock/NVDA')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest components/signals/__tests__/SignalCard.test.tsx --no-coverage
```
Expected: FAIL — `Cannot find module '../SignalCard'`

- [ ] **Step 3: Implement SignalCard**

```tsx
// frontend/components/signals/SignalCard.tsx
'use client'

import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return '↑ Bullish'
  if (direction === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function directionColor(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

function cardAccent(direction: SignalDirection): string {
  if (direction === 'bullish') return 'border-l-2 border-l-profit'
  return 'border-l-2 border-l-loss'
}

interface SignalCardProps {
  signal: SignalResponse
}

export default function SignalCard({ signal }: SignalCardProps) {
  const {
    ticker, stock_name, direction, confidence,
    expected_move_low, expected_move_high, horizon_days, rank,
  } = signal

  return (
    <Link href={`/stock/${ticker}`} className="block">
      <div className={`bg-surface-card rounded-xl border border-white/8 p-4 hover:brightness-110 transition-all ${cardAccent(direction)}`}>
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs text-gray-500 font-mono">#{rank}</span>
            <p className="font-mono font-bold text-lg text-white leading-tight">{ticker}</p>
            <p className="text-xs text-gray-400 truncate max-w-[140px]">{stock_name}</p>
          </div>
          <Badge className={`text-xs ${directionColor(direction)}`}>
            {directionLabel(direction)}
          </Badge>
        </div>

        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Confidence</span>
            <span className="font-mono text-gray-200">{Math.round(confidence * 100)}%</span>
          </div>
          <Progress value={confidence * 100} className="h-1" />
        </div>

        {/* Move + Horizon */}
        <div className="flex justify-between text-xs text-gray-400">
          <span className="font-mono">
            +{(expected_move_low * 100).toFixed(1)}% to +{(expected_move_high * 100).toFixed(1)}%
          </span>
          <span>{horizon_days} days</span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest components/signals/__tests__/SignalCard.test.tsx --no-coverage
```
Expected: PASS — 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/signals/
git commit -m "feat: add SignalCard component with tests"
```

---

## Task 10: NewsFeed + NewsItem components + tests

**Files:**
- Create: `frontend/components/news/NewsItem.tsx`
- Create: `frontend/components/news/NewsFeed.tsx`
- Create: `frontend/components/news/__tests__/NewsItem.test.tsx`
- Create: `frontend/components/news/__tests__/NewsFeed.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/components/news/__tests__/NewsItem.test.tsx
import { render, screen } from '@testing-library/react'
import NewsItem from '../NewsItem'
import type { NewsArticleResponse } from '@/lib/types'

const article: NewsArticleResponse = {
  id: '1',
  source_id: null,
  headline: 'NVIDIA reports record data center revenue',
  body: null,
  url: 'https://reuters.com/nvda-q4',
  published_at: '2026-03-26T15:00:00Z',
  fetched_at: '2026-03-26T16:00:00Z',
  tickers: ['NVDA'],
  sentiment_score: 0.88,
  event_type: 'earnings',
  novelty_score: 0.92,
  credibility_score: 0.92,
  severity: 0.85,
}

describe('NewsItem', () => {
  it('renders the headline', () => {
    render(<NewsItem article={article} />)
    expect(screen.getByText('NVIDIA reports record data center revenue')).toBeInTheDocument()
  })

  it('renders ticker badges', () => {
    render(<NewsItem article={article} />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })

  it('renders event type badge', () => {
    render(<NewsItem article={article} />)
    expect(screen.getByText('earnings')).toBeInTheDocument()
  })

  it('wraps with a link when url is present', () => {
    render(<NewsItem article={article} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://reuters.com/nvda-q4')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
```

```tsx
// frontend/components/news/__tests__/NewsFeed.test.tsx
import { render, screen } from '@testing-library/react'
import NewsFeed from '../NewsFeed'
import type { NewsArticleResponse } from '@/lib/types'

const articles: NewsArticleResponse[] = [
  {
    id: '1', source_id: null,
    headline: 'First article', body: null, url: null,
    published_at: '2026-03-26T15:00:00Z', fetched_at: '2026-03-26T16:00:00Z',
    tickers: ['AAPL'], sentiment_score: 0.5, event_type: 'earnings',
    novelty_score: 0.8, credibility_score: 0.9, severity: 0.5,
  },
  {
    id: '2', source_id: null,
    headline: 'Second article', body: null, url: null,
    published_at: '2026-03-26T14:00:00Z', fetched_at: '2026-03-26T15:00:00Z',
    tickers: ['MSFT'], sentiment_score: 0.6, event_type: 'product',
    novelty_score: 0.7, credibility_score: 0.85, severity: 0.4,
  },
]

describe('NewsFeed', () => {
  it('renders all articles', () => {
    render(<NewsFeed articles={articles} />)
    expect(screen.getByText('First article')).toBeInTheDocument()
    expect(screen.getByText('Second article')).toBeInTheDocument()
  })

  it('shows empty state when no articles', () => {
    render(<NewsFeed articles={[]} />)
    expect(screen.getByText('No recent news')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest components/news/__tests__/ --no-coverage
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement NewsItem**

```tsx
// frontend/components/news/NewsItem.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import type { NewsArticleResponse } from '@/lib/types'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Unknown time'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const eventTypeColors: Record<string, string> = {
  earnings: 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20',
  regulation: 'bg-warning/10 text-warning border-warning/20',
  'M&A': 'bg-info/10 text-info border-info/20',
  product: 'bg-profit/10 text-profit border-profit/20',
  executive: 'bg-loss/10 text-loss border-loss/20',
  macro: 'bg-surface-elevated text-gray-400 border-white/8',
}

interface NewsItemProps {
  article: NewsArticleResponse
}

export default function NewsItem({ article }: NewsItemProps) {
  const { headline, url, published_at, tickers, event_type } = article

  const content = (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-surface-elevated transition-colors rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 leading-snug line-clamp-2">{headline}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {tickers.map((t) => (
            <Badge key={t} className="text-xs bg-anchor/60 text-brand-cyan border-brand-cyan/20">
              {t}
            </Badge>
          ))}
          {event_type && (
            <Badge className={`text-xs ${eventTypeColors[event_type] || 'bg-surface-elevated text-gray-400'}`}>
              {event_type}
            </Badge>
          )}
          <span className="text-xs text-gray-600">{timeAgo(published_at)}</span>
        </div>
      </div>
    </div>
  )

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    )
  }
  return content
}
```

- [ ] **Step 4: Implement NewsFeed**

```tsx
// frontend/components/news/NewsFeed.tsx
'use client'

import { Newspaper } from 'lucide-react'
import NewsItem from './NewsItem'
import type { NewsArticleResponse } from '@/lib/types'

interface NewsFeedProps {
  articles: NewsArticleResponse[]
}

export default function NewsFeed({ articles }: NewsFeedProps) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2">
        <Newspaper className="w-8 h-8" />
        <p className="text-sm">No recent news</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-white/5">
      {articles.map((article) => (
        <NewsItem key={article.id} article={article} />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest components/news/__tests__/ --no-coverage
```
Expected: PASS — 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/news/
git commit -m "feat: add NewsFeed and NewsItem components with tests"
```

---

## Task 11: SignalExpanded component + tests

**Files:**
- Create: `frontend/components/signals/SignalExpanded.tsx`
- Create: `frontend/components/signals/__tests__/SignalExpanded.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/components/signals/__tests__/SignalExpanded.test.tsx
import { render, screen } from '@testing-library/react'
import SignalExpanded from '../SignalExpanded'
import type { SignalResponse } from '@/lib/types'

const signal: SignalResponse = {
  id: '1', stock_id: 'x', ticker: 'NVDA', stock_name: 'NVIDIA',
  sector: 'Technology', last_price: 875.5,
  direction: 'bullish', confidence: 1.0,
  expected_move_low: 0.05, expected_move_high: 0.10,
  horizon_days: 5, opportunity_score: 1.0, crash_risk_score: 0.0,
  rank: 3, explanation: 'AI analysis pending',
  drivers: ['Strong earnings sentiment', 'Strong product momentum'],
  evidence: { sources: ['Bloomberg'], article_ids: ['x'], article_count: 2, avg_credibility: 0.94 },
  historical_analog: { avg_move: 0.075, hit_rate: 0.64, sample_size: 15 },
  risk_flags: ['Overextended rally'],
  created_at: '2026-03-27T00:00:00Z', expires_at: null,
}

const signalNoFlags: SignalResponse = {
  ...signal,
  risk_flags: [],
}

describe('SignalExpanded', () => {
  it('renders key drivers', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('Strong earnings sentiment')).toBeInTheDocument()
    expect(screen.getByText('Strong product momentum')).toBeInTheDocument()
  })

  it('renders evidence stats', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('2 articles')).toBeInTheDocument()
    expect(screen.getByText('94% avg credibility')).toBeInTheDocument()
  })

  it('renders historical analog', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('+7.5% avg move')).toBeInTheDocument()
    expect(screen.getByText('64% hit rate')).toBeInTheDocument()
  })

  it('renders risk flags when present', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('Overextended rally')).toBeInTheDocument()
  })

  it('hides risk flags section when empty', () => {
    render(<SignalExpanded signal={signalNoFlags} />)
    expect(screen.queryByText('Risk Flags')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest components/signals/__tests__/SignalExpanded.test.tsx --no-coverage
```
Expected: FAIL — `Cannot find module '../SignalExpanded'`

- [ ] **Step 3: Implement SignalExpanded**

```tsx
// frontend/components/signals/SignalExpanded.tsx
'use client'

import { Separator } from '@/components/ui/separator'
import type { SignalResponse } from '@/lib/types'

interface SignalExpandedProps {
  signal: SignalResponse
}

export default function SignalExpanded({ signal }: SignalExpandedProps) {
  const { drivers, risk_flags, evidence, historical_analog } = signal

  return (
    <div className="space-y-5">
      {/* Key Drivers */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Key Drivers
        </h3>
        <ul className="space-y-1.5">
          {drivers.map((driver, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-brand-cyan mt-0.5">•</span>
              {driver}
            </li>
          ))}
        </ul>
      </div>

      {/* Risk Flags */}
      {risk_flags.length > 0 && (
        <>
          <Separator className="bg-white/8" />
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Risk Flags
            </h3>
            <ul className="space-y-1.5">
              {risk_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-warning">
                  <span className="mt-0.5">⚠</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Separator className="bg-white/8" />

      {/* Evidence */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Evidence
        </h3>
        <div className="space-y-1 text-sm text-gray-300">
          <p>{evidence.article_count} articles</p>
          <p>{Math.round(evidence.avg_credibility * 100)}% avg credibility</p>
          <p className="text-xs text-gray-500">
            Sources: {evidence.sources.join(', ')}
          </p>
        </div>
      </div>

      <Separator className="bg-white/8" />

      {/* Historical Analog */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Historical Analog
        </h3>
        <div className="space-y-1 text-sm text-gray-300">
          <p>+{(historical_analog.avg_move * 100).toFixed(1)}% avg move</p>
          <p>{Math.round(historical_analog.hit_rate * 100)}% hit rate</p>
          <p className="text-xs text-gray-500">
            {historical_analog.sample_size} historical samples
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest components/signals/__tests__/SignalExpanded.test.tsx --no-coverage
```
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/signals/SignalExpanded.tsx frontend/components/signals/__tests__/SignalExpanded.test.tsx
git commit -m "feat: add SignalExpanded component with tests"
```

---

## Task 12: Home Dashboard page

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```tsx
// frontend/app/page.tsx
import { getSignals, getNews } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import SignalCard from '@/components/signals/SignalCard'
import NewsFeed from '@/components/news/NewsFeed'
import TopBar from '@/components/layout/TopBar'
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const [bullish, crashRisk, news] = await Promise.all([
    getSignals({ direction: 'bullish', limit: 10 }),
    getSignals({ direction: 'crash_risk', limit: 5 }),
    getNews({ limit: 10 }),
  ])

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${bullish.total + crashRisk.total} active signals · ${news.total} articles`}
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Opportunities — takes 2 cols */}
        <section className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-profit" />
            <h2 className="text-sm font-semibold text-gray-300">Top Opportunities</h2>
            <span className="text-xs text-gray-600">({bullish.total})</span>
          </div>

          {bullish.data.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              No bullish signals available
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bullish.data.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Right column: Crash Risks + Quick Stats */}
        <section className="space-y-6">
          {/* Crash Risks */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-loss" />
              <h2 className="text-sm font-semibold text-gray-300">Crash Risk Alerts</h2>
              <span className="text-xs text-gray-600">({crashRisk.total})</span>
            </div>

            {crashRisk.data.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-profit text-sm">
                <span>✓</span>
                <span>No crash risks detected</span>
              </div>
            ) : (
              <div className="space-y-2">
                {crashRisk.data.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick Stats
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total signals</span>
                <span className="font-mono text-gray-200">{bullish.total + crashRisk.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Articles indexed</span>
                <span className="font-mono text-gray-200">{news.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bullish signals</span>
                <span className="font-mono text-profit">{bullish.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Crash risks</span>
                <span className="font-mono text-loss">{crashRisk.total}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Breaking News Feed — full width below */}
        <section className="xl:col-span-3 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-sm font-semibold text-gray-300">Breaking News</h2>
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8">
            <NewsFeed articles={news.data} />
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd frontend && npm run build
```
Expected: Build succeeds. No type errors.

- [ ] **Step 3: Start the backend and test the page visually**

In one terminal:
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000
```

In another:
```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. Expected: Dashboard loads with signal cards, crash risk alerts, news feed.

- [ ] **Step 4: Create app/loading.tsx (dashboard skeleton)**

```tsx
// frontend/app/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <Skeleton className="h-5 w-40 bg-surface-elevated" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl bg-surface-elevated" />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 bg-surface-elevated" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-surface-elevated" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl bg-surface-elevated" />
      </div>
      <div className="xl:col-span-3 space-y-3">
        <Skeleton className="h-5 w-32 bg-surface-elevated" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg bg-surface-elevated" />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/page.tsx frontend/app/loading.tsx
git commit -m "feat: add Home Dashboard page with loading skeleton"
```

---

## Task 13: Stock Detail page

**Files:**
- Create: `frontend/app/stock/[ticker]/page.tsx`

- [ ] **Step 1: Create the stock detail page**

```tsx
// frontend/app/stock/[ticker]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStock, getNews } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import ChartPlaceholder from '@/components/charts/ChartPlaceholder'
import SignalExpanded from '@/components/signals/SignalExpanded'
import NewsFeed from '@/components/news/NewsFeed'
import TopBar from '@/components/layout/TopBar'
import type { SignalDirection } from '@/lib/types'
import { ArrowLeft } from 'lucide-react'

function bannerStyle(direction: SignalDirection | undefined): string {
  if (direction === 'bullish') return 'border border-profit/20 bg-profit/5'
  if (direction === 'bearish' || direction === 'crash_risk') return 'border border-loss/20 bg-loss/5'
  return 'border border-white/8 bg-surface-elevated'
}

function directionLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return '↑ Bullish'
  if (direction === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function directionBadgeColor(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params

  let stock
  try {
    stock = await getStock(ticker)
  } catch {
    notFound()
  }

  const news = await getNews({ ticker: stock.ticker, limit: 10 })
  const signal = stock.latest_signal

  return (
    <div>
      <TopBar title={stock.ticker} subtitle={stock.name} />

      <div className="p-6 space-y-6">
        {/* Stock header */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-2xl text-white">{stock.ticker}</span>
            <span className="text-gray-400">{stock.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {stock.last_price && (
              <span className="font-mono text-xl text-white">
                ${stock.last_price.toLocaleString()}
              </span>
            )}
            {stock.sector && (
              <Badge className="bg-surface-elevated text-gray-400 border-white/8">
                {stock.sector}
              </Badge>
            )}
          </div>
        </div>

        {/* Signal summary banner */}
        <div className={`rounded-xl p-5 ${signal ? bannerStyle(signal.direction) : 'border border-white/8 bg-surface-elevated'}`}>
          {signal ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge className={`text-sm px-3 py-1 ${directionBadgeColor(signal.direction)}`}>
                {directionLabel(signal.direction)}
              </Badge>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Confidence</span>
                <span className="font-mono font-bold text-white ml-1">
                  {Math.round(signal.confidence * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Expected</span>
                <span className="font-mono text-white ml-1">
                  +{(signal.expected_move_low * 100).toFixed(1)}% to +{(signal.expected_move_high * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Horizon</span>
                <span className="font-mono text-white ml-1">{signal.horizon_days} days</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Rank</span>
                <span className="font-mono text-brand-cyan ml-1">#{signal.rank}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Opportunity</span>
                <span className="font-mono text-white ml-1">{signal.opportunity_score.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Crash Risk</span>
                <span className="font-mono text-white ml-1">{signal.crash_risk_score.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No signal available for {stock.ticker}</p>
          )}
        </div>

        {/* Main content: charts + explanation */}
        {signal && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Charts column (3/5) */}
            <div className="lg:col-span-3 space-y-4">
              <ChartPlaceholder title="Price Chart" height="h-52" />
              <ChartPlaceholder title="Sentiment Trend" height="h-40" />
              <ChartPlaceholder title="News Volume" height="h-40" />
            </div>

            {/* Explanation column (2/5) */}
            <div className="lg:col-span-2 bg-surface-card rounded-xl border border-white/8 p-5">
              <SignalExpanded signal={signal} />
            </div>
          </div>
        )}

        {/* Related Articles */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">
            Related Articles
            <span className="text-gray-600 font-normal ml-2">({news.total})</span>
          </h2>
          <div className="bg-surface-card rounded-xl border border-white/8">
            {news.data.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-600">
                No articles found for {stock.ticker}
              </div>
            ) : (
              <NewsFeed articles={news.data} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd frontend && npm run build
```
Expected: Build succeeds, `/stock/[ticker]` route appears in build output.

- [ ] **Step 3: Create app/stock/[ticker]/loading.tsx**

```tsx
// frontend/app/stock/[ticker]/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function StockLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-lg bg-surface-elevated" />
        <Skeleton className="h-8 w-48 bg-surface-elevated" />
        <Skeleton className="h-8 w-24 ml-auto bg-surface-elevated" />
      </div>
      <Skeleton className="h-20 rounded-xl bg-surface-elevated" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="h-52 rounded-xl bg-surface-elevated" />
          <Skeleton className="h-40 rounded-xl bg-surface-elevated" />
          <Skeleton className="h-40 rounded-xl bg-surface-elevated" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-80 rounded-xl bg-surface-elevated" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test the page visually**

With the backend still running, navigate to `http://localhost:3000/stock/NVDA`.
Expected: Stock header, bullish signal banner, three chart placeholders, explanation panel with drivers/evidence, related NVDA articles.

Navigate to `http://localhost:3000/stock/FAKE`.
Expected: 404 page.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/stock/
git commit -m "feat: add Stock Detail page with loading skeleton"
```

---

## Task 14: Error + 404 pages + full test run

**Files:**
- Create: `frontend/app/error.tsx`
- Create: `frontend/app/not-found.tsx`

- [ ] **Step 1: Create error.tsx**

```tsx
// frontend/app/error.tsx
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
      <h2 className="text-lg font-semibold text-white">Failed to load data</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Something went wrong connecting to the data source. Try refreshing the page.
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

- [ ] **Step 2: Create not-found.tsx**

```tsx
// frontend/app/not-found.tsx
import Link from 'next/link'
import { Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <Search className="w-12 h-12 text-gray-600" />
      <h2 className="text-lg font-semibold text-white">Not Found</h2>
      <p className="text-sm text-gray-500">
        That ticker or page doesn't exist in our system.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite**

```bash
cd frontend && npx jest --no-coverage
```
Expected: All tests pass. Summary should show:
- `lib/__tests__/api.test.ts` — 7 tests
- `components/charts/__tests__/ChartPlaceholder.test.tsx` — 2 tests
- `components/signals/__tests__/SignalCard.test.tsx` — 8 tests
- `components/signals/__tests__/SignalExpanded.test.tsx` — 5 tests
- `components/news/__tests__/NewsItem.test.tsx` — 4 tests
- `components/news/__tests__/NewsFeed.test.tsx` — 2 tests
- **Total: 28 tests, all passing**

- [ ] **Step 4: Final build check**

```bash
npm run build
```
Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/error.tsx frontend/app/not-found.tsx
git commit -m "feat: add error boundary and 404 page"
```

- [ ] **Step 6: End-to-end smoke test**

With backend running (`uvicorn app.main:app --port 8000`) and frontend running (`npm run dev`):

| URL | Expected |
|---|---|
| `http://localhost:3000` | Dashboard with signal cards, crash risks, news feed |
| `http://localhost:3000/stock/NVDA` | Stock detail with bullish banner, 3 chart placeholders, drivers, articles |
| `http://localhost:3000/stock/AAPL` | Stock detail for AAPL |
| `http://localhost:3000/stock/PFE` | Stock detail with crash_risk banner |
| `http://localhost:3000/stock/FAKE` | 404 page |

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 2 frontend dashboard — Home + Stock Detail pages"
```
