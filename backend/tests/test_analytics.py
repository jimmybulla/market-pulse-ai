# backend/tests/test_analytics.py
import pytest
from unittest.mock import MagicMock


def test_accuracy_returns_200_with_no_data(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 0
    assert body["overall_accuracy"] is None


def test_accuracy_calculates_hit_rate(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"direction": "bullish", "was_correct": True, "actual_move": 0.05},
        {"direction": "bullish", "was_correct": True, "actual_move": 0.04},
        {"direction": "bullish", "was_correct": False, "actual_move": -0.02},
        {"direction": "bearish", "was_correct": True, "actual_move": -0.03},
    ]
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 4
    assert body["overall_accuracy"] == 0.75
    assert "bullish" in body["by_direction"]
    assert body["by_direction"]["bullish"]["hit_rate"] == pytest.approx(2 / 3)


def test_accuracy_excludes_unresolved_signals(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"direction": "bullish", "was_correct": None, "actual_move": None},
        {"direction": "bullish", "was_correct": True, "actual_move": 0.04},
    ]
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/analytics/accuracy")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 1


# ── /analytics/backtesting NULL fix ───────────────────────────────────

def test_backtesting_returns_200_not_500(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 0
    assert body["overall_hit_rate"] == 0.0


def test_backtesting_calculates_hit_rate(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"direction": "bullish", "confidence": 0.85, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": 0.05, "was_correct": True},
        {"direction": "bullish", "confidence": 0.75, "expected_move_low": 0.02,
         "expected_move_high": 0.05, "actual_move": -0.01, "was_correct": False},
        {"direction": "bearish", "confidence": 0.65, "expected_move_low": 0.02,
         "expected_move_high": 0.04, "actual_move": -0.03, "was_correct": True},
    ]
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    body = response.json()
    assert body["total_resolved"] == 3
    assert body["overall_hit_rate"] == pytest.approx(2 / 3, abs=1e-4)
    assert "bullish" in body["by_direction"]
    assert body["by_direction"]["bullish"]["hit_rate"] == pytest.approx(0.5, abs=1e-4)


# ── /analytics/performance-over-time ─────────────────────────────────

def test_performance_weekly_groups_by_iso_week(client):
    c, mock_db = client
    mock_exec = MagicMock()
    # One signal in week 2026-W11, two in week 2026-W12
    mock_exec.data = [
        {"was_correct": True,  "created_at": "2026-03-10T10:00:00"},  # W11
        {"was_correct": True,  "created_at": "2026-03-16T10:00:00"},  # W12
        {"was_correct": False, "created_at": "2026-03-17T10:00:00"},  # W12
    ]
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/performance-over-time?period=weekly")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["period"] == "2026-W11"
    assert data[0]["hit_rate"] == 1.0
    assert data[0]["total"] == 1
    assert data[1]["period"] == "2026-W12"
    assert data[1]["hit_rate"] == pytest.approx(0.5, abs=1e-4)
    assert data[1]["total"] == 2


def test_performance_monthly_groups_by_month(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"was_correct": True,  "created_at": "2026-02-15T10:00:00"},  # 2026-02
        {"was_correct": True,  "created_at": "2026-03-10T10:00:00"},  # 2026-03
        {"was_correct": False, "created_at": "2026-03-20T10:00:00"},  # 2026-03
    ]
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/performance-over-time?period=monthly")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["period"] == "2026-02"
    assert data[0]["hit_rate"] == 1.0
    assert data[1]["period"] == "2026-03"
    assert data[1]["hit_rate"] == pytest.approx(0.5, abs=1e-4)


def test_performance_empty_returns_empty_list(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/analytics/performance-over-time?period=weekly")
    assert response.status_code == 200
    assert response.json() == []


def test_performance_invalid_period_returns_422(client):
    c, mock_db = client
    response = c.get("/analytics/performance-over-time?period=daily")
    assert response.status_code == 422
