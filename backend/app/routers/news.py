# backend/app/routers/news.py
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.news import NewsArticleResponse, NewsFeedItem, PaginatedNews

router = APIRouter()


@router.get("", response_model=PaginatedNews)
def list_news(
    ticker: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    query = db.table("news_articles").select("*").order("published_at", desc=True)
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


# NOTE: /feed must be registered before /{article_id} to avoid FastAPI
# routing "feed" as an article_id path parameter.
@router.get("/feed", response_model=list[NewsFeedItem])
def get_news_feed(
    direction: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    db: Client = Depends(get_db),
):
    from datetime import datetime, timezone, timedelta

    # Build article_id → signal map from all signals
    signals = (
        db.table("signals")
        .select("id, direction, confidence, opportunity_score, evidence")
        .order("opportunity_score", desc=True)
        .limit(500)
        .execute()
        .data or []
    )
    article_signal: dict = {}
    for sig in signals:
        evidence = sig.get("evidence") or {}
        for aid in (evidence.get("article_ids") or []):
            if aid not in article_signal:
                article_signal[aid] = sig

    # Fetch recent articles with features (last 48 h, non-empty headline and url)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    articles = (
        db.table("news_articles")
        .select(
            "id, headline, url, published_at, sentiment_score, "
            "event_type, credibility_score, tickers"
        )
        .gte("published_at", cutoff)
        .not_.is_("sentiment_score", "null")
        .order("published_at", desc=True)
        .limit(100)
        .execute()
        .data or []
    )

    # Filter out articles with empty/missing headlines or URLs
    articles = [a for a in articles if a.get("headline") and a.get("url")]

    result = []
    for article in articles:
        sig = article_signal.get(article["id"])

        if direction and (not sig or sig["direction"] != direction):
            continue
        if event_type and article.get("event_type") != event_type:
            continue

        result.append({
            **article,
            "signal_direction": sig["direction"] if sig else None,
            "signal_confidence": sig["confidence"] if sig else None,
            "signal_opportunity_score": sig["opportunity_score"] if sig else None,
        })

    # Sort: signal-linked first (by opportunity_score), then by published_at
    result.sort(
        key=lambda x: (
            x["signal_opportunity_score"] if x["signal_opportunity_score"] is not None else -1,
            x["published_at"] or "",
        ),
        reverse=True,
    )
    return result


@router.get("/{article_id}", response_model=NewsArticleResponse)
def get_article(article_id: str, db: Client = Depends(get_db)):
    result = db.table("news_articles").select("*").eq(
        "id", article_id
    ).maybe_single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Article not found")

    return result.data
