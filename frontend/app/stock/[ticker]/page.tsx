import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStock, getNews } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import ChartsSection from '@/components/charts/ChartsSection'
import SignalExpanded from '@/components/signals/SignalExpanded'
import SignalHistory from '@/components/signals/SignalHistory'
import ArticleList from '@/components/news/ArticleList'
import TopBar from '@/components/layout/TopBar'
import { directionLabel } from '@/lib/signal-formatting'
import type { SignalDirection } from '@/lib/types'
import { ArrowLeft } from 'lucide-react'

function bannerStyle(direction: SignalDirection | undefined): string {
  if (direction === 'bullish') return 'border border-profit/20 bg-profit/5'
  if (direction === 'bearish' || direction === 'crash_risk') return 'border border-loss/20 bg-loss/5'
  return 'border border-white/8 bg-surface-elevated'
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
                ${stock.last_price.toFixed(2)}
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
                  {(signal.expected_move_low * 100).toFixed(1)}% to {(signal.expected_move_high * 100).toFixed(1)}%
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
              <ChartsSection ticker={stock.ticker} />
            </div>

            {/* Explanation column (2/5) */}
            <div className="lg:col-span-2 bg-surface-card rounded-xl border border-white/8 p-5">
              <SignalExpanded signal={signal} />
            </div>
          </div>
        )}

        {/* Signal History */}
        <SignalHistory ticker={stock.ticker} />

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
              <ArticleList articles={news.data} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
