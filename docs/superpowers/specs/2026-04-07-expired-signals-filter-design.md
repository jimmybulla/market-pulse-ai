# Expired Signals Filter — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Problem

Signals have an `expires_at` timestamp (set to 7 days after creation by the pipeline), but the API returns them regardless of whether they have expired. Stale signals appear on the dashboard and stock detail page.

## Solution

Filter expired signals at the API layer. No DB migration required — `expires_at` already exists on every signal row.

- **Dashboard (`list_signals`):** Exclude expired signals entirely using a PostgREST `.gte("expires_at", now)` filter on both the data query and count query.
- **Stock detail page (`get_stock`):** Return the signal (even if expired) but inject `is_expired: true` so the frontend can show a "signal outdated" message.
- **Single signal fetch (`get_signal`):** Compute `is_expired` via the shared `_enrich()` helper.

---

## Section 1 — Model Change

File: `backend/app/models/signal.py`

Add `is_expired: bool = False` to `SignalResponse`. Defaults to `False` so existing serialisation is unaffected when `expires_at` is null.

---

## Section 2 — `_enrich()` helper

File: `backend/app/routers/signals.py`

Add `is_expired` computation at the end of `_enrich()`:

```python
expires_at_raw = row.get("expires_at")
if expires_at_raw:
    expires_dt = datetime.fromisoformat(str(expires_at_raw).replace("Z", "+00:00"))
    row["is_expired"] = expires_dt < datetime.now(timezone.utc)
else:
    row["is_expired"] = False
```

This covers both `list_signals` and `get_signal` automatically.

---

## Section 3 — `list_signals` endpoint

File: `backend/app/routers/signals.py`

Add `.gte("expires_at", now_iso)` to the data query and count query before applying direction/horizon filters:

```python
now_iso = datetime.now(timezone.utc).isoformat()
query = db.table("signals").select(...).order("rank").gte("expires_at", now_iso)
count_query = db.table("signals").select("id", count="exact").gte("expires_at", now_iso)
```

---

## Section 4 — `get_stock` endpoint

File: `backend/app/routers/stocks.py`

After fetching `latest_signal`, inject `is_expired`:

```python
if signal_result.data:
    sig = signal_result.data[0]
    expires_at_raw = sig.get("expires_at")
    if expires_at_raw:
        expires_dt = datetime.fromisoformat(str(expires_at_raw).replace("Z", "+00:00"))
        sig["is_expired"] = expires_dt < datetime.now(timezone.utc)
    else:
        sig["is_expired"] = False
    latest_signal = sig
else:
    latest_signal = None
```

---

## Files Changed

| File | Action |
|------|--------|
| `backend/app/models/signal.py` | Add `is_expired: bool = False` to `SignalResponse` |
| `backend/app/routers/signals.py` | `_enrich` computes `is_expired`; `list_signals` filters expired via `.gte` |
| `backend/app/routers/stocks.py` | `get_stock` injects `is_expired` into `latest_signal` dict |
| `backend/tests/test_signals.py` | Tests: expired signals excluded from list; `is_expired` flag on single fetch |
| `backend/tests/test_stocks.py` | Test: `is_expired` correctly set on `latest_signal` |

No frontend changes. No DB migration.
