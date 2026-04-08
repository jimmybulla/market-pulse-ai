// frontend/lib/api.ts
import type {
  PaginatedSignals, SignalResponse,
  PaginatedStocks, StockWithSignal,
  PaginatedNews, SignalDirection,
  SignalHistoryEntry, BacktestingStats,
  NewsFeedItem, PerformanceData,
  SectorHeatmapEntry, ResolvedSignalEntry,
} from './types'

const rawBackend = process.env.BACKEND_URL || 'http://localhost:8000'
const BACKEND = rawBackend.startsWith('http') ? rawBackend : `https://${rawBackend}`

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

export async function getSignalHistory(ticker: string): Promise<SignalHistoryEntry[]> {
  try {
    const res = await fetch(
      `${BACKEND}/signals/history/${ticker}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getBacktestingStats(): Promise<BacktestingStats> {
  try {
    const res = await fetch(`${BACKEND}/analytics/backtesting`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return {
        total_resolved: 0,
        overall_hit_rate: 0,
        by_direction: {},
        by_confidence_tier: {},
        avg_predicted_move: 0,
        avg_actual_move: 0,
      }
    }
    return res.json()
  } catch {
    return {
      total_resolved: 0,
      overall_hit_rate: 0,
      by_direction: {},
      by_confidence_tier: {},
      avg_predicted_move: 0,
      avg_actual_move: 0,
    }
  }
}

export async function getNewsFeed(): Promise<NewsFeedItem[]> {
  try {
    const res = await fetch(`${BACKEND}/news/feed`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getPerformanceOverTime(): Promise<PerformanceData> {
  try {
    const [weeklyRes, monthlyRes] = await Promise.all([
      fetch(`${BACKEND}/analytics/performance-over-time?period=weekly`, { next: { revalidate: 300 } }),
      fetch(`${BACKEND}/analytics/performance-over-time?period=monthly`, { next: { revalidate: 300 } }),
    ])
    const weekly = weeklyRes.ok ? await weeklyRes.json() : []
    const monthly = monthlyRes.ok ? await monthlyRes.json() : []
    return { weekly, monthly }
  } catch {
    return { weekly: [], monthly: [] }
  }
}

export async function getSectorHeatmap(): Promise<SectorHeatmapEntry[]> {
  try {
    const res = await fetch(`${BACKEND}/analytics/sector-heatmap`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getResolvedSignals(): Promise<ResolvedSignalEntry[]> {
  try {
    const res = await fetch(`${BACKEND}/analytics/resolved-signals`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
