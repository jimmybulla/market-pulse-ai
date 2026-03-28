# Signal History & Backtesting — Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Goal

Record a history of signal changes over time, resolve outcomes after the prediction horizon passes, and expose per-stock history and aggregate accuracy metrics in both the backend API and frontend UI.

---

## Approach

**Snapshot on change:** Insert a `signal_history` row only when the signal direction changes or confidence shifts by ≥5% from the most recent snapshot. This produces meaningful, readable history rather than near-duplicate rows every 30 minutes.

**Outcome resolution in pipeline:** A new pipeline step runs every 30 minutes and resolves unresolved `signal_history` rows whose horizon has passed, using yfinance to fetch the current price.

---

## Data Layer

### Schema Change

Add `price_at_signal` to the existing `signal_history` table:

```sql
ALTER TABLE signal_history ADD COLUMN price_at_signal FLOAT;
```

This field is required so outcome resolution can compute `actual_move` without a second yfinance historical lookup.

No other schema changes needed. The existing `signal_history` table already has all required fields:
- `id`, `signal_id`, `stock_id`, `direction`, `confidence`
- `expected_move_low`, `expected_move_high`, `horizon_days`
- `created_at`, `actual_move`, `was_correct`, `accuracy_notes`

### Recording Logic

Inside `generate_signals`, after the signal upsert, for each stock with a valid signal:

1. Fetch the most recent `signal_history` row for this `stock_id`
2. **Insert a new snapshot if any of the following are true:**
   - No prior history row exists
   - `direction` differs from the last snapshot
   - `|new_confidence - last_confidence| >= 0.05`
3. Include `price_at_signal` from `stocks.last_price` (already fetched by the pipeline)

### Outcome Resolution

New function: `resolve_signal_outcomes(db: Client)` — called as **Step 5** in `run_pipeline` (before `check_and_push_alerts`).

**Algorithm:**
1. Query `signal_history` rows where `actual_move IS NULL` AND `created_at + horizon_days * INTERVAL '1 day' <= NOW()`
2. Build `stock_id → ticker` map from `stocks` table
3. For each unresolved row:
   - Fetch current price via `yf.Ticker(ticker).fast_info.last_price`
   - Compute `actual_move = (current_price - price_at_signal) / price_at_signal`
   - Determine correctness:
     - `bullish`: `was_correct = actual_move >= expected_move_low`
     - `bearish` / `crash_risk`: `was_correct = actual_move <= -expected_move_low`
   - Write `accuracy_notes`: e.g. `"moved +2.3%, expected +3–7%"`
4. Update row with `actual_move`, `was_correct`, `accuracy_notes`
5. Log count of resolved signals

**Error handling:** Each resolution is wrapped in its own try/except so one failure doesn't abort the rest.

---

## Backend API

### `GET /signals/history/{ticker}`
Added to `backend/app/routers/signals.py`.

- Looks up stock by ticker; returns 404 if not found
- Queries `signal_history` for that `stock_id`, ordered by `created_at DESC`, limit 50
- Returns list of `SignalHistoryEntry`:

```python
class SignalHistoryEntry(BaseModel):
    id: str
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    horizon_days: int
    price_at_signal: Optional[float]
    actual_move: Optional[float]
    was_correct: Optional[bool]
    accuracy_notes: Optional[str]
    created_at: datetime
```

### `GET /analytics/backtesting`
Added to `backend/app/routers/analytics.py`.

Queries all resolved `signal_history` rows (`was_correct IS NOT NULL`).

Returns `BacktestingStats`:

```python
class BacktestingStats(BaseModel):
    total_resolved: int
    overall_hit_rate: float            # % was_correct
    by_direction: dict[str, dict]      # { "bullish": { "total": N, "hit_rate": 0.65 }, ... }
    by_confidence_tier: dict[str, dict] # { "high": ..., "medium": ..., "low": ... }
    avg_predicted_move: float          # mean of (expected_move_low + expected_move_high) / 2
    avg_actual_move: float             # mean of abs(actual_move) on correct signals only
```

Confidence tiers:
- `high`: confidence ≥ 0.8
- `medium`: 0.6 ≤ confidence < 0.8
- `low`: confidence < 0.6

Returns empty/zero stats (not 404) when no resolved signals exist yet.

---

## Frontend

### New Proxy Routes

- `GET /api/signals/history/[ticker]/route.ts` — proxies to `GET /signals/history/{ticker}`
- `GET /api/analytics/backtesting/route.ts` — proxies to `GET /analytics/backtesting`

### Stock Detail Page — Signal History Section

New component: `frontend/components/signals/SignalHistory.tsx`

- Fetches `/api/signals/history/[ticker]`
- Renders a table with columns: Date | Direction | Confidence | Predicted | Actual | Correct
- `was_correct = null` rows show "Pending" in the Correct column (muted style)
- `was_correct = true` → ✓ (green), `false` → ✗ (red)
- Shows 10 rows by default
- Empty state: "No signal history yet"

Rendered in `frontend/app/stock/[ticker]/page.tsx` below `SignalExpanded`.

### Backtesting Page

New page: `frontend/app/backtesting/page.tsx`

- Fetches `/api/analytics/backtesting`
- **3 stat cards:** Overall Hit Rate | Total Resolved Signals | Avg Actual Move (correct calls)
- **By Direction table:** Direction | Signals | Hit Rate
- **By Confidence Tier table:** Tier | Signals | Hit Rate
- **Empty state:** "No resolved signals yet — check back after signals have been live for 5+ days"

### Sidebar

Add "Backtesting" link to `frontend/components/layout/Sidebar.tsx`, pointing to `/backtesting`.

---

## Pipeline Integration

Updated `run_pipeline` step order:

```
Step 1: ingest_news
Step 2: extract_features_for_articles
Step 3: generate_signals  ← also records signal_history snapshots (on change)
Step 4: update_prices
Step 5: resolve_signal_outcomes  ← NEW
Step 6: check_and_push_alerts
```

---

## Testing

### Backend

- `test_signal_history.py`:
  - `generate_signals` inserts a history row on first signal
  - `generate_signals` inserts on direction change
  - `generate_signals` inserts on confidence shift ≥5%
  - `generate_signals` skips when direction and confidence unchanged
  - `resolve_signal_outcomes` marks bullish signal correct when move ≥ expected_move_low
  - `resolve_signal_outcomes` marks bearish/crash_risk correct when move ≤ -expected_move_low
  - `resolve_signal_outcomes` skips signals whose horizon has not yet passed
  - `GET /signals/history/{ticker}` returns 404 for unknown ticker
  - `GET /signals/history/{ticker}` returns history ordered by created_at DESC
  - `GET /analytics/backtesting` returns zero stats when no resolved signals
  - `GET /analytics/backtesting` computes hit rates correctly

### Frontend

- `SignalHistory.test.tsx`:
  - Renders pending rows with "Pending" label
  - Renders resolved correct row with ✓
  - Renders resolved incorrect row with ✗
  - Shows empty state when history is empty
- `BacktestingPage.test.tsx`:
  - Renders stat cards with correct values
  - Shows empty state when total_resolved is 0

---

## Out of Scope

- Retroactive backtesting against historical price data (would require a separate price history store)
- Confidence calibration curves / Brier score charts (V2)
- Signal performance attribution by news source or event type (V2)
- Replacing `historical_analog` placeholders with live data (deferred — needs sufficient resolved history first)
