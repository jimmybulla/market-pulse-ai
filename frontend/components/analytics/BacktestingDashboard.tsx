import type { BacktestingStats } from '@/lib/types'

export default function BacktestingDashboard({ stats }: { stats: BacktestingStats }) {
  if (stats.total_resolved === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-600">
        No resolved signals yet — check back after signals have been live for 5+ days
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-xl border border-white/8 p-5">
          <p className="text-xs text-gray-500 mb-1">Overall Hit Rate</p>
          <p className="text-3xl font-mono font-bold text-white">
            {(stats.overall_hit_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-surface-card rounded-xl border border-white/8 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Resolved</p>
          <p className="text-3xl font-mono font-bold text-white">{stats.total_resolved}</p>
        </div>
        <div className="bg-surface-card rounded-xl border border-white/8 p-5">
          <p className="text-xs text-gray-500 mb-1">Avg Actual Move (correct)</p>
          <p className="text-3xl font-mono font-bold text-profit">
            +{(stats.avg_actual_move * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* By Direction */}
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-gray-300">By Direction</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-gray-500">
              <th className="text-left px-5 py-3 font-medium">Direction</th>
              <th className="text-right px-5 py-3 font-medium">Signals</th>
              <th className="text-right px-5 py-3 font-medium">Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.by_direction).map(([dir, data]) => (
              <tr key={dir} className="border-b border-white/4 last:border-0">
                <td className="px-5 py-3 text-gray-300">{dir.replace('_', ' ')}</td>
                <td className="px-5 py-3 text-right font-mono text-gray-400">{data.total}</td>
                <td className="px-5 py-3 text-right font-mono text-white">
                  {(data.hit_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By Confidence Tier */}
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-gray-300">By Confidence Tier</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-gray-500">
              <th className="text-left px-5 py-3 font-medium">Tier</th>
              <th className="text-right px-5 py-3 font-medium">Signals</th>
              <th className="text-right px-5 py-3 font-medium">Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.by_confidence_tier).map(([tier, data]) => (
              <tr key={tier} className="border-b border-white/4 last:border-0">
                <td className="px-5 py-3 text-gray-300 capitalize">
                  {tier}{' '}
                  <span className="text-gray-600 text-xs">
                    {tier === 'high' ? '(≥80%)' : tier === 'medium' ? '(60–80%)' : '(<60%)'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-gray-400">{data.total}</td>
                <td className="px-5 py-3 text-right font-mono text-white">
                  {(data.hit_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
