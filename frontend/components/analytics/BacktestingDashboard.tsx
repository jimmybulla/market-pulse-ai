'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { BacktestingStats, PerformanceData, PerformanceBucket } from '@/lib/types'

interface Props {
  stats: BacktestingStats
  performanceData: PerformanceData
}

function PerformanceChart({ data }: { data: PerformanceBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-600">
        Not enough data yet — check back after signals have been live for 5+ days
      </div>
    )
  }

  const chartData = data.map((d) => ({
    period: d.period,
    'Hit Rate': Math.round(d.hit_rate * 100),
    Signals: d.total,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="period"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit=""
          domain={[0, 'auto']}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb', marginBottom: 4 }}
          itemStyle={{ color: '#9ca3af' }}
          formatter={(value: number, name: string) =>
            name === 'Hit Rate' ? [`${value}%`, name] : [value, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
        <Bar yAxisId="left" dataKey="Signals" fill="rgba(255,255,255,0.08)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="Hit Rate"
          stroke="#00B4FF"
          strokeWidth={2}
          dot={{ fill: '#00B4FF', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function BacktestingDashboard({ stats, performanceData }: Props) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')

  if (stats.total_resolved === 0 && performanceData.weekly.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-600">
        No resolved signals yet — check back after signals have been live for 5+ days
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Performance chart */}
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Hit Rate Over Time</h2>
          <div className="flex gap-1">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-brand-cyan/10 text-brand-cyan'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <PerformanceChart data={performanceData[period]} />
        </div>
      </div>

      {/* Stat cards */}
      {stats.total_resolved > 0 && (
        <>
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
        </>
      )}
    </div>
  )
}
