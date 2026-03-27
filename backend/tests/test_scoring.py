# backend/tests/test_scoring.py
import pytest
from app.services.scoring import ArticleFeatures, SignalResult, score_articles


def make_article(
    sentiment: float,
    credibility: float = 0.80,
    novelty: float = 0.75,
    severity: float = 0.65,
    event_type: str = "earnings",
) -> ArticleFeatures:
    return ArticleFeatures(
        sentiment_score=sentiment,
        credibility_score=credibility,
        novelty_score=novelty,
        severity=severity,
        event_type=event_type,
    )


def test_empty_list_returns_none():
    assert score_articles([]) is None


def test_bullish_signal():
    articles = [
        make_article(sentiment=0.75, credibility=0.85, novelty=0.80, severity=0.70),
        make_article(sentiment=0.60, credibility=0.78, novelty=0.72, severity=0.60),
    ]
    result = score_articles(articles)
    assert result is not None
    assert result.direction == "bullish"
    assert result.confidence > 0.6
    assert result.opportunity_score > 0.6
    assert result.crash_risk_score < 0.3


def test_bearish_signal():
    articles = [
        make_article(sentiment=-0.52, credibility=0.75, novelty=0.60, severity=0.50),
        make_article(sentiment=-0.48, credibility=0.72, novelty=0.58, severity=0.48),
    ]
    result = score_articles(articles)
    assert result is not None
    assert result.direction == "bearish"
    assert result.opportunity_score < 0.4
    assert result.crash_risk_score > 0.6
    assert result.crash_risk_score <= 0.75


def test_crash_risk_signal():
    articles = [
        make_article(sentiment=-0.88, credibility=0.90, novelty=0.85, severity=0.92),
        make_article(sentiment=-0.82, credibility=0.88, novelty=0.80, severity=0.88),
    ]
    result = score_articles(articles)
    assert result is not None
    assert result.direction == "crash_risk"
    assert result.crash_risk_score > 0.75


def test_no_signal_for_mixed_moderate():
    articles = [
        make_article(sentiment=0.45, credibility=0.70, novelty=0.55, severity=0.40),
        make_article(sentiment=-0.40, credibility=0.68, novelty=0.52, severity=0.38),
    ]
    result = score_articles(articles)
    assert result is None


def test_move_range_scales_with_confidence():
    high = [make_article(sentiment=0.90, credibility=0.95, novelty=0.90, severity=0.85)]
    low = [make_article(sentiment=0.62, credibility=0.72, novelty=0.62, severity=0.52)]
    r_high = score_articles(high)
    r_low = score_articles(low)
    assert r_high is not None and r_low is not None
    assert r_high.expected_move_high > r_low.expected_move_high


def test_drivers_contain_earnings_label():
    articles = [make_article(sentiment=0.80, event_type="earnings")]
    result = score_articles(articles)
    assert result is not None
    assert "Strong earnings sentiment" in result.drivers


def test_result_is_signal_result_instance():
    articles = [make_article(sentiment=0.75)]
    result = score_articles(articles)
    assert isinstance(result, SignalResult)


def test_scores_clamped_to_one():
    articles = [make_article(sentiment=0.99, credibility=0.99, novelty=0.99, severity=0.99)]
    result = score_articles(articles)
    assert result is not None
    assert result.opportunity_score <= 1.0
    assert result.crash_risk_score <= 1.0
