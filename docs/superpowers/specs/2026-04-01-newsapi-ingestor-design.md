# NewsAPI Ingestor — Design Spec

**Date:** 2026-04-01
**Status:** Approved

---

## Goal

Add NewsAPI as a second news source alongside yfinance, producing higher-quality financial articles with fuller headlines and reliable `publishedAt` timestamps. Better input articles → higher sentiment scores → signals that exceed the scoring threshold.

---

## Architecture

A new module `newsapi_ingestor.py` exposes `ingest_newsapi(db, tickers) -> list[str]`. It is called from `pipeline.py` immediately after the existing `ingest_news` call. The two returned ID lists are merged and passed together to `extract_features_for_articles`. No other pipeline steps change.

The module is optional: if `settings.newsapi_key` is empty, it returns `[]` immediately and logs a warning. This means the pipeline degrades gracefully in environments without a key.

---

## Rate Limiting

- Free tier: **100 requests/day**
- Pipeline runs: every 30 min = **48 runs/day**
- Strategy: split tickers into **2 batches** per run → **96 requests/day** (safe margin)
- Batch size: `ceil(len(tickers) / 2)` — never more than 2 HTTP calls per pipeline run

---

## NewsAPI Request

**Endpoint:** `GET https://newsapi.org/v2/everything`

**Parameters:**
```
q         = (AAPL OR MSFT OR NVDA OR ...)   # all tickers in this batch
language  = en
sortBy    = publishedAt
pageSize  = 20
from      = <ISO timestamp 24h ago>
apiKey    = <settings.newsapi_key>
```

**Response shape used:**
```json
{
  "articles": [
    {
      "title": "Apple beats Q4 earnings",
      "url": "https://reuters.com/...",
      "publishedAt": "2026-04-01T12:00:00Z",
      "source": { "name": "Reuters" }
    }
  ]
}
```

---

## Ticker Extraction

For each article, scan `title.upper()` for each ticker in the batch. All matching tickers are stored in the `tickers` array column. Articles with no ticker match are skipped (not inserted).

---

## Deduplication

Mirrors `ingestor.py`: fetch all `url` values from `news_articles` where `published_at >= 7 days ago`. Skip any article whose URL is already present. Also skip within-run duplicates by tracking inserted URLs in a local set.

---

## Insert Schema

Identical to yfinance ingestor:

| Column | Value |
|---|---|
| `headline` | `article["title"]` |
| `url` | `article["url"]` |
| `published_at` | `article["publishedAt"]` parsed to ISO with UTC timezone |
| `tickers` | `[t for t in batch if t in title.upper()]` |
| `fetched_at` | `datetime.now(timezone.utc).isoformat()` |

---

## Modified Files

| File | Change |
|---|---|
| `backend/app/config.py` | Add `newsapi_key: str = ""` |
| `backend/.env` | Add `NEWSAPI_KEY=f451b73c631147b18961248d97a077a8` |
| `backend/app/services/newsapi_ingestor.py` | **Create** — `ingest_newsapi()` |
| `backend/app/services/pipeline.py` | Call `ingest_newsapi` after `ingest_news`, merge ID lists |

No frontend changes. No database schema changes.

---

## Tests

File: `backend/tests/test_newsapi_ingestor.py`

Two tests using `unittest.mock.patch("httpx.get")`:

**1. Happy path**
- DB has 1 existing URL
- Mock returns 2 articles: 1 matching existing URL (dup), 1 new with ticker in title
- Assert: 1 `db.table("news_articles").insert` call, returned list has 1 ID, ticker correctly extracted

**2. Missing key**
- `settings.newsapi_key = ""`
- Assert: returns `[]`, no HTTP call made

---

## Out of Scope

- NewsAPI `/v2/top-headlines` endpoint (everything endpoint covers financial news adequately)
- Storing `source.name` in a separate `sources` table (out of scope for MVP)
- Per-source credibility lookup for NewsAPI domains (the existing `features.py` domain credibility dict handles this already)
- Pagination beyond `pageSize=20` per batch
