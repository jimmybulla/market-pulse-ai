# Phase 4: Price/Sentiment/News-Volume Charts Design
**Date:** 2026-03-27
**Scope:** Interactive charts on the stock detail page — price history, sentiment trend, news volume
**Approach:** On-demand FastAPI endpoints, yfinance + Supabase aggregation, Recharts components

---

## Decisions & Constraints

- **Recharts** for charting — React-native, composable, Tailwind-friendly, no new dependencies beyond the npm package
- **On-demand fetch** — chart data loaded on demand per stock page visit; no caching, no new DB tables
- **Three time ranges** — 7D / 30D / 90D, user-switchable via shared `RangeSelector` component
- **Three chart types** — price (area), sentiment (bar), news volume (bar)
- **yfinance for price** — `ticker.history(period=X)` returns OHLCV data; we expose `close` price only
- **Supabase for sentiment/volume** — aggregate `news_articles` by day for the ticker
- **Next.js proxy routes** — frontend calls `/api/charts/*` which proxies to the FastAPI backend (same pattern as existing routes)
- **No new DB tables** — all data derives from existing `stocks`, `news_articles` tables

---

## 1. New Files

```
backend/app/
└── routers/
    └── charts.py             ← 3 GET endpoints for price, sentiment, news-volume

frontend/
└── app/
    └── api/
        └── charts/
            ├── [ticker]/
            │   ├── price/route.ts           ← proxy → /stocks/{ticker}/price-history
            │   ├── sentiment/route.ts       ← proxy → /stocks/{ticker}/sentiment-trend
            │   └── news-volume/route.ts     ← proxy → /stocks/{ticker}/news-volume
└── components/
    └── charts/
        ├── PriceChart.tsx
        ├── SentimentChart.tsx
        ├── NewsVolumeChart.tsx
        └── RangeSelector.tsx
```

**Modified files:**
- `backend/app/main.py` — register `charts` router
- `frontend/app/stocks/[ticker]/page.tsx` — replace chart placeholders with real components

---

## 2. Backend Endpoints

### `GET /stocks/{ticker}/price-history?range=7d|30d|90d`

- Fetches `yf.Ticker(ticker).history(period=range)` (e.g. `"7d"`, `"30d"`, `"90d"`)
- Returns daily `close` prices
- Response:
  ```json
  {
    "ticker": "AAPL",
    "range": "7d",
    "data": [
      { "date": "2026-03-20", "close": 213.45 },
      ...
    ]
  }
  ```
- Error: 404 if ticker unknown, 502 if yfinance returns no data

### `GET /stocks/{ticker}/sentiment-trend?range=7d|30d|90d`

- Queries `news_articles` WHERE ticker matches AND `published_at` within range AND `sentiment_score IS NOT NULL`
- Groups by day, returns `avg(sentiment_score)` per day
- Response:
  ```json
  {
    "ticker": "AAPL",
    "range": "7d",
    "data": [
      { "date": "2026-03-20", "avg_sentiment": 0.32 },
      ...
    ]
  }
  ```
- Days with no articles return no entry (chart handles gaps)

### `GET /stocks/{ticker}/news-volume?range=7d|30d|90d`

- Same query as sentiment-trend but returns `count` per day instead of avg sentiment
- Response:
  ```json
  {
    "ticker": "AAPL",
    "range": "7d",
    "data": [
      { "date": "2026-03-20", "count": 7 },
      ...
    ]
  }
  ```

---

## 3. Frontend Components

### `RangeSelector`

- Props: `value: "7d" | "30d" | "90d"`, `onChange: (range) => void`
- Renders three buttons; active range is highlighted (brand-cyan)
- Shared across all three chart panels

### `PriceChart`

- Props: `ticker: string`, `range: string`
- Fetches `/api/charts/[ticker]/price` on mount and range change
- Recharts `AreaChart` with gradient fill (brand-cyan → transparent)
- X-axis: date labels (abbreviated), Y-axis: price in USD
- Loading skeleton while fetching; error state if fetch fails

### `SentimentChart`

- Props: `ticker: string`, `range: string`
- Fetches `/api/charts/[ticker]/sentiment`
- Recharts `BarChart`; bars colored green (positive sentiment) / red (negative) / neutral (gray)
- Y-axis range: −1.0 to 1.0; zero reference line
- Loading skeleton + error state

### `NewsVolumeChart`

- Props: `ticker: string`, `range: string`
- Fetches `/api/charts/[ticker]/news-volume`
- Recharts `BarChart`; bars in brand-cyan
- Y-axis: article count (integer)
- Loading skeleton + error state

---

## 4. Stock Page Integration

The stock detail page (`app/stocks/[ticker]/page.tsx`) currently has placeholder chart sections. Replace them:

```
[RangeSelector]          ← single control above all three charts
[PriceChart]             ← area chart, full width
[SentimentChart]         ← bar chart, full width
[NewsVolumeChart]        ← bar chart, full width
```

State is lifted to the page: `const [range, setRange] = useState("30d")`. All three charts receive the same `range` prop so switching ranges refreshes all three simultaneously.

---

## 5. Data Aggregation Logic (Supabase)

For sentiment-trend and news-volume, the backend queries `news_articles` filtering by ticker using the array containment operator (`cs`):

```python
rows = (
    db.table("news_articles")
    .select("published_at, sentiment_score")
    .filter("tickers", "cs", f'{{{ticker}}}')
    .gte("published_at", cutoff_iso)
    .neq("sentiment_score", "null")
    .execute()
    .data or []
)
```

Group by date in Python (no SQL GROUP BY needed for MVP — article counts are small enough):

```python
from collections import defaultdict
daily: dict[str, list[float]] = defaultdict(list)
for row in rows:
    date_str = row["published_at"][:10]  # "YYYY-MM-DD"
    daily[date_str].append(row["sentiment_score"])

result = [
    {"date": d, "avg_sentiment": sum(v) / len(v)}
    for d, v in sorted(daily.items())
]
```

---

## 6. Error Handling

- **yfinance no data**: return HTTP 502 with `{"detail": "No price data available for {ticker}"}`
- **Unknown ticker**: yfinance raises on bad tickers — catch and return 404
- **Empty sentiment/volume**: return 200 with `"data": []` (chart renders empty state)
- **Frontend fetch failure**: each chart shows an inline error message with a retry button (no page-level crash)

---

## 7. Out of Scope (Future)

- Intraday (minute-level) price data
- Volume chart overlay on price chart
- Candlestick chart mode
- Chart data caching / Redis
- Export to PNG/CSV
- Technical indicators (RSI, MACD)
