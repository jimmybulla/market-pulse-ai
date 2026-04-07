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
  price_at_signal: number | null
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

export interface SignalHistoryEntry {
  id: string
  direction: SignalDirection
  confidence: number
  expected_move_low: number
  expected_move_high: number
  horizon_days: number
  price_at_signal: number | null
  actual_move: number | null
  was_correct: boolean | null
  accuracy_notes: string | null
  created_at: string
}

export interface BacktestingStats {
  total_resolved: number
  overall_hit_rate: number
  by_direction: Record<string, { total: number; hit_rate: number }>
  by_confidence_tier: Record<string, { total: number; hit_rate: number }>
  avg_predicted_move: number
  avg_actual_move: number
}

export interface NewsFeedItem {
  id: string
  headline: string
  url: string
  published_at: string | null
  sentiment_score: number | null
  event_type: string | null
  credibility_score: number | null
  tickers: string[]
  signal_direction: string | null
  signal_confidence: number | null
  signal_opportunity_score: number | null
}

export interface PerformanceBucket {
  period: string
  hit_rate: number
  total: number
}

export interface PerformanceData {
  weekly: PerformanceBucket[]
  monthly: PerformanceBucket[]
}

export interface SectorHeatmapEntry {
  sector: string
  signal_count: number
  bullish: number
  bearish: number
  crash_risk: number
}
