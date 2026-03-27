from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EventResponse(BaseModel):
    id: str
    stock_id: str
    article_id: str
    event_type: Optional[str] = None
    severity: Optional[float] = None
    detected_at: datetime
