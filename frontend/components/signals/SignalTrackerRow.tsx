'use client'

import Link from 'next/link'
import { directionLabel, calcActualPct, calcProgressPct, calcDaysRemaining } from '@/lib/signal-formatting'
import { Badge } from '@/components/ui/badge'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionBadgeClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

interface Progress {
  pct: number
  barClass: string
  actualPct: number | null
}

function calcProgress(signal: SignalResponse): Progress {
  const { last_price, price_at_signal, direction, expected_move_low, expected_move_high } = signal
  const actualPct = calcActualPct(last_price, price_at_signal)
  if (actualPct === null) {
    return { pct: 0, barClass: 'bg-surface-elevated', actualPct: null }
  }

  const pct = calcProgressPct(direction, actualPct, expected_move_low, expected_move_high)

  if (direction === 'crash_risk') {
    const barClass = actualPct <= 0 ? 'bg-loss' : 'bg-profit'
    return { pct, barClass, actualPct }
  }

  const barClass = actualPct >= 0 ? 'bg-profit' : 'bg-loss'
  return { pct, barClass, actualPct }
}

interface Props {
  signal: SignalResponse
}

export default function SignalTrackerRow({ signal }: Props) {
  const {
    ticker, stock_name, direction, confidence,
    expected_move_low, expected_move_high, horizon_days,
    rank, created_at,
  } = signal

  const progress = calcProgress(signal)
  const daysLeft = calcDaysRemaining(created_at, horizon_days)
  const expired = daysLeft <= 0

  return (
    <Link href={`/stock/${ticker}`} className="block group">
      <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] items-center gap-3 lg:gap-4 px-4 py-3 rounded-lg hover:bg-surface-elevated transition-colors">

        {/* Rank */}
        <span className="text-xs text-gray-600 font-mono text-right">#{rank}</span>

        {/* Ticker + name */}
        <div className="min-w-0">
          <p className="font-mono font-bold text-sm text-white leading-tight">{ticker}</p>
          <p className="text-xs text-gray-500 truncate">{stock_name}</p>
        </div>

        {/* Direction badge */}
        <Badge className={`text-xs shrink-0 ${directionBadgeClass(direction)}`}>
          {directionLabel(direction)}
        </Badge>

        {/* Progress bar + labels */}
        <div className="flex flex-col gap-1 min-w-0">
          <div
            className="w-full bg-surface-elevated rounded-full h-1.5"
            data-testid="signal-progress-track"
          >
            <div
              className={`h-1.5 rounded-full transition-all ${progress.barClass}`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
            {progress.actualPct !== null ? (
              <>
                <span className={progress.actualPct >= 0 ? 'text-profit' : 'text-loss'}>
                  {progress.actualPct >= 0 ? '+' : ''}{progress.actualPct.toFixed(1)}%
                </span>
                {direction !== 'crash_risk' && (
                  <>
                    <span className="text-gray-700">→</span>
                    <span className="text-gray-500">
                      +{(expected_move_low * 100).toFixed(1)}–{(expected_move_high * 100).toFixed(1)}%
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-gray-700">—</span>
            )}
          </div>
        </div>

        {/* Confidence */}
        <span className="text-xs font-mono text-gray-300 text-right">{Math.round(confidence * 100)}%</span>

        {/* Time remaining */}
        <span className={`text-xs text-right shrink-0 ${expired ? 'text-gray-600' : 'text-gray-400'}`}>
          {expired ? 'Expired' : `${daysLeft}d left`}
        </span>

      </div>
    </Link>
  )
}
