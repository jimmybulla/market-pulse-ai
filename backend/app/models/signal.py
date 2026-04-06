from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class SignalResponse(BaseModel):
    id: str
    stock_id: Optional[str] = None
    ticker: str
    stock_name: str
    sector: Optional[str] = None
    last_price: Optional[float] = None
    price_at_signal: Optional[float] = None
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    horizon_days: int
    opportunity_score: float
    crash_risk_score: float
    rank: int
    explanation: Optional[str] = None
    drivers: list[str] = []
    evidence: Optional[dict[str, Any]] = None
    historical_analog: Optional[dict[str, Any]] = None
    risk_flags: list[str] = []
    created_at: datetime
    expires_at: Optional[datetime] = None


class PaginatedSignals(BaseModel):
    data: list[SignalResponse]
    total: int
    limit: int
    offset: int


class SignalHistoryEntry(BaseModel):
    id: str
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    horizon_days: int
    price_at_signal: Optional[float] = None
    actual_move: Optional[float] = None
    was_correct: Optional[bool] = None
    accuracy_notes: Optional[str] = None
    created_at: datetime
