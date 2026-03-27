// frontend/app/page.tsx
import { getSignals, getNews } from '@/lib/api'
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
