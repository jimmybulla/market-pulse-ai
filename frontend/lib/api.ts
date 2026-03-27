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
