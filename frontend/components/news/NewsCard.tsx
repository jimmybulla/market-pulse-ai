import { directionLabel, sourceDomain, sentimentColor, sentimentLabel } from '@/lib/signal-formatting'
import type { NewsFeedItem } from '@/lib/types'

export default function NewsCard({ item }: { item: NewsFeedItem }) {

  return (
    <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
      {/* Header: tickers + direction */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.tickers.map((t) => (
          <span
            key={t}
            className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/8 text-white"
          >
            {t}
          </span>
        ))}
        {item.signal_direction && item.signal_confidence !== null && (
          <span
            className={`text-xs font-medium ${item.signal_direction === 'bullish' ? 'text-profit' : 'text-loss'}`}
          >
            {directionLabel(item.signal_direction as import('@/lib/types').SignalDirection)} · {Math.round(item.signal_confidence * 100)}%
          </span>
        )}
      </div>

      {/* Headline */}
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium text-white leading-snug hover:text-brand-cyan transition-colors"
        >
          {item.headline}
        </a>
      ) : (
        <p className="text-sm font-medium text-white leading-snug">{item.headline}</p>
      )}

      {/* Footer: event type, sentiment, date, source */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
        {item.event_type && (
          <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 capitalize">
            {item.event_type.replace('_', ' ')}
          </span>
        )}
        {item.sentiment_score !== null && (
          <span className={sentimentColor(item.sentiment_score)}>
            {sentimentLabel(item.sentiment_score)}
          </span>
        )}
        <span>{item.published_at ? item.published_at.slice(0, 10) : '—'}</span>
        {item.url && <span>{sourceDomain(item.url)}</span>}
      </div>
    </div>
  )
}
