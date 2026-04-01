# NewsAPI Ingestor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NewsAPI as a second news source that runs every pipeline cycle, batching tracked tickers into 2 HTTP requests to stay within the 100 req/day free tier.

**Architecture:** A new `newsapi_ingestor.py` module exposes `ingest_newsapi(db, tickers) -> list[str]`. It is called from `run_pipeline()` immediately after `ingest_news()`. The two returned ID lists are merged and passed together to `extract_features_for_articles`. If `NEWSAPI_KEY` is not set, the module returns `[]` immediately and the rest of the pipeline is unaffected.

**Tech Stack:** Python, httpx (already in requirements.txt), pydantic-settings, pytest + unittest.mock

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/config.py` | Modify | Add `newsapi_key: str = ""` optional setting |
| `backend/.env` | Modify | Add `NEWSAPI_KEY=f451b73c631147b18961248d97a077a8` |
| `backend/.env.example` | Modify | Document `NEWSAPI_KEY=` placeholder |
| `backend/app/services/newsapi_ingestor.py` | Create | `ingest_newsapi()` — batched requests, ticker extraction, dedup, insert |
| `backend/tests/test_newsapi_ingestor.py` | Create | 2 unit tests using mocked httpx and DB |
| `backend/app/services/pipeline.py` | Modify | Call `ingest_newsapi` after `ingest_news`, merge ID lists |

---

### Task 1: Config and env

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/.env`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add `newsapi_key` to Settings**

Open `backend/app/config.py`. Add one line inside the `Settings` class, after `vapid_contact_email`:

```python
    newsapi_key: str = ""
```

Full updated class:

```python
class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    admin_secret: str = "dev-secret"
    env: str = "development"
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "admin@example.com"
    newsapi_key: str = ""

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def warn_missing_vapid_keys(self) -> "Settings":
        if self.env != "development" and not self.vapid_private_key:
            logger.warning(
                "VAPID_PRIVATE_KEY is not set — push notifications will not work in %s",
                self.env,
            )
        return self
```

- [ ] **Step 2: Add key to `.env` and `.env.example`**

Append to `backend/.env`:
```
NEWSAPI_KEY=f451b73c631147b18961248d97a077a8
```

Append to `backend/.env.example`:
```
NEWSAPI_KEY=
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add backend/app/config.py backend/.env.example && git commit -m "feat: add NEWSAPI_KEY config setting"
```

(Do **not** stage `backend/.env` — it contains real secrets and is gitignored.)

---

### Task 2: newsapi_ingestor module (TDD)

**Files:**
- Create: `backend/tests/test_newsapi_ingestor.py`
- Create: `backend/app/services/newsapi_ingestor.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_newsapi_ingestor.py`:

```python
# backend/tests/test_newsapi_ingestor.py
from unittest.mock import MagicMock, patch

from app.services.newsapi_ingestor import ingest_newsapi


def _make_db(existing_urls: list[str] = None):
    db = MagicMock()
    url_data = [{"url": u} for u in (existing_urls or [])]
    db.table.return_value.select.return_value.gte.return_value.execute.return_value.data = url_data
    db.table.return_value.insert.return_value.execute.return_value.data = [{"id": "newsapi-article-1"}]
    return db


def _make_response(articles: list[dict]):
    resp = MagicMock()
    resp.json.return_value = {"articles": articles}
    resp.raise_for_status.return_value = None
    return resp


def test_ingest_newsapi_inserts_new_article_and_skips_duplicate():
    """One new article (AAPL in title) and one duplicate URL → only new one inserted."""
    db = _make_db(existing_urls=["https://existing.com/old"])
    articles = [
        {
            "title": "AAPL beats earnings expectations",
            "url": "https://reuters.com/new",
            "publishedAt": "2026-04-01T12:00:00Z",
            "source": {"name": "Reuters"},
        },
        {
            "title": "Market roundup",
            "url": "https://existing.com/old",
            "publishedAt": "2026-04-01T10:00:00Z",
            "source": {"name": "CNN"},
        },
    ]

    with patch("app.services.newsapi_ingestor.settings") as mock_settings, \
         patch("app.services.newsapi_ingestor.httpx.get") as mock_get:
        mock_settings.newsapi_key = "test-key"
        mock_get.return_value = _make_response(articles)
        result = ingest_newsapi(db, ["AAPL", "MSFT"])

    assert len(result) == 1
    assert result[0] == "newsapi-article-1"
    insert_call = db.table.return_value.insert.call_args
    inserted = insert_call[0][0]
    assert inserted["headline"] == "AAPL beats earnings expectations"
    assert "AAPL" in inserted["tickers"]


def test_ingest_newsapi_returns_empty_when_no_key():
    """If NEWSAPI_KEY is empty, return [] immediately without any HTTP call."""
    db = _make_db()

    with patch("app.services.newsapi_ingestor.settings") as mock_settings, \
         patch("app.services.newsapi_ingestor.httpx.get") as mock_get:
        mock_settings.newsapi_key = ""
        result = ingest_newsapi(db, ["AAPL", "MSFT"])

    assert result == []
    mock_get.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && python -m pytest tests/test_newsapi_ingestor.py -v 2>&1 | tail -15
```

Expected: 2 failures — `ModuleNotFoundError: No module named 'app.services.newsapi_ingestor'`

- [ ] **Step 3: Create `newsapi_ingestor.py`**

Create `backend/app/services/newsapi_ingestor.py`:

```python
# backend/app/services/newsapi_ingestor.py
import logging
import math
from datetime import datetime, timezone, timedelta

import httpx
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)

NEWSAPI_URL = "https://newsapi.org/v2/everything"


def ingest_newsapi(db: Client, tickers: list[str]) -> list[str]:
    """
    Fetch news from NewsAPI for all tickers in at most 2 batched requests.
    Returns list of newly inserted article IDs.
    Skips gracefully if NEWSAPI_KEY is not configured.
    """
    if not settings.newsapi_key:
        logger.warning("[newsapi] NEWSAPI_KEY not set — skipping")
        return []

    if not tickers:
        return []

    # Fetch existing URLs to deduplicate (match signal retention window)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    existing_resp = (
        db.table("news_articles")
        .select("url")
        .gte("published_at", cutoff)
        .execute()
    )
    existing_urls: set[str] = {row["url"] for row in (existing_resp.data or [])}

    new_ids: list[str] = []
    new_count = 0
    dup_count = 0

    # Split into 2 batches to stay within 100 req/day free tier
    batch_size = math.ceil(len(tickers) / 2)
    batches = [tickers[i:i + batch_size] for i in range(0, len(tickers), batch_size)]
    from_date = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

    for batch in batches:
        q = " OR ".join(batch)
        try:
            resp = httpx.get(
                NEWSAPI_URL,
                params={
                    "q": q,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": 20,
                    "from": from_date,
                    "apiKey": settings.newsapi_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            articles = resp.json().get("articles", [])
        except Exception as exc:
            logger.error("[newsapi] ERROR: batch request failed — %s", exc)
            continue

        for article in articles:
            url = article.get("url", "")
            if not url or url in existing_urls:
                dup_count += 1
                continue

            title = article.get("title") or ""
            matched_tickers = [t for t in batch if t in title.upper()]
            if not matched_tickers:
                continue

            existing_urls.add(url)

            pub_str = article.get("publishedAt", "")
            try:
                published_at = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                published_at = datetime.now(timezone.utc)

            row = {
                "headline": title,
                "url": url,
                "published_at": published_at.isoformat(),
                "tickers": matched_tickers,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }

            try:
                insert_resp = db.table("news_articles").insert(row).execute()
                for inserted in insert_resp.data or []:
                    new_ids.append(inserted["id"])
                    new_count += 1
            except Exception as exc:
                logger.error("[newsapi] ERROR: failed to insert article %s — %s", url, exc)

    logger.info(
        "[newsapi] Ingested %d new articles (%d duplicates/no-ticker skipped)",
        new_count,
        dup_count,
    )
    return new_ids
```

- [ ] **Step 4: Run tests to verify both pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && python -m pytest tests/test_newsapi_ingestor.py -v 2>&1 | tail -15
```

Expected: 2 passing

- [ ] **Step 5: Run full backend test suite to confirm nothing broke**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && python -m pytest --tb=short 2>&1 | tail -15
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add backend/app/services/newsapi_ingestor.py backend/tests/test_newsapi_ingestor.py && git commit -m "feat: add NewsAPI ingestor with batched requests and ticker extraction"
```

---

### Task 3: Wire into pipeline

**Files:**
- Modify: `backend/app/services/pipeline.py` (lines 373–399, the `run_pipeline` function)

- [ ] **Step 1: Add import**

Open `backend/app/services/pipeline.py`. Find the existing import block at the top and add:

```python
from app.services.newsapi_ingestor import ingest_newsapi
```

The full import block should look like:

```python
from app.services.features import extract_features
from app.services.ingestor import ingest_news
from app.services.newsapi_ingestor import ingest_newsapi
from app.services.push import send_push_notification
from app.services.scoring import ArticleFeatures, score_articles
```

- [ ] **Step 2: Merge NewsAPI IDs in `run_pipeline`**

Find this block in `run_pipeline` (currently lines 382–393):

```python
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
```

Replace with:

```python
    # Step 1: Ingest news (yfinance + NewsAPI)
    new_article_ids = ingest_news(db, tickers)
    newsapi_ids = ingest_newsapi(db, tickers)
    all_new_ids = list(set(new_article_ids + newsapi_ids))

    # Step 2: Extract features on new articles
    if all_new_ids:
        new_articles = (
            db.table("news_articles")
            .select("id, headline, url, published_at")
            .in_("id", all_new_ids)
            .execute()
            .data or []
        )
        extract_features_for_articles(db, new_articles)
```

- [ ] **Step 3: Run full backend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend" && python -m pytest --tb=short 2>&1 | tail -15
```

Expected: all tests passing

- [ ] **Step 4: Commit**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI" && git add backend/app/services/pipeline.py && git commit -m "feat: wire NewsAPI ingestor into pipeline alongside yfinance"
```
