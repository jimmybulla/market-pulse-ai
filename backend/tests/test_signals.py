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

# An active (non-expired) signal row for tests that need is_expired=False
MOCK_SIGNAL_ROW_ACTIVE = {
    **MOCK_SIGNAL_ROW,
    "id": "sig-uuid-2",
    "expires_at": "2099-12-31T00:00:00+00:00",  # far future
}


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
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/sig-uuid-2")
    assert response.status_code == 200
    body = response.json()
    assert body["actual_move"] == 0.042
    assert body["was_correct"] is True
    assert body["resolved_verdict"] == "Apple hit its target."


def test_list_signals_returns_200(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW_ACTIVE)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["limit"] == 10
    assert body["offset"] == 0


def test_list_signals_enriches_stock_fields(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW_ACTIVE)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    item = response.json()["data"][0]
    assert item["ticker"] == "NVDA"
    assert item["stock_name"] == "NVIDIA Corporation"
    assert item["last_price"] == 875.50


def test_get_signal_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/nonexistent-id")
    assert response.status_code == 404


def test_get_signal_returns_200_when_found(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW)
    mock_exec = MagicMock()
    mock_exec.data = row
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/sig-uuid-1")
    assert response.status_code == 200
    assert response.json()["ticker"] == "NVDA"


def test_list_signals_includes_price_at_signal(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW_ACTIVE)
    row["price_at_signal"] = 875.50
    mock_exec = MagicMock()
    mock_exec.data = [row]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    item = response.json()["data"][0]
    assert item["price_at_signal"] == 875.50


def test_get_signal_sets_is_expired_true_when_past_expires_at(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW)  # expires_at "2026-04-01" is in the past
    mock_exec = MagicMock()
    mock_exec.data = row
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/sig-uuid-1")
    assert response.status_code == 200
    assert response.json()["is_expired"] is True


def test_get_signal_sets_is_expired_false_when_future_expires_at(client):
    c, mock_db = client
    row = dict(MOCK_SIGNAL_ROW_ACTIVE)
    mock_exec = MagicMock()
    mock_exec.data = row
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/signals/sig-uuid-2")
    assert response.status_code == 200
    assert response.json()["is_expired"] is False


def test_list_signals_excludes_expired_signals(client):
    """list_signals must call .gte("expires_at", now) to exclude expired signals."""
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW_ACTIVE)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 1
    # Assert the expiry filter was actually applied
    mock_db.table.return_value.select.return_value.order.return_value.gte.assert_called_once()
    call_args = mock_db.table.return_value.select.return_value.order.return_value.gte.call_args
    assert call_args[0][0] == "expires_at"


def test_list_signals_is_expired_false_for_active_signal(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [dict(MOCK_SIGNAL_ROW_ACTIVE)]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.gte.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value = mock_exec

    response = c.get("/signals")
    assert response.status_code == 200
    assert response.json()["data"][0]["is_expired"] is False
