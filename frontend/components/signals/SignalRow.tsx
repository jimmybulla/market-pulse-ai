import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionLabel(d: SignalDirection) {
  if (d === 'bullish') return '↑ Bullish'
  if (d === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function directionColor(d: SignalDirection) {
  return d === 'bullish' ? 'text-profit' : 'text-loss'
}

interface SignalRowProps {
  signal: SignalResponse
  isExpanded: boolean
  onToggle: () => void
}

export default function SignalRow({ signal, isExpanded, onToggle }: SignalRowProps) {
  const {
    ticker, stock_name, direction, confidence, rank,
    expected_move_low, expected_move_high, horizon_days, drivers,
  } = signal

  return (
    <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Rank */}
        <span className="text-xs font-mono text-gray-500 w-6 shrink-0">#{rank}</span>

        {/* Ticker + name */}
        <div className="min-w-0 w-24 shrink-0">
          <Link
            href={`/stock/${ticker}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono font-bold text-white hover:text-brand-cyan transition-colors text-sm"
          >
            {ticker}
          </Link>
          <p className="text-xs text-gray-500 truncate">{stock_name}</p>
        </div>

        {/* Direction */}
        <span className={`text-xs font-medium shrink-0 ${directionColor(direction)}`}>
          {directionLabel(direction)}
        </span>

        {/* Confidence */}
        <span className="font-mono text-sm text-white shrink-0">
          {Math.round(confidence * 100)}%
        </span>

        {/* Expected move */}
        <span className="font-mono text-xs text-gray-400 hidden sm:block shrink-0">
          +{(expected_move_low * 100).toFixed(1)}%–+{(expected_move_high * 100).toFixed(1)}%
        </span>

        {/* Horizon */}
        <span className="text-xs text-gray-500 hidden md:block shrink-0">
          {horizon_days}d
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toggle button */}
        <button
          onClick={onToggle}
          aria-label={`Toggle ${ticker} signal`}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/8 pt-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Key Drivers
          </h3>
          {drivers.length === 0 ? (
            <p className="text-sm text-gray-600">No drivers listed</p>
          ) : (
            <ul className="space-y-1.5">
              {drivers.map((driver, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-brand-cyan mt-0.5 shrink-0">•</span>
                  {driver}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
