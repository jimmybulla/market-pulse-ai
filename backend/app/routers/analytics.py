# backend/app/routers/analytics.py
from fastapi import APIRouter, Depends
from statistics import mean
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


@router.get("/backtesting")
def get_backtesting(db: Client = Depends(get_db)):
    rows = (
        db.table("signal_history")
        .select(
            "direction, confidence, expected_move_low, expected_move_high, "
            "actual_move, was_correct"
        )
        .neq("was_correct", "null")
        .execute()
        .data or []
    )

    if not rows:
        return {
            "total_resolved": 0,
            "overall_hit_rate": 0.0,
            "by_direction": {},
            "by_confidence_tier": {},
            "avg_predicted_move": 0.0,
            "avg_actual_move": 0.0,
        }

    total = len(rows)
    correct_count = sum(1 for r in rows if r["was_correct"])

    by_direction: dict = {}
    for d in ("bullish", "bearish", "crash_risk"):
        d_rows = [r for r in rows if r["direction"] == d]
        if d_rows:
            by_direction[d] = {
                "total": len(d_rows),
                "hit_rate": round(sum(1 for r in d_rows if r["was_correct"]) / len(d_rows), 4),
            }

    def _tier(conf: float) -> str:
        if conf >= 0.8:
            return "high"
        if conf >= 0.6:
            return "medium"
        return "low"

    by_confidence_tier: dict = {}
    for t in ("high", "medium", "low"):
        t_rows = [r for r in rows if _tier(r["confidence"]) == t]
        if t_rows:
            by_confidence_tier[t] = {
                "total": len(t_rows),
                "hit_rate": round(sum(1 for r in t_rows if r["was_correct"]) / len(t_rows), 4),
            }

    avg_predicted = mean(
        (r["expected_move_low"] + r["expected_move_high"]) / 2 for r in rows
    )
    correct_rows = [r for r in rows if r["was_correct"] and r.get("actual_move") is not None]
    avg_actual = mean(abs(r["actual_move"]) for r in correct_rows) if correct_rows else 0.0

    return {
        "total_resolved": total,
        "overall_hit_rate": round(correct_count / total, 4),
        "by_direction": by_direction,
        "by_confidence_tier": by_confidence_tier,
        "avg_predicted_move": round(avg_predicted, 4),
        "avg_actual_move": round(avg_actual, 4),
    }
