# backend/tests/test_charts.py
from unittest.mock import patch, MagicMock
import pandas as pd


# ── price-history ──────────────────────────────────────────────────────

def _no_price_cache(mock_db):
    """Configure mock_db to return no Supabase price history (forces yfinance fallback)."""
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None


def test_price_history_returns_data(client):
    c, mock_db = client
    _no_price_cache(mock_db)
    mock_hist = pd.DataFrame(
        {"Close": [213.45, 215.30]},
        index=pd.DatetimeIndex(["2026-03-26", "2026-03-27"]),
    )
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = mock_hist
        response = c.get("/stocks/AAPL/price-history?range=7d")
    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert body["range"] == "7d"
    assert len(body["data"]) == 2
    assert body["data"][0]["date"] == "2026-03-26"
    assert body["data"][0]["close"] == 213.45
    assert body["data"][1]["close"] == 215.30


def test_price_history_default_range_is_30d(client):
    c, mock_db = client
    _no_price_cache(mock_db)
    mock_hist = pd.DataFrame(
        {"Close": [500.0]},
        index=pd.DatetimeIndex(["2026-03-27"]),
    )
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = mock_hist
        response = c.get("/stocks/TSLA/price-history")
    assert response.status_code == 200
    assert response.json()["range"] == "30d"


def test_price_history_empty_returns_502(client):
    c, mock_db = client
    _no_price_cache(mock_db)
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = pd.DataFrame()
        response = c.get("/stocks/FAKE/price-history")
    assert response.status_code == 502


def test_price_history_yfinance_exception_returns_502(client):
    c, mock_db = client
    _no_price_cache(mock_db)
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.side_effect = Exception("timeout")
        response = c.get("/stocks/AAPL/price-history")
    assert response.status_code == 502


def test_price_history_upcases_ticker(client):
    c, mock_db = client
    _no_price_cache(mock_db)
    mock_hist = pd.DataFrame(
        {"Close": [500.0]},
        index=pd.DatetimeIndex(["2026-03-27"]),
    )
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = mock_hist
        response = c.get("/stocks/tsla/price-history")
    assert response.status_code == 200
    assert response.json()["ticker"] == "TSLA"


def test_price_history_reads_from_supabase_when_available(client):
    c, mock_db = client
    stored_data = [
        {"date": f"2026-03-{i:02d}", "close": 200.0 + i}
        for i in range(1, 32)  # 31 days of data
    ]
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "price_history_90d": stored_data
    }
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        response = c.get("/stocks/AAPL/price-history?range=7d")
        mock_ticker.assert_not_called()

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert body["range"] == "7d"
    assert len(body["data"]) == 7
    # Should be the last 7 entries
    assert body["data"][-1] == {"date": "2026-03-31", "close": 231.0}


def test_price_history_falls_back_to_yfinance_when_supabase_empty(client):
    c, mock_db = client
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "price_history_90d": None
    }
    mock_hist = pd.DataFrame(
        {"Close": [213.45]},
        index=pd.DatetimeIndex(["2026-03-27"]),
    )
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = mock_hist
        response = c.get("/stocks/AAPL/price-history?range=7d")
        mock_ticker.assert_called_once()

    assert response.status_code == 200
    assert len(response.json()["data"]) == 1


def test_price_history_falls_back_when_supabase_returns_no_row(client):
    c, mock_db = client
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
    mock_hist = pd.DataFrame(
        {"Close": [213.45]},
        index=pd.DatetimeIndex(["2026-03-27"]),
    )
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = mock_hist
        response = c.get("/stocks/AAPL/price-history?range=7d")
        mock_ticker.assert_called_once()

    assert response.status_code == 200


# ── sentiment-trend ────────────────────────────────────────────────────

def test_sentiment_trend_aggregates_by_day(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"published_at": "2026-03-27T10:00:00", "sentiment_score": 0.5},
        {"published_at": "2026-03-27T14:00:00", "sentiment_score": 0.3},
        {"published_at": "2026-03-26T09:00:00", "sentiment_score": -0.2},
    ]
    mock_db.table.return_value.select.return_value.contains.return_value.gte.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/stocks/AAPL/sentiment-trend?range=7d")
    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert len(body["data"]) == 2
    assert body["data"][0]["date"] == "2026-03-26"
    assert body["data"][0]["avg_sentiment"] == -0.2
    assert abs(body["data"][1]["avg_sentiment"] - 0.4) < 0.001  # avg of 0.5 and 0.3


def test_sentiment_trend_empty_returns_200_empty_list(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.contains.return_value.gte.return_value.not_.is_.return_value.execute.return_value = mock_exec
    response = c.get("/stocks/AAPL/sentiment-trend")
    assert response.status_code == 200
    assert response.json()["data"] == []


# ── news-volume ────────────────────────────────────────────────────────

def test_news_volume_counts_by_day(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"published_at": "2026-03-27T10:00:00"},
        {"published_at": "2026-03-27T14:00:00"},
        {"published_at": "2026-03-26T09:00:00"},
    ]
    mock_db.table.return_value.select.return_value.contains.return_value.gte.return_value.execute.return_value = mock_exec
    response = c.get("/stocks/AAPL/news-volume?range=7d")
    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 2
    assert body["data"][0]["date"] == "2026-03-26"
    assert body["data"][0]["count"] == 1
    assert body["data"][1]["date"] == "2026-03-27"
    assert body["data"][1]["count"] == 2


def test_news_volume_empty_returns_200_empty_list(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = []
    mock_db.table.return_value.select.return_value.contains.return_value.gte.return_value.execute.return_value = mock_exec
    response = c.get("/stocks/AAPL/news-volume")
    assert response.status_code == 200
    assert response.json()["data"] == []
