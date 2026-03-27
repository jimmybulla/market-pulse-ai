# backend/app/routers/news.py
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.news import NewsArticleResponse, PaginatedNews

router = APIRouter()


@router.get("", response_model=PaginatedNews)
def list_news(
    ticker: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
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
