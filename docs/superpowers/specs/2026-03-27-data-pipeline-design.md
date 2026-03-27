# Phase 3: Data Pipeline Design
**Date:** 2026-03-27
**Scope:** Backend data pipeline — news ingestion, feature extraction, signal generation, price updates
**Approach:** APScheduler (in-process), yfinance news + prices, VADER sentiment, rule-based classification

---

## Decisions & Constraints

- **APScheduler** (not Celery/Redis) — runs inside the FastAPI process, no extra services
- **yfinance** as sole data source — news via `ticker.news`, prices via `fast_info.last_price`
- **VADER** for sentiment — free, no API key, tuned for short financial text
- **Rule-based feature extraction** — keyword matching for event type, domain lookup for credibility, time decay for novelty
- **One signal per stock** — upsert pattern, always reflects the latest 48h of news
- **Error isolation** — each stock wrapped in try/except, one bad ticker never stops the pipeline
- **No new DB tables** — pipeline writes to existing `news_articles`, `signals`, `stocks` tables
- **Existing scoring engine untouched** — `services/scoring.py` `score_articles()` is already correct

---

## 1. New Files

```
backend/app/
├── scheduler.py                  ← APScheduler setup, wired to FastAPI lifespan
└── services/
    ├── ingestor.py               ← yfinance news fetch + URL deduplication
    ├── features.py               ← VADER + keyword classification → ArticleFeatures
    └── pipeline.py               ← Orchestrates all 4 steps
```

**Modified files:**
- `backend/app/main.py` — add scheduler lifespan
- `backend/app/routers/admin.py` — add `POST /admin/pipeline/run` trigger endpoint
- `backend/requirements.txt` — add yfinance, vaderSentiment, APScheduler

---

## 2. Pipeline Steps

The pipeline runs every 30 minutes (and immediately on startup). All four steps execute in sequence:

```
run_pipeline()
├── Step 1: ingest_news()      — fetch yfinance headlines per stock, deduplicate, store
├── Step 2: extract_features() — VADER + keyword classification on new articles
├── Step 3: generate_signals() — score_articles() per stock → upsert signals + re-rank
└── Step 4: update_prices()    — yfinance fast_info.last_price → update stocks.last_price
```

---

## 3. Ingestor (`services/ingestor.py`)

**Input:** list of stock tickers from `stocks` table
**Output:** new article rows inserted into `news_articles`

```
for each ticker:
  articles = yf.Ticker(ticker).news   # list of dicts
  for each article:
    if article['link'] not in existing URLs:
      insert into news_articles:
        headline = article['title']
        url      = article['link']
        published_at = datetime.fromtimestamp(article['providerPublishTime'])
        tickers  = [ticker]
        fetched_at = now()
        # sentiment/event fields left null — filled by extract_features()
```

**Deduplication:** before the loop, fetch all existing URLs for the current tickers from `news_articles` into a Python set. O(1) lookup per article.

**Returns:** list of newly inserted article IDs for the feature extraction step.

---

## 4. Feature Extraction (`services/features.py`)

**Input:** article headline + URL + published_at
**Output:** `ArticleFeatures` dataclass (matches existing `scoring.py` interface)

### Sentiment Score
VADER `SentimentIntensityAnalyzer().polarity_scores(headline)['compound']`
Range: −1.0 to 1.0

### Event Type (first keyword match wins)
```python
EVENT_KEYWORDS = {
    'earnings':   ['earnings', 'revenue', 'profit', 'eps', 'beat', 'miss', 'guidance', 'quarterly'],
    'm&a':        ['acqui', 'merger', 'takeover', 'buyout', 'deal', 'bid'],
    'regulation': ['fda', 'sec', 'ftc', 'doj', 'regulation', 'antitrust', 'fine', 'penalty', 'lawsuit'],
    'product':    ['launch', 'product', 'release', 'unveil', 'announce', 'new model'],
    'executive':  ['ceo', 'cfo', 'coo', 'resign', 'appoint', 'executive', 'leadership'],
}
# fallback: 'macro'
```

### Credibility Score (source domain lookup)
```python
CREDIBILITY = {
    'reuters.com':       0.92,
    'bloomberg.com':     0.92,
    'wsj.com':           0.90,
    'ft.com':            0.90,
    'cnbc.com':          0.82,
    'marketwatch.com':   0.80,
    'seekingalpha.com':  0.72,
    'yahoo.com':         0.70,
    'finance.yahoo.com': 0.70,
    'benzinga.com':      0.65,
    'motleyfool.com':    0.65,
}
# default for unknown domains: 0.55
```

### Novelty Score (time decay from published_at)
```python
age_hours = (now - published_at).total_seconds() / 3600
if age_hours < 2:   novelty = 1.0
elif age_hours < 6:  novelty = 0.85
elif age_hours < 12: novelty = 0.70
elif age_hours < 24: novelty = 0.50
elif age_hours < 48: novelty = 0.30
else:                novelty = 0.10
```

### Severity
```python
EVENT_WEIGHTS = {
    'earnings': 1.0, 'regulation': 1.0, 'm&a': 0.9,
    'executive': 0.8, 'product': 0.7, 'macro': 0.5,
}
severity = min(1.0, abs(sentiment_score) * EVENT_WEIGHTS[event_type])
```

After computing features, update the `news_articles` row with `sentiment_score`, `event_type`, `credibility_score`, `novelty_score`, `severity`.

---

## 5. Signal Generation (`services/pipeline.py`)

**Input:** all stocks + their recent articles (last 48h)
**Output:** upserted rows in `signals` table with updated `rank`

```
for each stock:
  articles = news_articles WHERE ticker = stock.ticker AND published_at > now - 48h
  features = [ArticleFeatures(...) for each article with non-null sentiment]
  result   = score_articles(features)   # existing scoring engine

  if result is not None:
    evidence = {
      article_count: len(features),
      avg_credibility: mean(credibility scores),
      sources: unique publisher domains,
      article_ids: [article IDs used],
    }
    historical_analog = { avg_move: result.expected_move_high * 0.9,
                          hit_rate: 0.64, sample_size: 15 }  # static MVP values
    upsert signals WHERE stock_id = stock.id:
      direction, confidence, expected_move_low, expected_move_high,
      opportunity_score, crash_risk_score, drivers, risk_flags,
      evidence, historical_analog, horizon_days=5, expires_at=now+7days

# After all stocks processed: re-rank by opportunity_score DESC
# Update rank field on all signals (1 = highest opportunity)
```

**Upsert key:** `stock_id` — one signal per stock, always replaced with latest.

**Signal retention:** if `score_articles()` returns `None` (insufficient evidence this cycle), the existing signal is left unchanged. Signals are never deleted mid-cycle — a quiet news day does not erase a previously valid signal. Signals expire naturally via the `expires_at = now + 7 days` field.

---

## 6. Price Update (`services/pipeline.py`)

```
for each stock:
  price = yf.Ticker(stock.ticker).fast_info.last_price
  if price is not None:
    UPDATE stocks SET last_price = price, updated_at = now()
    WHERE ticker = stock.ticker
```

Runs last so signal generation has the most recent price context on the next cycle.

---

## 7. Scheduler (`scheduler.py`)

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime

scheduler = AsyncIOScheduler()
scheduler.add_job(
    run_pipeline,
    'interval',
    minutes=30,
    next_run_time=datetime.now(),  # run immediately on startup
    id='market_pipeline',
    max_instances=1,               # prevent overlapping runs
    coalesce=True,                 # skip missed runs if server was down
)
```

**FastAPI lifespan integration (`main.py`):**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)
```

---

## 8. Manual Trigger Endpoint

`POST /admin/pipeline/run` — triggers `run_pipeline()` immediately, returns `{"status": "started"}`. Useful for development and testing without waiting 30 minutes.

---

## 9. Logging

Each pipeline run logs to stdout:

```
[pipeline] Starting pipeline run — 17 stocks
[pipeline] Ingested 34 new articles (12 duplicates skipped)
[pipeline] Features extracted for 34 articles
[pipeline] Signals: 12 updated, 5 unchanged (below threshold)
[pipeline] Prices: 17 updated
[pipeline] Pipeline complete in 8.4s
[ingestor] ERROR: FAKE ticker failed — yfinance returned no data (non-fatal)
```

---

## 10. Out of Scope (Future)

- Celery/Redis migration
- GDELT or NewsAPI as additional sources
- LLM-based event classification
- Historical analog from real backtesting data
- Per-article source credibility learned from outcomes
- Deduplication across tickers (same article tagged to multiple stocks)
