import type { NewsFeedItem } from '@/lib/types'

function directionLabel(d: string) {
  if (d === 'bullish') return '↑ Bullish'
  if (d === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export default function NewsCard({ item }: { item: NewsFeedItem }) {
  const sentimentSign = item.sentiment_score !== null && item.sentiment_score >= 0 ? '+' : ''
  const sentimentClass =
    item.sentiment_score === null
      ? 'text-gray-500'
      : item.sentiment_score >= 0
      ? 'text-profit'
      : 'text-loss'

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
            {directionLabel(item.signal_direction)} · {Math.round(item.signal_confidence * 100)}%
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
          <span className={sentimentClass}>
            {sentimentSign}{item.sentiment_score.toFixed(2)}
          </span>
        )}
        <span>{item.published_at ? item.published_at.slice(0, 10) : '—'}</span>
        {item.url && <span>{sourceDomain(item.url)}</span>}
      </div>
    </div>
  )
}
