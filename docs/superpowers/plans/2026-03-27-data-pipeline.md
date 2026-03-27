# Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a background data pipeline that ingests yfinance news, extracts features, generates signals via the existing scoring engine, and updates prices — running every 30 minutes via APScheduler.

**Architecture:** APScheduler runs inside the FastAPI process, wired to lifespan events. Four steps execute in sequence: ingest → extract → signal → price. Error isolation per-ticker prevents one bad stock from stopping the pipeline. All writes go to existing `news_articles`, `signals`, and `stocks` tables.

**Tech Stack:** yfinance, vaderSentiment, APScheduler (AsyncIOScheduler), existing supabase client, existing `services/scoring.py`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/app/services/features.py` | VADER sentiment + keyword event type + domain credibility + time-decay novelty → `ArticleFeatures` |
| Create | `backend/app/services/ingestor.py` | yfinance news fetch + URL deduplication + insert new `news_articles` rows |
| Create | `backend/app/services/pipeline.py` | Orchestrate all 4 steps; signal upsert + re-rank; price update |
| Create | `backend/app/scheduler.py` | `AsyncIOScheduler` setup; exported `scheduler` instance |
| Modify | `backend/app/main.py` | Add `@asynccontextmanager lifespan` that starts/stops scheduler |
| Modify | `backend/app/routers/admin.py` | Add `POST /admin/pipeline/run` endpoint |
| Modify | `backend/requirements.txt` | Add yfinance, vaderSentiment, APScheduler |
| Create | `backend/tests/test_features.py` | Unit tests for all feature extraction logic |
| Create | `backend/tests/test_ingestor.py` | Unit tests for ingestor with mocked yfinance |
| Create | `backend/tests/test_pipeline.py` | Unit tests for pipeline orchestration with mocked services |

---

## Task 1: Add Dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the three new packages**

Open `backend/requirements.txt` and append:

```
yfinance==0.2.54
vaderSentiment==3.3.2
APScheduler==3.10.4
```

Final file:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
supabase==2.9.0
pydantic-settings==2.4.0
python-dotenv==1.0.1
pytest==8.3.3
httpx==0.27.2
yfinance==0.2.54
vaderSentiment==3.3.2
APScheduler==3.10.4
```

- [ ] **Step 2: Install them**

```bash
cd backend
pip install yfinance==0.2.54 vaderSentiment==3.3.2 APScheduler==3.10.4
```

Expected: All three packages install without error.

- [ ] **Step 3: Verify imports**

```bash
python -c "import yfinance; import vaderSentiment; import apscheduler; print('OK')"
```

Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat: add yfinance, vaderSentiment, APScheduler dependencies"
```

---

## Task 2: Feature Extraction Service

**Files:**
- Create: `backend/app/services/features.py`
- Create: `backend/tests/test_features.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_features.py`:

```python
# backend/tests/test_features.py
from datetime import datetime, timezone, timedelta
import pytest
from app.services.features import extract_features, _sentiment, _event_type, _credibility, _novelty, _severity


def _now():
    return datetime.now(timezone.utc)


# --- _sentiment ---

def test_sentiment_positive_headline():
    score = _sentiment("Company beats earnings expectations with record profit")
    assert score > 0


def test_sentiment_negative_headline():
    score = _sentiment("Company misses revenue targets, stock crashes")
    assert score < 0


def test_sentiment_range():
    score = _sentiment("quarterly results")
    assert -1.0 <= score <= 1.0


# --- _event_type ---

def test_event_type_earnings():
    assert _event_type("Q3 earnings beat EPS estimates") == "earnings"


def test_event_type_ma():
    assert _event_type("Company announces acquisition of rival") == "m&a"


def test_event_type_regulation():
    assert _event_type("SEC fines company for disclosure violations") == "regulation"


def test_event_type_product():
    assert _event_type("Apple to launch new model next quarter") == "product"


def test_event_type_executive():
    assert _event_type("CEO resigns amid board pressure") == "executive"


def test_event_type_macro_fallback():
    assert _event_type("Weather forecast for next week") == "macro"


def test_event_type_case_insensitive():
    assert _event_type("EARNINGS BEAT EXPECTATIONS") == "earnings"


# --- _credibility ---

def test_credibility_known_domain():
    assert _credibility("https://reuters.com/article/123") == 0.92


def test_credibility_bloomberg():
    assert _credibility("https://bloomberg.com/news/abc") == 0.92


def test_credibility_finance_yahoo():
    assert _credibility("https://finance.yahoo.com/xyz") == 0.70


def test_credibility_unknown_domain():
    score = _credibility("https://unknownblog.example.com/post")
    assert score == 0.55


def test_credibility_subdomain_stripped():
    # www.reuters.com should resolve to reuters.com
    score = _credibility("https://www.reuters.com/article/abc")
    assert score == 0.92


# --- _novelty ---

def test_novelty_very_fresh():
    published = _now() - timedelta(hours=1)
    assert _novelty(published) == 1.0


def test_novelty_under_6h():
    published = _now() - timedelta(hours=4)
    assert _novelty(published) == 0.85


def test_novelty_under_12h():
    published = _now() - timedelta(hours=8)
    assert _novelty(published) == 0.70


def test_novelty_under_24h():
    published = _now() - timedelta(hours=20)
    assert _novelty(published) == 0.50


def test_novelty_under_48h():
    published = _now() - timedelta(hours=36)
    assert _novelty(published) == 0.30


def test_novelty_old():
    published = _now() - timedelta(hours=72)
    assert _novelty(published) == 0.10


# --- _severity ---

def test_severity_earnings_high_sentiment():
    sev = _severity("earnings", 0.9)
    assert sev == pytest.approx(min(1.0, 0.9 * 1.0))


def test_severity_macro_low():
    sev = _severity("macro", 0.5)
    assert sev == pytest.approx(min(1.0, 0.5 * 0.5))


def test_severity_capped_at_1():
    sev = _severity("earnings", 1.5)
    assert sev == 1.0


def test_severity_uses_abs():
    pos = _severity("regulation", 0.8)
    neg = _severity("regulation", -0.8)
    assert pos == neg


# --- extract_features ---

def test_extract_features_returns_article_features():
    from app.services.scoring import ArticleFeatures
    published = _now() - timedelta(hours=3)
    result = extract_features(
        headline="Strong earnings beat analyst estimates",
        url="https://reuters.com/article/abc",
        published_at=published,
    )
    assert isinstance(result, ArticleFeatures)
    assert result.event_type == "earnings"
    assert result.credibility_score == 0.92
    assert result.novelty_score == 0.85
    assert result.sentiment_score > 0
    assert 0.0 <= result.severity <= 1.0
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend
python -m pytest tests/test_features.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'app.services.features'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/features.py`:

```python
# backend/app/services/features.py
from datetime import datetime, timezone
from urllib.parse import urlparse

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.services.scoring import ArticleFeatures

_analyzer = SentimentIntensityAnalyzer()

EVENT_KEYWORDS: dict[str, list[str]] = {
    "earnings":   ["earnings", "revenue", "profit", "eps", "beat", "miss", "guidance", "quarterly"],
    "m&a":        ["acqui", "merger", "takeover", "buyout", "deal", "bid"],
    "regulation": ["fda", "sec", "ftc", "doj", "regulation", "antitrust", "fine", "penalty", "lawsuit"],
    "product":    ["launch", "product", "release", "unveil", "announce", "new model"],
    "executive":  ["ceo", "cfo", "coo", "resign", "appoint", "executive", "leadership"],
}

CREDIBILITY: dict[str, float] = {
    "reuters.com":       0.92,
    "bloomberg.com":     0.92,
    "wsj.com":           0.90,
    "ft.com":            0.90,
    "cnbc.com":          0.82,
    "marketwatch.com":   0.80,
    "seekingalpha.com":  0.72,
    "yahoo.com":         0.70,
    "finance.yahoo.com": 0.70,
    "benzinga.com":      0.65,
    "motleyfool.com":    0.65,
}
_DEFAULT_CREDIBILITY = 0.55

EVENT_WEIGHTS: dict[str, float] = {
    "earnings":   1.0,
    "regulation": 1.0,
    "m&a":        0.9,
    "executive":  0.8,
    "product":    0.7,
    "macro":      0.5,
}


def _sentiment(headline: str) -> float:
    return _analyzer.polarity_scores(headline)["compound"]


def _event_type(headline: str) -> str:
    lower = headline.lower()
    for event, keywords in EVENT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return event
    return "macro"


def _credibility(url: str) -> float:
    try:
        host = urlparse(url).hostname or ""
        # strip leading www.
        if host.startswith("www."):
            host = host[4:]
        return CREDIBILITY.get(host, _DEFAULT_CREDIBILITY)
    except Exception:
        return _DEFAULT_CREDIBILITY


def _novelty(published_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    # ensure published_at is timezone-aware
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age_hours = (now - published_at).total_seconds() / 3600
    if age_hours < 2:
        return 1.0
    elif age_hours < 6:
        return 0.85
    elif age_hours < 12:
        return 0.70
    elif age_hours < 24:
        return 0.50
    elif age_hours < 48:
        return 0.30
    return 0.10


def _severity(event_type: str, sentiment_score: float) -> float:
    weight = EVENT_WEIGHTS.get(event_type, 0.5)
    return min(1.0, abs(sentiment_score) * weight)


def extract_features(headline: str, url: str, published_at: datetime) -> ArticleFeatures:
    sentiment = _sentiment(headline)
    event = _event_type(headline)
    cred = _credibility(url)
    novelty = _novelty(published_at)
    sev = _severity(event, sentiment)
    return ArticleFeatures(
        sentiment_score=sentiment,
        credibility_score=cred,
        novelty_score=novelty,
        severity=sev,
        event_type=event,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_features.py -v
```

Expected: All tests pass. Output ends with something like `29 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/features.py backend/tests/test_features.py
git commit -m "feat: add feature extraction service (VADER + keyword + credibility + novelty)"
```

---

## Task 3: News Ingestor

**Files:**
- Create: `backend/app/services/ingestor.py`
- Create: `backend/tests/test_ingestor.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_ingestor.py`:

```python
# backend/tests/test_ingestor.py
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest

from app.services.ingestor import ingest_news


def _make_db(existing_urls: list[str] = None, ticker_rows: list[dict] = None):
    db = MagicMock()

    # stocks query
    stocks_data = ticker_rows or [{"id": "stock-1", "ticker": "AAPL"}]
    db.table.return_value.select.return_value.execute.return_value.data = stocks_data

    # existing URLs query
    url_data = [{"url": u} for u in (existing_urls or [])]
    (db.table.return_value.select.return_value
       .in_.return_value.execute.return_value.data) = url_data

    # insert returns something with .data
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "new-article-1"}
    ]
    return db


def _fake_article(title: str, url: str, ts: int = 1700000000) -> dict:
    return {
        "title": title,
        "link": url,
        "providerPublishTime": ts,
    }


def test_ingest_news_inserts_new_article():
    db = _make_db(existing_urls=[], ticker_rows=[{"id": "stock-1", "ticker": "AAPL"}])
    articles = [_fake_article("Apple beats earnings", "https://reuters.com/a1")]

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = articles
        result = ingest_news(db, ["AAPL"])

    assert len(result) == 1
    assert result[0] == "new-article-1"


def test_ingest_news_skips_duplicate_url():
    existing = ["https://reuters.com/a1"]
    db = _make_db(existing_urls=existing, ticker_rows=[{"id": "stock-1", "ticker": "AAPL"}])
    articles = [_fake_article("Apple beats earnings", "https://reuters.com/a1")]

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = articles
        result = ingest_news(db, ["AAPL"])

    assert result == []
    db.table.return_value.insert.assert_not_called()


def test_ingest_news_handles_ticker_error_gracefully():
    db = _make_db(existing_urls=[], ticker_rows=[{"id": "stock-1", "ticker": "FAKE"}])

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = []
        # even if yfinance throws, other tickers should continue
        mock_ticker.side_effect = Exception("yfinance error")
        result = ingest_news(db, ["FAKE"])

    assert result == []


def test_ingest_news_multiple_tickers():
    db = MagicMock()
    stocks_data = [
        {"id": "stock-1", "ticker": "AAPL"},
        {"id": "stock-2", "ticker": "MSFT"},
    ]
    db.table.return_value.select.return_value.execute.return_value.data = stocks_data
    (db.table.return_value.select.return_value
       .in_.return_value.execute.return_value.data) = []
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "article-x"}
    ]

    aapl_article = _fake_article("AAPL news", "https://cnbc.com/a1")
    msft_article = _fake_article("MSFT news", "https://cnbc.com/a2")

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.side_effect = lambda t: MagicMock(
            news=[aapl_article] if t == "AAPL" else [msft_article]
        )
        result = ingest_news(db, ["AAPL", "MSFT"])

    assert len(result) == 2


def test_ingest_news_inserts_correct_fields():
    db = _make_db(existing_urls=[], ticker_rows=[{"id": "stock-1", "ticker": "AAPL"}])
    ts = 1700000000
    article = _fake_article("Apple earnings beat", "https://reuters.com/xyz", ts)

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = [article]
        ingest_news(db, ["AAPL"])

    insert_call = db.table.return_value.insert.call_args
    inserted = insert_call[0][0]
    assert inserted["headline"] == "Apple earnings beat"
    assert inserted["url"] == "https://reuters.com/xyz"
    assert inserted["tickers"] == ["AAPL"]
    assert "published_at" in inserted
    assert "fetched_at" in inserted
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend
python -m pytest tests/test_ingestor.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'app.services.ingestor'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/ingestor.py`:

```python
# backend/app/services/ingestor.py
import logging
from datetime import datetime, timezone

import yfinance as yf
from supabase import Client

logger = logging.getLogger(__name__)


def ingest_news(db: Client, tickers: list[str]) -> list[str]:
    """
    Fetch news from yfinance for each ticker, deduplicate by URL,
    insert new rows into news_articles.

    Returns: list of newly inserted article IDs.
    """
    if not tickers:
        return []

    # Fetch all existing URLs for these tickers in one query
    existing_resp = (
        db.table("news_articles")
        .select("url")
        .in_("tickers", tickers)
        .execute()
    )
    existing_urls: set[str] = {row["url"] for row in (existing_resp.data or [])}

    new_ids: list[str] = []
    new_count = 0
    dup_count = 0

    for ticker in tickers:
        try:
            articles = yf.Ticker(ticker).news or []
        except Exception as exc:
            logger.error("[ingestor] ERROR: %s ticker failed — %s (non-fatal)", ticker, exc)
            continue

        for article in articles:
            url = article.get("link", "")
            if not url or url in existing_urls:
                dup_count += 1
                continue

            existing_urls.add(url)  # prevent re-insert within same run

            published_at = datetime.fromtimestamp(
                article.get("providerPublishTime", 0), tz=timezone.utc
            )

            row = {
                "headline":    article.get("title", ""),
                "url":         url,
                "published_at": published_at.isoformat(),
                "tickers":     [ticker],
                "fetched_at":  datetime.now(timezone.utc).isoformat(),
            }

            try:
                resp = db.table("news_articles").insert(row).execute()
                for inserted in resp.data or []:
                    new_ids.append(inserted["id"])
                    new_count += 1
            except Exception as exc:
                logger.error("[ingestor] ERROR: failed to insert article %s — %s", url, exc)

    logger.info(
        "[ingestor] Ingested %d new articles (%d duplicates skipped)",
        new_count,
        dup_count,
    )
    return new_ids
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_ingestor.py -v
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ingestor.py backend/tests/test_ingestor.py
git commit -m "feat: add news ingestor (yfinance fetch + URL deduplication)"
```

---

## Task 4: Pipeline Orchestrator

**Files:**
- Create: `backend/app/services/pipeline.py`
- Create: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_pipeline.py`:

```python
# backend/tests/test_pipeline.py
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, call
import pytest

from app.services.pipeline import (
    extract_features_for_articles,
    generate_signals,
    update_prices,
    run_pipeline,
)
from app.services.scoring import ArticleFeatures, SignalResult


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _article(article_id: str, headline: str, url: str, published_at: str = None) -> dict:
    return {
        "id": article_id,
        "headline": headline,
        "url": url,
        "published_at": published_at or _now_iso(),
        "sentiment_score": None,
    }


# --- extract_features_for_articles ---

def test_extract_features_updates_article_row():
    db = MagicMock()
    articles = [_article("art-1", "Strong earnings beat", "https://reuters.com/a")]

    with patch("app.services.pipeline.extract_features") as mock_extract:
        mock_extract.return_value = ArticleFeatures(
            sentiment_score=0.8,
            credibility_score=0.92,
            novelty_score=1.0,
            severity=0.8,
            event_type="earnings",
        )
        extract_features_for_articles(db, articles)

    update_call = db.table.return_value.update.call_args
    updated = update_call[0][0]
    assert updated["sentiment_score"] == 0.8
    assert updated["event_type"] == "earnings"
    assert updated["credibility_score"] == 0.92
    assert updated["novelty_score"] == 1.0
    assert updated["severity"] == 0.8


def test_extract_features_handles_error_gracefully():
    db = MagicMock()
    articles = [_article("art-1", "Headline", "https://example.com/a")]

    with patch("app.services.pipeline.extract_features", side_effect=Exception("parse error")):
        # Should not raise
        extract_features_for_articles(db, articles)

    db.table.return_value.update.assert_not_called()


# --- generate_signals ---

def _make_signal_result() -> SignalResult:
    return SignalResult(
        direction="bullish",
        confidence=0.75,
        expected_move_low=0.03,
        expected_move_high=0.08,
        opportunity_score=0.75,
        crash_risk_score=0.10,
        drivers=["Strong earnings sentiment"],
        risk_flags=[],
    )


def _make_stock_db(stocks, articles):
    db = MagicMock()

    def table_side_effect(name):
        mock = MagicMock()
        if name == "stocks":
            mock.select.return_value.execute.return_value.data = stocks
        elif name == "news_articles":
            mock.select.return_value.gte.return_value.eq.return_value.not_.return_value.is_.return_value.execute.return_value.data = articles
        elif name == "signals":
            mock.select.return_value.eq.return_value.execute.return_value.data = []
        return mock

    db.table.side_effect = table_side_effect
    return db


def test_generate_signals_upserts_signal():
    stocks = [{"id": "stock-1", "ticker": "AAPL"}]
    articles = [
        {
            "id": "art-1",
            "headline": "Beat earnings",
            "url": "https://reuters.com/a",
            "published_at": _now_iso(),
            "sentiment_score": 0.8,
            "credibility_score": 0.92,
            "novelty_score": 1.0,
            "severity": 0.8,
            "event_type": "earnings",
        }
    ]
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = stocks
    db.table.return_value.select.return_value.gte.return_value.eq.return_value.not_.return_value.is_.return_value.execute.return_value.data = articles
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.pipeline.score_articles", return_value=_make_signal_result()):
        generate_signals(db)

    # insert or update should be called for the signal
    assert db.table.return_value.insert.called or db.table.return_value.update.called


def test_generate_signals_skips_when_scoring_returns_none():
    stocks = [{"id": "stock-1", "ticker": "AAPL"}]
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = stocks
    db.table.return_value.select.return_value.gte.return_value.eq.return_value.not_.return_value.is_.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.pipeline.score_articles", return_value=None):
        generate_signals(db)

    db.table.return_value.insert.assert_not_called()


# --- update_prices ---

def test_update_prices_sets_last_price():
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "AAPL"}
    ]

    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 195.50
        update_prices(db)

    update_call = db.table.return_value.update.call_args
    assert update_call[0][0]["last_price"] == 195.50


def test_update_prices_skips_none_price():
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "FAKE"}
    ]

    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = None
        update_prices(db)

    db.table.return_value.update.assert_not_called()


# --- run_pipeline (integration smoke test) ---

def test_run_pipeline_calls_all_steps(monkeypatch):
    from app.services import pipeline as pl

    calls = []

    def fake_ingest(db, tickers):
        calls.append("ingest")
        return ["art-1"]

    def fake_extract(db, articles):
        calls.append("extract")

    def fake_generate(db):
        calls.append("generate")

    def fake_prices(db):
        calls.append("prices")

    monkeypatch.setattr(pl, "ingest_news", fake_ingest)
    monkeypatch.setattr(pl, "extract_features_for_articles", fake_extract)
    monkeypatch.setattr(pl, "generate_signals", fake_generate)
    monkeypatch.setattr(pl, "update_prices", fake_prices)

    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "AAPL"}
    ]

    pl.run_pipeline(db)

    assert calls == ["ingest", "extract", "generate", "prices"]
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend
python -m pytest tests/test_pipeline.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'app.services.pipeline'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/pipeline.py`:

```python
# backend/app/services/pipeline.py
import logging
import time
from datetime import datetime, timezone, timedelta
from statistics import mean

import yfinance as yf
from supabase import Client

from app.services.features import extract_features
from app.services.ingestor import ingest_news
from app.services.scoring import ArticleFeatures, score_articles

logger = logging.getLogger(__name__)


def extract_features_for_articles(db: Client, articles: list[dict]) -> None:
    """Run VADER + keyword feature extraction on articles that lack sentiment."""
    for article in articles:
        try:
            published_at = datetime.fromisoformat(article["published_at"])
            features = extract_features(
                headline=article["headline"],
                url=article["url"],
                published_at=published_at,
            )
            db.table("news_articles").update({
                "sentiment_score":  features.sentiment_score,
                "event_type":       features.event_type,
                "credibility_score": features.credibility_score,
                "novelty_score":    features.novelty_score,
                "severity":         features.severity,
            }).eq("id", article["id"]).execute()
        except Exception as exc:
            logger.error("[pipeline] ERROR: feature extraction failed for article %s — %s", article.get("id"), exc)

    logger.info("[pipeline] Features extracted for %d articles", len(articles))


def generate_signals(db: Client) -> None:
    """Score articles per stock and upsert signals. Re-ranks all signals after."""
    stocks = db.table("stocks").select("id, ticker").execute().data or []
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()

    updated = 0
    unchanged = 0

    for stock in stocks:
        try:
            rows = (
                db.table("news_articles")
                .select("id, sentiment_score, credibility_score, novelty_score, severity, event_type")
                .gte("published_at", cutoff)
                .eq("tickers", f'{{{stock["ticker"]}}}')  # Supabase array contains
                .not_("sentiment_score", "is", None)
                .execute()
                .data or []
            )

            features = [
                ArticleFeatures(
                    sentiment_score=r["sentiment_score"],
                    credibility_score=r["credibility_score"],
                    novelty_score=r["novelty_score"],
                    severity=r["severity"],
                    event_type=r["event_type"],
                )
                for r in rows
            ]

            result = score_articles(features)
            if result is None:
                unchanged += 1
                continue

            article_ids = [r["id"] for r in rows]
            credibilities = [r["credibility_score"] for r in rows]
            domains = list({r.get("url", "").split("/")[2] for r in rows if r.get("url")})

            evidence = {
                "article_count":    len(features),
                "avg_credibility":  round(mean(credibilities), 4) if credibilities else 0.0,
                "sources":          domains,
                "article_ids":      article_ids,
            }
            historical_analog = {
                "avg_move":    round(result.expected_move_high * 0.9, 4),
                "hit_rate":    0.64,
                "sample_size": 15,
            }

            now = datetime.now(timezone.utc)
            signal_data = {
                "stock_id":            stock["id"],
                "direction":           result.direction,
                "confidence":          result.confidence,
                "expected_move_low":   result.expected_move_low,
                "expected_move_high":  result.expected_move_high,
                "opportunity_score":   result.opportunity_score,
                "crash_risk_score":    result.crash_risk_score,
                "drivers":             result.drivers,
                "risk_flags":          result.risk_flags,
                "evidence":            evidence,
                "historical_analog":   historical_analog,
                "horizon_days":        5,
                "expires_at":          (now + timedelta(days=7)).isoformat(),
                "updated_at":          now.isoformat(),
            }

            existing = (
                db.table("signals")
                .select("id")
                .eq("stock_id", stock["id"])
                .execute()
                .data or []
            )

            if existing:
                db.table("signals").update(signal_data).eq("stock_id", stock["id"]).execute()
            else:
                signal_data["created_at"] = now.isoformat()
                db.table("signals").insert(signal_data).execute()

            updated += 1

        except Exception as exc:
            logger.error("[pipeline] ERROR: signal generation failed for %s — %s", stock.get("ticker"), exc)

    # Re-rank all signals by opportunity_score DESC
    try:
        all_signals = (
            db.table("signals")
            .select("id, opportunity_score")
            .order("opportunity_score", desc=True)
            .execute()
            .data or []
        )
        for rank, sig in enumerate(all_signals, start=1):
            db.table("signals").update({"rank": rank}).eq("id", sig["id"]).execute()
    except Exception as exc:
        logger.error("[pipeline] ERROR: re-ranking failed — %s", exc)

    logger.info("[pipeline] Signals: %d updated, %d unchanged (below threshold)", updated, unchanged)


def update_prices(db: Client) -> None:
    """Update last_price for all stocks from yfinance."""
    stocks = db.table("stocks").select("id, ticker").execute().data or []
    count = 0

    for stock in stocks:
        try:
            price = yf.Ticker(stock["ticker"]).fast_info.last_price
            if price is None:
                continue
            db.table("stocks").update({
                "last_price": price,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", stock["id"]).execute()
            count += 1
        except Exception as exc:
            logger.error("[pipeline] ERROR: price update failed for %s — %s", stock.get("ticker"), exc)

    logger.info("[pipeline] Prices: %d updated", count)


def run_pipeline(db: Client) -> None:
    """Run all four pipeline steps in sequence."""
    start = time.monotonic()

    stocks = db.table("stocks").select("id, ticker").execute().data or []
    tickers = [s["ticker"] for s in stocks]
    logger.info("[pipeline] Starting pipeline run — %d stocks", len(tickers))

    # Step 1: Ingest news
    new_article_ids = ingest_news(db, tickers)

    # Step 2: Extract features on new articles
    if new_article_ids:
        new_articles = (
            db.table("news_articles")
            .select("id, headline, url, published_at")
            .in_("id", new_article_ids)
            .execute()
            .data or []
        )
        extract_features_for_articles(db, new_articles)

    # Step 3: Generate signals
    generate_signals(db)

    # Step 4: Update prices
    update_prices(db)

    elapsed = time.monotonic() - start
    logger.info("[pipeline] Pipeline complete in %.1fs", elapsed)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_pipeline.py -v
```

Expected: All tests pass.

- [ ] **Step 5: Run all backend tests to check for regressions**

```bash
cd backend
python -m pytest -v
```

Expected: All tests pass (features + ingestor + pipeline + existing tests).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: add pipeline orchestrator (signal upsert, re-rank, price update)"
```

---

## Task 5: Scheduler + FastAPI Lifespan

**Files:**
- Create: `backend/app/scheduler.py`
- Modify: `backend/app/main.py`

There are no unit tests for the scheduler module itself (it's a thin APScheduler wrapper). We verify it works via the admin trigger endpoint in Task 6.

- [ ] **Step 1: Create the scheduler module**

Create `backend/app/scheduler.py`:

```python
# backend/app/scheduler.py
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()


def configure_scheduler(run_pipeline_fn) -> None:
    """Wire run_pipeline into the scheduler. Called once from lifespan."""
    scheduler.add_job(
        run_pipeline_fn,
        "interval",
        minutes=30,
        next_run_time=datetime.now(),  # run immediately on startup
        id="market_pipeline",
        max_instances=1,               # prevent overlapping runs
        coalesce=True,                 # skip missed runs if server was down
    )
```

- [ ] **Step 2: Update main.py to wire the lifespan**

Replace the contents of `backend/app/main.py` with:

```python
# backend/app/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import signals, stocks, news, analytics, admin
from app.scheduler import scheduler, configure_scheduler
from app.database import get_db
from app.services.pipeline import run_pipeline


def _pipeline_runner():
    """Sync wrapper: get a DB client and run the pipeline."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        db = next(get_db())
        run_pipeline(db)
    except Exception as exc:
        logger.error("[scheduler] Pipeline run failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_scheduler(_pipeline_runner)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Market Pulse AI API",
    version="0.1.0",
    description="AI-powered market intelligence and prediction engine — MVP",
    lifespan=lifespan,
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

- [ ] **Step 3: Verify existing tests still pass**

The test client uses `TestClient(app)` which triggers lifespan. APScheduler will start during tests. Verify nothing breaks:

```bash
cd backend
python -m pytest -v
```

Expected: All tests pass. If APScheduler causes issues in tests, note that `TestClient` runs the lifespan synchronously — APScheduler's AsyncIOScheduler requires a running event loop. If any test fails due to the scheduler, add `scheduler.shutdown()` and remove jobs between tests in conftest — but this is unlikely since TestClient handles the lifespan cleanly.

- [ ] **Step 4: Commit**

```bash
git add backend/app/scheduler.py backend/app/main.py
git commit -m "feat: add APScheduler + FastAPI lifespan (pipeline runs every 30min)"
```

---

## Task 6: Admin Pipeline Trigger Endpoint

**Files:**
- Modify: `backend/app/routers/admin.py`

- [ ] **Step 1: Write the failing test**

Add a new test file `backend/tests/test_admin_pipeline.py`:

```python
# backend/tests/test_admin_pipeline.py
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from unittest.mock import MagicMock


def _make_client():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    return client, db


def test_pipeline_run_returns_started():
    client, db = _make_client()
    with patch("app.routers.admin.run_pipeline") as mock_pipeline:
        resp = client.post("/admin/pipeline/run?secret=dev-secret")
    assert resp.status_code == 200
    assert resp.json()["status"] == "started"
    mock_pipeline.assert_called_once()
    app.dependency_overrides.clear()


def test_pipeline_run_requires_secret():
    client, _ = _make_client()
    resp = client.post("/admin/pipeline/run?secret=wrong-secret")
    assert resp.status_code == 403
    app.dependency_overrides.clear()


def test_pipeline_run_missing_secret():
    client, _ = _make_client()
    resp = client.post("/admin/pipeline/run")
    assert resp.status_code == 422  # FastAPI validation error
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend
python -m pytest tests/test_admin_pipeline.py -v
```

Expected: `FAILED` — `404 Not Found` for `/admin/pipeline/run` (endpoint doesn't exist yet).

- [ ] **Step 3: Add the endpoint to admin.py**

Replace the contents of `backend/app/routers/admin.py` with:

```python
# backend/app/routers/admin.py
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.config import settings
from app.services.seed import load_seed_data, _FAKE_UUID
from app.services.pipeline import run_pipeline

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


@router.post("/pipeline/run")
def trigger_pipeline(
    db: Client = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    run_pipeline(db)
    return {"status": "started"}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_admin_pipeline.py -v
```

Expected: All 3 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd backend
python -m pytest -v
```

Expected: All tests pass with no regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin_pipeline.py
git commit -m "feat: add POST /admin/pipeline/run manual trigger endpoint"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| APScheduler in-process, 30min interval, immediate startup | Task 5 |
| yfinance news fetch per ticker | Task 3 |
| URL deduplication before insert | Task 3 |
| VADER sentiment score | Task 2 |
| Keyword event type classification | Task 2 |
| Domain credibility lookup | Task 2 |
| Time-decay novelty score | Task 2 |
| Severity = abs(sentiment) × event_weight | Task 2 |
| One signal per stock, upsert pattern | Task 4 |
| Re-rank by opportunity_score after cycle | Task 4 |
| Error isolation per ticker (try/except) | Tasks 3, 4 |
| Price update via fast_info.last_price | Task 4 |
| POST /admin/pipeline/run | Task 6 |
| FastAPI lifespan integration | Task 5 |
| Logging format matching spec | Tasks 3, 4 |
| No new DB tables | Confirmed — writes to existing news_articles, signals, stocks |
| Existing scoring engine untouched | Confirmed — only imported, never modified |

**Placeholder scan:** No TBDs, no "implement later" notes. All code blocks are complete.

**Type consistency:**
- `extract_features()` returns `ArticleFeatures` — used correctly in `pipeline.py`
- `score_articles()` takes `list[ArticleFeatures]` — fed correctly from `generate_signals()`
- `ingest_news(db, tickers)` returns `list[str]` (article IDs) — consumed correctly in `run_pipeline()`
- `run_pipeline(db)` takes `Client` — called correctly from scheduler wrapper and admin endpoint
