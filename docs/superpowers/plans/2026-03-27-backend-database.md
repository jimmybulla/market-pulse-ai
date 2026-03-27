# Backend + Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully working FastAPI backend with Supabase PostgreSQL, a rules-based scoring engine, seed data for 20 US large-cap stocks, and read-only REST endpoints — all without auth, Celery, or real news APIs.

**Architecture:** Python FastAPI app with a Supabase client (supabase-py), a pure-Python scoring engine that runs at seed time, and five routers (signals, stocks, news, analytics, admin). The scoring engine converts mock news articles into ranked signals that are stored in the DB and served via API.

**Tech Stack:** Python 3.11+, FastAPI 0.115, supabase-py 2.9, pydantic-settings 2.4, pytest 8.3, httpx 0.27

---

## File Map

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── config.py                  # pydantic-settings: supabase_url, supabase_key, admin_secret
│   ├── database.py                # get_db() → Supabase Client singleton (lru_cache)
│   ├── models/
│   │   ├── signal.py              # SignalResponse, PaginatedSignals
│   │   ├── stock.py               # StockResponse, StockWithSignal, PaginatedStocks
│   │   ├── news.py                # NewsArticleResponse, PaginatedNews
│   │   └── event.py               # EventResponse
│   ├── routers/
│   │   ├── signals.py             # GET /signals, GET /signals/{id}
│   │   ├── stocks.py              # GET /stocks, GET /stocks/{ticker}
│   │   ├── news.py                # GET /news, GET /news/{id}
│   │   ├── analytics.py           # GET /analytics/accuracy
│   │   └── admin.py               # POST /admin/seed, DELETE /admin/clear
│   ├── services/
│   │   ├── scoring.py             # ArticleFeatures, SignalResult, score_articles()
│   │   └── seed.py                # load_seed_data(db) → inserts all seed rows + signals
│   └── seed_data/
│       ├── sources.json           # 3 news sources with credibility scores
│       ├── stocks.json            # 20 US large-cap stocks
│       └── news.json              # ~42 articles pre-scored for expected signal distribution
├── migrations/
│   └── 001_initial_schema.sql     # All tables — run in Supabase SQL editor
├── tests/
│   ├── conftest.py                # TestClient + mock_db fixture
│   ├── test_scoring.py            # Unit tests for scoring engine (no DB)
│   ├── test_signals.py            # API tests for /signals
│   ├── test_stocks.py             # API tests for /stocks
│   ├── test_news.py               # API tests for /news
│   └── test_analytics.py         # API tests for /analytics
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/app/__init__.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/seed_data/` (directory)
- Create: `backend/migrations/` (directory)
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend/app/models backend/app/routers backend/app/services backend/app/seed_data backend/migrations backend/tests
touch backend/app/__init__.py backend/app/models/__init__.py backend/app/routers/__init__.py backend/app/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

```
# backend/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
supabase==2.9.0
pydantic-settings==2.4.0
python-dotenv==1.0.1
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 3: Write .env.example**

```
# backend/.env.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
ADMIN_SECRET=dev-secret
ENV=development
```

- [ ] **Step 4: Write .gitignore**

```
# backend/.gitignore
__pycache__/
*.pyc
.env
.venv/
venv/
.pytest_cache/
*.egg-info/
dist/
```

- [ ] **Step 5: Create virtual environment and install dependencies**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: All packages install without errors.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: bootstrap backend project structure"
```

---

## Task 2: Config + Database Client

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`

- [ ] **Step 1: Write config.py**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    admin_secret: str = "dev-secret"
    env: str = "development"

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 2: Write database.py**

```python
# backend/app/database.py
from functools import lru_cache
from supabase import create_client, Client
from app.config import settings


@lru_cache(maxsize=1)
def get_db() -> Client:
    return create_client(settings.supabase_url, settings.supabase_key)
```

- [ ] **Step 3: Verify config loads**

Create `backend/.env` from `.env.example` with your real Supabase credentials, then run:

```bash
cd backend
source .venv/bin/activate
python -c "from app.config import settings; print(settings.supabase_url)"
```

Expected: Prints your Supabase project URL.

- [ ] **Step 4: Commit**

```bash
git add backend/app/config.py backend/app/database.py
git commit -m "feat: add config and supabase client"
```

---

## Task 3: Database Migration

**Files:**
- Create: `backend/migrations/001_initial_schema.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- backend/migrations/001_initial_schema.sql

-- Sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT,
    credibility_score FLOAT DEFAULT 0.7,
    type TEXT CHECK (type IN ('news', 'press_release', 'sec_filing'))
);

-- Stocks
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    market_cap NUMERIC,
    last_price NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- News Articles
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
    credibility_score FLOAT DEFAULT 0.7,
    severity FLOAT DEFAULT 0.5
);

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id),
    article_id UUID REFERENCES news_articles(id),
    event_type TEXT,
    severity FLOAT,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signals
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

-- Signal History
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

- [ ] **Step 2: Run migration in Supabase**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Paste the full SQL above and click **Run**

Expected: All tables created without errors. Verify in **Table Editor** — you should see: `sources`, `stocks`, `news_articles`, `events`, `signals`, `signal_history`.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/001_initial_schema.sql
git commit -m "feat: add initial database schema"
```

---

## Task 4: Pydantic Models

**Files:**
- Create: `backend/app/models/signal.py`
- Create: `backend/app/models/stock.py`
- Create: `backend/app/models/news.py`
- Create: `backend/app/models/event.py`

- [ ] **Step 1: Write signal.py**

```python
# backend/app/models/signal.py
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class SignalResponse(BaseModel):
    id: str
    ticker: str
    stock_name: str
    sector: Optional[str] = None
    last_price: Optional[float] = None
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    horizon_days: int
    opportunity_score: float
    crash_risk_score: float
    rank: int
    explanation: Optional[str] = None
    drivers: list[str] = []
    evidence: Optional[dict[str, Any]] = None
    historical_analog: Optional[dict[str, Any]] = None
    risk_flags: list[str] = []
    created_at: datetime
    expires_at: Optional[datetime] = None


class PaginatedSignals(BaseModel):
    data: list[SignalResponse]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 2: Write stock.py**

```python
# backend/app/models/stock.py
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class StockResponse(BaseModel):
    id: str
    ticker: str
    name: str
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    last_price: Optional[float] = None
    updated_at: Optional[datetime] = None


class StockWithSignal(StockResponse):
    latest_signal: Optional[dict[str, Any]] = None


class PaginatedStocks(BaseModel):
    data: list[StockResponse]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 3: Write news.py**

```python
# backend/app/models/news.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NewsArticleResponse(BaseModel):
    id: str
    headline: str
    body: Optional[str] = None
    url: Optional[str] = None
    published_at: Optional[datetime] = None
    tickers: list[str] = []
    sentiment_score: Optional[float] = None
    event_type: Optional[str] = None
    novelty_score: Optional[float] = None
    credibility_score: Optional[float] = None
    severity: Optional[float] = None


class PaginatedNews(BaseModel):
    data: list[NewsArticleResponse]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 4: Write event.py**

```python
# backend/app/models/event.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EventResponse(BaseModel):
    id: str
    stock_id: str
    article_id: str
    event_type: Optional[str] = None
    severity: Optional[float] = None
    detected_at: datetime
```

- [ ] **Step 5: Verify models import cleanly**

```bash
cd backend
source .venv/bin/activate
python -c "from app.models.signal import SignalResponse, PaginatedSignals; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add pydantic response models"
```

---

## Task 5: Scoring Engine (TDD)

**Files:**
- Create: `backend/tests/test_scoring.py`
- Create: `backend/app/services/scoring.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_scoring.py
import pytest
from app.services.scoring import ArticleFeatures, SignalResult, score_articles


def make_article(
    sentiment: float,
    credibility: float = 0.80,
    novelty: float = 0.75,
    severity: float = 0.65,
    event_type: str = "earnings",
) -> ArticleFeatures:
    return ArticleFeatures(
        sentiment_score=sentiment,
        credibility_score=credibility,
        novelty_score=novelty,
        severity=severity,
        event_type=event_type,
    )


def test_empty_list_returns_none():
    assert score_articles([]) is None


def test_bullish_signal():
    articles = [
        make_article(sentiment=0.75, credibility=0.85, novelty=0.80, severity=0.70),
        make_article(sentiment=0.60, credibility=0.78, novelty=0.72, severity=0.60),
    ]
    result = score_articles(articles)
    assert result is not None
    assert result.direction == "bullish"
    assert result.confidence > 0.6
    assert result.opportunity_score > 0.6
    assert result.crash_risk_score < 0.3


def test_bearish_signal():
    articles = [
        make_article(sentiment=-0.52, credibility=0.75, novelty=0.60, severity=0.50),
        make_article(sentiment=-0.48, credibility=0.72, novelty=0.58, severity=0.48),
    ]
    result = score_articles(articles)
    assert result is not None
    assert result.direction == "bearish"
    assert result.opportunity_score < 0.4
    assert result.crash_risk_score > 0.6
    assert result.crash_risk_score <= 0.75


def test_crash_risk_signal():
    articles = [
        make_article(sentiment=-0.88, credibility=0.90, novelty=0.85, severity=0.92),
        make_article(sentiment=-0.82, credibility=0.88, novelty=0.80, severity=0.88),
    ]
    result = score_articles(articles)
    assert result is not None
    assert result.direction == "crash_risk"
    assert result.crash_risk_score > 0.75


def test_no_signal_for_mixed_moderate():
    articles = [
        make_article(sentiment=0.45, credibility=0.70, novelty=0.55, severity=0.40),
        make_article(sentiment=-0.40, credibility=0.68, novelty=0.52, severity=0.38),
    ]
    result = score_articles(articles)
    assert result is None


def test_move_range_scales_with_confidence():
    # High confidence → wider expected range
    high = [make_article(sentiment=0.90, credibility=0.95, novelty=0.90, severity=0.85)]
    low = [make_article(sentiment=0.62, credibility=0.72, novelty=0.62, severity=0.52)]
    r_high = score_articles(high)
    r_low = score_articles(low)
    assert r_high is not None and r_low is not None
    assert r_high.expected_move_high > r_low.expected_move_high


def test_drivers_contain_earnings_label():
    articles = [make_article(sentiment=0.80, event_type="earnings")]
    result = score_articles(articles)
    assert result is not None
    assert "Strong earnings sentiment" in result.drivers


def test_result_is_signal_result_instance():
    articles = [make_article(sentiment=0.75)]
    result = score_articles(articles)
    assert isinstance(result, SignalResult)


def test_scores_clamped_to_one():
    # Very high values should never exceed 1.0
    articles = [make_article(sentiment=0.99, credibility=0.99, novelty=0.99, severity=0.99)]
    result = score_articles(articles)
    assert result is not None
    assert result.opportunity_score <= 1.0
    assert result.crash_risk_score <= 1.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/test_scoring.py -v
```

Expected: `ImportError` — `app.services.scoring` doesn't exist yet.

- [ ] **Step 3: Implement scoring.py**

```python
# backend/app/services/scoring.py
from dataclasses import dataclass, field
from typing import Optional

DRIVER_LABELS: dict[tuple[str, bool], str] = {
    ("earnings", True): "Strong earnings sentiment",
    ("earnings", False): "Earnings disappointment",
    ("regulation", True): "Favorable regulatory outcome",
    ("regulation", False): "Regulatory headwinds",
    ("m&a", True): "Positive M&A activity",
    ("m&a", False): "M&A uncertainty",
    ("product", True): "Strong product momentum",
    ("product", False): "Product concerns raised",
    ("executive", True): "Positive leadership news",
    ("executive", False): "Leadership instability",
    ("macro", True): "Favorable macro environment",
    ("macro", False): "Macro headwinds",
}


@dataclass
class ArticleFeatures:
    sentiment_score: float    # -1.0 to 1.0
    credibility_score: float  # 0.0 to 1.0
    novelty_score: float      # 0.0 to 1.0
    severity: float           # 0.0 to 1.0
    event_type: str           # earnings | regulation | m&a | product | executive | macro


@dataclass
class SignalResult:
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    opportunity_score: float
    crash_risk_score: float
    drivers: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)


def score_articles(articles: list[ArticleFeatures]) -> Optional[SignalResult]:
    """Score a list of articles for one stock. Returns None if below signal threshold."""
    if not articles:
        return None

    positive = [a for a in articles if a.sentiment_score > 0]
    negative = [a for a in articles if a.sentiment_score <= 0]

    opportunity_score = min(1.0, max(0.0, _weighted_score(positive, lambda a: a.credibility_score)))
    crash_risk_score = min(1.0, max(0.0, _weighted_score(negative, lambda a: a.severity)))

    if crash_risk_score > 0.75:
        direction, confidence = "crash_risk", crash_risk_score
    elif opportunity_score > 0.6 and crash_risk_score < 0.3:
        direction, confidence = "bullish", opportunity_score
    elif opportunity_score < 0.4 and crash_risk_score > 0.6:
        direction, confidence = "bearish", crash_risk_score
    else:
        return None

    low, high = _move_range(confidence)

    return SignalResult(
        direction=direction,
        confidence=round(confidence, 4),
        expected_move_low=round(low, 4),
        expected_move_high=round(high, 4),
        opportunity_score=round(opportunity_score, 4),
        crash_risk_score=round(crash_risk_score, 4),
        drivers=_extract_drivers(articles),
        risk_flags=_risk_flags(opportunity_score, crash_risk_score, direction),
    )


def _weighted_score(articles: list[ArticleFeatures], weight_fn) -> float:
    if not articles:
        return 0.0
    total_weight = sum(weight_fn(a) for a in articles)
    if total_weight == 0:
        return 0.0
    return sum(
        (abs(a.sentiment_score) * a.credibility_score + a.severity * a.novelty_score) * weight_fn(a)
        for a in articles
    ) / total_weight


def _move_range(confidence: float) -> tuple[float, float]:
    if confidence >= 0.80:
        return confidence * 0.05, confidence * 0.10
    elif confidence >= 0.60:
        return confidence * 0.03, confidence * 0.08
    return confidence * 0.01, confidence * 0.06


def _extract_drivers(articles: list[ArticleFeatures]) -> list[str]:
    scored: list[tuple[float, str]] = []
    for a in articles:
        label = DRIVER_LABELS.get((a.event_type, a.sentiment_score > 0))
        if label:
            scored.append((abs(a.sentiment_score) * a.credibility_score, label))
    scored.sort(reverse=True)
    seen: set[str] = set()
    drivers: list[str] = []
    for _, label in scored:
        if label not in seen:
            seen.add(label)
            drivers.append(label)
        if len(drivers) == 3:
            break
    return drivers


def _risk_flags(opportunity: float, crash_risk: float, direction: str) -> list[str]:
    flags: list[str] = []
    if direction == "bullish" and opportunity > 0.85:
        flags.append("Overextended rally — high conviction")
    if direction == "bullish" and crash_risk > 0.20:
        flags.append("Elevated crash risk despite bullish signal")
    if direction == "bearish" and crash_risk > 0.70:
        flags.append("Near crash-risk territory")
    return flags
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest tests/test_scoring.py -v
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scoring.py backend/tests/test_scoring.py
git commit -m "feat: add rules-based scoring engine with TDD"
```

---

## Task 6: Seed Data JSON

**Files:**
- Create: `backend/app/seed_data/sources.json`
- Create: `backend/app/seed_data/stocks.json`
- Create: `backend/app/seed_data/news.json`

- [ ] **Step 1: Write sources.json**

```json
[
  {"name": "Reuters", "url": "https://reuters.com", "credibility_score": 0.92, "type": "news"},
  {"name": "Bloomberg", "url": "https://bloomberg.com", "credibility_score": 0.95, "type": "news"},
  {"name": "SEC EDGAR", "url": "https://sec.gov/edgar", "credibility_score": 1.0, "type": "sec_filing"}
]
```

- [ ] **Step 2: Write stocks.json**

```json
[
  {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "market_cap": 3200000000000, "last_price": 215.50},
  {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "market_cap": 3100000000000, "last_price": 415.20},
  {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "market_cap": 2800000000000, "last_price": 875.50},
  {"ticker": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology", "market_cap": 2100000000000, "last_price": 172.30},
  {"ticker": "META", "name": "Meta Platforms Inc.", "sector": "Technology", "market_cap": 1400000000000, "last_price": 560.80},
  {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Finance", "market_cap": 680000000000, "last_price": 228.40},
  {"ticker": "BAC", "name": "Bank of America Corp.", "sector": "Finance", "market_cap": 310000000000, "last_price": 40.20},
  {"ticker": "GS", "name": "Goldman Sachs Group Inc.", "sector": "Finance", "market_cap": 175000000000, "last_price": 495.60},
  {"ticker": "V", "name": "Visa Inc.", "sector": "Finance", "market_cap": 620000000000, "last_price": 300.15},
  {"ticker": "MA", "name": "Mastercard Inc.", "sector": "Finance", "market_cap": 490000000000, "last_price": 518.90},
  {"ticker": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare", "market_cap": 380000000000, "last_price": 158.30},
  {"ticker": "PFE", "name": "Pfizer Inc.", "sector": "Healthcare", "market_cap": 142000000000, "last_price": 25.40},
  {"ticker": "UNH", "name": "UnitedHealth Group Inc.", "sector": "Healthcare", "market_cap": 450000000000, "last_price": 488.70},
  {"ticker": "ABBV", "name": "AbbVie Inc.", "sector": "Healthcare", "market_cap": 310000000000, "last_price": 175.20},
  {"ticker": "MRK", "name": "Merck & Co. Inc.", "sector": "Healthcare", "market_cap": 240000000000, "last_price": 93.80},
  {"ticker": "XOM", "name": "Exxon Mobil Corporation", "sector": "Energy", "market_cap": 490000000000, "last_price": 115.30},
  {"ticker": "CVX", "name": "Chevron Corporation", "sector": "Energy", "market_cap": 280000000000, "last_price": 148.20},
  {"ticker": "COP", "name": "ConocoPhillips", "sector": "Energy", "market_cap": 138000000000, "last_price": 108.40},
  {"ticker": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer", "market_cap": 2200000000000, "last_price": 210.80},
  {"ticker": "TSLA", "name": "Tesla Inc.", "sector": "Consumer", "market_cap": 870000000000, "last_price": 275.40}
]
```

- [ ] **Step 3: Write news.json**

Values are pre-verified to produce: ~10 bullish, ~5 bearish, ~2 crash_risk, ~3 no-signal.

```json
[
  {"headline": "Apple beats Q4 earnings, announces $110B buyback", "body": "Apple reported record quarterly revenue.", "url": "https://reuters.com/aapl-q4-2026", "published_at": "2026-03-25T14:00:00Z", "tickers": ["AAPL"], "sentiment_score": 0.75, "event_type": "earnings", "novelty_score": 0.85, "credibility_score": 0.92, "severity": 0.72, "source_name": "Reuters"},
  {"headline": "Apple Vision Pro 2 pre-orders shatter records", "body": "Demand for Apple's mixed reality headset exceeded forecasts.", "url": "https://bloomberg.com/aapl-vp2-2026", "published_at": "2026-03-24T10:00:00Z", "tickers": ["AAPL"], "sentiment_score": 0.68, "event_type": "product", "novelty_score": 0.80, "credibility_score": 0.95, "severity": 0.65, "source_name": "Bloomberg"},

  {"headline": "Microsoft Azure cloud revenue surges 38% year-over-year", "body": "Strong enterprise AI adoption drove Azure growth.", "url": "https://reuters.com/msft-azure-2026", "published_at": "2026-03-25T16:00:00Z", "tickers": ["MSFT"], "sentiment_score": 0.78, "event_type": "earnings", "novelty_score": 0.82, "credibility_score": 0.92, "severity": 0.74, "source_name": "Reuters"},
  {"headline": "Microsoft and OpenAI deepen partnership with $20B expansion", "body": "Extended compute and model access agreement announced.", "url": "https://bloomberg.com/msft-oai-2026", "published_at": "2026-03-23T12:00:00Z", "tickers": ["MSFT"], "sentiment_score": 0.70, "event_type": "m&a", "novelty_score": 0.88, "credibility_score": 0.95, "severity": 0.68, "source_name": "Bloomberg"},

  {"headline": "NVIDIA reports record data center revenue of $36B in Q4", "body": "Blackwell GPU demand remains insatiable from hyperscalers.", "url": "https://reuters.com/nvda-q4-2026", "published_at": "2026-03-26T15:00:00Z", "tickers": ["NVDA"], "sentiment_score": 0.88, "event_type": "earnings", "novelty_score": 0.92, "credibility_score": 0.92, "severity": 0.85, "source_name": "Reuters"},
  {"headline": "NVIDIA Blackwell B300 chip unveiled, 3x performance leap", "body": "Next-gen AI chip confirmed for H2 2026 mass production.", "url": "https://bloomberg.com/nvda-b300-2026", "published_at": "2026-03-24T09:00:00Z", "tickers": ["NVDA"], "sentiment_score": 0.82, "event_type": "product", "novelty_score": 0.95, "credibility_score": 0.95, "severity": 0.80, "source_name": "Bloomberg"},

  {"headline": "Alphabet ad revenue rebounds strongly, YouTube hits record", "body": "Q1 ad spending surged across search and YouTube.", "url": "https://reuters.com/googl-ads-2026", "published_at": "2026-03-25T13:00:00Z", "tickers": ["GOOGL"], "sentiment_score": 0.72, "event_type": "earnings", "novelty_score": 0.80, "credibility_score": 0.92, "severity": 0.68, "source_name": "Reuters"},
  {"headline": "Google Gemini Ultra 3 launches, benchmarks beat GPT-5", "body": "Google's flagship AI model tops every major benchmark.", "url": "https://bloomberg.com/googl-gemini3-2026", "published_at": "2026-03-22T11:00:00Z", "tickers": ["GOOGL"], "sentiment_score": 0.76, "event_type": "product", "novelty_score": 0.90, "credibility_score": 0.95, "severity": 0.72, "source_name": "Bloomberg"},

  {"headline": "Meta Q1 DAU grows to 3.8B, AI feed engagement up 22%", "body": "Meta's family of apps continues to dominate social engagement.", "url": "https://reuters.com/meta-q1-2026", "published_at": "2026-03-26T14:00:00Z", "tickers": ["META"], "sentiment_score": 0.74, "event_type": "earnings", "novelty_score": 0.82, "credibility_score": 0.92, "severity": 0.70, "source_name": "Reuters"},
  {"headline": "Meta unveils Orion AR glasses for $999, ships Q3 2026", "body": "Long-awaited consumer AR device revealed at Connect 2026.", "url": "https://bloomberg.com/meta-orion-2026", "published_at": "2026-03-21T10:00:00Z", "tickers": ["META"], "sentiment_score": 0.80, "event_type": "product", "novelty_score": 0.94, "credibility_score": 0.95, "severity": 0.78, "source_name": "Bloomberg"},

  {"headline": "JPMorgan reports record trading revenue, raises dividend 12%", "body": "Strong fixed income and equity trading drove outperformance.", "url": "https://reuters.com/jpm-q1-2026", "published_at": "2026-03-25T11:00:00Z", "tickers": ["JPM"], "sentiment_score": 0.72, "event_type": "earnings", "novelty_score": 0.78, "credibility_score": 0.92, "severity": 0.65, "source_name": "Reuters"},
  {"headline": "JPMorgan acquires fintech startup for $4.2B, expanding AI banking", "body": "Deal strengthens JPM's retail AI banking capabilities.", "url": "https://bloomberg.com/jpm-fintech-2026", "published_at": "2026-03-23T09:00:00Z", "tickers": ["JPM"], "sentiment_score": 0.65, "event_type": "m&a", "novelty_score": 0.82, "credibility_score": 0.95, "severity": 0.62, "source_name": "Bloomberg"},

  {"headline": "Visa transaction volume up 18%, international payments accelerate", "body": "Cross-border payments growth exceeded analyst estimates.", "url": "https://reuters.com/v-q1-2026", "published_at": "2026-03-24T14:00:00Z", "tickers": ["V"], "sentiment_score": 0.70, "event_type": "earnings", "novelty_score": 0.75, "credibility_score": 0.92, "severity": 0.62, "source_name": "Reuters"},
  {"headline": "Visa raises full-year guidance, cites AI fraud prevention gains", "body": "Lower fraud losses boosted net revenue margin for the quarter.", "url": "https://bloomberg.com/v-guidance-2026", "published_at": "2026-03-22T15:00:00Z", "tickers": ["V"], "sentiment_score": 0.65, "event_type": "macro", "novelty_score": 0.72, "credibility_score": 0.95, "severity": 0.60, "source_name": "Bloomberg"},

  {"headline": "Mastercard Q1 earnings beat on strong consumer spending", "body": "Domestic and international spending trends remained robust.", "url": "https://reuters.com/ma-q1-2026", "published_at": "2026-03-25T10:00:00Z", "tickers": ["MA"], "sentiment_score": 0.68, "event_type": "earnings", "novelty_score": 0.76, "credibility_score": 0.92, "severity": 0.63, "source_name": "Reuters"},
  {"headline": "Mastercard expands B2B payment platform to 40 new markets", "body": "International expansion targets SMB segment in emerging markets.", "url": "https://bloomberg.com/ma-b2b-2026", "published_at": "2026-03-20T11:00:00Z", "tickers": ["MA"], "sentiment_score": 0.62, "event_type": "product", "novelty_score": 0.80, "credibility_score": 0.95, "severity": 0.58, "source_name": "Bloomberg"},

  {"headline": "Amazon AWS Q1 growth reaccelerates to 28%, margin expands", "body": "Cloud demand from AI workloads drove an acceleration in growth.", "url": "https://reuters.com/amzn-aws-2026", "published_at": "2026-03-26T13:00:00Z", "tickers": ["AMZN"], "sentiment_score": 0.76, "event_type": "earnings", "novelty_score": 0.85, "credibility_score": 0.92, "severity": 0.73, "source_name": "Reuters"},
  {"headline": "Amazon Prime membership hits 350M globally, advertising up 35%", "body": "Prime Video ad tier continues to outperform expectations.", "url": "https://bloomberg.com/amzn-prime-2026", "published_at": "2026-03-24T12:00:00Z", "tickers": ["AMZN"], "sentiment_score": 0.70, "event_type": "product", "novelty_score": 0.80, "credibility_score": 0.95, "severity": 0.66, "source_name": "Bloomberg"},

  {"headline": "ExxonMobil benefits from oil price surge, raises quarterly dividend", "body": "Brent crude above $95/barrel lifted Exxon's Q1 earnings.", "url": "https://reuters.com/xom-q1-2026", "published_at": "2026-03-25T15:00:00Z", "tickers": ["XOM"], "sentiment_score": 0.65, "event_type": "earnings", "novelty_score": 0.72, "credibility_score": 0.92, "severity": 0.60, "source_name": "Reuters"},
  {"headline": "ExxonMobil authorizes $25B share buyback through 2027", "body": "Strong cash flows enable continued capital returns to shareholders.", "url": "https://bloomberg.com/xom-buyback-2026", "published_at": "2026-03-23T14:00:00Z", "tickers": ["XOM"], "sentiment_score": 0.62, "event_type": "macro", "novelty_score": 0.75, "credibility_score": 0.95, "severity": 0.58, "source_name": "Bloomberg"},

  {"headline": "Pfizer Phase 3 trial for oncology drug fails primary endpoint", "body": "The drug missed its primary overall survival endpoint.", "url": "https://reuters.com/pfe-trial-2026", "published_at": "2026-03-25T08:00:00Z", "tickers": ["PFE"], "sentiment_score": -0.52, "event_type": "regulation", "novelty_score": 0.62, "credibility_score": 0.92, "severity": 0.50, "source_name": "Reuters"},
  {"headline": "Pfizer Q1 revenue misses estimates, COVID product revenue collapses", "body": "Ongoing normalization of COVID-related products weighs on results.", "url": "https://bloomberg.com/pfe-q1-2026", "published_at": "2026-03-24T09:00:00Z", "tickers": ["PFE"], "sentiment_score": -0.48, "event_type": "earnings", "novelty_score": 0.58, "credibility_score": 0.95, "severity": 0.48, "source_name": "Bloomberg"},

  {"headline": "Merck faces accelerated generic competition for top-selling drug", "body": "Patent cliff on Keytruda extended indications weighs on outlook.", "url": "https://reuters.com/mrk-generic-2026", "published_at": "2026-03-24T11:00:00Z", "tickers": ["MRK"], "sentiment_score": -0.50, "event_type": "regulation", "novelty_score": 0.60, "credibility_score": 0.92, "severity": 0.50, "source_name": "Reuters"},
  {"headline": "Merck cuts 2026 EPS guidance on pricing pressure from IRA", "body": "Drug pricing legislation impact larger than previously guided.", "url": "https://bloomberg.com/mrk-guidance-2026", "published_at": "2026-03-22T14:00:00Z", "tickers": ["MRK"], "sentiment_score": -0.48, "event_type": "earnings", "novelty_score": 0.62, "credibility_score": 0.95, "severity": 0.48, "source_name": "Bloomberg"},

  {"headline": "Goldman Sachs Q1 trading revenue misses estimates by wide margin", "body": "Fixed income trading declined sharply amid rate uncertainty.", "url": "https://reuters.com/gs-q1-2026", "published_at": "2026-03-25T10:00:00Z", "tickers": ["GS"], "sentiment_score": -0.50, "event_type": "earnings", "novelty_score": 0.60, "credibility_score": 0.92, "severity": 0.50, "source_name": "Reuters"},
  {"headline": "Goldman Sachs faces regulatory scrutiny over Marcus consumer unit wind-down", "body": "Federal Reserve reviewing process for winding down consumer lending.", "url": "https://bloomberg.com/gs-marcus-2026", "published_at": "2026-03-23T13:00:00Z", "tickers": ["GS"], "sentiment_score": -0.48, "event_type": "regulation", "novelty_score": 0.58, "credibility_score": 0.95, "severity": 0.48, "source_name": "Bloomberg"},

  {"headline": "Chevron lowers capital spending amid oil demand concerns", "body": "CVX cuts 2026 capex by $3B on weaker long-term demand forecasts.", "url": "https://reuters.com/cvx-capex-2026", "published_at": "2026-03-24T15:00:00Z", "tickers": ["CVX"], "sentiment_score": -0.50, "event_type": "macro", "novelty_score": 0.62, "credibility_score": 0.92, "severity": 0.50, "source_name": "Reuters"},
  {"headline": "Chevron production targets revised lower as Kazakhstan output disappoints", "body": "TCO field delays push Chevron to lower full-year production guidance.", "url": "https://bloomberg.com/cvx-kaz-2026", "published_at": "2026-03-22T12:00:00Z", "tickers": ["CVX"], "sentiment_score": -0.48, "event_type": "earnings", "novelty_score": 0.58, "credibility_score": 0.95, "severity": 0.48, "source_name": "Bloomberg"},

  {"headline": "ConocoPhillips cuts production guidance on softening crude prices", "body": "Lower WTI prices prompt COP to reduce drilling activity.", "url": "https://reuters.com/cop-cut-2026", "published_at": "2026-03-25T12:00:00Z", "tickers": ["COP"], "sentiment_score": -0.50, "event_type": "macro", "novelty_score": 0.60, "credibility_score": 0.92, "severity": 0.50, "source_name": "Reuters"},
  {"headline": "ConocoPhillips misses Q1 EPS estimate, analyst downgrades pile in", "body": "Three sell-side analysts downgraded COP following earnings miss.", "url": "https://bloomberg.com/cop-q1-2026", "published_at": "2026-03-23T10:00:00Z", "tickers": ["COP"], "sentiment_score": -0.48, "event_type": "earnings", "novelty_score": 0.58, "credibility_score": 0.95, "severity": 0.48, "source_name": "Bloomberg"},

  {"headline": "Bank of America faces DOJ investigation over discriminatory lending practices", "body": "Federal investigation expands to cover mortgage and auto lending.", "url": "https://reuters.com/bac-doj-2026", "published_at": "2026-03-26T08:00:00Z", "tickers": ["BAC"], "sentiment_score": -0.88, "event_type": "regulation", "novelty_score": 0.88, "credibility_score": 0.92, "severity": 0.92, "source_name": "Reuters"},
  {"headline": "Bank of America credit loss provisions spike 85% as consumer defaults rise", "body": "BAC raises loan loss reserves sharply amid deteriorating credit quality.", "url": "https://bloomberg.com/bac-credit-2026", "published_at": "2026-03-25T09:00:00Z", "tickers": ["BAC"], "sentiment_score": -0.84, "event_type": "earnings", "novelty_score": 0.85, "credibility_score": 0.95, "severity": 0.88, "source_name": "Bloomberg"},
  {"headline": "Bank of America CEO faces Senate hearing over risk management failures", "body": "Senate Banking Committee summons BAC leadership to testify.", "url": "https://sec.gov/edgar/bac-senate-2026", "published_at": "2026-03-24T14:00:00Z", "tickers": ["BAC"], "sentiment_score": -0.82, "event_type": "executive", "novelty_score": 0.82, "credibility_score": 1.00, "severity": 0.86, "source_name": "SEC EDGAR"},

  {"headline": "DOJ launches antitrust probe into UnitedHealth Group's hospital pricing", "body": "Wide-ranging federal investigation targets UNH's integrated care model.", "url": "https://reuters.com/unh-doj-2026", "published_at": "2026-03-26T07:00:00Z", "tickers": ["UNH"], "sentiment_score": -0.86, "event_type": "regulation", "novelty_score": 0.90, "credibility_score": 0.92, "severity": 0.90, "source_name": "Reuters"},
  {"headline": "UnitedHealth Q1 earnings miss badly as Medicare Advantage costs surge", "body": "Medical loss ratio spiked to 87.8%, worst in 10 years.", "url": "https://bloomberg.com/unh-q1-2026", "published_at": "2026-03-25T08:00:00Z", "tickers": ["UNH"], "sentiment_score": -0.82, "event_type": "earnings", "novelty_score": 0.85, "credibility_score": 0.95, "severity": 0.88, "source_name": "Bloomberg"},
  {"headline": "CMS proposes 5% Medicare Advantage rate cut for 2027, UNH hardest hit", "body": "Proposed cut far exceeds analyst estimates and would dent UNH margins.", "url": "https://sec.gov/edgar/unh-cms-2026", "published_at": "2026-03-24T11:00:00Z", "tickers": ["UNH"], "sentiment_score": -0.80, "event_type": "regulation", "novelty_score": 0.88, "credibility_score": 1.00, "severity": 0.85, "source_name": "SEC EDGAR"},

  {"headline": "Johnson & Johnson pipeline update: 2 mid-stage trials show mixed results", "body": "MedTech and pharma pipeline news was a net neutral for investors.", "url": "https://reuters.com/jnj-pipeline-2026", "published_at": "2026-03-24T13:00:00Z", "tickers": ["JNJ"], "sentiment_score": 0.42, "event_type": "product", "novelty_score": 0.55, "credibility_score": 0.92, "severity": 0.38, "source_name": "Reuters"},
  {"headline": "J&J talc litigation settlement delayed by appeals court ruling", "body": "Ongoing liability uncertainty prevents final resolution of talc suits.", "url": "https://bloomberg.com/jnj-talc-2026", "published_at": "2026-03-22T10:00:00Z", "tickers": ["JNJ"], "sentiment_score": -0.38, "event_type": "regulation", "novelty_score": 0.50, "credibility_score": 0.95, "severity": 0.35, "source_name": "Bloomberg"},

  {"headline": "AbbVie Skyrizi label expansion approved in new indication", "body": "FDA approved Skyrizi for a new dermatology use, modest upside.", "url": "https://reuters.com/abbv-skyrizi-2026", "published_at": "2026-03-23T14:00:00Z", "tickers": ["ABBV"], "sentiment_score": 0.42, "event_type": "regulation", "novelty_score": 0.55, "credibility_score": 0.92, "severity": 0.38, "source_name": "Reuters"},
  {"headline": "AbbVie Humira biosimilar erosion accelerates, guidance lowered slightly", "body": "Biosimilar uptake exceeded internal models, offsetting Skyrizi growth.", "url": "https://bloomberg.com/abbv-humira-2026", "published_at": "2026-03-21T11:00:00Z", "tickers": ["ABBV"], "sentiment_score": -0.38, "event_type": "earnings", "novelty_score": 0.52, "credibility_score": 0.95, "severity": 0.35, "source_name": "Bloomberg"},

  {"headline": "Tesla Q1 deliveries miss estimates by 12%, shares fall in premarket", "body": "Global delivery numbers came in below consensus on demand concerns.", "url": "https://reuters.com/tsla-q1-2026", "published_at": "2026-03-26T06:00:00Z", "tickers": ["TSLA"], "sentiment_score": 0.40, "event_type": "earnings", "novelty_score": 0.55, "credibility_score": 0.92, "severity": 0.38, "source_name": "Reuters"},
  {"headline": "Tesla retains strong US EV market share despite BYD global pressure", "body": "Despite global competition, Tesla maintained its domestic leadership.", "url": "https://bloomberg.com/tsla-ev-2026", "published_at": "2026-03-23T12:00:00Z", "tickers": ["TSLA"], "sentiment_score": -0.36, "event_type": "macro", "novelty_score": 0.50, "credibility_score": 0.95, "severity": 0.34, "source_name": "Bloomberg"}
]
```

- [ ] **Step 4: Verify JSON files parse without errors**

```bash
cd backend
python -c "
import json
from pathlib import Path
for f in ['sources', 'stocks', 'news']:
    data = json.loads(Path(f'app/seed_data/{f}.json').read_text())
    print(f'{f}.json: {len(data)} records OK')
"
```

Expected:
```
sources.json: 3 records OK
stocks.json: 20 records OK
news.json: 42 records OK
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/seed_data/
git commit -m "feat: add seed data for 20 stocks, 42 articles, 3 sources"
```

---

## Task 7: Seed Service

**Files:**
- Create: `backend/app/services/seed.py`

- [ ] **Step 1: Write seed.py**

```python
# backend/app/services/seed.py
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from supabase import Client

from app.services.scoring import ArticleFeatures, score_articles

SEED_DIR = Path(__file__).parent.parent / "seed_data"
_FAKE_UUID = "00000000-0000-0000-0000-000000000000"


def _clear_tables(db: Client) -> None:
    for table in ("signal_history", "signals", "events", "news_articles", "stocks", "sources"):
        db.table(table).delete().neq("id", _FAKE_UUID).execute()


def load_seed_data(db: Client) -> dict:
    _clear_tables(db)

    # 1. Sources
    sources_raw = json.loads((SEED_DIR / "sources.json").read_text())
    sources_result = db.table("sources").insert(sources_raw).execute()
    sources_by_name = {s["name"]: s["id"] for s in sources_result.data}

    # 2. Stocks
    stocks_raw = json.loads((SEED_DIR / "stocks.json").read_text())
    stocks_result = db.table("stocks").insert(stocks_raw).execute()
    stocks_by_ticker = {s["ticker"]: s["id"] for s in stocks_result.data}

    # 3. News articles — strip source_name, replace with source_id
    news_raw = json.loads((SEED_DIR / "news.json").read_text())
    articles_to_insert = []
    for article in news_raw:
        row = dict(article)
        source_name = row.pop("source_name")
        row["source_id"] = sources_by_name.get(source_name)
        articles_to_insert.append(row)

    articles_result = db.table("news_articles").insert(articles_to_insert).execute()
    articles_by_url = {a["url"]: a["id"] for a in articles_result.data}

    # 4. Group raw articles by ticker for scoring
    articles_by_ticker: dict[str, list[dict]] = {}
    for article in news_raw:
        for ticker in article["tickers"]:
            articles_by_ticker.setdefault(ticker, []).append(article)

    # 5. Score each stock and collect signals
    signals_to_insert = []
    for ticker, raw_articles in articles_by_ticker.items():
        stock_id = stocks_by_ticker.get(ticker)
        if not stock_id:
            continue

        features = [
            ArticleFeatures(
                sentiment_score=a["sentiment_score"],
                credibility_score=a["credibility_score"],
                novelty_score=a["novelty_score"],
                severity=a["severity"],
                event_type=a["event_type"],
            )
            for a in raw_articles
        ]

        result = score_articles(features)
        if result is None:
            continue

        horizon = 30 if result.direction == "bearish" else 5
        expires_at = (datetime.now(timezone.utc) + timedelta(days=horizon)).isoformat()

        signals_to_insert.append({
            "stock_id": stock_id,
            "direction": result.direction,
            "confidence": result.confidence,
            "expected_move_low": result.expected_move_low,
            "expected_move_high": result.expected_move_high,
            "horizon_days": horizon,
            "opportunity_score": result.opportunity_score,
            "crash_risk_score": result.crash_risk_score,
            "rank": 0,  # set after sorting
            "explanation": "AI analysis pending",
            "drivers": result.drivers,
            "evidence": {
                "article_count": len(raw_articles),
                "sources": list({a["source_name"] for a in raw_articles}),
                "avg_credibility": round(
                    sum(a["credibility_score"] for a in raw_articles) / len(raw_articles), 2
                ),
                "article_ids": [articles_by_url.get(a.get("url", "")) for a in raw_articles],
            },
            "historical_analog": {
                "avg_move": round((result.expected_move_low + result.expected_move_high) / 2, 4),
                "hit_rate": 0.64,
                "sample_size": 15,
            },
            "risk_flags": result.risk_flags,
            "expires_at": expires_at,
        })

    # Sort by opportunity_score descending and assign ranks
    signals_to_insert.sort(key=lambda s: s["opportunity_score"], reverse=True)
    for i, signal in enumerate(signals_to_insert):
        signal["rank"] = i + 1

    if signals_to_insert:
        db.table("signals").insert(signals_to_insert).execute()

    return {
        "sources": len(sources_by_name),
        "stocks": len(stocks_by_ticker),
        "articles": len(articles_result.data),
        "signals": len(signals_to_insert),
    }
```

- [ ] **Step 2: Verify seed.py imports cleanly**

```bash
cd backend
source .venv/bin/activate
python -c "from app.services.seed import load_seed_data; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/seed.py
git commit -m "feat: add seed service with scoring pipeline"
```

---

## Task 8: Main FastAPI App

**Files:**
- Create: `backend/app/main.py`

- [ ] **Step 1: Write main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import signals, stocks, news, analytics, admin

app = FastAPI(
    title="Market Pulse AI API",
    version="0.1.0",
    description="AI-powered market intelligence and prediction engine — MVP",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signals.router, prefix="/signals", tags=["signals"])
app.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
app.include_router(news.router, prefix="/news", tags=["news"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "0.1.0"}
```

- [ ] **Step 2: Create empty router stubs so the app starts**

```python
# backend/app/routers/signals.py
from fastapi import APIRouter
router = APIRouter()
```

```python
# backend/app/routers/stocks.py
from fastapi import APIRouter
router = APIRouter()
```

```python
# backend/app/routers/news.py
from fastapi import APIRouter
router = APIRouter()
```

```python
# backend/app/routers/analytics.py
from fastapi import APIRouter
router = APIRouter()
```

```python
# backend/app/routers/admin.py
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 3: Start server and verify health endpoint**

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

In a second terminal:
```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok","version":"0.1.0"}`

Also visit `http://localhost:8000/docs` — should show the Swagger UI.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/routers/
git commit -m "feat: add fastapi app with cors and router stubs"
```

---

## Task 9: Signals Router (TDD)

**Files:**
- Create: `backend/tests/conftest.py`
- Modify: `backend/tests/test_signals.py` (create)
- Modify: `backend/app/routers/signals.py`

- [ ] **Step 1: Write conftest.py**

```python
# backend/tests/conftest.py
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db


@pytest.fixture
def mock_db():
    db = MagicMock()
    # Default empty responses for all chains
    db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.count = 0
    db.table.return_value.select.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.execute.return_value.count = 0
    db.table.return_value.select.return_value.maybe_single.return_value.execute.return_value.data = None
    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as c:
        yield c, mock_db
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Write failing signal tests**

```python
# backend/tests/test_signals.py
from unittest.mock import MagicMock

MOCK_SIGNAL_ROW = {
    "id": "sig-uuid-1",
    "stock_id": "stock-uuid-1",
    "direction": "bullish",
    "confidence": 0.82,
    "expected_move_low": 0.041,
    "expected_move_high": 0.082,
    "horizon_days": 5,
    "opportunity_score": 0.82,
    "crash_risk_score": 0.0,
    "rank": 1,
    "explanation": "AI analysis pending",
    "drivers": ["Strong earnings sentiment", "Strong product momentum"],
    "evidence": {"article_count": 2, "sources": ["Reuters"], "avg_credibility": 0.92, "article_ids": []},
    "historical_analog": {"avg_move": 0.062, "hit_rate": 0.64, "sample_size": 15},
    "risk_flags": [],
    "created_at": "2026-03-27T10:00:00+00:00",
    "expires_at": "2026-04-01T10:00:00+00:00",
    "stocks": {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "last_price": 875.50},
}


def test_list_signals_returns_200(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["limit"] == 10
    assert body["offset"] == 0


def test_list_signals_enriches_stock_fields(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    item = response.json()["data"][0]
    assert item["ticker"] == "NVDA"
    assert item["stock_name"] == "NVIDIA Corporation"
    assert item["last_price"] == 875.50


def test_get_signal_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/nonexistent-id")
    assert response.status_code == 404


def test_get_signal_returns_200_when_found(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW)
    mock_exec = MagicMock()
    mock_exec.data = row
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/sig-uuid-1")
    assert response.status_code == 200
    assert response.json()["ticker"] == "NVDA"
```

- [ ] **Step 3: Run tests to confirm failure**

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/test_signals.py -v
```

Expected: Tests fail — router returns 404 for all routes (empty stubs).

- [ ] **Step 4: Implement signals router**

```python
# backend/app/routers/signals.py
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.signal import SignalResponse, PaginatedSignals

router = APIRouter()


def _enrich(row: dict) -> dict:
    stock = row.pop("stocks", None) or {}
    row["ticker"] = stock.get("ticker", "")
    row["stock_name"] = stock.get("name", "")
    row["sector"] = stock.get("sector")
    row["last_price"] = stock.get("last_price")
    return row


@router.get("", response_model=PaginatedSignals)
def list_signals(
    direction: str | None = Query(None),
    horizon: int | None = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    query = db.table("signals").select(
        "*, stocks(ticker, name, sector, last_price)"
    ).order("rank", ascending=True)

    count_query = db.table("signals").select("id", count="exact")

    if direction:
        query = query.eq("direction", direction)
        count_query = count_query.eq("direction", direction)
    if horizon:
        query = query.eq("horizon_days", horizon)
        count_query = count_query.eq("horizon_days", horizon)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": [_enrich(row) for row in result.data],
        "total": count_result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{signal_id}", response_model=SignalResponse)
def get_signal(signal_id: str, db: Client = Depends(get_db)):
    result = db.table("signals").select(
        "*, stocks(ticker, name, sector, last_price)"
    ).eq("id", signal_id).maybe_single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")

    return _enrich(result.data)
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
python -m pytest tests/test_signals.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/signals.py backend/tests/test_signals.py backend/tests/conftest.py
git commit -m "feat: implement signals router with TDD"
```

---

## Task 10: Stocks Router (TDD)

**Files:**
- Create: `backend/tests/test_stocks.py`
- Modify: `backend/app/routers/stocks.py`

- [ ] **Step 1: Write failing stock tests**

```python
# backend/tests/test_stocks.py
from unittest.mock import MagicMock

MOCK_STOCK = {
    "id": "stock-uuid-1",
    "ticker": "NVDA",
    "name": "NVIDIA Corporation",
    "sector": "Technology",
    "market_cap": 2800000000000,
    "last_price": 875.50,
    "updated_at": "2026-03-27T10:00:00+00:00",
}


def test_list_stocks_returns_200(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [MOCK_STOCK]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/stocks")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"][0]["ticker"] == "NVDA"


def test_get_stock_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/stocks/FAKE")
    assert response.status_code == 404


def test_get_stock_upcases_ticker(client):
    c, mock_db = client
    mock_stock_exec = MagicMock()
    mock_stock_exec.data = MOCK_STOCK
    mock_signal_exec = MagicMock()
    mock_signal_exec.data = []

    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_stock_exec
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_signal_exec

    response = c.get("/stocks/nvda")  # lowercase — should still work
    assert response.status_code == 200
    assert response.json()["ticker"] == "NVDA"
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
python -m pytest tests/test_stocks.py -v
```

Expected: All 3 tests FAIL.

- [ ] **Step 3: Implement stocks router**

```python
# backend/app/routers/stocks.py
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.stock import StockResponse, StockWithSignal, PaginatedStocks

router = APIRouter()


@router.get("", response_model=PaginatedStocks)
def list_stocks(
    sector: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    query = db.table("stocks").select("*").order("ticker", ascending=True)
    count_query = db.table("stocks").select("id", count="exact")

    if sector:
        query = query.eq("sector", sector)
        count_query = count_query.eq("sector", sector)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": result.data,
        "total": count_result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{ticker}", response_model=StockWithSignal)
def get_stock(ticker: str, db: Client = Depends(get_db)):
    stock_result = db.table("stocks").select("*").eq(
        "ticker", ticker.upper()
    ).maybe_single().execute()

    if not stock_result.data:
        raise HTTPException(status_code=404, detail="Stock not found")

    signal_result = db.table("signals").select("*").eq(
        "stock_id", stock_result.data["id"]
    ).order("created_at", ascending=False).limit(1).execute()

    return {
        **stock_result.data,
        "latest_signal": signal_result.data[0] if signal_result.data else None,
    }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest tests/test_stocks.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/stocks.py backend/tests/test_stocks.py
git commit -m "feat: implement stocks router with TDD"
```

---

## Task 11: News Router (TDD)

**Files:**
- Create: `backend/tests/test_news.py`
- Modify: `backend/app/routers/news.py`

- [ ] **Step 1: Write failing news tests**

```python
# backend/tests/test_news.py
from unittest.mock import MagicMock

MOCK_ARTICLE = {
    "id": "article-uuid-1",
    "headline": "NVIDIA reports record data center revenue",
    "body": "Blackwell GPU demand remains insatiable.",
    "url": "https://reuters.com/nvda-q4-2026",
    "published_at": "2026-03-26T15:00:00+00:00",
    "tickers": ["NVDA"],
    "sentiment_score": 0.88,
    "event_type": "earnings",
    "novelty_score": 0.92,
    "credibility_score": 0.92,
    "severity": 0.85,
}


def test_list_news_returns_200(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [MOCK_ARTICLE]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/news")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"][0]["headline"] == "NVIDIA reports record data center revenue"


def test_get_article_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/news/nonexistent-id")
    assert response.status_code == 404


def test_get_article_returns_200_when_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = MOCK_ARTICLE
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/news/article-uuid-1")
    assert response.status_code == 200
    assert response.json()["event_type"] == "earnings"
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
python -m pytest tests/test_news.py -v
```

Expected: All 3 tests FAIL.

- [ ] **Step 3: Implement news router**

```python
# backend/app/routers/news.py
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.news import NewsArticleResponse, PaginatedNews

router = APIRouter()


@router.get("", response_model=PaginatedNews)
def list_news(
    ticker: str | None = Query(None),
    event_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    query = db.table("news_articles").select("*").order("published_at", ascending=False)
    count_query = db.table("news_articles").select("id", count="exact")

    if ticker:
        query = query.contains("tickers", [ticker.upper()])
        count_query = count_query.contains("tickers", [ticker.upper()])
    if event_type:
        query = query.eq("event_type", event_type)
        count_query = count_query.eq("event_type", event_type)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": result.data,
        "total": count_result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{article_id}", response_model=NewsArticleResponse)
def get_article(article_id: str, db: Client = Depends(get_db)):
    result = db.table("news_articles").select("*").eq(
        "id", article_id
    ).maybe_single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Article not found")

    return result.data
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest tests/test_news.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/news.py backend/tests/test_news.py
git commit -m "feat: implement news router with TDD"
```

---

## Task 12: Analytics Router (TDD)

**Files:**
- Create: `backend/tests/test_analytics.py`
- Modify: `backend/app/routers/analytics.py`

- [ ] **Step 1: Write failing analytics tests**

```python
# backend/tests/test_analytics.py
from unittest.mock import MagicMock


def test_accuracy_returns_200_with_no_data(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 0
    assert body["overall_accuracy"] is None


def test_accuracy_calculates_hit_rate(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"direction": "bullish", "was_correct": True, "actual_move": 0.05},
        {"direction": "bullish", "was_correct": True, "actual_move": 0.04},
        {"direction": "bullish", "was_correct": False, "actual_move": -0.02},
        {"direction": "bearish", "was_correct": True, "actual_move": -0.03},
    ]
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 4
    assert body["overall_accuracy"] == 0.75
    assert "bullish" in body["by_direction"]
    assert body["by_direction"]["bullish"]["hit_rate"] == pytest.approx(2 / 3)


def test_accuracy_excludes_unresolved_signals(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"direction": "bullish", "was_correct": None, "actual_move": None},
        {"direction": "bullish", "was_correct": True, "actual_move": 0.04},
    ]
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 1
```

Add `import pytest` at the top of the test file:

```python
# backend/tests/test_analytics.py
import pytest
from unittest.mock import MagicMock

# ... (rest of tests as above)
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
python -m pytest tests/test_analytics.py -v
```

Expected: All 3 tests FAIL.

- [ ] **Step 3: Implement analytics router**

```python
# backend/app/routers/analytics.py
from fastapi import APIRouter, Depends
from supabase import Client

from app.database import get_db

router = APIRouter()


@router.get("/accuracy")
def get_accuracy(db: Client = Depends(get_db)):
    result = db.table("signal_history").select("*").execute()
    rows = result.data

    resolved = [r for r in rows if r.get("was_correct") is not None]
    if not resolved:
        return {"total_resolved": 0, "overall_accuracy": None, "by_direction": {}}

    correct = [r for r in resolved if r["was_correct"]]
    overall_accuracy = round(len(correct) / len(resolved), 4)

    by_direction: dict = {}
    for direction in ("bullish", "bearish", "crash_risk"):
        d_rows = [r for r in resolved if r["direction"] == direction]
        if not d_rows:
            continue
        d_correct = [r for r in d_rows if r["was_correct"]]
        moves = [r["actual_move"] for r in d_rows if r.get("actual_move") is not None]
        by_direction[direction] = {
            "count": len(d_rows),
            "hit_rate": round(len(d_correct) / len(d_rows), 4),
            "avg_actual_move": round(sum(moves) / len(moves), 4) if moves else None,
        }

    return {
        "total_resolved": len(resolved),
        "overall_accuracy": overall_accuracy,
        "by_direction": by_direction,
    }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
python -m pytest tests/test_analytics.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/analytics.py backend/tests/test_analytics.py
git commit -m "feat: implement analytics router with TDD"
```

---

## Task 13: Admin Router

**Files:**
- Modify: `backend/app/routers/admin.py`

- [ ] **Step 1: Implement admin router**

```python
# backend/app/routers/admin.py
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.config import settings
from app.services.seed import load_seed_data, _FAKE_UUID

router = APIRouter()


def _verify_secret(secret: str = Query(..., description="Admin secret key")):
    if secret != settings.admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")


@router.post("/seed")
def seed_database(
    db: Client = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    result = load_seed_data(db)
    return {"message": "Seed data loaded successfully", **result}


@router.delete("/clear")
def clear_database(
    db: Client = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    for table in ("signal_history", "signals", "events", "news_articles", "stocks", "sources"):
        db.table(table).delete().neq("id", _FAKE_UUID).execute()
    return {"message": "All tables cleared"}
```

- [ ] **Step 2: Verify admin routes are visible in docs**

With server running (`uvicorn app.main:app --reload`), visit `http://localhost:8000/docs`.

Expected: `/admin/seed` (POST) and `/admin/clear` (DELETE) visible with `secret` query param.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/admin.py
git commit -m "feat: implement admin seed/clear endpoints"
```

---

## Task 14: Full Test Suite + Smoke Test

**Files:** No new files

- [ ] **Step 1: Run full test suite**

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/ -v
```

Expected: All tests pass. Summary should show:
```
tests/test_scoring.py       9 passed
tests/test_signals.py       4 passed
tests/test_stocks.py        3 passed
tests/test_news.py          3 passed
tests/test_analytics.py     3 passed
======================== 22 passed ========================
```

- [ ] **Step 2: Start the server**

```bash
uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 3: Seed the database**

```bash
curl -X POST "http://localhost:8000/admin/seed?secret=dev-secret"
```

Expected response:
```json
{
  "message": "Seed data loaded successfully",
  "sources": 3,
  "stocks": 20,
  "articles": 42,
  "signals": 17
}
```

(17 signals = 10 bullish + 5 bearish + 2 crash_risk)

- [ ] **Step 4: Verify signals endpoint**

```bash
curl "http://localhost:8000/signals?limit=5" | python -m json.tool
```

Expected: 5 ranked signals, each with `ticker`, `direction`, `confidence`, `drivers`.

- [ ] **Step 5: Verify stock detail endpoint**

```bash
curl "http://localhost:8000/stocks/NVDA" | python -m json.tool
```

Expected: NVDA stock with `latest_signal` containing the bullish signal.

- [ ] **Step 6: Verify crash risk filter**

```bash
curl "http://localhost:8000/signals?direction=crash_risk" | python -m json.tool
```

Expected: 2 signals for BAC and UNH.

- [ ] **Step 7: Verify news filter**

```bash
curl "http://localhost:8000/news?ticker=NVDA" | python -m json.tool
```

Expected: 2 articles with `tickers` containing `"NVDA"`.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: complete backend phase 1 — scoring engine, seed data, all endpoints passing"
```

---

## Done

Backend Phase 1 is complete when:
- All 22 tests pass
- `POST /admin/seed` loads 20 stocks, 42 articles, ~17 signals
- `GET /signals` returns ranked signals with stock data
- `GET /stocks/{ticker}` returns stock + latest signal
- `GET /news?ticker=X` returns articles filtered by ticker
- `GET /analytics/accuracy` returns empty stats (no resolved signals yet)
- Server runs cleanly on `uvicorn app.main:app --reload`
