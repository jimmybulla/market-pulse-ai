# backend/tests/test_ingestor.py
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest

from app.services.ingestor import ingest_news


def _make_db(existing_urls: list[str] = None, ticker_rows: list[dict] = None):
    db = MagicMock()

    # stocks query
    stocks_data = ticker_rows or [{"id": "stock-1", "ticker": "AAPL"}]
    db.table.return_value.select.return_value.execute.return_value.data = stocks_data

    # existing URLs query
    url_data = [{"url": u} for u in (existing_urls or [])]
    (db.table.return_value.select.return_value
       .in_.return_value.execute.return_value.data) = url_data

    # insert returns something with .data
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "new-article-1"}
    ]
    return db


def _fake_article(title: str, url: str, ts: int = 1700000000) -> dict:
    return {
        "title": title,
        "link": url,
        "providerPublishTime": ts,
    }


def test_ingest_news_inserts_new_article():
    db = _make_db(existing_urls=[], ticker_rows=[{"id": "stock-1", "ticker": "AAPL"}])
    articles = [_fake_article("Apple beats earnings", "https://reuters.com/a1")]

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = articles
        result = ingest_news(db, ["AAPL"])

    assert len(result) == 1
    assert result[0] == "new-article-1"


def test_ingest_news_skips_duplicate_url():
    existing = ["https://reuters.com/a1"]
    db = _make_db(existing_urls=existing, ticker_rows=[{"id": "stock-1", "ticker": "AAPL"}])
    articles = [_fake_article("Apple beats earnings", "https://reuters.com/a1")]

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = articles
        result = ingest_news(db, ["AAPL"])

    assert result == []
    db.table.return_value.insert.assert_not_called()


def test_ingest_news_handles_ticker_error_gracefully():
    db = _make_db(existing_urls=[], ticker_rows=[{"id": "stock-1", "ticker": "FAKE"}])

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = []
        # even if yfinance throws, other tickers should continue
        mock_ticker.side_effect = Exception("yfinance error")
        result = ingest_news(db, ["FAKE"])

    assert result == []


def test_ingest_news_multiple_tickers():
    db = MagicMock()
    stocks_data = [
        {"id": "stock-1", "ticker": "AAPL"},
        {"id": "stock-2", "ticker": "MSFT"},
    ]
    db.table.return_value.select.return_value.execute.return_value.data = stocks_data
    (db.table.return_value.select.return_value
       .in_.return_value.execute.return_value.data) = []
    db.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "article-x"}
    ]

    aapl_article = _fake_article("AAPL news", "https://cnbc.com/a1")
    msft_article = _fake_article("MSFT news", "https://cnbc.com/a2")

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.side_effect = lambda t: MagicMock(
            news=[aapl_article] if t == "AAPL" else [msft_article]
        )
        result = ingest_news(db, ["AAPL", "MSFT"])

    assert len(result) == 2


def test_ingest_news_inserts_correct_fields():
    db = _make_db(existing_urls=[], ticker_rows=[{"id": "stock-1", "ticker": "AAPL"}])
    ts = 1700000000
    article = _fake_article("Apple earnings beat", "https://reuters.com/xyz", ts)

    with patch("app.services.ingestor.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.news = [article]
        ingest_news(db, ["AAPL"])

    insert_call = db.table.return_value.insert.call_args
    inserted = insert_call[0][0]
    assert inserted["headline"] == "Apple earnings beat"
    assert inserted["url"] == "https://reuters.com/xyz"
    assert inserted["tickers"] == ["AAPL"]
    assert "published_at" in inserted
    assert "fetched_at" in inserted
