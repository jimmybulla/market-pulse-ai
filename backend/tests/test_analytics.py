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
