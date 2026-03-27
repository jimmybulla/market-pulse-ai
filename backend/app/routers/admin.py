# backend/app/routers/admin.py
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.config import settings
from app.services.seed import load_seed_data, _FAKE_UUID
from app.services.pipeline import run_pipeline

router = APIRouter()


def _verify_secret(secret: str = Query(..., description="Admin secret key")):
    if secret != settings.admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")


@router.post("/seed")
def seed_database(
    db: Client = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    result = load_seed_data(db)
    return {"message": "Seed data loaded successfully", **result}


@router.delete("/clear")
def clear_database(
    db: Client = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    for table in ("signal_history", "signals", "events", "news_articles", "stocks", "sources"):
        db.table(table).delete().neq("id", _FAKE_UUID).execute()
    return {"message": "All tables cleared"}


@router.post("/pipeline/run")
def trigger_pipeline(
    db: Client = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    run_pipeline(db)
    return {"status": "started"}
