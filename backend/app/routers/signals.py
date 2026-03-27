# backend/app/routers/signals.py
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.signal import SignalResponse, PaginatedSignals

router = APIRouter()


def _enrich(row: dict) -> dict:
    stock = row.pop("stocks", None) or {}
    row["ticker"] = stock.get("ticker", "")
    row["stock_name"] = stock.get("name", "")
    row["sector"] = stock.get("sector")
    row["last_price"] = stock.get("last_price")
    return row


@router.get("", response_model=PaginatedSignals)
def list_signals(
    direction: Optional[str] = Query(None),
    horizon: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    query = db.table("signals").select(
        "*, stocks(ticker, name, sector, last_price)"
    ).order("rank")

    count_query = db.table("signals").select("id", count="exact")

    if direction:
        query = query.eq("direction", direction)
        count_query = count_query.eq("direction", direction)
    if horizon:
        query = query.eq("horizon_days", horizon)
        count_query = count_query.eq("horizon_days", horizon)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": [_enrich(row) for row in result.data],
        "total": count_result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{signal_id}", response_model=SignalResponse)
def get_signal(signal_id: str, db: Client = Depends(get_db)):
    result = db.table("signals").select(
        "*, stocks(ticker, name, sector, last_price)"
    ).eq("id", signal_id).maybe_single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")

    return _enrich(result.data)
