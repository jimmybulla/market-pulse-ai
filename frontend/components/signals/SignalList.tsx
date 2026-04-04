'use client'
import { useState, useMemo } from 'react'
import type { SignalResponse } from '@/lib/types'
import SignalRow from './SignalRow'

const SELECT_CLS = 'bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20'

export default function SignalList({ signals }: { signals: SignalResponse[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [direction, setDirection] = useState('')
  const [sector, setSector] = useState('')
  const [minConfidence, setMinConfidence] = useState(0)
  const [horizon, setHorizon] = useState('')

  const sectors = useMemo(() => {
    const s = new Set(signals.map((sig) => sig.sector).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [signals])

  const filtered = signals.filter((s) => {
    if (direction && s.direction !== direction) return false
    if (sector && s.sector !== sector) return false
    if (s.confidence < minConfidence / 100) return false
    if (horizon && s.horizon_days !== Number(horizon)) return false
    return true
  })

  function handleToggle(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <select aria-label="Direction" value={direction} onChange={(e) => setDirection(e.target.value)} className={SELECT_CLS}>
          <option value="">All Directions</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="crash_risk">Crash Risk</option>
        </select>

        <select aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} className={SELECT_CLS}>
          <option value="">All Sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select aria-label="Horizon" value={horizon} onChange={(e) => setHorizon(e.target.value)} className={SELECT_CLS}>
          <option value="">Any Horizon</option>
          <option value="1">1 day</option>
          <option value="5">5 days</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Min confidence</span>
          <input
            type="range"
            min={0}
            max={90}
            step={10}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-24 accent-brand-cyan"
          />
          <span className="text-xs font-mono text-gray-300 w-8">{minConfidence}%</span>
        </div>
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
