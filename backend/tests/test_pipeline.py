# backend/tests/test_pipeline.py
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, call
import pytest

from app.services.pipeline import (
    extract_features_for_articles,
    generate_signals,
    update_prices,
    run_pipeline,
)
from app.services.scoring import ArticleFeatures, SignalResult


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _article(article_id: str, headline: str, url: str, published_at: str = None) -> dict:
    return {
        "id": article_id,
        "headline": headline,
        "url": url,
        "published_at": published_at or _now_iso(),
        "sentiment_score": None,
    }


# --- extract_features_for_articles ---

def test_extract_features_updates_article_row():
    db = MagicMock()
    articles = [_article("art-1", "Strong earnings beat", "https://reuters.com/a")]

    with patch("app.services.pipeline.extract_features") as mock_extract:
        mock_extract.return_value = ArticleFeatures(
            sentiment_score=0.8,
            credibility_score=0.92,
            novelty_score=1.0,
            severity=0.8,
            event_type="earnings",
        )
        extract_features_for_articles(db, articles)

    update_call = db.table.return_value.update.call_args
    updated = update_call[0][0]
    assert updated["sentiment_score"] == 0.8
    assert updated["event_type"] == "earnings"
    assert updated["credibility_score"] == 0.92
    assert updated["novelty_score"] == 1.0
    assert updated["severity"] == 0.8


def test_extract_features_handles_error_gracefully():
    db = MagicMock()
    articles = [_article("art-1", "Headline", "https://example.com/a")]

    with patch("app.services.pipeline.extract_features", side_effect=Exception("parse error")):
        # Should not raise
        extract_features_for_articles(db, articles)

    db.table.return_value.update.assert_not_called()


# --- generate_signals ---

def _make_signal_result() -> SignalResult:
    return SignalResult(
        direction="bullish",
        confidence=0.75,
        expected_move_low=0.03,
        expected_move_high=0.08,
        opportunity_score=0.75,
        crash_risk_score=0.10,
        drivers=["Strong earnings sentiment"],
        risk_flags=[],
    )


def test_generate_signals_upserts_signal():
    stocks = [{"id": "stock-1", "ticker": "AAPL"}]
    articles = [
        {
            "id": "art-1",
            "headline": "Beat earnings",
            "url": "https://reuters.com/a",
            "published_at": _now_iso(),
            "sentiment_score": 0.8,
            "credibility_score": 0.92,
            "novelty_score": 1.0,
            "severity": 0.8,
            "event_type": "earnings",
        }
    ]
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = stocks
    db.table.return_value.select.return_value.gte.return_value.filter.return_value.neq.return_value.execute.return_value.data = articles
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.pipeline.score_articles", return_value=_make_signal_result()):
        generate_signals(db)

    # insert or update should be called for the signal
    assert db.table.return_value.insert.called or db.table.return_value.update.called


def test_generate_signals_skips_when_scoring_returns_none():
    stocks = [{"id": "stock-1", "ticker": "AAPL"}]
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = stocks
    db.table.return_value.select.return_value.gte.return_value.filter.return_value.neq.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.pipeline.score_articles", return_value=None):
        generate_signals(db)

    db.table.return_value.insert.assert_not_called()


# --- update_prices ---

def test_update_prices_sets_last_price():
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "AAPL"}
    ]

    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 195.50
        update_prices(db)

    update_call = db.table.return_value.update.call_args
    assert update_call[0][0]["last_price"] == 195.50


def test_update_prices_skips_none_price():
    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "FAKE"}
    ]

    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = None
        update_prices(db)

    db.table.return_value.update.assert_not_called()


# --- run_pipeline (integration smoke test) ---

def test_run_pipeline_calls_all_steps(monkeypatch):
    from app.services import pipeline as pl

    calls = []

    def fake_ingest(db, tickers):
        calls.append("ingest")
        return ["art-1"]

    def fake_extract(db, articles):
        calls.append("extract")

    def fake_generate(db):
        calls.append("generate")

    def fake_prices(db):
        calls.append("prices")

    monkeypatch.setattr(pl, "ingest_news", fake_ingest)
    monkeypatch.setattr(pl, "extract_features_for_articles", fake_extract)
    monkeypatch.setattr(pl, "generate_signals", fake_generate)
    monkeypatch.setattr(pl, "update_prices", fake_prices)

    db = MagicMock()
    db.table.return_value.select.return_value.execute.return_value.data = [
        {"id": "s1", "ticker": "AAPL"}
    ]

    pl.run_pipeline(db)

    assert calls == ["ingest", "extract", "generate", "prices"]
