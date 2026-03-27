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
