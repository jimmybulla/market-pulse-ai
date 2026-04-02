# backend/app/routers/charts.py
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.database import get_db

router = APIRouter()

RangeParam = Literal["7d", "30d", "90d"]
_DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90}


@router.get("/{ticker}/price-history")
def get_price_history(
    ticker: str,
    period: RangeParam = Query("30d", alias="range"),
):
    days = _DAYS[period]
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    try:
        hist = yf.Ticker(ticker.upper()).history(start=start, end=end)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch price data for {ticker.upper()}",
        )
    if hist.empty:
        raise HTTPException(
            status_code=502,
            detail=f"No price data available for {ticker.upper()}",
        )
    data = [
        {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
        for idx, row in hist.iterrows()
    ]
    return {"ticker": ticker.upper(), "range": period, "data": data}


@router.get("/{ticker}/sentiment-trend")
def get_sentiment_trend(
    ticker: str,
    period: RangeParam = Query("30d", alias="range"),
    db: Client = Depends(get_db),
):
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=_DAYS[period])
    ).isoformat()
    rows = (
        db.table("news_articles")
        .select("published_at, sentiment_score")
        .contains("tickers", [ticker.upper()])
        .gte("published_at", cutoff)
        .not_.is_("sentiment_score", "null")
        .execute()
        .data
        or []
    )
    daily: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        daily[row["published_at"][:10]].append(row["sentiment_score"])
    data = [
        {"date": d, "avg_sentiment": round(sum(v) / len(v), 4)}
        for d, v in sorted(daily.items())
    ]
    return {"ticker": ticker.upper(), "range": period, "data": data}


@router.get("/{ticker}/news-volume")
def get_news_volume(
    ticker: str,
    period: RangeParam = Query("30d", alias="range"),
    db: Client = Depends(get_db),
):
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=_DAYS[period])
    ).isoformat()
    rows = (
        db.table("news_articles")
        .select("published_at")
        .contains("tickers", [ticker.upper()])
        .gte("published_at", cutoff)
        .execute()
        .data
        or []
    )
    daily: dict[str, int] = defaultdict(int)
    for row in rows:
        daily[row["published_at"][:10]] += 1
    data = [{"date": d, "count": c} for d, c in sorted(daily.items())]
    return {"ticker": ticker.upper(), "range": period, "data": data}
