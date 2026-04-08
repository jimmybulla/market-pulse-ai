'use client'

import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { directionLabel } from '@/lib/signal-formatting'
import { deleteSignalAction } from '@/app/actions'
import type { ResolvedSignalEntry, SignalDirection } from '@/lib/types'

function directionBadgeClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  if (direction === 'crash_risk') return 'bg-loss/10 text-loss border-loss/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

interface Props {
  entry: ResolvedSignalEntry
  onDelete: (id: string) => void
}

export default function ResolvedSignalRow({ entry, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const outcomePrice =
    entry.price_at_signal != null && entry.actual_move != null
      ? entry.price_at_signal * (1 + entry.actual_move)
      : null

  const movePct =
    entry.actual_move != null
      ? `${entry.actual_move >= 0 ? '+' : ''}${(entry.actual_move * 100).toFixed(1)}%`
      : '—'

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    try {
      await deleteSignalAction(entry.id)
      onDelete(entry.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="border-b border-white/8 last:border-b-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Correctness indicator */}
        <span className={`text-sm font-bold shrink-0 ${entry.was_correct ? 'text-profit' : 'text-loss'}`}>
          {entry.was_correct ? '✓' : '✗'}
        </span>

        {/* Ticker + direction */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-white">{entry.ticker}</span>
          <Badge className={`text-xs shrink-0 ${directionBadgeClass(entry.direction)}`}>
            {directionLabel(entry.direction)}
          </Badge>
        </div>

        {/* Price journey */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 ml-auto">
          {entry.price_at_signal != null ? (
            <span>${entry.price_at_signal.toFixed(2)}</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
          <span className="text-gray-700">→</span>
          {outcomePrice != null ? (
            <span>${outcomePrice.toFixed(2)}</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
          <span className={`font-semibold ml-1 ${
            entry.actual_move == null
              ? 'text-gray-600'
              : entry.actual_move >= 0
                ? 'text-profit'
                : 'text-loss'
          }`}>
            {movePct}
          </span>
        </div>

        {/* Expand + delete */}
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-loss transition-all disabled:opacity-30"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Verdict */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-surface-elevated/50">
          <p className="text-xs text-gray-400 leading-relaxed">
            {entry.resolved_verdict || 'No verdict generated yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
