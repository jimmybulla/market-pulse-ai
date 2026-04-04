'use client'
import { sourceDomain, sentimentColor, sentimentLabel } from '@/lib/signal-formatting'
import type { NewsArticleResponse } from '@/lib/types'

export default function ArticleList({ articles }: { articles: NewsArticleResponse[] }) {
  if (articles.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-600">No articles found</div>
    )
  }

  return (
    <div className="divide-y divide-white/4">
      {articles.map((article) => {
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
                <span className={sentimentColor(article.sentiment_score)}>
                  {sentimentLabel(article.sentiment_score)}
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
