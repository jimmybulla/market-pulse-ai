# Real Historical Analog Stats — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Goal

Replace hardcoded `historical_analog` placeholders (`hit_rate: 0.64`, `sample_size: 15`) with real stats computed from resolved `signal_history` rows.

---

## Approach

Add `_compute_historical_analog(db, stock_id, direction)` helper to `pipeline.py`. Called inside `generate_signals()` per stock, replacing the hardcoded block. Returns `None` when no resolved data exists. No schema changes, no frontend changes.

---

## Design

### New helper: `_compute_historical_analog`

```python
def _compute_historical_analog(
    db: Client,
    stock_id: str,
    direction: str,
) -> dict | None:
```

Queries `signal_history` for rows where:
- `stock_id` matches
- `direction` matches
- `was_correct IS NOT NULL` (resolved rows only)

Computes:
- `avg_move` — `mean(abs(actual_move))` rounded to 4 decimal places
- `hit_rate` — `sum(was_correct) / len(rows)` rounded to 4 decimal places
- `sample_size` — `len(rows)`

Returns `None` if no resolved rows exist.

### Change in `generate_signals()`

Replace:
```python
# TODO: replace with real backtesting data (hit_rate and sample_size are MVP placeholders)
historical_analog = {
    "avg_move":    round(result.expected_move_high * 0.9, 4),
    "hit_rate":    0.64,   # placeholder
    "sample_size": 15,     # placeholder
}
```
With:
```python
historical_analog = _compute_historical_analog(db, stock["id"], result.direction)
```

### Null handling

- `signal_data["historical_analog"]` is set to `None` when no resolved data exists
- `SignalResponse.historical_analog` is already `Optional[dict[str, Any]] = None` — no model change needed
- Frontend already conditionally renders the historical analog section — no frontend change needed

---

## Files Changed

| File | Action |
|------|--------|
| `backend/app/services/pipeline.py` | Add `_compute_historical_analog`, replace hardcoded block |
| `backend/tests/test_pipeline.py` | Add unit tests for `_compute_historical_analog` |
