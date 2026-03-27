# backend/tests/test_charts.py
from unittest.mock import patch, MagicMock
import pandas as pd


# ── price-history ──────────────────────────────────────────────────────

def test_price_history_returns_data(client):
    c, mock_db = client
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
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = pd.DataFrame()
        response = c.get("/stocks/FAKE/price-history")
    assert response.status_code == 502


def test_price_history_upcases_ticker(client):
    c, mock_db = client
    mock_hist = pd.DataFrame(
        {"Close": [500.0]},
        index=pd.DatetimeIndex(["2026-03-27"]),
    )
    with patch("app.routers.charts.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = mock_hist
        response = c.get("/stocks/tsla/price-history")
    assert response.status_code == 200
    assert response.json()["ticker"] == "TSLA"


# ── sentiment-trend ────────────────────────────────────────────────────

def test_sentiment_trend_aggregates_by_day(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [
        {"published_at": "2026-03-27T10:00:00", "sentiment_score": 0.5},
        {"published_at": "2026-03-27T14:00:00", "sentiment_score": 0.3},
        {"published_at": "2026-03-26T09:00:00", "sentiment_score": -0.2},
    ]
    mock_db.table.return_value.select.return_value.filter.return_value.gte.return_value.neq.return_value.execute.return_value = mock_exec
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
    mock_db.table.return_value.select.return_value.filter.return_value.gte.return_value.neq.return_value.execute.return_value = mock_exec
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
    mock_db.table.return_value.select.return_value.filter.return_value.gte.return_value.execute.return_value = mock_exec
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
    mock_db.table.return_value.select.return_value.filter.return_value.gte.return_value.execute.return_value = mock_exec
    response = c.get("/stocks/AAPL/news-volume")
    assert response.status_code == 200
    assert response.json()["data"] == []
