from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class StockResponse(BaseModel):
    id: str
    ticker: str
    name: str
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    last_price: Optional[float] = None
    updated_at: Optional[datetime] = None


class StockWithSignal(StockResponse):
    latest_signal: Optional[dict[str, Any]] = None


class PaginatedStocks(BaseModel):
    data: list[StockResponse]
    total: int
    limit: int
    offset: int
