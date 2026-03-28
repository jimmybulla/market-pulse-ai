'use client'
import { useEffect, useState } from 'react'
import type { SignalHistoryEntry } from '@/lib/types'

export default function SignalHistory({ ticker }: { ticker: string }) {
  const [history, setHistory] = useState<SignalHistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/signals/history/${ticker}`)
      .then((res) => res.json())
      .then((data: SignalHistoryEntry[]) => {
        setHistory(data.slice(0, 10))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [ticker])

  if (!loaded) return null

  function directionLabel(d: string) {
    if (d === 'bullish') return '↑ Bullish'
    if (d === 'bearish') return '↓ Bearish'
    return '⚠ Crash Risk'
  }

  function correctCell(entry: SignalHistoryEntry) {
    if (entry.was_correct === null) return <span className="text-gray-600">Pending</span>
    if (entry.was_correct) return <span className="text-profit">✓</span>
    return <span className="text-loss">✗</span>
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">Signal History</h2>
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-600">
            No signal history yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Direction</th>
                <th className="text-right px-4 py-3 font-medium">Confidence</th>
                <th className="text-right px-4 py-3 font-medium">Predicted</th>
                <th className="text-right px-4 py-3 font-medium">Actual</th>
                <th className="text-right px-4 py-3 font-medium">Correct</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-white/4 last:border-0">
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-3 ${entry.direction === 'bullish' ? 'text-profit' : 'text-loss'}`}>
                    {directionLabel(entry.direction)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    {Math.round(entry.confidence * 100)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">
                    +{(entry.expected_move_low * 100).toFixed(0)}%&ndash;{(entry.expected_move_high * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {entry.actual_move !== null ? (
                      <span className={entry.actual_move >= 0 ? 'text-profit' : 'text-loss'}>
                        {entry.actual_move >= 0 ? '+' : ''}
                        {(entry.actual_move * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{correctCell(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
