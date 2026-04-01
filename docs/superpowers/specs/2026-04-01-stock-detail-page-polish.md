# Stock Detail Page Polish — Design Spec

**Date:** 2026-04-01
**Status:** Approved

---

## Goal

Fix two bugs on the `/stock/[ticker]` page and add the missing `ArticleList` component so Related Articles actually renders.

---

## Bugs

### Bug 1: Related Articles always empty

`app/stock/[ticker]/page.tsx` passes `articles={news.data}` to `<NewsFeed>`, but `NewsFeed` only accepts `items: NewsFeedItem[]`. Since `articles` is not a valid prop, `items` defaults to `[]` and the section always shows "No signal-linked news yet".

**Fix:** Replace `<NewsFeed articles={news.data} />` with `<ArticleList articles={news.data} />`.

### Bug 2: `SignalHistory` hydration mismatch

`SignalHistory.tsx` uses `new Date(entry.created_at).toLocaleDateString()` — locale-dependent formatting causes a server/client mismatch (same issue previously fixed in `NewsCard.tsx`).

**Fix:** Replace with `entry.created_at.slice(0, 10)` — locale-invariant ISO date prefix.

---

## New Component: `ArticleList`

### File

`frontend/components/news/ArticleList.tsx`

### Props

```typescript
{ articles: NewsArticleResponse[] }
```

`NewsArticleResponse` (already in `frontend/lib/types.ts`):
```typescript
interface NewsArticleResponse {
  id: string
  source_id: string | null
  headline: string
  body: string | null
  url: string | null
  published_at: string | null
  fetched_at: string
  tickers: string[]
  sentiment_score: number | null
  event_type: string | null
  novelty_score: number
  credibility_score: number
  severity: number
}
```

### Behaviour

- `'use client'` directive (consistent with other news components)
- No filter controls — ticker scoping handled by the server fetch
- Each article renders as a row:
  - **Headline:** `<a href={article.url} target="_blank">` if `url` is non-null, plain text otherwise
  - **Date:** `article.published_at ? article.published_at.slice(0, 10) : '—'`
  - **Sentiment:** color-coded (`text-profit` if ≥ 0, `text-loss` if < 0, `text-gray-500` if null); displays `+0.75` / `-0.32` format
  - **Event type:** plain text badge if non-null, omitted if null; underscores replaced with spaces
  - **Source:** domain extracted from `url` (`new URL(url).hostname.replace('www.', '')`)
- Empty state: `"No articles found"` (centered, `text-gray-600`)

### Implementation

```tsx
'use client'
import type { NewsArticleResponse } from '@/lib/types'

function sourceDomain(url: string | null): string {
  if (!url) return ''
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
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
        const sentimentSign = article.sentiment_score !== null && article.sentiment_score >= 0 ? '+' : ''
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
              {sourceDomain(article.url) && (
                <span>{sourceDomain(article.url)}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Modified Files

### `frontend/app/stock/[ticker]/page.tsx`

- Remove `NewsFeed` import
- Add `ArticleList` import: `import ArticleList from '@/components/news/ArticleList'`
- Change `<NewsFeed articles={news.data} />` → `<ArticleList articles={news.data} />`

### `frontend/components/signals/SignalHistory.tsx`

Change line:
```tsx
{new Date(entry.created_at).toLocaleDateString()}
```
To:
```tsx
{entry.created_at.slice(0, 10)}
```

---

## Tests

### `frontend/components/news/__tests__/ArticleList.test.tsx`

4 tests using `@testing-library/react`:

1. **Renders all articles** — two articles rendered, both headlines visible
2. **Headline is a link when url is present** — `<a>` with correct `href`
3. **Shows `—` for null `published_at`** — date cell shows `—`
4. **Shows empty state when articles is empty** — "No articles found" visible

---

## Out of Scope

- Filtering/sorting articles on the stock page
- Pagination of related articles
- Changes to `NewsFeed` or `NewsCard`
- Any other stock page changes
