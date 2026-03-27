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
    range: RangeParam = Query("30d"),
    db: Client = Depends(get_db),
):
    t = yf.Ticker(ticker.upper())
    hist = t.history(period=range)
    if hist.empty:
        raise HTTPException(
            status_code=502,
            detail=f"No price data available for {ticker.upper()}",
        )
    data = [
        {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
        for idx, row in hist.iterrows()
    ]
    return {"ticker": ticker.upper(), "range": range, "data": data}


@router.get("/{ticker}/sentiment-trend")
def get_sentiment_trend(
    ticker: str,
    range: RangeParam = Query("30d"),
    db: Client = Depends(get_db),
):
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=_DAYS[range])
    ).isoformat()
    rows = (
        db.table("news_articles")
        .select("published_at, sentiment_score")
        .filter("tickers", "cs", f"{{{ticker.upper()}}}")
        .gte("published_at", cutoff)
        .neq("sentiment_score", "null")
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
    return {"ticker": ticker.upper(), "range": range, "data": data}


@router.get("/{ticker}/news-volume")
def get_news_volume(
    ticker: str,
    range: RangeParam = Query("30d"),
    db: Client = Depends(get_db),
):
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=_DAYS[range])
    ).isoformat()
    rows = (
        db.table("news_articles")
        .select("published_at")
        .filter("tickers", "cs", f"{{{ticker.upper()}}}")
        .gte("published_at", cutoff)
        .execute()
        .data
        or []
    )
    daily: dict[str, int] = defaultdict(int)
    for row in rows:
        daily[row["published_at"][:10]] += 1
    data = [{"date": d, "count": c} for d, c in sorted(daily.items())]
    return {"ticker": ticker.upper(), "range": range, "data": data}
