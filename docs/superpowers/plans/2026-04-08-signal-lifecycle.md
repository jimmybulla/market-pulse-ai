# Signal Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add soft-delete to all signals, surface resolved signals with Claude-generated verdicts in a "Past Signals" section at the bottom of the dashboard.

**Architecture:** Four columns added to `signals` table (`deleted_at`, `actual_move`, `was_correct`, `resolved_verdict`). Pipeline gains two new steps: `sync_resolved_signals` (copies resolution data from `signal_history` back to `signals`) and `generate_verdicts` (calls Claude for each newly resolved signal). A DELETE endpoint soft-deletes. A new `/analytics/resolved-signals` endpoint serves past signals. Dashboard adds a `PastSignals` client component below Breaking News; active signal rows grow a hover-reveal trash button wired to a Server Action.

**Tech Stack:** FastAPI, Supabase (PostgREST), Python `anthropic` SDK, Next.js 15 App Router (Server Actions), TypeScript, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `backend/migrations/006_signal_lifecycle.sql` | Create — add 5 columns to signals |
| `backend/app/models/signal.py` | Modify — update SignalResponse, add ResolvedSignalEntry |
| `backend/app/services/explainer.py` | Modify — add generate_verdict() |
| `backend/app/services/pipeline.py` | Modify — price_at_signal on insert, sync_resolved_signals, generate_verdicts, run_pipeline wiring |
| `backend/app/routers/signals.py` | Modify — filter deleted_at, add DELETE endpoint |
| `backend/app/routers/analytics.py` | Modify — add GET /analytics/resolved-signals |
| `backend/tests/conftest.py` | Modify — update mock chains for deleted_at filter |
| `backend/tests/test_signals.py` | Modify — update mock chains, add delete tests |
| `backend/tests/test_pipeline.py` | Modify — add sync/verdict tests, price_at_signal test |
| `backend/tests/test_analytics.py` | Modify — add resolved-signals tests |
| `frontend/lib/types.ts` | Modify — update SignalResponse, add ResolvedSignalEntry |
| `frontend/lib/api.ts` | Modify — add getResolvedSignals() |
| `frontend/app/actions.ts` | Create — deleteSignalAction server action |
| `frontend/components/signals/ResolvedSignalRow.tsx` | Create — single resolved signal row |
| `frontend/components/signals/PastSignals.tsx` | Create — client component wrapping resolved rows |
| `frontend/components/signals/SignalTrackerRow.tsx` | Modify — add hover-reveal delete button |
| `frontend/app/page.tsx` | Modify — fetch + render PastSignals section |

---

## Task 1: DB Migration

**Files:**
- Create: `backend/migrations/006_signal_lifecycle.sql`

> Run this migration manually in Supabase SQL editor before deploying the backend changes.

- [ ] **Step 1: Write the migration file**

```sql
-- backend/migrations/006_signal_lifecycle.sql
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_move      NUMERIC,
  ADD COLUMN IF NOT EXISTS was_correct      BOOLEAN,
  ADD COLUMN IF NOT EXISTS resolved_verdict TEXT,
  ADD COLUMN IF NOT EXISTS accuracy_notes   TEXT;
```

Note: `price_at_signal` already exists in the Pydantic model — if it does not exist in your Supabase table yet, add it too:
```sql
ALTER TABLE signals ADD COLUMN IF NOT EXISTS price_at_signal NUMERIC;
```

- [ ] **Step 2: Commit the migration file**

```bash
git add backend/migrations/006_signal_lifecycle.sql
git commit -m "migration: add deleted_at, actual_move, was_correct, resolved_verdict, accuracy_notes to signals"
```

---

## Task 2: Backend Models

**Files:**
- Modify: `backend/app/models/signal.py`

- [ ] **Step 1: Write failing tests**

In `backend/tests/test_signals.py`, add after the existing `MOCK_SIGNAL_ROW_ACTIVE` block:

```python
def test_signal_response_includes_lifecycle_fields(client):
    """SignalResponse must include deleted_at, actual_move, was_correct, resolved_verdict."""
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW_ACTIVE)
    row["deleted_at"] = None
    row["actual_move"] = 0.042
    row["was_correct"] = True
    row["resolved_verdict"] = "Apple hit its target."
    mock_exec = MagicMock()
    mock_exec.data = row
    mock_db.table.return_value.select.return_value.eq.return_value.is_.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/sig-uuid-2")
    assert response.status_code == 200
    body = response.json()
    assert body["actual_move"] == 0.042
    assert body["was_correct"] is True
    assert body["resolved_verdict"] == "Apple hit its target."
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/test_signals.py::test_signal_response_includes_lifecycle_fields -v
```

Expected: FAIL — `actual_move` not in response / field validation error

- [ ] **Step 3: Update SignalResponse and add ResolvedSignalEntry**

Replace the contents of `backend/app/models/signal.py` with:

```python
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class SignalResponse(BaseModel):
    id: str
    stock_id: Optional[str] = None
    ticker: str
    stock_name: str
    sector: Optional[str] = None
    last_price: Optional[float] = None
    price_at_signal: Optional[float] = None
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    horizon_days: int
    opportunity_score: float
    crash_risk_score: float
    rank: int
    explanation: Optional[str] = None
    drivers: list[str] = []
    evidence: Optional[dict[str, Any]] = None
    historical_analog: Optional[dict[str, Any]] = None
    risk_flags: list[str] = []
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_expired: bool = False
    deleted_at: Optional[datetime] = None
    actual_move: Optional[float] = None
    was_correct: Optional[bool] = None
    resolved_verdict: Optional[str] = None


class PaginatedSignals(BaseModel):
    data: list[SignalResponse]
    total: int
    limit: int
    offset: int


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


class ResolvedSignalEntry(BaseModel):
    id: str
    ticker: str
    stock_name: str
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    price_at_signal: Optional[float] = None
    actual_move: Optional[float] = None
    was_correct: bool
    expires_at: datetime
    resolved_verdict: Optional[str] = None
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python3 -m pytest tests/test_signals.py -v --tb=short
```

Expected: existing tests pass (new fields are Optional), new test passes

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/signal.py backend/tests/test_signals.py
git commit -m "feat: add lifecycle fields to SignalResponse, add ResolvedSignalEntry model"
```

---

## Task 3: Pipeline — price_at_signal on insert + sync_resolved_signals

**Files:**
- Modify: `backend/app/services/pipeline.py`
- Modify: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_pipeline.py`, after the existing `generate_signals` tests:

```python
def test_generate_signals_captures_price_at_signal_on_insert():
    """price_at_signal should be written on first insert, not on update."""
    stocks = [{"id": "stock-1", "ticker": "AAPL", "last_price": 195.50}]
    articles = [
        {
            "id": "art-1",
            "headline": "Beat earnings",
            "url": "https://reuters.com/a",
            "published_at": _now_iso(),
            "sentiment_score": 0.8,
            "credibility_score": 0.92,
            "novelty_score": 1.0,
            "severity": 0.8,
            "event_type": "earnings",
        }
    ]
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = stocks
    db.table.return_value.select.return_value.gte.return_value.filter.return_value.execute.return_value.data = articles
    # No existing signal → triggers insert path
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.not_.is_.return_value.execute.return_value.data = []
    db.table.return_value.insert.return_value.execute.return_value.data = [{"id": "new-sig-1"}]

    with patch("app.services.pipeline.score_articles", return_value=_make_signal_result()), \
         patch("app.services.pipeline.generate_explanation", return_value=None), \
         patch("app.services.pipeline.get_momentum", return_value=0.0):
        generate_signals(db)

    insert_call = db.table.return_value.insert.call_args
    assert insert_call is not None
    inserted_data = insert_call[0][0]
    assert inserted_data["price_at_signal"] == 195.50


def test_sync_resolved_signals_copies_data_from_history():
    from app.services.pipeline import sync_resolved_signals
    db = MagicMock()
    db.table.return_value.select.return_value.not_.is_.return_value.not_.is_.return_value.execute.return_value.data = [
        {"signal_id": "sig-1", "actual_move": 0.042, "was_correct": True, "accuracy_notes": "moved +4.2%"},
    ]

    sync_resolved_signals(db)

    update_call = db.table.return_value.update.call_args
    assert update_call is not None
    updated = update_call[0][0]
    assert updated["actual_move"] == 0.042
    assert updated["was_correct"] is True
    assert updated["accuracy_notes"] == "moved +4.2%"


def test_sync_resolved_signals_skips_when_no_history():
    from app.services.pipeline import sync_resolved_signals
    db = MagicMock()
    db.table.return_value.select.return_value.not_.is_.return_value.not_.is_.return_value.execute.return_value.data = []

    sync_resolved_signals(db)

    db.table.return_value.update.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_pipeline.py::test_generate_signals_captures_price_at_signal_on_insert tests/test_pipeline.py::test_sync_resolved_signals_copies_data_from_history tests/test_pipeline.py::test_sync_resolved_signals_skips_when_no_history -v
```

Expected: FAIL — `sync_resolved_signals` not defined, `price_at_signal` not in insert data

- [ ] **Step 3: Implement changes in pipeline.py**

In `generate_signals()`, find the `else` branch of the insert/update block (around line 147) and add `price_at_signal`:

```python
            if existing:
                db.table("signals").update(signal_data).eq("stock_id", stock["id"]).execute()
                signal_id = existing[0]["id"]
            else:
                signal_data["created_at"] = now.isoformat()
                signal_data["price_at_signal"] = stock.get("last_price")
                insert_result = db.table("signals").insert(signal_data).execute()
                signal_id = insert_result.data[0]["id"] if insert_result.data else None
```

Add `sync_resolved_signals` after `_compute_historical_analog` (before `resolve_signal_outcomes`):

```python
def sync_resolved_signals(db: Client) -> None:
    """Copy actual_move, was_correct, accuracy_notes from signal_history back to signals."""
    rows = (
        db.table("signal_history")
        .select("signal_id, actual_move, was_correct, accuracy_notes")
        .not_.is_("was_correct", "null")
        .not_.is_("signal_id", "null")
        .execute()
        .data or []
    )
    synced = 0
    for row in rows:
        db.table("signals").update({
            "actual_move":    row["actual_move"],
            "was_correct":    row["was_correct"],
            "accuracy_notes": row.get("accuracy_notes"),
        }).eq("id", row["signal_id"]).is_("was_correct", "null").execute()
        synced += 1
    logger.info("[pipeline] Synced %d resolved signal outcomes to signals table", synced)
```

Also update `run_pipeline()` — after the `resolve_signal_outcomes` try/except block, add:

```python
    # Step 5b: Copy resolution data back to signals table
    try:
        sync_resolved_signals(db)
    except Exception as exc:
        logger.error("[pipeline] sync_resolved_signals failed: %s", exc)
```

Also update `test_run_pipeline_calls_all_steps` — add `"sync"` to the expected calls list and a `fake_sync` stub. In `backend/tests/test_pipeline.py`, find that test and update:

```python
def test_run_pipeline_calls_all_steps(monkeypatch):
    from app.services import pipeline as pl

    calls = []

    def fake_ingest(db, tickers): calls.append("ingest"); return ["art-1"]
    def fake_extract(db, articles): calls.append("extract")
    def fake_generate(db): calls.append("generate")
    def fake_prices(db): calls.append("prices")
    def fake_price_history(db): calls.append("price_history")
    def fake_resolve(db): calls.append("resolve")
    def fake_sync(db): calls.append("sync")

    monkeypatch.setattr(pl, "ingest_news", fake_ingest)
    monkeypatch.setattr(pl, "extract_features_for_articles", fake_extract)
    monkeypatch.setattr(pl, "generate_signals", fake_generate)
    monkeypatch.setattr(pl, "update_prices", fake_prices)
    monkeypatch.setattr(pl, "update_price_history", fake_price_history)
    monkeypatch.setattr(pl, "resolve_signal_outcomes", fake_resolve)
    monkeypatch.setattr(pl, "sync_resolved_signals", fake_sync)

    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "AAPL"}
    ]
    monkeypatch.setattr(pl, "ingest_newsapi", lambda db, tickers: [])

    pl.run_pipeline(db)

    assert "ingest" in calls
    assert "extract" in calls
    assert "generate" in calls
    assert "prices" in calls
    assert "price_history" in calls
    assert "resolve" in calls
    assert "sync" in calls
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python3 -m pytest tests/test_pipeline.py -v --tb=short 2>&1 | tail -20
```

Expected: all pipeline tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: capture price_at_signal on signal insert, add sync_resolved_signals pipeline step"
```

---

## Task 4: generate_verdict + generate_verdicts pipeline step

**Files:**
- Modify: `backend/app/services/explainer.py`
- Modify: `backend/app/services/pipeline.py`
- Modify: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_pipeline.py`:

```python
def test_generate_verdicts_calls_claude_for_resolved_signals():
    from app.services.pipeline import generate_verdicts
    db = MagicMock()
    db.table.return_value.select.return_value.not_.is_.return_value.is_.return_value.is_.return_value.execute.return_value.data = [
        {
            "id": "sig-1",
            "ticker": "AAPL",
            "direction": "bullish",
            "confidence": 0.72,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "actual_move": 0.042,
            "was_correct": True,
            "drivers": ["Strong earnings"],
            "accuracy_notes": "moved +4.2%",
        }
    ]

    with patch("app.services.pipeline.generate_verdict", return_value="Apple hit its target.") as mock_verdict:
        generate_verdicts(db)

    mock_verdict.assert_called_once()
    update_call = db.table.return_value.update.call_args
    assert update_call[0][0]["resolved_verdict"] == "Apple hit its target."


def test_generate_verdicts_skips_when_verdict_returns_none():
    from app.services.pipeline import generate_verdicts
    db = MagicMock()
    db.table.return_value.select.return_value.not_.is_.return_value.is_.return_value.is_.return_value.execute.return_value.data = [
        {
            "id": "sig-1",
            "ticker": "AAPL",
            "direction": "bullish",
            "confidence": 0.72,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "actual_move": 0.042,
            "was_correct": True,
            "drivers": [],
            "accuracy_notes": None,
        }
    ]

    with patch("app.services.pipeline.generate_verdict", return_value=None):
        generate_verdicts(db)

    db.table.return_value.update.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_pipeline.py::test_generate_verdicts_calls_claude_for_resolved_signals tests/test_pipeline.py::test_generate_verdicts_skips_when_verdict_returns_none -v
```

Expected: FAIL — `generate_verdicts` not defined

- [ ] **Step 3: Add generate_verdict to explainer.py**

Add after `generate_explanation` in `backend/app/services/explainer.py`:

```python
def generate_verdict(signal: dict) -> Optional[str]:
    """
    Generate a plain-English verdict for a resolved signal.
    Successes: 2 sentences. Failures: 3-4 sentences explaining the miss.
    Returns None if API key is missing or call fails.
    """
    if not settings.anthropic_api_key:
        logger.warning("[explainer] ANTHROPIC_API_KEY not set — skipping verdict for %s", signal.get("ticker"))
        return None
    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        ticker = signal.get("ticker", "")
        direction = signal.get("direction", "").replace("_", " ")
        actual_move = signal.get("actual_move")
        actual_pct = f"{actual_move * 100:.1f}%" if actual_move is not None else "unknown"
        exp_low = (signal.get("expected_move_low") or 0) * 100
        exp_high = (signal.get("expected_move_high") or 0) * 100
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
                f"Reference the actual move and the drivers. Plain prose, no bullet points, no markdown."
            )
        else:
            prompt = (
                f"Stock: {ticker}\n"
                f"Signal: {direction} (expected +{exp_low:.0f}%–{exp_high:.0f}%)\n"
                f"Actual move: {actual_pct}\n"
                f"Key drivers at signal time: {', '.join(drivers) if drivers else 'none'}\n"
                f"Notes: {accuracy_notes}\n\n"
                f"Write 3-4 sentences explaining why this signal failed. "
                f"Be specific — what actually happened? What overrode the {direction} thesis? "
                f"Consider macro shifts, news reversals, sector rotation, earnings surprise, rate changes. "
                f"Plain prose, no bullet points, no markdown."
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

- [ ] **Step 4: Add generate_verdicts to pipeline.py**

At the top of `pipeline.py`, update the import:

```python
from app.services.explainer import generate_explanation, generate_verdict
```

Add `generate_verdicts` function after `sync_resolved_signals`:

```python
def generate_verdicts(db: Client) -> None:
    """For each newly resolved signal without a verdict, call Claude to generate one."""
    rows = (
        db.table("signals")
        .select(
            "id, ticker, direction, confidence, expected_move_low, expected_move_high, "
            "actual_move, was_correct, drivers, accuracy_notes"
        )
        .not_.is_("was_correct", "null")
        .is_("resolved_verdict", "null")
        .is_("deleted_at", "null")
        .execute()
        .data or []
    )
    generated = 0
    for row in rows:
        verdict = generate_verdict(row)
        if verdict:
            db.table("signals").update({"resolved_verdict": verdict}).eq("id", row["id"]).execute()
            generated += 1
    logger.info("[pipeline] Generated %d signal verdicts", generated)
```

Wire into `run_pipeline()` — after the `sync_resolved_signals` block:

```python
    # Step 5c: Generate Claude verdicts for newly resolved signals
    try:
        generate_verdicts(db)
    except Exception as exc:
        logger.error("[pipeline] generate_verdicts failed: %s", exc)
```

- [ ] **Step 5: Run tests**

```bash
cd backend && python3 -m pytest tests/test_pipeline.py -v --tb=short 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/explainer.py backend/app/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: add generate_verdict to explainer, add generate_verdicts pipeline step"
```

---

## Task 5: DELETE endpoint + deleted_at filter on existing queries

**Files:**
- Modify: `backend/app/routers/signals.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_signals.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_signals.py`:

```python
def test_delete_signal_returns_204(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = {"id": "sig-uuid-1"}
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.delete("/signals/sig-uuid-1")
    assert response.status_code == 204


def test_delete_signal_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.delete("/signals/nonexistent")
    assert response.status_code == 404


def test_delete_signal_sets_deleted_at(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = {"id": "sig-uuid-1"}
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    c.delete("/signals/sig-uuid-1")

    update_call = mock_db.table.return_value.update.call_args
    assert "deleted_at" in update_call[0][0]


def test_list_signals_excludes_deleted_signals(client):
    """list_signals must filter out signals where deleted_at IS NOT NULL."""
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW_ACTIVE)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.is_.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.is_.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    # Assert deleted_at filter was applied
    gte_chain = mock_db.table.return_value.select.return_value.order.return_value.gte.return_value
    gte_chain.is_.assert_called()
    call_args = gte_chain.is_.call_args
    assert call_args[0][0] == "deleted_at"
    assert call_args[0][1] == "null"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_signals.py::test_delete_signal_returns_204 tests/test_signals.py::test_delete_signal_returns_404_when_not_found tests/test_signals.py::test_list_signals_excludes_deleted_signals -v
```

Expected: FAIL — DELETE route not found, is_ filter not applied

- [ ] **Step 3: Update conftest.py mock chains**

The `list_signals` query now chains `.gte().is_().range().execute()` instead of `.gte().range().execute()`. Update `backend/tests/conftest.py`:

```python
# backend/tests/conftest.py
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db


@pytest.fixture(autouse=True)
def clear_price_cache():
    """Clear the in-memory price cache between tests to avoid cross-test pollution."""
    from app.routers import charts
    charts._PRICE_CACHE.clear()
    yield
    charts._PRICE_CACHE.clear()


@pytest.fixture(autouse=True)
def no_scheduler(monkeypatch):
    """Prevent APScheduler from starting during tests."""
    from app import scheduler as sched_module
    monkeypatch.setattr("app.main.configure_scheduler", lambda fn: None)
    monkeypatch.setattr(sched_module.scheduler, "start", lambda: None)
    monkeypatch.setattr(sched_module.scheduler, "shutdown", lambda **kwargs: None)


@pytest.fixture
def mock_db():
    db = MagicMock()
    # list_signals: select().order().gte().is_("deleted_at","null").range().execute()
    db.table.return_value.select.return_value.order.return_value.gte.return_value.is_.return_value.range.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.order.return_value.gte.return_value.is_.return_value.range.return_value.execute.return_value.count = 0
    # list_signals count query: select("id",count="exact").gte().is_().execute()
    db.table.return_value.select.return_value.gte.return_value.is_.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.gte.return_value.is_.return_value.execute.return_value.count = 0
    # get_signal: select().eq().is_("deleted_at","null").maybe_single().execute()
    db.table.return_value.select.return_value.eq.return_value.is_.return_value.maybe_single.return_value.execute.return_value.data = None
    # delete check + stocks get_stock: select().eq().maybe_single().execute()
    db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
    # fallback
    db.table.return_value.select.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.execute.return_value.count = 0
    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as c:
        yield c, mock_db
    app.dependency_overrides.clear()
```

- [ ] **Step 4: Update existing test_signals.py mock chains**

The existing `list_signals` tests use the old chain `.gte.range.execute`. Update all of them to the new chain `.gte.is_.range.execute`. Also update `get_signal` tests from `.eq.maybe_single.execute` to `.eq.is_.maybe_single.execute`. Here is the full updated `MOCK_SIGNAL_ROW` block and test list (replace the top of `test_signals.py`):

```python
# backend/tests/test_signals.py
from unittest.mock import MagicMock

MOCK_SIGNAL_ROW = {
    "id": "sig-uuid-1",
    "stock_id": "stock-uuid-1",
    "direction": "bullish",
    "confidence": 0.82,
    "expected_move_low": 0.041,
    "expected_move_high": 0.082,
    "horizon_days": 5,
    "opportunity_score": 0.82,
    "crash_risk_score": 0.0,
    "rank": 1,
    "explanation": "AI analysis pending",
    "drivers": ["Strong earnings sentiment", "Strong product momentum"],
    "evidence": {"article_count": 2, "sources": ["Reuters"], "avg_credibility": 0.92, "article_ids": []},
    "historical_analog": {"avg_move": 0.062, "hit_rate": 0.64, "sample_size": 15},
    "risk_flags": [],
    "created_at": "2026-03-27T10:00:00+00:00",
    "expires_at": "2026-04-01T10:00:00+00:00",
    "stocks": {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "last_price": 875.50},
}

MOCK_SIGNAL_ROW_ACTIVE = {
    **MOCK_SIGNAL_ROW,
    "id": "sig-uuid-2",
    "expires_at": "2099-12-31T00:00:00+00:00",
}


def _list_mock(mock_db, rows, count=None):
    """Helper: set up list_signals mock chains (order.gte.is_.range.execute)."""
    mock_exec = MagicMock()
    mock_exec.data = rows
    mock_exec.count = count if count is not None else len(rows)
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.is_.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.is_.return_value.execute.return_value = mock_exec


def _get_mock(mock_db, row):
    """Helper: set up get_signal mock chain (eq.is_.maybe_single.execute)."""
    mock_exec = MagicMock()
    mock_exec.data = row
    mock_db.table.return_value.select.return_value.eq.return_value.is_.return_value.maybe_single.return_value.execute.return_value = mock_exec


def test_list_signals_returns_200(client):
    c, mock_db = client
    _list_mock(mock_db, [dict(MOCK_SIGNAL_ROW_ACTIVE)], count=1)
    response = c.get("/signals")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["limit"] == 10
    assert body["offset"] == 0


def test_list_signals_enriches_stock_fields(client):
    c, mock_db = client
    _list_mock(mock_db, [dict(MOCK_SIGNAL_ROW_ACTIVE)], count=1)
    response = c.get("/signals")
    assert response.status_code == 200
    item = response.json()["data"][0]
    assert item["ticker"] == "NVDA"
    assert item["stock_name"] == "NVIDIA Corporation"
    assert item["last_price"] == 875.50


def test_get_signal_returns_404_when_not_found(client):
    c, mock_db = client
    _get_mock(mock_db, None)
    response = c.get("/signals/nonexistent-id")
    assert response.status_code == 404


def test_get_signal_returns_200_when_found(client):
    c, mock_db = client
    _get_mock(mock_db, dict(MOCK_SIGNAL_ROW))
    response = c.get("/signals/sig-uuid-1")
    assert response.status_code == 200
    assert response.json()["ticker"] == "NVDA"


def test_list_signals_includes_price_at_signal(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW_ACTIVE)
    row["price_at_signal"] = 875.50
    _list_mock(mock_db, [row], count=1)
    response = c.get("/signals")
    assert response.status_code == 200
    assert response.json()["data"][0]["price_at_signal"] == 875.50


def test_get_signal_sets_is_expired_true_when_past_expires_at(client):
    c, mock_db = client
    _get_mock(mock_db, dict(MOCK_SIGNAL_ROW))
    response = c.get("/signals/sig-uuid-1")
    assert response.status_code == 200
    assert response.json()["is_expired"] is True


def test_get_signal_sets_is_expired_false_when_future_expires_at(client):
    c, mock_db = client
    _get_mock(mock_db, dict(MOCK_SIGNAL_ROW_ACTIVE))
    response = c.get("/signals/sig-uuid-2")
    assert response.status_code == 200
    assert response.json()["is_expired"] is False


def test_list_signals_excludes_expired_signals(client):
    c, mock_db = client
    _list_mock(mock_db, [dict(MOCK_SIGNAL_ROW_ACTIVE)], count=1)
    response = c.get("/signals")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 1
    gte_call = mock_db.table.return_value.select.return_value.order.return_value.gte
    gte_call.assert_called_once()
    assert gte_call.call_args[0][0] == "expires_at"


def test_list_signals_is_expired_false_for_active_signal(client):
    c, mock_db = client
    _list_mock(mock_db, [dict(MOCK_SIGNAL_ROW_ACTIVE)], count=1)
    response = c.get("/signals")
    assert response.status_code == 200
    assert response.json()["data"][0]["is_expired"] is False


def test_signal_response_includes_lifecycle_fields(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW_ACTIVE)
    row["actual_move"] = 0.042
    row["was_correct"] = True
    row["resolved_verdict"] = "Apple hit its target."
    _get_mock(mock_db, row)
    response = c.get("/signals/sig-uuid-2")
    assert response.status_code == 200
    body = response.json()
    assert body["actual_move"] == 0.042
    assert body["was_correct"] is True
    assert body["resolved_verdict"] == "Apple hit its target."


def test_delete_signal_returns_204(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = {"id": "sig-uuid-1"}
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec
    response = c.delete("/signals/sig-uuid-1")
    assert response.status_code == 204


def test_delete_signal_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec
    response = c.delete("/signals/nonexistent")
    assert response.status_code == 404


def test_delete_signal_sets_deleted_at(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = {"id": "sig-uuid-1"}
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec
    c.delete("/signals/sig-uuid-1")
    update_call = mock_db.table.return_value.update.call_args
    assert "deleted_at" in update_call[0][0]


def test_list_signals_excludes_deleted_signals(client):
    c, mock_db = client
    _list_mock(mock_db, [dict(MOCK_SIGNAL_ROW_ACTIVE)], count=1)
    response = c.get("/signals")
    assert response.status_code == 200
    gte_chain = mock_db.table.return_value.select.return_value.order.return_value.gte.return_value
    gte_chain.is_.assert_called()
    call_args = gte_chain.is_.call_args
    assert call_args[0][0] == "deleted_at"
    assert call_args[0][1] == "null"
```

- [ ] **Step 5: Run tests to verify they still fail**

```bash
cd backend && python3 -m pytest tests/test_signals.py -v --tb=short 2>&1 | tail -25
```

Expected: several failures because `signals.py` hasn't been updated yet

- [ ] **Step 6: Update signals.py**

Replace the contents of `backend/app/routers/signals.py` with:

```python
# backend/app/routers/signals.py
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends
from supabase import Client

from app.database import get_db
from app.models.signal import SignalResponse, PaginatedSignals, SignalHistoryEntry

router = APIRouter()


def _enrich(row: dict) -> dict:
    stock = row.pop("stocks", None) or {}
    row["ticker"] = stock.get("ticker", "")
    row["stock_name"] = stock.get("name", "")
    row["sector"] = stock.get("sector")
    row["last_price"] = stock.get("last_price")
    expires_at_raw = row.get("expires_at")
    if expires_at_raw:
        expires_dt = datetime.fromisoformat(str(expires_at_raw).replace("Z", "+00:00"))
        row["is_expired"] = expires_dt < datetime.now(timezone.utc)
    else:
        row["is_expired"] = False
    return row


@router.get("", response_model=PaginatedSignals)
def list_signals(
    direction: Optional[str] = Query(None),
    horizon: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Client = Depends(get_db),
):
    now_iso = datetime.now(timezone.utc).isoformat()
    query = (
        db.table("signals")
        .select("*, stocks(ticker, name, sector, last_price)")
        .order("rank")
        .gte("expires_at", now_iso)
        .is_("deleted_at", "null")
    )
    count_query = (
        db.table("signals")
        .select("id", count="exact")
        .gte("expires_at", now_iso)
        .is_("deleted_at", "null")
    )

    if direction:
        query = query.eq("direction", direction)
        count_query = count_query.eq("direction", direction)
    if horizon:
        query = query.eq("horizon_days", horizon)
        count_query = count_query.eq("horizon_days", horizon)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": [_enrich(row) for row in result.data],
        "total": count_result.count or 0,
        "limit": limit,
        "offset": offset,
    }


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


@router.delete("/{signal_id}", status_code=204)
def delete_signal(signal_id: str, db: Client = Depends(get_db)):
    result = (
        db.table("signals")
        .select("id")
        .eq("id", signal_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")
    db.table("signals").update(
        {"deleted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", signal_id).execute()


@router.get("/{signal_id}", response_model=SignalResponse)
def get_signal(signal_id: str, db: Client = Depends(get_db)):
    result = (
        db.table("signals")
        .select("*, stocks(ticker, name, sector, last_price)")
        .eq("id", signal_id)
        .is_("deleted_at", "null")
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")
    return _enrich(result.data)
```

Note: `DELETE /{signal_id}` must be declared **before** `GET /{signal_id}` to avoid FastAPI routing the DELETE to the GET handler.

- [ ] **Step 7: Run all signal tests**

```bash
cd backend && python3 -m pytest tests/test_signals.py -v --tb=short 2>&1 | tail -25
```

Expected: all pass

- [ ] **Step 8: Run full suite to check for regressions**

```bash
cd backend && python3 -m pytest --tb=short -q 2>&1 | tail -10
```

Expected: 0 failures

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/signals.py backend/tests/conftest.py backend/tests/test_signals.py
git commit -m "feat: add DELETE /signals/{id}, filter deleted_at from list/get queries"
```

---

## Task 6: GET /analytics/resolved-signals

**Files:**
- Modify: `backend/app/routers/analytics.py`
- Modify: `backend/tests/test_analytics.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_analytics.py`:

```python
# ── /analytics/resolved-signals ──────────────────────────────────────

def test_resolved_signals_returns_empty_list_when_none(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.lt.return_value.not_.is_.return_value.is_.return_value.order.return_value.limit.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/resolved-signals")
    assert response.status_code == 200
    assert response.json() == []


def test_resolved_signals_returns_correct_shape(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {
            "id": "sig-1",
            "direction": "bullish",
            "confidence": 0.72,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "price_at_signal": 185.50,
            "actual_move": 0.042,
            "was_correct": True,
            "expires_at": "2026-04-01T00:00:00+00:00",
            "resolved_verdict": "Apple hit its target.",
            "stocks": {"ticker": "AAPL", "name": "Apple Inc."},
        }
    ]
    mock_db.table.return_value.select.return_value.lt.return_value.not_.is_.return_value.is_.return_value.order.return_value.limit.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/resolved-signals")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["ticker"] == "AAPL"
    assert body[0]["stock_name"] == "Apple Inc."
    assert body[0]["was_correct"] is True
    assert body[0]["resolved_verdict"] == "Apple hit its target."


def test_resolved_signals_excludes_active_and_deleted(client):
    """Endpoint filters: expires_at < now, was_correct IS NOT NULL, deleted_at IS NULL."""
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.lt.return_value.not_.is_.return_value.is_.return_value.order.return_value.limit.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/resolved-signals")
    assert response.status_code == 200
    # Verify filter chain was called
    lt_call = mock_db.table.return_value.select.return_value.lt
    lt_call.assert_called_once()
    assert lt_call.call_args[0][0] == "expires_at"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_analytics.py::test_resolved_signals_returns_empty_list_when_none tests/test_analytics.py::test_resolved_signals_returns_correct_shape -v
```

Expected: FAIL — endpoint not found

- [ ] **Step 3: Add endpoint to analytics.py**

Add the following to `backend/app/routers/analytics.py` (at the end of the file, after the sector-heatmap endpoint). First add the import at the top if not present:

```python
from app.models.signal import ResolvedSignalEntry
```

Then add the endpoint:

```python
# ── /resolved-signals ─────────────────────────────────────────────────

@router.get("/resolved-signals", response_model=list[ResolvedSignalEntry])
def get_resolved_signals(db: Client = Depends(get_db)):
    from datetime import timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    rows = (
        db.table("signals")
        .select(
            "id, direction, confidence, expected_move_low, expected_move_high, "
            "price_at_signal, actual_move, was_correct, expires_at, resolved_verdict, "
            "stocks(ticker, name)"
        )
        .lt("expires_at", now_iso)
        .not_.is_("was_correct", "null")
        .is_("deleted_at", "null")
        .order("expires_at", desc=True)
        .limit(50)
        .execute()
        .data or []
    )
    result = []
    for row in rows:
        stock = row.pop("stocks", None) or {}
        row["ticker"] = stock.get("ticker", "")
        row["stock_name"] = stock.get("name", "")
        result.append(row)
    return result
```

- [ ] **Step 4: Run analytics tests**

```bash
cd backend && python3 -m pytest tests/test_analytics.py -v --tb=short 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Run full suite**

```bash
cd backend && python3 -m pytest --tb=short -q 2>&1 | tail -10
```

Expected: 0 failures

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/analytics.py backend/tests/test_analytics.py
git commit -m "feat: add GET /analytics/resolved-signals endpoint"
```

---

## Task 7: Frontend types, API function, Server Action

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/app/actions.ts`

- [ ] **Step 1: Update types.ts**

In `frontend/lib/types.ts`, add the three lifecycle fields to `SignalResponse` (after `is_expired`):

```typescript
  is_expired: boolean
  deleted_at: string | null
  actual_move: number | null
  was_correct: boolean | null
  resolved_verdict: string | null
```

Add the `ResolvedSignalEntry` interface at the end of the file:

```typescript
export interface ResolvedSignalEntry {
  id: string
  ticker: string
  stock_name: string
  direction: SignalDirection
  confidence: number
  expected_move_low: number
  expected_move_high: number
  price_at_signal: number | null
  actual_move: number | null
  was_correct: boolean
  expires_at: string
  resolved_verdict: string | null
}
```

- [ ] **Step 2: Add getResolvedSignals to api.ts**

In `frontend/lib/api.ts`, add the import for `ResolvedSignalEntry` at the top (add to the existing import):

```typescript
import type {
  PaginatedSignals, SignalResponse,
  PaginatedStocks, StockWithSignal,
  PaginatedNews, SignalDirection,
  SignalHistoryEntry, BacktestingStats,
  NewsFeedItem, PerformanceData,
  SectorHeatmapEntry, ResolvedSignalEntry,
} from './types'
```

Add the function at the end of `api.ts`:

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

- [ ] **Step 3: Create frontend/app/actions.ts**

```typescript
'use server'

import { revalidatePath } from 'next/cache'

const rawBackend = process.env.BACKEND_URL || 'http://localhost:8000'
const BACKEND = rawBackend.startsWith('http') ? rawBackend : `https://${rawBackend}`

export async function deleteSignalAction(id: string): Promise<void> {
  try {
    await fetch(`${BACKEND}/signals/${id}`, { method: 'DELETE' })
  } catch {
    // Silent fail — UI handles optimistic removal
  }
  revalidatePath('/')
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors relating to the new types

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/api.ts frontend/app/actions.ts
git commit -m "feat: add ResolvedSignalEntry type, getResolvedSignals API fn, deleteSignalAction server action"
```

---

## Task 8: ResolvedSignalRow + PastSignals components

**Files:**
- Create: `frontend/components/signals/ResolvedSignalRow.tsx`
- Create: `frontend/components/signals/PastSignals.tsx`

- [ ] **Step 1: Create ResolvedSignalRow component**

Create `frontend/components/signals/ResolvedSignalRow.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { directionLabel } from '@/lib/signal-formatting'
import { deleteSignalAction } from '@/app/actions'
import type { ResolvedSignalEntry, SignalDirection } from '@/lib/types'

function directionBadgeClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

interface Props {
  entry: ResolvedSignalEntry
  onDelete: (id: string) => void
}

export default function ResolvedSignalRow({ entry, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const outcomePrice =
    entry.price_at_signal != null && entry.actual_move != null
      ? entry.price_at_signal * (1 + entry.actual_move)
      : null

  const movePct =
    entry.actual_move != null
      ? `${entry.actual_move >= 0 ? '+' : ''}${(entry.actual_move * 100).toFixed(1)}%`
      : '—'

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    onDelete(entry.id)
    await deleteSignalAction(entry.id)
  }

  return (
    <div className="border-b border-white/8 last:border-b-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Correctness indicator */}
        <span className={`text-sm font-bold shrink-0 ${entry.was_correct ? 'text-profit' : 'text-loss'}`}>
          {entry.was_correct ? '✓' : '✗'}
        </span>

        {/* Ticker + direction */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-white">{entry.ticker}</span>
          <Badge className={`text-xs shrink-0 ${directionBadgeClass(entry.direction)}`}>
            {directionLabel(entry.direction)}
          </Badge>
        </div>

        {/* Price journey */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 ml-auto">
          {entry.price_at_signal != null ? (
            <span>${entry.price_at_signal.toFixed(2)}</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
          <span className="text-gray-700">→</span>
          {outcomePrice != null ? (
            <span>${outcomePrice.toFixed(2)}</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
          <span className={`font-semibold ml-1 ${entry.actual_move != null && entry.actual_move >= 0 ? 'text-profit' : 'text-loss'}`}>
            {movePct}
          </span>
        </div>

        {/* Expand + delete */}
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-loss transition-all disabled:opacity-30"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Verdict */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-surface-elevated/50">
          <p className="text-xs text-gray-400 leading-relaxed">
            {entry.resolved_verdict || 'No verdict generated yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PastSignals component**

Create `frontend/components/signals/PastSignals.tsx`:

```tsx
'use client'

import { useState } from 'react'
import ResolvedSignalRow from './ResolvedSignalRow'
import type { ResolvedSignalEntry } from '@/lib/types'

interface Props {
  initialData: ResolvedSignalEntry[]
}

export default function PastSignals({ initialData }: Props) {
  const [entries, setEntries] = useState(initialData)

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-600 bg-surface-card rounded-xl border border-white/8">
        No resolved signals yet
      </div>
    )
  }

  return (
    <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
      {entries.map((entry) => (
        <ResolvedSignalRow key={entry.id} entry={entry} onDelete={handleDelete} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/components/signals/ResolvedSignalRow.tsx frontend/components/signals/PastSignals.tsx
git commit -m "feat: add ResolvedSignalRow and PastSignals components"
```

---

## Task 9: Delete button on SignalTrackerRow + dashboard wiring

**Files:**
- Modify: `frontend/components/signals/SignalTrackerRow.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Add delete button to SignalTrackerRow**

Replace the contents of `frontend/components/signals/SignalTrackerRow.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { directionLabel, calcActualPct, calcProgressPct, calcDaysRemaining } from '@/lib/signal-formatting'
import { Badge } from '@/components/ui/badge'
import { deleteSignalAction } from '@/app/actions'
import type { SignalResponse, SignalDirection } from '@/lib/types'

function directionBadgeClass(direction: SignalDirection): string {
  if (direction === 'bullish') return 'bg-profit/10 text-profit border-profit/20'
  return 'bg-loss/10 text-loss border-loss/20'
}

interface Progress {
  pct: number
  barClass: string
  actualPct: number | null
}

function calcProgress(signal: SignalResponse): Progress {
  const { last_price, price_at_signal, direction, expected_move_low, expected_move_high } = signal
  const actualPct = calcActualPct(last_price, price_at_signal)
  if (actualPct === null) {
    return { pct: 0, barClass: 'bg-surface-elevated', actualPct: null }
  }

  const pct = calcProgressPct(direction, actualPct, expected_move_low, expected_move_high)

  if (direction === 'crash_risk') {
    const barClass = actualPct <= 0 ? 'bg-loss' : 'bg-profit'
    return { pct, barClass, actualPct }
  }

  const barClass = actualPct >= 0 ? 'bg-profit' : 'bg-loss'
  return { pct, barClass, actualPct }
}

interface Props {
  signal: SignalResponse
}

export default function SignalTrackerRow({ signal }: Props) {
  const {
    ticker, stock_name, direction, confidence,
    expected_move_low, expected_move_high, horizon_days,
    rank, created_at,
  } = signal

  const progress = calcProgress(signal)
  const daysLeft = calcDaysRemaining(created_at, horizon_days)
  const expired = daysLeft <= 0

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await deleteSignalAction(signal.id)
  }

  return (
    <div className="group relative">
      <Link href={`/stock/${ticker}`} className="block">
        <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] items-center gap-3 lg:gap-4 px-4 py-3 rounded-lg hover:bg-surface-elevated transition-colors">

          {/* Rank */}
          <span className="text-xs text-gray-600 font-mono text-right">#{rank}</span>

          {/* Ticker + name */}
          <div className="min-w-0">
            <p className="font-mono font-bold text-sm text-white leading-tight">{ticker}</p>
            <p className="text-xs text-gray-500 truncate">{stock_name}</p>
          </div>

          {/* Direction badge */}
          <Badge className={`text-xs shrink-0 ${directionBadgeClass(direction)}`}>
            {directionLabel(direction)}
          </Badge>

          {/* Progress bar + labels */}
          <div className="flex flex-col gap-1 min-w-0">
            <div
              className="w-full bg-surface-elevated rounded-full h-1.5"
              data-testid="signal-progress-track"
            >
              <div
                className={`h-1.5 rounded-full transition-all ${progress.barClass}`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
              {progress.actualPct !== null ? (
                <>
                  <span className={progress.actualPct >= 0 ? 'text-profit' : 'text-loss'}>
                    {progress.actualPct >= 0 ? '+' : ''}{progress.actualPct.toFixed(1)}%
                  </span>
                  {direction !== 'crash_risk' && (
                    <>
                      <span className="text-gray-700">→</span>
                      <span className="text-gray-500">
                        +{(expected_move_low * 100).toFixed(1)}–{(expected_move_high * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-gray-700">—</span>
              )}
            </div>
          </div>

          {/* Confidence */}
          <span className="text-xs font-mono text-gray-300 text-right">{Math.round(confidence * 100)}%</span>

          {/* Time remaining + delete */}
          <div className="flex items-center gap-2 justify-end">
            <span className={`text-xs shrink-0 ${expired ? 'text-gray-600' : 'text-gray-400'}`}>
              {expired ? 'Expired' : `${daysLeft}d left`}
            </span>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-loss transition-all"
              title="Delete signal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Update dashboard page.tsx**

Replace the contents of `frontend/app/page.tsx` with:

```tsx
// frontend/app/page.tsx
import { getSignals, getNewsFeed, getSectorHeatmap, getResolvedSignals } from '@/lib/api'
import SignalTrackerRow from '@/components/signals/SignalTrackerRow'
import NewsFeed from '@/components/news/NewsFeed'
import SectorHeatmap from '@/components/analytics/SectorHeatmap'
import PastSignals from '@/components/signals/PastSignals'
import TopBar from '@/components/layout/TopBar'
import { TrendingUp, AlertTriangle, Clock, BarChart2, CheckCircle } from 'lucide-react'

export default async function DashboardPage() {
  const [bullish, crashRisk, newsFeed, heatmap, resolved] = await Promise.all([
    getSignals({ direction: 'bullish', limit: 10 }),
    getSignals({ direction: 'crash_risk', limit: 10 }),
    getNewsFeed(),
    getSectorHeatmap(),
    getResolvedSignals(),
  ])

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${bullish.total + crashRisk.total} active signals · ${newsFeed.length} articles`}
      />

      <div className="p-6 space-y-6">

        {/* Top Opportunities */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-profit" />
            <h2 className="text-sm font-semibold text-gray-300">Top Opportunities</h2>
            <span className="text-xs text-gray-600">({bullish.total})</span>
          </div>

          {bullish.data.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-sm bg-surface-card rounded-xl border border-white/8">
              No bullish signals available
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] gap-3 lg:gap-4 px-4 py-2 border-b border-white/8">
                <span className="text-xs text-gray-600">#</span>
                <span className="text-xs text-gray-600">Stock</span>
                <span className="text-xs text-gray-600">Signal</span>
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs text-gray-600 text-right">Conf</span>
                <span className="text-xs text-gray-600 text-right">Time</span>
              </div>
              {bullish.data.map((signal) => (
                <SignalTrackerRow key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Crash Risk Alerts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <h2 className="text-sm font-semibold text-gray-300">Crash Risk Alerts</h2>
            <span className="text-xs text-gray-600">({crashRisk.total})</span>
          </div>

          {crashRisk.data.length === 0 ? (
            <div className="flex items-center gap-2 py-4 px-4 text-profit text-sm bg-surface-card rounded-xl border border-white/8">
              <span>✓</span>
              <span>No crash risks detected</span>
            </div>
          ) : (
            <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-[2rem_1fr_auto_2fr_auto_auto] lg:grid-cols-[2.5rem_1.5fr_auto_2fr_auto_auto] gap-3 lg:gap-4 px-4 py-2 border-b border-white/8">
                <span className="text-xs text-gray-600">#</span>
                <span className="text-xs text-gray-600">Stock</span>
                <span className="text-xs text-gray-600">Signal</span>
                <span className="text-xs text-gray-600">Progress</span>
                <span className="text-xs text-gray-600 text-right">Conf</span>
                <span className="text-xs text-gray-600 text-right">Time</span>
              </div>
              {crashRisk.data.map((signal) => (
                <SignalTrackerRow key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Sector Activity */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-sm font-semibold text-gray-300">Sector Activity</h2>
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8 p-4">
            <SectorHeatmap data={heatmap} />
          </div>
        </section>

        {/* Breaking News */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-brand-cyan" />
            <h2 className="text-sm font-semibold text-gray-300">Breaking News</h2>
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8">
            <NewsFeed items={newsFeed} />
          </div>
        </section>

        {/* Past Signals */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Past Signals</h2>
            <span className="text-xs text-gray-600">({resolved.length})</span>
          </div>
          <PastSignals initialData={resolved} />
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Run backend tests one final time**

```bash
cd backend && python3 -m pytest --tb=short -q 2>&1 | tail -10
```

Expected: 0 failures

- [ ] **Step 5: Commit and push**

```bash
git add frontend/components/signals/SignalTrackerRow.tsx frontend/app/page.tsx
git commit -m "feat: add delete button to active signal rows, wire Past Signals section to dashboard"
git push origin main
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `deleted_at`, `actual_move`, `was_correct`, `resolved_verdict` columns | Task 1 |
| `price_at_signal` populated on first insert | Task 3 |
| `sync_resolved_signals` copies from signal_history | Task 3 |
| `generate_verdict` (success 2 sentences, failure 3-4 sentences) | Task 4 |
| `generate_verdicts` pipeline step | Task 4 |
| `DELETE /signals/{id}` soft delete | Task 5 |
| `list_signals` / `get_signal` filter deleted | Task 5 |
| `GET /analytics/resolved-signals` | Task 6 |
| `ResolvedSignalEntry` type + `getResolvedSignals()` | Task 7 |
| `deleteSignalAction` server action | Task 7 |
| `ResolvedSignalRow` component | Task 8 |
| `PastSignals` component with optimistic delete | Task 8 |
| Delete button on `SignalTrackerRow` | Task 9 |
| Dashboard wiring with Past Signals section | Task 9 |

**Note on `accuracy_notes`:** The spec migration didn't include `accuracy_notes` but `generate_verdict` uses it. Task 1 migration adds it. `sync_resolved_signals` (Task 3) copies it from `signal_history`. This is a valid fix, not over-building.

**Note on route order:** In `signals.py`, `DELETE /{signal_id}` is declared before `GET /{signal_id}` to avoid FastAPI routing conflicts. This is critical.
