'use client'
import type { NewsArticleResponse } from '@/lib/types'

function sourceDomain(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

export default function ArticleList({ articles }: { articles: NewsArticleResponse[] }) {
  if (articles.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-600">No articles found</div>
    )
  }

  return (
    <div className="divide-y divide-white/4">
      {articles.map((article) => {
        const sentimentClass =
          article.sentiment_score === null
            ? 'text-gray-500'
            : article.sentiment_score >= 0
            ? 'text-profit'
            : 'text-loss'
        const sentimentSign =
          article.sentiment_score !== null && article.sentiment_score >= 0 ? '+' : ''
        const domain = sourceDomain(article.url)

        return (
          <div key={article.id} className="px-4 py-3 space-y-1">
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-white hover:text-brand-cyan transition-colors leading-snug block"
              >
                {article.headline}
              </a>
            ) : (
              <p className="text-sm font-medium text-white leading-snug">{article.headline}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
              <span>{article.published_at ? article.published_at.slice(0, 10) : '—'}</span>
              {article.sentiment_score !== null && (
                <span className={sentimentClass}>
                  {sentimentSign}{article.sentiment_score.toFixed(2)}
                </span>
              )}
              {article.event_type && (
                <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 capitalize">
                  {article.event_type.replace(/_/g, ' ')}
                </span>
              )}
              {domain && <span>{domain}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
