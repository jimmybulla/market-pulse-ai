# backend/tests/test_newsapi_ingestor.py
from unittest.mock import MagicMock, patch

from app.services.newsapi_ingestor import ingest_newsapi


def _make_db(existing_urls: list[str] = None):
    db = MagicMock()
    url_data = [{"url": u} for u in (existing_urls or [])]
    db.table.return_value.select.return_value.gte.return_value.execute.return_value.data = url_data
    db.table.return_value.insert.return_value.execute.return_value.data = [{"id": "newsapi-article-1"}]
    return db


def _make_response(articles: list[dict]):
    resp = MagicMock()
    resp.json.return_value = {"articles": articles}
    resp.raise_for_status.return_value = None
    return resp


def test_ingest_newsapi_inserts_new_article_and_skips_duplicate():
    """One new article (AAPL in title) and one duplicate URL → only new one inserted."""
    db = _make_db(existing_urls=["https://existing.com/old"])
    articles = [
        {
            "title": "AAPL beats earnings expectations",
            "url": "https://reuters.com/new",
            "publishedAt": "2026-04-01T12:00:00Z",
            "source": {"name": "Reuters"},
        },
        {
            "title": "Market roundup",
            "url": "https://existing.com/old",
            "publishedAt": "2026-04-01T10:00:00Z",
            "source": {"name": "CNN"},
        },
    ]

    with patch("app.services.newsapi_ingestor.settings") as mock_settings, \
         patch("app.services.newsapi_ingestor.httpx.get") as mock_get:
        mock_settings.newsapi_key = "test-key"
        mock_get.return_value = _make_response(articles)
        result = ingest_newsapi(db, ["AAPL", "MSFT"])

    assert len(result) == 1
    assert result[0] == "newsapi-article-1"
    insert_call = db.table.return_value.insert.call_args
    inserted = insert_call[0][0]
    assert inserted["headline"] == "AAPL beats earnings expectations"
    assert "AAPL" in inserted["tickers"]


def test_ingest_newsapi_returns_empty_when_no_key():
    """If NEWSAPI_KEY is empty, return [] immediately without any HTTP call."""
    db = _make_db()

    with patch("app.services.newsapi_ingestor.settings") as mock_settings, \
         patch("app.services.newsapi_ingestor.httpx.get") as mock_get:
        mock_settings.newsapi_key = ""
        result = ingest_newsapi(db, ["AAPL", "MSFT"])

    assert result == []
    mock_get.assert_not_called()
