# backend/tests/test_news.py
from unittest.mock import MagicMock

MOCK_ARTICLE = {
    "id": "article-uuid-1",
    "headline": "NVIDIA reports record data center revenue",
    "body": "Blackwell GPU demand remains insatiable.",
    "url": "https://reuters.com/nvda-q4-2026",
    "published_at": "2026-03-26T15:00:00+00:00",
    "tickers": ["NVDA"],
    "sentiment_score": 0.88,
    "event_type": "earnings",
    "novelty_score": 0.92,
    "credibility_score": 0.92,
    "severity": 0.85,
}


def test_list_news_returns_200(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = [MOCK_ARTICLE]
    mock_exec.count = 1
    mock_db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value = mock_exec
    mock_db.table.return_value.select.return_value.execute.return_value = mock_exec

    response = c.get("/news")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"][0]["headline"] == "NVIDIA reports record data center revenue"


def test_get_article_returns_404_when_not_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = None
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/news/nonexistent-id")
    assert response.status_code == 404


def test_get_article_returns_200_when_found(client):
    c, mock_db = client
    mock_exec = MagicMock()
    mock_exec.data = MOCK_ARTICLE
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_exec

    response = c.get("/news/article-uuid-1")
    assert response.status_code == 200
    assert response.json()["event_type"] == "earnings"
