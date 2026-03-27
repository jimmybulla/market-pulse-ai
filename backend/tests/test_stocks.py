# backend/tests/test_stocks.py
from unittest.mock import MagicMock

MOCK_STOCK = {
    "id": "stock-uuid-1",
    "ticker": "NVDA",
    "name": "NVIDIA Corporation",
    "sector": "Technology",
    "market_cap": 2800000000000,
    "last_price": 875.50,
    "updated_at": "2026-03-27T10:00:00+00:00",
}


def test_list_stocks_returns_200(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [MOCK_STOCK]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/stocks")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"][0]["ticker"] == "NVDA"


def test_get_stock_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/stocks/FAKE")
    assert response.status_code == 404


def test_get_stock_upcases_ticker(client):
    c, mock_db = client
    mock_stock_exec = MagicMock()
    mock_stock_exec.data = MOCK_STOCK
    mock_signal_exec = MagicMock()
    mock_signal_exec.data = []

    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_stock_exec
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_signal_exec

    response = c.get("/stocks/nvda")
    assert response.status_code == 200
    assert response.json()["ticker"] == "NVDA"
