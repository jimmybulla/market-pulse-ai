# Signal History & Backtesting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record signal snapshots on change, resolve outcomes after the horizon passes, and expose per-stock history + aggregate accuracy metrics in the API and frontend.

**Architecture:** `_record_signal_history()` inserts into `signal_history` when direction/confidence changes inside `generate_signals`. `resolve_signal_outcomes()` runs as Step 5 in the pipeline and marks outcomes for expired rows using yfinance. Two new backend endpoints serve history and aggregate stats. Frontend adds a `SignalHistory` client component to the stock detail page and a `BacktestingDashboard` server-rendered page.

**Tech Stack:** Python/FastAPI (backend), Supabase (database), yfinance (price lookup), Next.js Server + Client Components, TypeScript.

---

## File Map

**Create:**
- `backend/migrations/002_add_price_at_signal.sql`
- `backend/tests/test_signal_history.py`
- `frontend/app/api/signals/history/[ticker]/route.ts`
- `frontend/app/api/analytics/backtesting/route.ts`
- `frontend/components/signals/SignalHistory.tsx`
- `frontend/components/signals/__tests__/SignalHistory.test.tsx`
- `frontend/components/analytics/BacktestingDashboard.tsx`
- `frontend/components/analytics/__tests__/BacktestingDashboard.test.tsx`
- `frontend/app/backtesting/page.tsx`

**Modify:**
- `backend/app/models/signal.py` — add `SignalHistoryEntry`
- `backend/app/services/pipeline.py` — add `_record_signal_history`, `resolve_signal_outcomes`, wire into `run_pipeline`, update stocks select
- `backend/app/routers/signals.py` — add `GET /history/{ticker}`
- `backend/app/routers/analytics.py` — add `GET /backtesting`
- `frontend/lib/types.ts` — add `SignalHistoryEntry`, `BacktestingStats`
- `frontend/lib/api.ts` — add `getSignalHistory`, `getBacktestingStats`
- `frontend/app/stock/[ticker]/page.tsx` — render `<SignalHistory>`
- `frontend/components/layout/Sidebar.tsx` — add Backtesting nav item

---

## Task 1: Schema migration

**Files:**
- Create: `backend/migrations/002_add_price_at_signal.sql`

- [ ] **Step 1: Create migration file**

```sql
-- backend/migrations/002_add_price_at_signal.sql
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS price_at_signal FLOAT;
```

- [ ] **Step 2: Run migration in Supabase**

In the Supabase dashboard SQL editor, run:
```sql
ALTER TABLE signal_history ADD COLUMN IF NOT EXISTS price_at_signal FLOAT;
```
Expected: no error, column appears in `signal_history` table definition.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/002_add_price_at_signal.sql
git commit -m "feat: add price_at_signal column to signal_history"
```

---

## Task 2: Backend model

**Files:**
- Modify: `backend/app/models/signal.py`

- [ ] **Step 1: Add `SignalHistoryEntry` model**

Read `backend/app/models/signal.py` first, then add at the bottom:

```python
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
```

- [ ] **Step 2: Confirm no test failures**

```bash
cd backend && .venv/bin/pytest --tb=short -q
```
Expected: all 87 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/signal.py
git commit -m "feat: add SignalHistoryEntry model"
```

---

## Task 3: History recording in generate_signals

**Files:**
- Modify: `backend/app/services/pipeline.py`
- Create: `backend/tests/test_signal_history.py`

**Context:** `generate_signals` currently selects `"id, ticker"` from stocks. It needs `"id, ticker, last_price"`. After each signal upsert, it calls `_record_signal_history`. The helper checks the most recent `signal_history` row; if none exists, or direction changed, or `|conf_diff| >= 0.05`, it inserts a new snapshot.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_signal_history.py
from unittest.mock import MagicMock, patch, call
from app.services.pipeline import _record_signal_history


def _make_hist_db(last_row=None):
    db = MagicMock()
    hist = MagicMock()
    hist.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[last_row] if last_row else []
    )
    db.table.return_value = hist
    return db, hist


def _signal_data(direction="bullish", confidence=0.72):
    return {
        "direction": direction,
        "confidence": confidence,
        "expected_move_low": 0.03,
        "expected_move_high": 0.07,
        "horizon_days": 5,
    }


def test_record_history_inserts_when_no_prior_row():
    db, hist = _make_hist_db(last_row=None)
    _record_signal_history(db, "stock-1", _signal_data(), 150.0, "sig-1")
    hist.insert.assert_called_once()
    inserted = hist.insert.call_args.args[0]
    assert inserted["direction"] == "bullish"
    assert inserted["price_at_signal"] == 150.0
    assert inserted["signal_id"] == "sig-1"


def test_record_history_inserts_on_direction_change():
    db, hist = _make_hist_db(last_row={"direction": "bearish", "confidence": 0.72})
    _record_signal_history(db, "stock-1", _signal_data(direction="bullish"), 150.0, None)
    hist.insert.assert_called_once()


def test_record_history_inserts_on_confidence_shift():
    db, hist = _make_hist_db(last_row={"direction": "bullish", "confidence": 0.65})
    # 0.72 - 0.65 = 0.07 >= 0.05 → should insert
    _record_signal_history(db, "stock-1", _signal_data(confidence=0.72), 150.0, None)
    hist.insert.assert_called_once()


def test_record_history_skips_when_unchanged():
    db, hist = _make_hist_db(last_row={"direction": "bullish", "confidence": 0.72})
    # same direction, |0.72 - 0.72| = 0.0 < 0.05 → skip
    _record_signal_history(db, "stock-1", _signal_data(confidence=0.72), 150.0, None)
    hist.insert.assert_not_called()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v
```
Expected: `ImportError: cannot import name '_record_signal_history'`

- [ ] **Step 3: Add `_record_signal_history` to pipeline.py**

Read `backend/app/services/pipeline.py` first. Add this function after `update_prices` and before `check_and_push_alerts`:

```python
def _record_signal_history(
    db: Client,
    stock_id: str,
    signal_data: dict,
    last_price: float | None,
    signal_id: str | None,
) -> None:
    """Insert a signal_history snapshot if direction or confidence changed >= 5%."""
    last = (
        db.table("signal_history")
        .select("direction, confidence")
        .eq("stock_id", stock_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data or []
    )

    direction = signal_data["direction"]
    confidence = signal_data["confidence"]

    if last:
        prev = last[0]
        if prev["direction"] == direction and abs(prev["confidence"] - confidence) < 0.05:
            return  # no meaningful change

    db.table("signal_history").insert({
        "stock_id":          stock_id,
        "signal_id":         signal_id,
        "direction":         direction,
        "confidence":        confidence,
        "expected_move_low": signal_data["expected_move_low"],
        "expected_move_high": signal_data["expected_move_high"],
        "horizon_days":      signal_data["horizon_days"],
        "price_at_signal":   last_price,
    }).execute()
```

- [ ] **Step 4: Modify `generate_signals` to include `last_price` in stocks select**

In `generate_signals`, change the first line from:
```python
stocks = db.table("stocks").select("id, ticker").execute().data or []
```
to:
```python
stocks = db.table("stocks").select("id, ticker, last_price").execute().data or []
```

- [ ] **Step 5: Call `_record_signal_history` after the signal upsert**

In `generate_signals`, inside the `try` block for each stock, after the `if existing: ... else: ...` upsert block and before `updated += 1`, add:

```python
            signal_id = existing[0]["id"] if existing else None
            _record_signal_history(
                db,
                stock["id"],
                signal_data,
                stock.get("last_price"),
                signal_id,
            )
```

- [ ] **Step 6: Run the history recording tests**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v
```
Expected: `4 passed`

- [ ] **Step 7: Run full backend suite**

```bash
cd backend && .venv/bin/pytest --tb=short -q
```
Expected: all tests pass (87 unchanged + 4 new = 91 passed).

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/pipeline.py backend/tests/test_signal_history.py
git commit -m "feat: record signal_history snapshots on direction/confidence change"
```

---

## Task 4: Outcome resolution pipeline step

**Files:**
- Modify: `backend/app/services/pipeline.py`
- Modify: `backend/tests/test_signal_history.py`

**Context:** `resolve_signal_outcomes` queries `signal_history` rows where `actual_move IS NULL`, filters in Python to those whose `created_at + horizon_days` has passed, then uses yfinance to compute `actual_move` and `was_correct`. It runs as Step 5 in `run_pipeline`, before `check_and_push_alerts`. Uses `yf` which is already imported in `pipeline.py`.

- [ ] **Step 1: Add failing tests to test_signal_history.py**

Append to `backend/tests/test_signal_history.py`:

```python
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from app.services.pipeline import resolve_signal_outcomes


def _expired_row(direction="bullish", confidence=0.75, exp_low=0.03, exp_high=0.07,
                  price_at_signal=100.0, stock_id="stock-aapl"):
    """A signal_history row whose horizon_days=5 expired > 5 days ago."""
    created = (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
    return {
        "id": "hist-1",
        "stock_id": stock_id,
        "direction": direction,
        "confidence": confidence,
        "expected_move_low": exp_low,
        "expected_move_high": exp_high,
        "horizon_days": 5,
        "price_at_signal": price_at_signal,
        "created_at": created,
    }


def _pending_row():
    """A signal_history row whose horizon has NOT yet passed."""
    created = datetime.now(timezone.utc).isoformat()
    return {
        "id": "hist-2",
        "stock_id": "stock-aapl",
        "direction": "bullish",
        "confidence": 0.75,
        "expected_move_low": 0.03,
        "expected_move_high": 0.07,
        "horizon_days": 5,
        "price_at_signal": 100.0,
        "created_at": created,
    }


def _make_resolve_db(history_rows, stocks_data):
    db = MagicMock()
    hist = MagicMock()
    hist.select.return_value.is_.return_value.gte.return_value.execute.return_value = MagicMock(
        data=history_rows
    )
    stocks_tbl = MagicMock()
    stocks_tbl.select.return_value.execute.return_value = MagicMock(data=stocks_data)

    def side(t):
        if t == "signal_history":
            return hist
        if t == "stocks":
            return stocks_tbl
        return MagicMock()

    db.table.side_effect = side
    return db, hist


_STOCKS = [{"id": "stock-aapl", "ticker": "AAPL"}]


def test_resolve_marks_bullish_correct_when_move_meets_low():
    db, hist = _make_resolve_db([_expired_row(direction="bullish", exp_low=0.03, price_at_signal=100.0)], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 104.0  # +4% >= 3% → correct
        resolve_signal_outcomes(db)
    hist.update.assert_called_once()
    update_payload = hist.update.call_args.args[0]
    assert update_payload["was_correct"] is True
    assert update_payload["actual_move"] == pytest.approx(0.04, abs=1e-4)


def test_resolve_marks_bullish_incorrect_when_move_below_low():
    db, hist = _make_resolve_db([_expired_row(direction="bullish", exp_low=0.03, price_at_signal=100.0)], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 101.0  # +1% < 3% → incorrect
        resolve_signal_outcomes(db)
    update_payload = hist.update.call_args.args[0]
    assert update_payload["was_correct"] is False


def test_resolve_marks_bearish_correct_when_price_drops():
    db, hist = _make_resolve_db([_expired_row(direction="bearish", exp_low=0.03, price_at_signal=100.0)], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 96.0  # -4% <= -3% → correct
        resolve_signal_outcomes(db)
    update_payload = hist.update.call_args.args[0]
    assert update_payload["was_correct"] is True


def test_resolve_skips_rows_whose_horizon_has_not_passed():
    db, hist = _make_resolve_db([_pending_row()], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        resolve_signal_outcomes(db)
    hist.update.assert_not_called()
    mock_ticker.assert_not_called()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v -k "resolve"
```
Expected: `ImportError: cannot import name 'resolve_signal_outcomes'`

- [ ] **Step 3: Implement `resolve_signal_outcomes` in pipeline.py**

Add after `_record_signal_history` and before `check_and_push_alerts`:

```python
def resolve_signal_outcomes(db: Client) -> None:
    """Resolve actual outcomes for signal_history rows whose horizon has passed."""
    now = datetime.now(timezone.utc)
    lookback = (now - timedelta(days=30)).isoformat()

    rows = (
        db.table("signal_history")
        .select(
            "id, stock_id, direction, confidence, expected_move_low, "
            "expected_move_high, horizon_days, price_at_signal, created_at"
        )
        .is_("actual_move", "null")
        .gte("created_at", lookback)
        .execute()
        .data or []
    )

    expired = [
        r for r in rows
        if datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
        + timedelta(days=r["horizon_days"]) <= now
    ]

    if not expired:
        logger.info("[pipeline] Resolution: 0 expired signals to resolve")
        return

    stocks = db.table("stocks").select("id, ticker").execute().data or []
    stock_ticker = {s["id"]: s["ticker"] for s in stocks}

    resolved = 0
    for row in expired:
        try:
            ticker = stock_ticker.get(row["stock_id"])
            if not ticker or row.get("price_at_signal") is None:
                continue

            current_price = yf.Ticker(ticker).fast_info.last_price
            if current_price is None:
                continue

            actual_move = (current_price - row["price_at_signal"]) / row["price_at_signal"]
            exp_low = row["expected_move_low"]

            if row["direction"] == "bullish":
                was_correct = actual_move >= exp_low
            else:  # bearish or crash_risk
                was_correct = actual_move <= -exp_low

            sign = "+" if actual_move >= 0 else ""
            accuracy_notes = (
                f"moved {sign}{actual_move * 100:.1f}%, "
                f"expected +{exp_low * 100:.0f}%\u2013{row['expected_move_high'] * 100:.0f}%"
            )

            db.table("signal_history").update({
                "actual_move":    round(actual_move, 6),
                "was_correct":    was_correct,
                "accuracy_notes": accuracy_notes,
            }).eq("id", row["id"]).execute()

            resolved += 1
        except Exception as exc:
            logger.error(
                "[pipeline] Resolution failed for history row %s: %s",
                row.get("id"), exc,
            )

    logger.info("[pipeline] Resolved %d signal outcomes", resolved)
```

- [ ] **Step 4: Wire `resolve_signal_outcomes` into `run_pipeline`**

In `run_pipeline`, add Step 5 between `update_prices` and `check_and_push_alerts`:

```python
    # Step 4: Update prices
    update_prices(db)

    # Step 5: Resolve signal outcomes
    try:
        resolve_signal_outcomes(db)
    except Exception as exc:
        logger.error("[pipeline] Outcome resolution failed: %s", exc)

    # Step 6: Push alerts for newly created high-confidence signals
    try:
        check_and_push_alerts(db)
    except Exception as exc:
        logger.error("[pipeline] Alert check failed: %s", exc)
```

- [ ] **Step 5: Run resolution tests**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v
```
Expected: `8 passed`

- [ ] **Step 6: Run full backend suite**

```bash
cd backend && .venv/bin/pytest --tb=short -q
```
Expected: all tests pass (91 + 4 new = 95 passed).

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/pipeline.py backend/tests/test_signal_history.py
git commit -m "feat: add resolve_signal_outcomes pipeline step"
```

---

## Task 5: GET /signals/history/{ticker}

**Files:**
- Modify: `backend/app/routers/signals.py`
- Modify: `backend/tests/test_signal_history.py`

**Context:** Add endpoint above `GET /{signal_id}` (to avoid route conflict). It resolves ticker → stock_id, then queries `signal_history` ordered by `created_at DESC` limit 50. Uses `SignalHistoryEntry` from `app.models.signal`.

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_signal_history.py`:

```python
def test_signal_history_returns_404_for_unknown_ticker(client):
    c, mock_db = client
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
    response = c.get("/signals/history/FAKEXYZ")
    assert response.status_code == 404


def test_signal_history_returns_rows_for_known_ticker(client):
    c, mock_db = client

    stock_mock = MagicMock()
    stock_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "stock-aapl"}
    )

    history_mock = MagicMock()
    from datetime import datetime, timezone
    history_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "hist-1",
            "direction": "bullish",
            "confidence": 0.75,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "horizon_days": 5,
            "price_at_signal": 150.0,
            "actual_move": None,
            "was_correct": None,
            "accuracy_notes": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }]
    )

    def side(t):
        if t == "stocks":
            return stock_mock
        if t == "signal_history":
            return history_mock
        return MagicMock()

    mock_db.table.side_effect = side

    response = c.get("/signals/history/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["direction"] == "bullish"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v -k "signal_history_returns"
```
Expected: 404 Not Found (route doesn't exist yet).

- [ ] **Step 3: Add endpoint to signals.py**

Read `backend/app/routers/signals.py` first. Add this import at the top (after existing imports):

```python
from app.models.signal import SignalResponse, PaginatedSignals, SignalHistoryEntry
```

Add the new endpoint **before** the existing `@router.get("/{signal_id}")` route:

```python
@router.get("/history/{ticker}", response_model=list[SignalHistoryEntry])
def get_signal_history(ticker: str, db: Client = Depends(get_db)):
    stock = (
        db.table("stocks")
        .select("id")
        .eq("ticker", ticker.upper())
        .maybe_single()
        .execute()
    )
    if not stock.data:
        raise HTTPException(status_code=404, detail="Stock not found")

    rows = (
        db.table("signal_history")
        .select(
            "id, direction, confidence, expected_move_low, expected_move_high, "
            "horizon_days, price_at_signal, actual_move, was_correct, accuracy_notes, created_at"
        )
        .eq("stock_id", stock.data["id"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data or []
    )
    return rows
```

- [ ] **Step 4: Run tests**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v
```
Expected: `10 passed`

- [ ] **Step 5: Run full backend suite**

```bash
cd backend && .venv/bin/pytest --tb=short -q
```
Expected: all tests pass (95 + 2 new = 97 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/signals.py backend/tests/test_signal_history.py
git commit -m "feat: add GET /signals/history/{ticker} endpoint"
```

---

## Task 6: GET /analytics/backtesting

**Files:**
- Modify: `backend/app/routers/analytics.py`
- Modify: `backend/tests/test_signal_history.py`

**Context:** `analytics.py` already has a `/accuracy` endpoint with the same DB pattern (fetch all, filter in Python). The new `/backtesting` endpoint adds confidence tier breakdown and avg move stats. Add `from statistics import mean` to analytics.py.

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_signal_history.py`:

```python
def test_backtesting_returns_zeros_when_no_resolved_signals(client):
    c, mock_db = client
    mock_db.table.return_value.select.return_value.neq.return_value.execute.return_value = MagicMock(data=[])
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    data = response.json()
    assert data["total_resolved"] == 0
    assert data["overall_hit_rate"] == 0.0


def test_backtesting_computes_hit_rate_correctly(client):
    c, mock_db = client
    rows = [
        {"direction": "bullish", "confidence": 0.82, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": 0.05, "was_correct": True},
        {"direction": "bullish", "confidence": 0.75, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": 0.01, "was_correct": False},
        {"direction": "bearish", "confidence": 0.65, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": -0.04, "was_correct": True},
    ]
    mock_db.table.return_value.select.return_value.neq.return_value.execute.return_value = MagicMock(data=rows)
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    data = response.json()
    assert data["total_resolved"] == 3
    assert data["overall_hit_rate"] == pytest.approx(2 / 3, abs=0.001)
    assert "bullish" in data["by_direction"]
    assert data["by_direction"]["bullish"]["total"] == 2
    assert "high" in data["by_confidence_tier"]   # confidence 0.82 → high
    assert "medium" in data["by_confidence_tier"]  # 0.75, 0.65 → medium
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v -k "backtesting"
```
Expected: 404 (route doesn't exist yet).

- [ ] **Step 3: Update analytics.py**

Read `backend/app/routers/analytics.py` first. Add `from statistics import mean` at the top imports, then append the new endpoint:

```python
from statistics import mean
```

```python
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
```

- [ ] **Step 4: Run tests**

```bash
cd backend && .venv/bin/pytest tests/test_signal_history.py -v
```
Expected: `12 passed`

- [ ] **Step 5: Run full backend suite**

```bash
cd backend && .venv/bin/pytest --tb=short -q
```
Expected: all tests pass (97 + 2 new = 99 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/analytics.py backend/tests/test_signal_history.py
git commit -m "feat: add GET /analytics/backtesting endpoint"
```

---

## Task 7: Frontend types, API helpers, and proxy routes

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/app/api/signals/history/[ticker]/route.ts`
- Create: `frontend/app/api/analytics/backtesting/route.ts`

**Context:** Read `frontend/lib/types.ts` and `frontend/lib/api.ts` first to understand existing structure before adding.

- [ ] **Step 1: Add types to lib/types.ts**

Read `frontend/lib/types.ts` first. Append at the end:

```typescript
export interface SignalHistoryEntry {
  id: string
  direction: SignalDirection
  confidence: number
  expected_move_low: number
  expected_move_high: number
  horizon_days: number
  price_at_signal: number | null
  actual_move: number | null
  was_correct: boolean | null
  accuracy_notes: string | null
  created_at: string
}

export interface BacktestingStats {
  total_resolved: number
  overall_hit_rate: number
  by_direction: Record<string, { total: number; hit_rate: number }>
  by_confidence_tier: Record<string, { total: number; hit_rate: number }>
  avg_predicted_move: number
  avg_actual_move: number
}
```

- [ ] **Step 2: Add API helpers to lib/api.ts**

Read `frontend/lib/api.ts` first. Add the import for the new types at the top alongside existing imports, then append:

```typescript
import type { SignalHistoryEntry, BacktestingStats } from '@/lib/types'
```

```typescript
export async function getSignalHistory(ticker: string): Promise<SignalHistoryEntry[]> {
  const res = await fetch(
    `${process.env.BACKEND_URL}/signals/history/${ticker}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return []
  return res.json()
}

export async function getBacktestingStats(): Promise<BacktestingStats> {
  const res = await fetch(`${process.env.BACKEND_URL}/analytics/backtesting`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) {
    return {
      total_resolved: 0,
      overall_hit_rate: 0,
      by_direction: {},
      by_confidence_tier: {},
      avg_predicted_move: 0,
      avg_actual_move: 0,
    }
  }
  return res.json()
}
```

- [ ] **Step 3: Create history proxy route**

```typescript
// frontend/app/api/signals/history/[ticker]/route.ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/signals/history/${ticker}`,
      { cache: 'no-store' },
    )
    return Response.json(await res.json(), { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Create backtesting proxy route**

```typescript
// frontend/app/api/analytics/backtesting/route.ts
export async function GET() {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/analytics/backtesting`, {
      next: { revalidate: 300 },
    })
    return Response.json(await res.json(), { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 5: Confirm frontend tests still pass**

```bash
cd frontend && npm test -- --passWithNoTests --watchAll=false
```
Expected: all 57 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/api.ts \
  frontend/app/api/signals/history/[ticker]/route.ts \
  frontend/app/api/analytics/backtesting/route.ts
git commit -m "feat: add signal history types, API helpers, and proxy routes"
```

---

## Task 8: SignalHistory component + stock page integration

**Files:**
- Create: `frontend/components/signals/SignalHistory.tsx`
- Create: `frontend/components/signals/__tests__/SignalHistory.test.tsx`
- Modify: `frontend/app/stock/[ticker]/page.tsx`

**Context:** `SignalHistory` is a `'use client'` component that fetches from `/api/signals/history/[ticker]`. It follows the same fetch-in-useEffect pattern as `PriceChart.tsx`. Renders a table with 10 rows max. The stock detail page is a Server Component — adding a client component to it is fine.

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/components/signals/__tests__/SignalHistory.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import SignalHistory from '../SignalHistory'

const mockEntry = (overrides = {}) => ({
  id: 'hist-1',
  direction: 'bullish',
  confidence: 0.75,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  price_at_signal: 150.0,
  actual_move: null,
  was_correct: null,
  accuracy_notes: null,
  created_at: '2026-03-20T10:00:00Z',
  ...overrides,
})

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  } as Response)
})

afterEach(() => jest.restoreAllMocks())

describe('SignalHistory', () => {
  it('renders empty state when no history', async () => {
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() =>
      expect(screen.getByText('No signal history yet')).toBeInTheDocument()
    )
  })

  it('renders a pending row with Pending label', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockEntry()]),
    } as Response)
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument())
  })

  it('renders a correct resolved row with checkmark', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockEntry({ actual_move: 0.05, was_correct: true })]),
    } as Response)
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() => expect(screen.getByText('✓')).toBeInTheDocument())
  })

  it('renders an incorrect resolved row with cross', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockEntry({ actual_move: 0.01, was_correct: false })]),
    } as Response)
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() => expect(screen.getByText('✗')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- --testPathPattern="signals/__tests__/SignalHistory" --watchAll=false
```
Expected: `Cannot find module '../SignalHistory'`

- [ ] **Step 3: Implement SignalHistory component**

```typescript
// frontend/components/signals/SignalHistory.tsx
'use client'
import { useEffect, useState } from 'react'
import type { SignalHistoryEntry } from '@/lib/types'

export default function SignalHistory({ ticker }: { ticker: string }) {
  const [history, setHistory] = useState<SignalHistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/signals/history/${ticker}`)
      .then((res) => res.json())
      .then((data: SignalHistoryEntry[]) => {
        setHistory(data.slice(0, 10))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [ticker])

  if (!loaded) return null

  function directionLabel(d: string) {
    if (d === 'bullish') return '↑ Bullish'
    if (d === 'bearish') return '↓ Bearish'
    return '⚠ Crash Risk'
  }

  function correctCell(entry: SignalHistoryEntry) {
    if (entry.was_correct === null) return <span className="text-gray-600">Pending</span>
    if (entry.was_correct) return <span className="text-profit">✓</span>
    return <span className="text-loss">✗</span>
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">Signal History</h2>
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-600">
            No signal history yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Direction</th>
                <th className="text-right px-4 py-3 font-medium">Confidence</th>
                <th className="text-right px-4 py-3 font-medium">Predicted</th>
                <th className="text-right px-4 py-3 font-medium">Actual</th>
                <th className="text-right px-4 py-3 font-medium">Correct</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-white/4 last:border-0">
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-3 ${entry.direction === 'bullish' ? 'text-profit' : 'text-loss'}`}>
                    {directionLabel(entry.direction)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    {Math.round(entry.confidence * 100)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">
                    +{(entry.expected_move_low * 100).toFixed(0)}%&ndash;{(entry.expected_move_high * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {entry.actual_move !== null ? (
                      <span className={entry.actual_move >= 0 ? 'text-profit' : 'text-loss'}>
                        {entry.actual_move >= 0 ? '+' : ''}
                        {(entry.actual_move * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{correctCell(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run component tests**

```bash
cd frontend && npm test -- --testPathPattern="signals/__tests__/SignalHistory" --watchAll=false
```
Expected: `4 passed`

- [ ] **Step 5: Add SignalHistory to stock detail page**

Read `frontend/app/stock/[ticker]/page.tsx` first. Add import at the top:

```typescript
import SignalHistory from '@/components/signals/SignalHistory'
```

Add `<SignalHistory ticker={stock.ticker} />` after the Related Articles section, before the closing `</div>` of the `p-6 space-y-6` container:

```tsx
        {/* Signal History */}
        <SignalHistory ticker={stock.ticker} />
```

- [ ] **Step 6: Run full frontend suite**

```bash
cd frontend && npm test -- --passWithNoTests --watchAll=false
```
Expected: all 57 + 4 new = 61 tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/signals/SignalHistory.tsx \
  frontend/components/signals/__tests__/SignalHistory.test.tsx \
  frontend/app/stock/[ticker]/page.tsx
git commit -m "feat: add SignalHistory component and wire into stock detail page"
```

---

## Task 9: BacktestingDashboard, backtesting page, and sidebar link

**Files:**
- Create: `frontend/components/analytics/BacktestingDashboard.tsx`
- Create: `frontend/components/analytics/__tests__/BacktestingDashboard.test.tsx`
- Create: `frontend/app/backtesting/page.tsx`
- Modify: `frontend/components/layout/Sidebar.tsx`

**Context:** `BacktestingDashboard` is a presentational component (no fetch, accepts `stats` prop) so it's easy to test in isolation. `backtesting/page.tsx` is an async Server Component that calls `getBacktestingStats()` and renders `<BacktestingDashboard stats={stats} />`. Sidebar uses a `nav` array — add an entry with `FlaskConical` from lucide-react.

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/components/analytics/__tests__/BacktestingDashboard.test.tsx
import { render, screen } from '@testing-library/react'
import BacktestingDashboard from '../BacktestingDashboard'
import type { BacktestingStats } from '@/lib/types'

const emptyStats: BacktestingStats = {
  total_resolved: 0,
  overall_hit_rate: 0,
  by_direction: {},
  by_confidence_tier: {},
  avg_predicted_move: 0,
  avg_actual_move: 0,
}

const richStats: BacktestingStats = {
  total_resolved: 10,
  overall_hit_rate: 0.7,
  by_direction: {
    bullish: { total: 7, hit_rate: 0.71 },
    bearish: { total: 3, hit_rate: 0.67 },
  },
  by_confidence_tier: {
    high: { total: 4, hit_rate: 0.75 },
    medium: { total: 6, hit_rate: 0.67 },
  },
  avg_predicted_move: 0.05,
  avg_actual_move: 0.043,
}

describe('BacktestingDashboard', () => {
  it('renders empty state when total_resolved is 0', () => {
    render(<BacktestingDashboard stats={emptyStats} />)
    expect(screen.getByText(/No resolved signals yet/i)).toBeInTheDocument()
  })

  it('renders overall hit rate stat card', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText('70.0%')).toBeInTheDocument()
  })

  it('renders total resolved stat card', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders by_direction table rows', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText('bullish')).toBeInTheDocument()
    expect(screen.getByText('bearish')).toBeInTheDocument()
  })

  it('renders by_confidence_tier table rows', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText(/high/i)).toBeInTheDocument()
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm test -- --testPathPattern="analytics/__tests__/BacktestingDashboard" --watchAll=false
```
Expected: `Cannot find module '../BacktestingDashboard'`

- [ ] **Step 3: Implement BacktestingDashboard**

```typescript
// frontend/components/analytics/BacktestingDashboard.tsx
import type { BacktestingStats } from '@/lib/types'

export default function BacktestingDashboard({ stats }: { stats: BacktestingStats }) {
  if (stats.total_resolved === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-600">
        No resolved signals yet — check back after signals have been live for 5+ days
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-xl border border-white/8 p-5">
          <p className="text-xs text-gray-500 mb-1">Overall Hit Rate</p>
          <p className="text-3xl font-mono font-bold text-white">
            {(stats.overall_hit_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-surface-card rounded-xl border border-white/8 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Resolved</p>
          <p className="text-3xl font-mono font-bold text-white">{stats.total_resolved}</p>
        </div>
        <div className="bg-surface-card rounded-xl border border-white/8 p-5">
          <p className="text-xs text-gray-500 mb-1">Avg Actual Move (correct)</p>
          <p className="text-3xl font-mono font-bold text-profit">
            +{(stats.avg_actual_move * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* By Direction */}
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-gray-300">By Direction</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-gray-500">
              <th className="text-left px-5 py-3 font-medium">Direction</th>
              <th className="text-right px-5 py-3 font-medium">Signals</th>
              <th className="text-right px-5 py-3 font-medium">Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.by_direction).map(([dir, data]) => (
              <tr key={dir} className="border-b border-white/4 last:border-0">
                <td className="px-5 py-3 text-gray-300">{dir.replace('_', ' ')}</td>
                <td className="px-5 py-3 text-right font-mono text-gray-400">{data.total}</td>
                <td className="px-5 py-3 text-right font-mono text-white">
                  {(data.hit_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By Confidence Tier */}
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-gray-300">By Confidence Tier</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-gray-500">
              <th className="text-left px-5 py-3 font-medium">Tier</th>
              <th className="text-right px-5 py-3 font-medium">Signals</th>
              <th className="text-right px-5 py-3 font-medium">Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.by_confidence_tier).map(([tier, data]) => (
              <tr key={tier} className="border-b border-white/4 last:border-0">
                <td className="px-5 py-3 text-gray-300 capitalize">
                  {tier}{' '}
                  <span className="text-gray-600 text-xs">
                    {tier === 'high' ? '(≥80%)' : tier === 'medium' ? '(60–80%)' : '(<60%)'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-gray-400">{data.total}</td>
                <td className="px-5 py-3 text-right font-mono text-white">
                  {(data.hit_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run component tests**

```bash
cd frontend && npm test -- --testPathPattern="analytics/__tests__/BacktestingDashboard" --watchAll=false
```
Expected: `5 passed`

- [ ] **Step 5: Create backtesting page**

```typescript
// frontend/app/backtesting/page.tsx
import { getBacktestingStats } from '@/lib/api'
import BacktestingDashboard from '@/components/analytics/BacktestingDashboard'
import TopBar from '@/components/layout/TopBar'

export default async function BacktestingPage() {
  const stats = await getBacktestingStats()
  return (
    <div>
      <TopBar title="Backtesting" subtitle="Signal accuracy tracking" />
      <div className="p-6">
        <BacktestingDashboard stats={stats} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Add Backtesting link to Sidebar**

Read `frontend/components/layout/Sidebar.tsx` first. Change the import line to add `FlaskConical`:

```typescript
import { BarChart3, TrendingUp, Newspaper, LayoutDashboard, FlaskConical } from 'lucide-react'
```

Add to the `nav` array after the Stocks entry:

```typescript
  { href: '/backtesting', label: 'Backtesting', icon: FlaskConical },
```

- [ ] **Step 7: Run full frontend suite**

```bash
cd frontend && npm test -- --passWithNoTests --watchAll=false
```
Expected: 61 + 5 new = 66 tests pass.

- [ ] **Step 8: Run full backend suite**

```bash
cd backend && .venv/bin/pytest --tb=short -q
```
Expected: 99 tests pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/analytics/BacktestingDashboard.tsx \
  frontend/components/analytics/__tests__/BacktestingDashboard.test.tsx \
  frontend/app/backtesting/page.tsx \
  frontend/components/layout/Sidebar.tsx
git commit -m "feat: add backtesting page and sidebar link"
```
