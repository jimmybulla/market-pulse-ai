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
