'use client'

import { Badge } from '@/components/ui/badge'
import type { NewsArticleResponse } from '@/lib/types'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Unknown time'
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const eventTypeColors: Record<string, string> = {
  earnings: 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20',
  regulation: 'bg-warning/10 text-warning border-warning/20',
  'M&A': 'bg-info/10 text-info border-info/20',
  product: 'bg-profit/10 text-profit border-profit/20',
  executive: 'bg-loss/10 text-loss border-loss/20',
  macro: 'bg-surface-elevated text-gray-400 border-white/8',
}

interface NewsItemProps {
  article: NewsArticleResponse
}

export default function NewsItem({ article }: NewsItemProps) {
  const { headline, url, published_at, tickers, event_type } = article

  const content = (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-surface-elevated transition-colors rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 leading-snug line-clamp-2">{headline}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {tickers.map((t) => (
            <Badge key={t} className="text-xs bg-anchor/60 text-brand-cyan border-brand-cyan/20">
              {t}
            </Badge>
          ))}
          {event_type && (
            <Badge className={`text-xs ${eventTypeColors[event_type] || 'bg-surface-elevated text-gray-400'}`}>
              {event_type}
            </Badge>
          )}
          <span className="text-xs text-gray-600">{timeAgo(published_at)}</span>
        </div>
      </div>
    </div>
  )

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    )
  }
  return content
}
