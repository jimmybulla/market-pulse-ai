# backend/app/routers/analytics.py
from fastapi import APIRouter, Depends
from supabase import Client

from app.database import get_db

router = APIRouter()


@router.get("/accuracy")
def get_accuracy(db: Client = Depends(get_db)):
    result = db.table("signal_history").select("*").execute()
    rows = result.data

    resolved = [r for r in rows if r.get("was_correct") is not None]
    if not resolved:
        return {"total_resolved": 0, "overall_accuracy": None, "by_direction": {}}

    correct = [r for r in resolved if r["was_correct"]]
    overall_accuracy = round(len(correct) / len(resolved), 4)

    by_direction: dict = {}
    for direction in ("bullish", "bearish", "crash_risk"):
        d_rows = [r for r in resolved if r["direction"] == direction]
        if not d_rows:
            continue
        d_correct = [r for r in d_rows if r["was_correct"]]
        moves = [r["actual_move"] for r in d_rows if r.get("actual_move") is not None]
        by_direction[direction] = {
            "count": len(d_rows),
            "hit_rate": round(len(d_correct) / len(d_rows), 6),
            "avg_actual_move": round(sum(moves) / len(moves), 4) if moves else None,
        }

    return {
        "total_resolved": len(resolved),
        "overall_accuracy": overall_accuracy,
        "by_direction": by_direction,
    }
