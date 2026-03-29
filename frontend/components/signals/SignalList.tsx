'use client'
import { useState } from 'react'
import type { SignalResponse } from '@/lib/types'
import SignalRow from './SignalRow'

export default function SignalList({ signals }: { signals: SignalResponse[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [direction, setDirection] = useState('')

  const filtered = signals.filter((s) => !direction || s.direction === direction)

  function handleToggle(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3">
        <select
          aria-label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Directions</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="crash_risk">Crash Risk</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-600">No signals yet</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((signal) => (
            <SignalRow
              key={signal.id}
              signal={signal}
              isExpanded={expandedId === signal.id}
              onToggle={() => handleToggle(signal.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
