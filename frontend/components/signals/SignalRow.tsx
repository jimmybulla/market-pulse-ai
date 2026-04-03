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
    last_price, price_at_signal, created_at, explanation, evidence,
    historical_analog, risk_flags,
  } = signal

  // Calculate progress bar metrics
  const hasPrice = price_at_signal !== null && last_price !== null
  let actualPct = 0
  let progressPct = 0
  let daysRemaining = 0

  if (hasPrice) {
    actualPct = ((last_price - price_at_signal) / price_at_signal) * 100

    if (direction === 'bullish') {
      const bullishDenom = expected_move_high * 100
      progressPct = bullishDenom !== 0 ? Math.min((actualPct / bullishDenom) * 100, 100) : 0
    } else if (direction === 'crash_risk') {
      // crash_risk: treat a 10% drawdown as 100% progress toward crash threshold
      progressPct = Math.min((Math.abs(actualPct) / 10) * 100, 100)
    } else {
      // bearish
      const bearishDenom = Math.abs(expected_move_low) * 100
      progressPct = bearishDenom !== 0 ? Math.min((Math.abs(actualPct) / bearishDenom) * 100, 100) : 0
    }

    const elapsedDays = (Date.now() - new Date(created_at).getTime()) / 86400000
    daysRemaining = Math.round(horizon_days - elapsedDays)
  }

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
        <>
          {/* Section 1: Progress tracking */}
          {hasPrice && (
            <div className="px-4 py-4 border-t border-white/8">
              <div data-testid="signal-progress-track" className="h-1.5 rounded-full bg-brand-cyan/20 overflow-hidden mb-3">
                <div
                  className={`h-full transition-all ${
                    direction === 'bullish' ? 'bg-brand-cyan' : 'bg-loss'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span
                  data-testid="actual-move"
                  className={actualPct >= 0 ? 'text-profit' : 'text-loss'}
                >
                  {actualPct >= 0 ? '+' : '-'}{Math.abs(actualPct).toFixed(1)}%
                </span>
                <span data-testid="target-range" className="text-gray-400">
                  {(expected_move_low * 100).toFixed(1)}% → {(expected_move_high * 100).toFixed(1)}%
                </span>
                <span className="text-gray-500">
                  {daysRemaining <= 0 ? 'Expired' : `${daysRemaining}d`}
                </span>
              </div>
            </div>
          )}

          {/* Section 2: Detail panel */}
          <div className={`px-4 pb-4 ${hasPrice ? 'border-t border-white/8 pt-4' : 'border-t border-white/8 pt-3'}`}>
            {/* Key Drivers */}
            <div className="mb-4">
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

            {/* Explanation */}
            {explanation && (
              <div data-testid="explanation-section" className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Explanation
                </h3>
                <p className="text-sm text-gray-300">{explanation}</p>
              </div>
            )}

            {/* Evidence */}
            <div data-testid="evidence-section" className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Evidence
              </h3>
              <div className="text-sm text-gray-300">
                <p>{evidence.article_count} articles</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(evidence.avg_credibility * 100)}% avg credibility
                </p>
              </div>
            </div>

            {/* Historical Analog */}
            <div data-testid="historical-section" className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Historical Analog
              </h3>
              <div className="text-sm text-gray-300">
                <p>{(historical_analog.avg_move * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(historical_analog.hit_rate * 100)}% hit rate
                </p>
              </div>
            </div>

            {/* Risk Flags */}
            {risk_flags.length > 0 && (
              <div data-testid="risk-flags-section">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Risk Flags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {risk_flags.map((flag, i) => (
                    <div
                      key={i}
                      className="bg-loss/10 text-loss border border-loss/20 text-xs rounded-full px-2 py-0.5"
                    >
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
