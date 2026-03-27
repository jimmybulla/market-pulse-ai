# Phase 1: Backend + Database Design
**Date:** 2026-03-27
**Scope:** FastAPI backend, Supabase schema, rules-based scoring engine, seed data
**Approach:** Approach A — Minimal API with seed data, no Celery, no auth, stub LLM explanations

---

## Decisions & Constraints

- **No authentication** — all endpoints open for Phase 1
- **No Celery/Redis** — scoring engine is pure Python, wraps into Celery in Phase 2
- **No real news API** — mock JSON seed data only
- **No LLM explanations** — stub text `"AI analysis pending"` on all signals
- **Supabase project** already created by user
- **Admin endpoints** protected by `ADMIN_SECRET` query param (accidental-trigger prevention only)

---

## 1. Project Structure

```
market-pulse-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Env vars, settings
│   │   ├── database.py          # Supabase client setup
│   │   ├── models/
│   │   │   ├── stock.py         # Pydantic schemas for stocks
│   │   │   ├── signal.py        # Pydantic schemas for signals
│   │   │   ├── news.py          # Pydantic schemas for news articles
│   │   │   └── event.py         # Pydantic schemas for events
│   │   ├── routers/
│   │   │   ├── signals.py       # GET /signals, GET /signals/{id}
│   │   │   ├── stocks.py        # GET /stocks, GET /stocks/{ticker}
│   │   │   └── news.py          # GET /news, GET /news/{ticker}
│   │   ├── services/
│   │   │   ├── scoring.py       # Rules-based scoring engine
│   │   │   └── seed.py          # Seed data loader
│   │   └── seed_data/
│   │       ├── stocks.json      # 20 US large-cap stocks
│   │       ├── news.json        # Mock articles with scores
│   │       └── sources.json     # News sources
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── docs/
└── .gitignore
```

---

## 2. Database Schema

Single migration file run directly in Supabase SQL editor.

```sql
-- migrations/001_initial_schema.sql

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT,
    credibility_score FLOAT DEFAULT 0.7,
    type TEXT CHECK (type IN ('news', 'press_release', 'sec_filing'))
);

CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    market_cap NUMERIC,
    last_price NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id),
    headline TEXT NOT NULL,
    body TEXT,
    url TEXT UNIQUE,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    tickers TEXT[],
    sentiment_score FLOAT,
    event_type TEXT CHECK (event_type IN ('earnings','regulation','m&a','product','executive','macro')),
    novelty_score FLOAT DEFAULT 0.5,
    credibility_score FLOAT DEFAULT 0.7
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id),
    article_id UUID REFERENCES news_articles(id),
    event_type TEXT,
    severity FLOAT,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id),
    direction TEXT CHECK (direction IN ('bullish','bearish','crash_risk')),
    confidence FLOAT,
    expected_move_low FLOAT,
    expected_move_high FLOAT,
    horizon_days INT,
    opportunity_score FLOAT,
    crash_risk_score FLOAT,
    rank INT,
    explanation TEXT,
    drivers JSONB,
    evidence JSONB,
    historical_analog JSONB,
    risk_flags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE signal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES signals(id),
    stock_id UUID REFERENCES stocks(id),
    direction TEXT,
    confidence FLOAT,
    expected_move_low FLOAT,
    expected_move_high FLOAT,
    horizon_days INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    actual_move FLOAT,
    was_correct BOOL,
    accuracy_notes TEXT
);

-- Indexes
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_signals_stock ON signals(stock_id, created_at DESC);
CREATE INDEX idx_signals_rank ON signals(rank ASC);
CREATE INDEX idx_signal_history_stock ON signal_history(stock_id, created_at DESC);
```

---

## 3. API Endpoints

```
Base URL: http://localhost:8000

GET  /signals                    # All active signals, ranked
     ?direction=bullish|bearish|crash_risk
     ?horizon=5|30|90
     ?limit=10&offset=0

GET  /signals/{id}               # Single signal, full detail

GET  /stocks                     # All tracked stocks
     ?sector=Technology
     ?limit=50&offset=0

GET  /stocks/{ticker}            # Stock + its latest signal

GET  /news                       # Latest articles
     ?ticker=TSLA
     ?event_type=earnings
     ?limit=20&offset=0

GET  /news/{id}                  # Single article

GET  /analytics/accuracy         # Accuracy stats (hit_rate, avg_move, by direction)

POST /admin/seed?secret=xxx      # Load seed data
DELETE /admin/clear?secret=xxx   # Wipe all tables
```

### Standard paginated response shape
```json
{
  "data": [...],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

### Signal object shape
```json
{
  "id": "uuid",
  "ticker": "TSLA",
  "stock_name": "Tesla Inc.",
  "direction": "bullish",
  "confidence": 0.72,
  "expected_move_low": 0.03,
  "expected_move_high": 0.07,
  "horizon_days": 5,
  "opportunity_score": 0.68,
  "crash_risk_score": 0.12,
  "rank": 5,
  "explanation": "AI analysis pending",
  "drivers": ["Strong earnings sentiment", "High social momentum"],
  "risk_flags": ["Overextended rally"],
  "created_at": "2026-03-27T10:00:00Z"
}
```

---

## 4. Scoring Engine

Pure Python in `services/scoring.py`. Runs at seed time, writes pre-computed signals to DB.

### Formula
```
article_score = (sentiment × credibility) + (severity × novelty)
opportunity_score = weighted_avg(positive article_scores, weight=credibility)
crash_risk_score  = weighted_avg(negative article_scores, weight=severity)
```

### Direction Rules
| Condition | Direction |
|-----------|-----------|
| opportunity > 0.6 AND crash_risk < 0.3 | bullish |
| crash_risk > 0.75 | crash_risk |
| opportunity < 0.4 AND crash_risk > 0.6 | bearish |
| anything else | None (not inserted) |

### Confidence → Expected Move
| Confidence | Move Range |
|------------|------------|
| ≥ 0.80 | (conf × 0.05) to (conf × 0.10) — tight |
| 0.60–0.79 | (conf × 0.03) to (conf × 0.08) — moderate |
| < 0.60 | (conf × 0.01) to (conf × 0.06) — wide |

### Driver Extraction
Top 3 drivers derived from article event_types and sentiment scores. Mapped to human-readable strings (e.g., `earnings` + positive → `"Strong earnings sentiment"`).

### Evidence JSONB Shape
```json
{
  "article_count": 3,
  "sources": ["Reuters", "Bloomberg"],
  "avg_credibility": 0.88,
  "article_ids": ["uuid1", "uuid2"]
}
```

---

## 5. Seed Data

### Stocks (20 US large-cap)
| Sector | Tickers |
|--------|---------|
| Technology | AAPL, MSFT, NVDA, GOOGL, META |
| Finance | JPM, BAC, GS, V, MA |
| Healthcare | JNJ, PFE, UNH, ABBV, MRK |
| Energy | XOM, CVX, COP |
| Consumer | AMZN, TSLA |

### Article Types per Stock
Each stock gets 3–5 articles with pre-set scores. Mix of event types: earnings, regulation, product, executive, macro.

### Horizon Days
Seed signals use one of three horizon values: `5` (near-term), `30` (medium), `90` (extended). Bullish signals default to 5 days, bearish to 30, crash_risk to 5.

### Expected Signal Distribution
- ~10 bullish signals
- ~5 bearish signals
- ~2 crash_risk signals
- ~3 stocks below threshold (no signal)

### Seed Flow
```
POST /admin/seed
  1. Insert sources
  2. Insert stocks
  3. Insert news_articles + events
  4. Run scoring engine per stock
  5. Insert signals ranked by opportunity_score DESC
```

---

## 6. Environment Variables

```bash
# .env.example
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-anon-or-service-key
ADMIN_SECRET=dev-secret-change-me
ENV=development
```

---

## Out of Scope for Phase 1
- Authentication
- Celery / Redis
- Real NewsAPI ingestion
- LLM explanation generation
- Frontend
- Deployment (Railway/Render)
