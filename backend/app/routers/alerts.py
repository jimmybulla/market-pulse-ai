# backend/app/routers/alerts.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.database import get_db

router = APIRouter()


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": ..., "auth": ...}


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/subscribe")
def subscribe(body: SubscribeRequest, db: Client = Depends(get_db)):
    db.table("push_subscriptions").upsert(
        {
            "endpoint": body.endpoint,
            "p256dh": body.keys["p256dh"],
            "auth": body.keys["auth"],
        },
        on_conflict="endpoint",
    ).execute()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe(body: UnsubscribeRequest, db: Client = Depends(get_db)):
    db.table("push_subscriptions").delete().eq("endpoint", body.endpoint).execute()
    return {"status": "unsubscribed"}
