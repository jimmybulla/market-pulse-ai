// frontend/app/page.tsx
import { getSignals, getNewsFeed } from '@/lib/api'
import SignalTrackerRow from '@/components/signals/SignalTrackerRow'
import NewsFeed from '@/components/news/NewsFeed'
import TopBar from '@/components/layout/TopBar'
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const [bullish, crashRisk, newsFeed] = await Promise.all([
    getSignals({ direction: 'bullish', limit: 10 }),
    getSignals({ direction: 'crash_risk', limit: 10 }),
    getNewsFeed(),
  ])

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${bullish.total + crashRisk.total} active signals · ${newsFeed.length} articles`}
      />

      <div className="p-6 space-y-6">

        {/* Top Opportunities */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-profit" />
            <h2 className="text-sm font-semibold text-gray-300">Top Opportunities</h2>
            <span className="text-xs text-gray-600">({bullish.total})</span>
          </div>

          {bullish.data.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-sm bg-surface-card rounded-xl border border-white/8">
              No bullish signals available
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
              {/* Column header */}
              <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] gap-3 lg:gap-4 px-4 py-2 border-b border-white/8">
                <span className="text-xs text-gray-600">#</span>
                <span className="text-xs text-gray-600">Stock</span>
                <span className="text-xs text-gray-600">Signal</span>
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs text-gray-600 text-right">Conf</span>
                <span className="text-xs text-gray-600 text-right">Time</span>
              </div>
              {bullish.data.map((signal) => (
                <SignalTrackerRow key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Crash Risk Alerts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <h2 className="text-sm font-semibold text-gray-300">Crash Risk Alerts</h2>
            <span className="text-xs text-gray-600">({crashRisk.total})</span>
          </div>

          {crashRisk.data.length === 0 ? (
            <div className="flex items-center gap-2 py-4 px-4 text-profit text-sm bg-surface-card rounded-xl border border-white/8">
              <span>✓</span>
              <span>No crash risks detected</span>
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] gap-3 lg:gap-4 px-4 py-2 border-b border-white/8">
                <span className="text-xs text-gray-600">#</span>
                <span className="text-xs text-gray-600">Stock</span>
                <span className="text-xs text-gray-600">Signal</span>
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs text-gray-600 text-right">Conf</span>
                <span className="text-xs text-gray-600 text-right">Time</span>
              </div>
              {crashRisk.data.map((signal) => (
                <SignalTrackerRow key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Breaking News */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-sm font-semibold text-gray-300">Breaking News</h2>
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8">
            <NewsFeed items={newsFeed} />
          </div>
        </section>

      </div>
    </div>
  )
}
