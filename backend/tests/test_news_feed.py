import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone


def _signal(id="sig-1", direction="bullish", confidence=0.75, opp_score=0.8, article_ids=None):
    return {
        "id": id,
        "direction": direction,
        "confidence": confidence,
        "opportunity_score": opp_score,
        "evidence": {"article_ids": article_ids or []},
    }


def _article(id="art-1", headline="Market moves", event_type="earnings", tickers=None, url="https://example.com/article"):
    return {
        "id": id,
        "headline": headline,
        "url": url,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "sentiment_score": 0.42,
        "event_type": event_type,
        "credibility_score": 0.8,
        "tickers": tickers or ["AAPL"],
    }


def _setup_client(mock_db, signals_data, articles_data):
    """Set up mock_db for new feed endpoint: signals from one query, articles from another."""
    signals_tbl = MagicMock()
    signals_tbl.select.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=signals_data
    )

    # New article query chain: .select().gte().not_.is_().order().limit().execute()
    articles_tbl = MagicMock()
    (
        articles_tbl.select.return_value
        .gte.return_value
        .not_.is_.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
    ) = MagicMock(data=articles_data)

    def side(t):
        if t == "signals":
            return signals_tbl
        if t == "news_articles":
            return articles_tbl
        return MagicMock()

    mock_db.table.side_effect = side


def test_news_feed_returns_empty_when_no_articles(client):
    c, mock_db = client
    _setup_client(mock_db, signals_data=[], articles_data=[])
    response = c.get("/news/feed")
    assert response.status_code == 200
    assert response.json() == []


def test_news_feed_returns_articles_ordered_by_opp_score(client):
    c, mock_db = client
    signals = [
        _signal(id="sig-1", direction="bullish", opp_score=0.9, article_ids=["art-1"]),
        _signal(id="sig-2", direction="bearish", opp_score=0.5, article_ids=["art-2"]),
    ]
    articles = [
        _article(id="art-2", headline="Low story"),
        _article(id="art-1", headline="Top story"),
    ]
    _setup_client(mock_db, signals, articles)
    response = c.get("/news/feed")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["headline"] == "Top story"
    assert data[0]["signal_opportunity_score"] == 0.9


def test_news_feed_deduplicates_articles(client):
    c, mock_db = client
    # Both signals reference the same article — bullish (0.9) wins (first-match)
    signals = [
        _signal(id="sig-1", direction="bullish", opp_score=0.9, article_ids=["art-1"]),
        _signal(id="sig-2", direction="bearish", opp_score=0.5, article_ids=["art-1"]),
    ]
    articles = [_article(id="art-1")]
    _setup_client(mock_db, signals, articles)
    response = c.get("/news/feed")
    data = response.json()
    assert len(data) == 1
    assert data[0]["signal_direction"] == "bullish"


def test_news_feed_filters_by_direction(client):
    c, mock_db = client
    signals = [
        _signal(id="sig-1", direction="bullish", opp_score=0.9, article_ids=["art-1"]),
        _signal(id="sig-2", direction="bearish", opp_score=0.7, article_ids=["art-2"]),
    ]
    articles = [_article(id="art-1"), _article(id="art-2")]
    _setup_client(mock_db, signals, articles)
    response = c.get("/news/feed?direction=bullish")
    data = response.json()
    assert len(data) == 1
    assert data[0]["signal_direction"] == "bullish"


def test_news_feed_filters_by_event_type(client):
    c, mock_db = client
    signals = [
        _signal(id="sig-1", opp_score=0.9, article_ids=["art-1"]),
        _signal(id="sig-2", opp_score=0.7, article_ids=["art-2"]),
    ]
    articles = [
        _article(id="art-1", event_type="earnings"),
        _article(id="art-2", event_type="regulation"),
    ]
    _setup_client(mock_db, signals, articles)
    response = c.get("/news/feed?event_type=earnings")
    data = response.json()
    assert len(data) == 1
    assert data[0]["event_type"] == "earnings"


def test_news_feed_returns_articles_without_signal(client):
    c, mock_db = client
    # Article exists but no signal references it — should still appear with null signal fields
    articles = [_article(id="art-1", headline="Unlinked article")]
    _setup_client(mock_db, signals_data=[], articles_data=articles)
    response = c.get("/news/feed")
    data = response.json()
    assert len(data) == 1
    assert data[0]["headline"] == "Unlinked article"
    assert data[0]["signal_direction"] is None
    assert data[0]["signal_confidence"] is None


def test_news_feed_skips_articles_with_empty_headline(client):
    c, mock_db = client
    articles = [
        _article(id="art-1", headline=""),        # empty — should be skipped
        _article(id="art-2", headline="Good story"),
    ]
    _setup_client(mock_db, signals_data=[], articles_data=articles)
    response = c.get("/news/feed")
    data = response.json()
    assert len(data) == 1
    assert data[0]["headline"] == "Good story"


def test_news_feed_skips_articles_with_empty_url(client):
    c, mock_db = client
    articles = [
        _article(id="art-1", url=""),             # empty url — should be skipped
        _article(id="art-2", headline="Real article"),
    ]
    _setup_client(mock_db, signals_data=[], articles_data=articles)
    response = c.get("/news/feed")
    data = response.json()
    assert len(data) == 1
    assert data[0]["headline"] == "Real article"
