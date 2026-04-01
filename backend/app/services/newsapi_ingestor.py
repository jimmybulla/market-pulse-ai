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
