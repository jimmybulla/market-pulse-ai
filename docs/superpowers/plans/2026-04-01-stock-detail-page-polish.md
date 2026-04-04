# Stock Detail Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs on `/stock/[ticker]` (empty Related Articles section, hydration mismatch in SignalHistory) and add the missing `ArticleList` component.

**Architecture:** Create a new `ArticleList` presentational component for `NewsArticleResponse[]`, swap it into the stock page in place of the misused `NewsFeed`, and fix the locale-dependent date in `SignalHistory`. No backend changes needed — `getNews()` and all types already exist.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS, Jest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/components/news/ArticleList.tsx` | Create | Presentational list for `NewsArticleResponse[]` — no filters, no signal fields |
| `frontend/components/news/__tests__/ArticleList.test.tsx` | Create | 4 unit tests |
| `frontend/app/stock/[ticker]/page.tsx` | Modify | Swap `<NewsFeed articles={...}>` → `<ArticleList articles={...}>` |
| `frontend/components/signals/SignalHistory.tsx` | Modify | Fix `toLocaleDateString()` → `.slice(0, 10)` |

---

### Task 1: ArticleList component

**Files:**
- Create: `frontend/components/news/ArticleList.tsx`
- Create: `frontend/components/news/__tests__/ArticleList.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/components/news/__tests__/ArticleList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import ArticleList from '../ArticleList'
import type { NewsArticleResponse } from '@/lib/types'

const makeArticle = (overrides: Partial<NewsArticleResponse> = {}): NewsArticleResponse => ({
  id: 'art-1',
  source_id: null,
  headline: 'Apple beats Q4 earnings',
  body: null,
  url: 'https://reuters.com/aapl',
  published_at: '2026-03-25T14:00:00Z',
  fetched_at: '2026-03-25T15:00:00Z',
  tickers: ['AAPL'],
  sentiment_score: 0.75,
  event_type: 'earnings',
  novelty_score: 0.9,
  credibility_score: 0.92,
  severity: 0.8,
  ...overrides,
})

describe('ArticleList', () => {
  it('renders all articles', () => {
    const articles = [
      makeArticle({ id: 'art-1', headline: 'Apple beats Q4 earnings' }),
      makeArticle({ id: 'art-2', headline: 'Tesla misses revenue' }),
    ]
    render(<ArticleList articles={articles} />)
    expect(screen.getByText('Apple beats Q4 earnings')).toBeInTheDocument()
    expect(screen.getByText('Tesla misses revenue')).toBeInTheDocument()
  })

  it('renders headline as a link when url is present', () => {
    render(<ArticleList articles={[makeArticle({ url: 'https://reuters.com/aapl' })]} />)
    const link = screen.getByRole('link', { name: 'Apple beats Q4 earnings' })
    expect(link).toHaveAttribute('href', 'https://reuters.com/aapl')
  })

  it('shows — for null published_at', () => {
    render(<ArticleList articles={[makeArticle({ published_at: null })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows empty state when articles array is empty', () => {
    render(<ArticleList articles={[]} />)
    expect(screen.getByText('No articles found')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx jest components/news/__tests__/ArticleList.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: 4 failures — `Cannot find module '../ArticleList'`

- [ ] **Step 3: Create `ArticleList.tsx`**

Create `frontend/components/news/ArticleList.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to verify all 4 pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx jest components/news/__tests__/ArticleList.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/components/news/ArticleList.tsx frontend/components/news/__tests__/ArticleList.test.tsx && git commit -m "feat: add ArticleList component for NewsArticleResponse[]"
```

---

### Task 2: Fix stock page and SignalHistory

**Files:**
- Modify: `frontend/app/stock/[ticker]/page.tsx`
- Modify: `frontend/components/signals/SignalHistory.tsx`

- [ ] **Step 1: Fix `page.tsx` — swap NewsFeed for ArticleList**

Open `frontend/app/stock/[ticker]/page.tsx`. Make two changes:

**Change 1** — replace the `NewsFeed` import with `ArticleList`:

Find:
```tsx
import NewsFeed from '@/components/news/NewsFeed'
```
Replace with:
```tsx
import ArticleList from '@/components/news/ArticleList'
```

**Change 2** — replace the broken JSX:

Find:
```tsx
              <NewsFeed articles={news.data} />
```
Replace with:
```tsx
              <ArticleList articles={news.data} />
```

- [ ] **Step 2: Fix `SignalHistory.tsx` — hydration-safe date**

Open `frontend/components/signals/SignalHistory.tsx`. Find and replace the locale-dependent date call:

Find:
```tsx
                    {new Date(entry.created_at).toLocaleDateString()}
```
Replace with:
```tsx
                    {entry.created_at.slice(0, 10)}
```

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/frontend" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests passing (previously 90, now 94)

- [ ] **Step 4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add frontend/app/stock/[ticker]/page.tsx frontend/components/signals/SignalHistory.tsx && git commit -m "fix: wire ArticleList into stock page and fix SignalHistory date hydration"
```
