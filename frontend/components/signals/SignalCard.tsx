'use client'

import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionLabel(direction: SignalDirection): string {
  if (direction === 'bullish') return '↑ Bullish'
  if (direction === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function directionColor(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

function cardAccent(direction: SignalDirection): string {
  if (direction === 'bullish') return 'border-l-2 border-l-profit'
  return 'border-l-2 border-l-loss'
}

interface SignalCardProps {
  signal: SignalResponse
}

export default function SignalCard({ signal }: SignalCardProps) {
  const {
    ticker, stock_name, direction, confidence,
    expected_move_low, expected_move_high, horizon_days, rank,
  } = signal

  return (
    <Link href={`/stock/${ticker}`} className="block">
      <div className={`bg-surface-card rounded-xl border border-white/8 p-4 hover:brightness-110 transition-all ${cardAccent(direction)}`}>
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs text-gray-500 font-mono">#{rank}</span>
            <p className="font-mono font-bold text-lg text-white leading-tight">{ticker}</p>
            <p className="text-xs text-gray-400 truncate max-w-[140px]">{stock_name}</p>
          </div>
          <Badge className={`text-xs ${directionColor(direction)}`}>
            {directionLabel(direction)}
          </Badge>
        </div>

        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Confidence</span>
            <span className="font-mono text-gray-200">{Math.round(confidence * 100)}%</span>
          </div>
          <Progress value={confidence * 100} className="h-1" />
        </div>

        {/* Move + Horizon */}
        <div className="flex justify-between text-xs text-gray-400">
          <span className="font-mono">
            +{(expected_move_low * 100).toFixed(1)}% to +{(expected_move_high * 100).toFixed(1)}%
          </span>
          <span>{horizon_days} days</span>
        </div>
      </div>
    </Link>
  )
}
