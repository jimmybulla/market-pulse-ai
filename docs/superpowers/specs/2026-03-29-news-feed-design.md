# News Feed — Design Spec

**Date:** 2026-03-29
**Status:** Approved

---

## Goal

Expose a `/news` page showing recent market-moving articles that are directly linked to active signals, sorted by signal opportunity score descending, with client-side filtering by direction and event type.

---

## Approach

**Signal-linked articles only:** Articles are surfaced via each signal's `evidence.article_ids` JSONB field — only articles that contributed to a signal appear in the feed.

**Sorted by signal strength:** Items are ordered by `opportunity_score DESC` so the most significant market-moving stories appear first.

**Client-side filtering:** The page fetches the full feed on load; direction and event type filters are applied in JS without additional network requests.

---

## Data Layer

### New Endpoint: `GET /news/feed`

Added to `backend/app/routers/news.py`.

**Query params:**
- `direction` (optional): `bullish` | `bearish` | `crash_risk`
- `event_type` (optional): `earnings` | `regulation` | `m_a` | `product_launch` | `executive_change` | `other`

**Algorithm:**
1. Fetch all signals ordered by `opportunity_score DESC`
2. For each signal, extract `evidence["article_ids"]` from the JSONB `evidence` field
3. Collect all article IDs into a deduplicated set, tracking which signal (highest `opportunity_score`) each article is associated with
4. Batch-fetch those articles from `news_articles`
5. Attach signal context (`direction`, `confidence`, `opportunity_score`) from the associated signal to each article
6. Apply `direction` and `event_type` filters if provided
7. Return list ordered by `signal_opportunity_score DESC`

**Deduplication:** If an article appears in multiple signals' evidence lists, it is shown once — associated with the signal that has the highest `opportunity_score`.

**Skips:** Signals with no `article_ids` in evidence (e.g. `evidence` is null or `article_ids` is empty) are skipped silently.

### Response Model: `NewsFeedItem`

```python
class NewsFeedItem(BaseModel):
    id: str
    headline: str
    url: str
    published_at: datetime
    sentiment_score: Optional[float] = None
    event_type: Optional[str] = None
    credibility_score: Optional[float] = None
    tickers: list[str]
    signal_direction: str
    signal_confidence: float
    signal_opportunity_score: float
```

---

## Frontend

### New Files

- `frontend/app/news/page.tsx` — async Server Component, calls `getNewsFeed()`, passes result to `<NewsFeed>`
- `frontend/app/api/news/feed/route.ts` — proxy GET handler, forwards to `GET /news/feed`, returns 502 on catch
- `frontend/components/news/NewsFeed.tsx` — `'use client'`, owns filter state, filters client-side, renders `<NewsCard>` per item
- `frontend/components/news/NewsCard.tsx` — presentational, renders a single article card

### Modified Files

- `frontend/lib/types.ts` — add `NewsFeedItem` interface
- `frontend/lib/api.ts` — add `getNewsFeed()` function

> Note: `Sidebar.tsx` already has the `/news` nav entry and `Newspaper` import — no changes needed.

### Page: `app/news/page.tsx`

Async server component:
```tsx
const items = await getNewsFeed()
return (
  <div>
    <TopBar title="News" subtitle="Signal-linked market news" />
    <div className="p-6">
      <NewsFeed items={items} />
    </div>
  </div>
)
```

### API Helper: `getNewsFeed()`

```typescript
export async function getNewsFeed(): Promise<NewsFeedItem[]> {
  try {
    const res = await fetch(`${BACKEND}/news/feed`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
```

### Component: `NewsFeed.tsx`

- `'use client'`
- Accepts `items: NewsFeedItem[]` prop (no fetch)
- Filter bar: two `<select>` dropdowns
  - **Direction:** All / Bullish / Bearish / Crash Risk
  - **Event Type:** All / Earnings / Regulation / M&A / Product Launch / Executive Change / Other
- Filters applied in JS on the received `items` list
- Empty state: "No signal-linked news yet"
- Renders `<NewsCard>` for each filtered item

### Component: `NewsCard.tsx`

Presentational. Each card shows:
- **Headline** — links to `url` (opens in new tab)
- **Ticker badge(s)** — from `tickers` array
- **Signal direction** — arrow + label (↑ Bullish / ↓ Bearish / ⚠ Crash Risk) + confidence %
- **Event type badge** — from `event_type`
- **Sentiment score** — color-coded (green if ≥ 0, red if < 0), shown as e.g. `+0.42` or `-0.18`
- **Published date** — relative or absolute
- **Source domain** — extracted from `url`

### Proxy Route: `app/api/news/feed/route.ts`

```typescript
export async function GET() {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/news/feed`, { cache: 'no-store' })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
```

### Type: `NewsFeedItem`

```typescript
export interface NewsFeedItem {
  id: string
  headline: string
  url: string
  published_at: string
  sentiment_score: number | null
  event_type: string | null
  credibility_score: number | null
  tickers: string[]
  signal_direction: string
  signal_confidence: number
  signal_opportunity_score: number
}
```

---

## Sidebar

No changes needed — `Sidebar.tsx` already has `{ href: '/news', label: 'News', icon: Newspaper }` in its nav array and `Newspaper` already imported.

---

## Testing

### Backend (`backend/tests/test_news_feed.py`)

- `GET /news/feed` returns empty list when no signals exist
- `GET /news/feed` returns articles ordered by `signal_opportunity_score DESC`
- `GET /news/feed` deduplicates articles appearing in multiple signals' evidence
- `GET /news/feed?direction=bullish` returns only bullish-signal articles
- `GET /news/feed?event_type=earnings` returns only earnings articles
- `GET /news/feed` skips signals with no `article_ids` in evidence

### Frontend

- `NewsFeed.test.tsx`:
  - Renders empty state when items list is empty
  - Renders all items when no filter active
  - Filters to bullish direction only
  - Filters to earnings event type only
- `NewsCard.test.tsx`:
  - Renders headline as a link
  - Renders ticker badge
  - Renders direction with confidence
  - Renders sentiment score with correct color class (positive vs negative)

---

## Out of Scope

- Pagination (all signal-linked articles fit comfortably in one load for MVP article counts)
- Server-side filtering (client-side is sufficient given the volume)
- Full-text search
- Bookmarking or saving articles
- Social sharing
