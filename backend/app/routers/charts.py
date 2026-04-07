# backend/app/routers/charts.py
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal
import time

import logging

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

RangeParam = Literal["7d", "30d", "90d"]
_DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90}

# Simple TTL cache: key → (timestamp, data)
_PRICE_CACHE: dict[str, tuple[float, list]] = {}
_PRICE_CACHE_TTL = 3600  # 1 hour


@router.get("/{ticker}/price-history")
def get_price_history(
    ticker: str,
    period: RangeParam = Query("30d", alias="range"),
    db: Client = Depends(get_db),
):
    upper = ticker.upper()
    days = _DAYS[period]

    # Try Supabase-cached history first (populated by pipeline, avoids yfinance rate limits)
    stock_row = (
        db.table("stocks")
        .select("price_history_90d")
        .eq("ticker", upper)
        .maybe_single()
        .execute()
        .data
    )
    if stock_row and stock_row.get("price_history_90d"):
        all_data = stock_row["price_history_90d"]
        sliced = all_data[-days:] if len(all_data) >= days else all_data
        return {"ticker": upper, "range": period, "data": sliced}

    # Fallback: fetch from yfinance (used before first pipeline run)
    cache_key = f"{upper}:{period}"
    now = time.time()
    cached = _PRICE_CACHE.get(cache_key)
    if cached and now - cached[0] < _PRICE_CACHE_TTL:
        return {"ticker": upper, "range": period, "data": cached[1]}

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    try:
        hist = yf.Ticker(upper).history(start=start, end=end)
    except Exception as exc:
        logger.error("[charts] price-history error for %s: %s: %s", upper, type(exc).__name__, exc)
        if cached:
            logger.warning("[charts] returning stale cache for %s due to error", upper)
            return {"ticker": upper, "range": period, "data": cached[1]}
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch price data for {upper}: {type(exc).__name__}",
        )
    if hist.empty:
        if cached:
            return {"ticker": upper, "range": period, "data": cached[1]}
        raise HTTPException(
            status_code=502,
            detail=f"No price data available for {upper}",
        )
    data = [
        {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
        for idx, row in hist.iterrows()
    ]
    _PRICE_CACHE[cache_key] = (now, data)
    return {"ticker": upper, "range": period, "data": data}


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
