# Real Historical Analog Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `historical_analog` placeholders with real stats computed from resolved `signal_history` rows.

**Architecture:** Add `_compute_historical_analog(db, stock_id, direction)` helper to `pipeline.py`. Called inside `generate_signals()` per stock, replacing the 3-line hardcoded block. Returns `None` when no resolved data exists — the Pydantic model and frontend already handle `None` gracefully.

**Tech Stack:** Python, FastAPI, Supabase (PostgREST), pytest + unittest.mock

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/services/pipeline.py` | Modify | Add `_compute_historical_analog`, replace hardcoded block |
| `backend/tests/test_pipeline.py` | Modify | Add 4 unit tests for `_compute_historical_analog` |

---

## Task 1: Add `_compute_historical_analog` and wire it in

**Files:**
- Modify: `backend/app/services/pipeline.py`
- Modify: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write the failing tests**

Open `backend/tests/test_pipeline.py`. Add this import at the top alongside the existing imports:

Find:
```python
from app.services.pipeline import (
    extract_features_for_articles,
    generate_signals,
    update_prices,
    run_pipeline,
)
```
Replace with:
```python
from app.services.pipeline import (
    _compute_historical_analog,
    extract_features_for_articles,
    generate_signals,
    update_prices,
    run_pipeline,
)
```

Then add these 4 tests at the bottom of the file:

```python
# --- _compute_historical_analog ---

def _make_history_db(rows: list[dict]) -> MagicMock:
    """Return a mock db whose signal_history select chain returns `rows`."""
    db = MagicMock()
    (
        db.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .not_.is_.return_value
        .execute.return_value
        .data
    ) = rows
    return db


def test_compute_historical_analog_correct_stats():
    rows = [
        {"actual_move": 0.05, "was_correct": True},
        {"actual_move": -0.03, "was_correct": False},
        {"actual_move": 0.07, "was_correct": True},
    ]
    db = _make_history_db(rows)
    result = _compute_historical_analog(db, "stock-1", "bullish")
    assert result is not None
    assert result["sample_size"] == 3
    assert result["hit_rate"] == pytest.approx(2 / 3, abs=0.001)
    assert result["avg_move"] == pytest.approx((0.05 + 0.03 + 0.07) / 3, abs=0.001)


def test_compute_historical_analog_returns_none_when_no_rows():
    db = _make_history_db([])
    result = _compute_historical_analog(db, "stock-1", "bullish")
    assert result is None


def test_compute_historical_analog_all_correct():
    rows = [
        {"actual_move": 0.04, "was_correct": True},
        {"actual_move": 0.06, "was_correct": True},
    ]
    db = _make_history_db(rows)
    result = _compute_historical_analog(db, "stock-1", "bullish")
    assert result["hit_rate"] == 1.0
    assert result["sample_size"] == 2


def test_compute_historical_analog_uses_abs_actual_move():
    # Bearish signals have negative actual_move when correct — avg_move should be positive
    rows = [
        {"actual_move": -0.08, "was_correct": True},
        {"actual_move": -0.04, "was_correct": True},
    ]
    db = _make_history_db(rows)
    result = _compute_historical_analog(db, "stock-1", "bearish")
    assert result["avg_move"] == pytest.approx(0.06, abs=0.001)
    assert result["avg_move"] > 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python3 -m pytest tests/test_pipeline.py::test_compute_historical_analog_correct_stats tests/test_pipeline.py::test_compute_historical_analog_returns_none_when_no_rows tests/test_pipeline.py::test_compute_historical_analog_all_correct tests/test_pipeline.py::test_compute_historical_analog_uses_abs_actual_move -v 2>&1 | tail -15
```

Expected: 4 errors — `ImportError: cannot import name '_compute_historical_analog'`

- [ ] **Step 3: Add `_compute_historical_analog` to `pipeline.py`**

Open `backend/app/services/pipeline.py`. Add this function after `_record_signal_history` (around line 239) and before `resolve_signal_outcomes`:

```python
def _compute_historical_analog(
    db: Client,
    stock_id: str,
    direction: str,
) -> Optional[dict]:
    """
    Compute real historical analog stats from resolved signal_history rows.
    Returns None when no resolved data exists for this stock+direction.
    """
    rows = (
        db.table("signal_history")
        .select("actual_move, was_correct")
        .eq("stock_id", stock_id)
        .eq("direction", direction)
        .not_.is_("was_correct", "null")
        .execute()
        .data or []
    )
    if not rows:
        return None
    avg_move = round(mean(abs(r["actual_move"]) for r in rows), 4)
    hit_rate = round(sum(1 for r in rows if r["was_correct"]) / len(rows), 4)
    return {
        "avg_move": avg_move,
        "hit_rate": hit_rate,
        "sample_size": len(rows),
    }
```

- [ ] **Step 4: Replace the hardcoded block in `generate_signals`**

Inside `generate_signals()`, find:

```python
            # TODO: replace with real backtesting data (hit_rate and sample_size are MVP placeholders)
            historical_analog = {
                "avg_move":    round(result.expected_move_high * 0.9, 4),
                "hit_rate":    0.64,   # placeholder
                "sample_size": 15,     # placeholder
            }
```
Replace with:
```python
            historical_analog = _compute_historical_analog(db, stock["id"], result.direction)
```

- [ ] **Step 5: Run the 4 new tests to verify they pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python3 -m pytest tests/test_pipeline.py::test_compute_historical_analog_correct_stats tests/test_pipeline.py::test_compute_historical_analog_returns_none_when_no_rows tests/test_pipeline.py::test_compute_historical_analog_all_correct tests/test_pipeline.py::test_compute_historical_analog_uses_abs_actual_move -v 2>&1 | tail -15
```

Expected: 4 passed.

- [ ] **Step 6: Run the full test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python3 -m pytest tests/ -q --tb=short 2>&1 | tail -8
```

Expected: same pass count as before + 4 new tests passing (3 pre-existing failures in test_ingestor.py are unrelated — ignore them).
