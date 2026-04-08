# Signal Lifecycle — Design Spec

**Date:** 2026-04-08
**Status:** Approved

## Problem

The dashboard currently shows all signals regardless of whether they're still actionable, and there's no way to remove a signal or review how past signals performed. The UX is noisy and lacks closure.

## Solution

Three changes in one cohesive feature:

1. **Soft delete** — any signal (active or resolved) can be deleted via a trash button. Deleted signals are hidden everywhere.
2. **Resolved signals archive** — once a signal's horizon passes and its outcome is resolved, it moves to a "Past Signals" section at the bottom of the dashboard showing entry price, outcome price, direction, and a Claude-generated verdict.
3. **Verdict generation** — after the pipeline resolves signal outcomes, Claude writes a 2-3 sentence verdict for each newly resolved signal. Failures get a detailed explanation of what drove the miss.

No new tables. All changes live on the `signals` table.

---

## Section 1 — Database migration

File: `backend/migrations/006_signal_lifecycle.sql`

```sql
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_move       NUMERIC,
  ADD COLUMN IF NOT EXISTS was_correct       BOOLEAN,
  ADD COLUMN IF NOT EXISTS resolved_verdict  TEXT;
```

`price_at_signal` already exists on the `signals` table in the Pydantic model but is not populated. The pipeline will begin writing it on first insert (see Section 2).

---

## Section 2 — Pipeline changes

File: `backend/app/services/pipeline.py`

### 2a. Capture `price_at_signal` on first insert

In `generate_signals()`, when inserting a new signal (not updating), include `price_at_signal: stock["last_price"]`. On update, do not overwrite — entry price must reflect when the signal was first created.

Current code already distinguishes insert vs update:
```python
if existing:
    db.table("signals").update(signal_data).eq(...)  # don't add price_at_signal here
else:
    signal_data["price_at_signal"] = stock.get("last_price")
    signal_data["created_at"] = now.isoformat()
    insert_result = db.table("signals").insert(signal_data).execute()
```

### 2b. Copy resolution data from signal_history back to signals

After `resolve_signal_outcomes(db)` runs, add a new function `sync_resolved_signals(db)` that:

1. Finds `signal_history` rows where `was_correct IS NOT NULL` and `actual_move IS NOT NULL` (recently resolved)
2. Joins to `signals` via `signal_id` (already stored on `signal_history`)
3. For each matching signal where `signals.was_correct IS NULL`: copies `actual_move` and `was_correct` back to the signals row

```python
def sync_resolved_signals(db: Client) -> None:
    rows = (
        db.table("signal_history")
        .select("signal_id, actual_move, was_correct")
        .not_.is_("was_correct", "null")
        .not_.is_("signal_id", "null")
        .execute()
        .data or []
    )
    for row in rows:
        db.table("signals").update({
            "actual_move": row["actual_move"],
            "was_correct": row["was_correct"],
        }).eq("id", row["signal_id"]).is_("was_correct", "null").execute()
    logger.info("[pipeline] Synced %d resolved signal outcomes", len(rows))
```

### 2c. Verdict generation

Add `generate_verdicts(db)` after `sync_resolved_signals`. Finds signals where `was_correct IS NOT NULL` and `resolved_verdict IS NULL` and `deleted_at IS NULL`. For each, calls Claude to produce a verdict.

Verdict prompt:
- **Success:** 2 sentences, plain English, reference the drivers/move
- **Failure:** 3-4 sentences, explain what actually happened vs. the prediction — macro shift, news reversal, sector rotation, etc. Use `accuracy_notes` and `drivers` as inputs.

```python
def generate_verdicts(db: Client) -> None:
    rows = (
        db.table("signals")
        .select("id, ticker, direction, confidence, expected_move_low, expected_move_high, actual_move, was_correct, drivers, accuracy_notes")
        .not_.is_("was_correct", "null")
        .is_("resolved_verdict", "null")
        .is_("deleted_at", "null")
        .execute()
        .data or []
    )
    for row in rows:
        verdict = generate_verdict(row)
        if verdict:
            db.table("signals").update({"resolved_verdict": verdict}).eq("id", row["id"]).execute()
    logger.info("[pipeline] Generated %d signal verdicts", len(rows))
```

File: `backend/app/services/explainer.py`

Add `generate_verdict(signal: dict) -> Optional[str]`:

```python
def generate_verdict(signal: dict) -> Optional[str]:
    if not settings.anthropic_api_key:
        return None
    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        ticker = signal["ticker"]
        direction = signal["direction"].replace("_", " ")
        actual_pct = f"{signal['actual_move'] * 100:.1f}%" if signal.get("actual_move") is not None else "unknown"
        exp_low = signal.get("expected_move_low", 0) * 100
        exp_high = signal.get("expected_move_high", 0) * 100
        was_correct = signal.get("was_correct")
        drivers = signal.get("drivers") or []
        accuracy_notes = signal.get("accuracy_notes") or ""

        if was_correct:
            prompt = (
                f"Stock: {ticker}\n"
                f"Signal: {direction} (expected +{exp_low:.0f}%–{exp_high:.0f}%)\n"
                f"Actual move: {actual_pct}\n"
                f"Key drivers: {', '.join(drivers) if drivers else 'none'}\n\n"
                f"Write 2 sentences explaining why this signal worked. "
                f"Reference the actual move and the drivers. Plain prose, no bullet points."
            )
        else:
            prompt = (
                f"Stock: {ticker}\n"
                f"Signal: {direction} (expected +{exp_low:.0f}%–{exp_high:.0f}%)\n"
                f"Actual move: {actual_pct}\n"
                f"Key drivers at signal time: {', '.join(drivers) if drivers else 'none'}\n"
                f"Notes: {accuracy_notes}\n\n"
                f"Write 3-4 sentences explaining why this signal failed. "
                f"Be specific — what actually happened? What overrode the bullish/bearish thesis? "
                f"Consider macro shifts, news reversals, sector rotation, earnings surprise. "
                f"Plain prose, no bullet points."
            )

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as exc:
        logger.warning("[explainer] Failed to generate verdict for %s: %s", signal.get("ticker"), exc)
        return None
```

### 2d. Wire into `run_pipeline()`

After `resolve_signal_outcomes(db)`:
```python
try:
    sync_resolved_signals(db)
except Exception as exc:
    logger.error("[pipeline] sync_resolved_signals failed: %s", exc)

try:
    generate_verdicts(db)
except Exception as exc:
    logger.error("[pipeline] generate_verdicts failed: %s", exc)
```

---

## Section 3 — Backend endpoints

File: `backend/app/routers/signals.py`

### 3a. DELETE /signals/{id}

```python
@router.delete("/{signal_id}", status_code=204)
def delete_signal(signal_id: str, db: Client = Depends(get_db)):
    result = db.table("signals").select("id").eq("id", signal_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")
    db.table("signals").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", signal_id).execute()
```

### 3b. Update existing queries to exclude deleted signals

`list_signals` and `get_signal` must add `.is_("deleted_at", "null")` to all queries.

File: `backend/app/routers/analytics.py`

### 3c. GET /analytics/resolved-signals

Returns signals where `expires_at < now`, `was_correct IS NOT NULL`, `deleted_at IS NULL`, ordered by `expires_at DESC`, limit 50.

**Response shape:**
```json
[
  {
    "id": "...",
    "ticker": "AAPL",
    "stock_name": "Apple Inc.",
    "direction": "bullish",
    "confidence": 0.72,
    "price_at_signal": 185.50,
    "actual_move": 0.042,
    "was_correct": true,
    "expires_at": "2026-04-05T...",
    "resolved_verdict": "Apple hit the target...",
    "expected_move_low": 0.03,
    "expected_move_high": 0.07
  }
]
```

New Pydantic model `ResolvedSignalEntry` in `backend/app/models/signal.py`.

---

## Section 4 — Frontend

### 4a. Types

File: `frontend/lib/types.ts`

Add to `SignalResponse`:
```typescript
deleted_at: string | null
actual_move: number | null
was_correct: boolean | null
```

Add new interface:
```typescript
export interface ResolvedSignalEntry {
  id: string
  ticker: string
  stock_name: string
  direction: SignalDirection
  confidence: number
  price_at_signal: number | null
  actual_move: number | null
  was_correct: boolean
  expires_at: string
  resolved_verdict: string | null
  expected_move_low: number
  expected_move_high: number
}
```

### 4b. API function

File: `frontend/lib/api.ts`

```typescript
export async function getResolvedSignals(): Promise<ResolvedSignalEntry[]> {
  try {
    const res = await fetch(`${BACKEND}/analytics/resolved-signals`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
```

### 4c. Delete API function

```typescript
export async function deleteSignal(id: string): Promise<void> {
  await fetch(`${BACKEND}/signals/${id}`, { method: 'DELETE' })
}
```

### 4d. ResolvedSignalRow component

File: `frontend/components/signals/ResolvedSignalRow.tsx`

Client component. Props: `entry: ResolvedSignalEntry, onDelete: (id: string) => void`

Each row shows:
- Ticker + direction badge (green/red)
- Entry price → outcome price (computed as `price_at_signal * (1 + actual_move)`) with % move
- ✓ or ✗ correctness indicator
- Verdict text (collapsed by default, click to expand)
- Trash icon button — on click, calls `deleteSignal(id)` then `onDelete(id)` to remove from local state

### 4e. PastSignals component

File: `frontend/components/signals/PastSignals.tsx`

Client component. Props: `initialData: ResolvedSignalEntry[]`

Holds resolved signals in local state (initialised from `initialData`). Renders a list of `ResolvedSignalRow`. When `onDelete` fires, filters the entry out of state immediately (optimistic).

### 4f. Active signal delete button

File: `frontend/components/signals/SignalTrackerRow.tsx`

Add a trash icon to the existing row. On click, calls `deleteSignal(id)` — triggers a router refresh to remove the row from the server-rendered list.

### 4g. Dashboard wiring

File: `frontend/app/page.tsx`

- Add `getResolvedSignals()` to `Promise.all`
- Add "Past Signals" section below Breaking News:

```tsx
<section>
  <div className="flex items-center gap-2 mb-3">
    <CheckCircle className="w-4 h-4 text-gray-500" />
    <h2 className="text-sm font-semibold text-gray-300">Past Signals</h2>
    <span className="text-xs text-gray-600">({resolved.length})</span>
  </div>
  <PastSignals initialData={resolved} />
</section>
```

---

## Files Changed

| File | Action |
|------|--------|
| `backend/migrations/006_signal_lifecycle.sql` | Add `deleted_at`, `actual_move`, `was_correct`, `resolved_verdict` to signals |
| `backend/app/services/explainer.py` | Add `generate_verdict()` |
| `backend/app/services/pipeline.py` | Add `sync_resolved_signals()`, `generate_verdicts()`, populate `price_at_signal` on insert, wire both into `run_pipeline()` |
| `backend/app/models/signal.py` | Add `deleted_at`, `actual_move`, `was_correct`, `resolved_verdict` to `SignalResponse`; add `ResolvedSignalEntry` |
| `backend/app/routers/signals.py` | Add `DELETE /signals/{id}`; filter `deleted_at IS NULL` in list/get queries |
| `backend/app/routers/analytics.py` | Add `GET /analytics/resolved-signals` |
| `backend/tests/test_signals.py` | Tests for delete endpoint + deleted_at filter |
| `backend/tests/test_pipeline.py` | Tests for `sync_resolved_signals`, `generate_verdicts`, `price_at_signal` on insert |
| `backend/tests/test_analytics.py` | Tests for resolved-signals endpoint |
| `frontend/lib/types.ts` | Add fields to `SignalResponse`, add `ResolvedSignalEntry` |
| `frontend/lib/api.ts` | Add `getResolvedSignals()`, `deleteSignal()` |
| `frontend/components/signals/ResolvedSignalRow.tsx` | New component |
| `frontend/components/signals/PastSignals.tsx` | New component |
| `frontend/components/signals/SignalTrackerRow.tsx` | Add delete button |
| `frontend/app/page.tsx` | Fetch resolved signals, render Past Signals section |

No new dependencies.
