# backend/app/routers/stocks.py
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.stock import StockResponse, StockWithSignal, PaginatedStocks

router = APIRouter()


@router.get("", response_model=PaginatedStocks)
def list_stocks(
    sector: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    query = db.table("stocks").select("*").order("ticker")
    count_query = db.table("stocks").select("id", count="exact")

    if sector:
        query = query.eq("sector", sector)
        count_query = count_query.eq("sector", sector)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": result.data,
        "total": count_result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{ticker}", response_model=StockWithSignal)
def get_stock(ticker: str, db: Client = Depends(get_db)):
    stock_result = db.table("stocks").select("*").eq(
        "ticker", ticker.upper()
    ).maybe_single().execute()

    if not stock_result.data:
        raise HTTPException(status_code=404, detail="Stock not found")

    signal_result = db.table("signals").select("*").eq(
        "stock_id", stock_result.data["id"]
    ).order("created_at", desc=True).limit(1).execute()

    return {
        **stock_result.data,
        "latest_signal": signal_result.data[0] if signal_result.data else None,
    }
