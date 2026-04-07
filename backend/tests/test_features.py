# backend/tests/test_features.py
from datetime import datetime, timezone, timedelta
import pytest
from app.services.features import extract_features, _sentiment, _event_type, _credibility, _novelty, _severity


def _now():
    return datetime.now(timezone.utc)


# --- _sentiment ---

def test_sentiment_positive_headline():
    score = _sentiment("Company beats earnings expectations with record profit")
    assert score > 0


def test_sentiment_negative_headline():
    score = _sentiment("Company misses revenue targets, stock crashes")
    assert score < 0


def test_sentiment_range():
    score = _sentiment("quarterly results")
    assert -1.0 <= score <= 1.0


# --- _event_type ---

def test_event_type_earnings():
    assert _event_type("Q3 earnings beat EPS estimates") == "earnings"


def test_event_type_ma():
    assert _event_type("Company announces acquisition of rival") == "m&a"


def test_event_type_regulation():
    assert _event_type("SEC fines company for disclosure violations") == "regulation"


def test_event_type_product():
    assert _event_type("Apple to launch new model next quarter") == "product"


def test_event_type_executive():
    assert _event_type("CEO resigns amid board pressure") == "executive"


def test_event_type_macro_fallback():
    assert _event_type("Weather forecast for next week") == "macro"


def test_event_type_case_insensitive():
    assert _event_type("EARNINGS BEAT EXPECTATIONS") == "earnings"


# --- _credibility ---

def test_credibility_known_domain():
    assert _credibility("https://reuters.com/article/123") == 0.92


def test_credibility_bloomberg():
    assert _credibility("https://bloomberg.com/news/abc") == 0.92


def test_credibility_finance_yahoo():
    assert _credibility("https://finance.yahoo.com/xyz") == 0.70


def test_credibility_unknown_domain():
    score = _credibility("https://unknownblog.example.com/post")
    assert score == 0.55


def test_credibility_subdomain_stripped():
    # www.reuters.com should resolve to reuters.com
    score = _credibility("https://www.reuters.com/article/abc")
    assert score == 0.92


# --- _novelty ---

def test_novelty_very_fresh():
    published = _now() - timedelta(minutes=30)
    assert _novelty(published) == 1.0


def test_novelty_under_6h():
    published = _now() - timedelta(hours=4)
    assert _novelty(published) == 0.85


def test_novelty_under_12h():
    published = _now() - timedelta(hours=8)
    assert _novelty(published) == 0.65


def test_novelty_under_24h():
    published = _now() - timedelta(hours=20)
    assert _novelty(published) == 0.40


def test_novelty_under_48h():
    published = _now() - timedelta(hours=36)
    assert _novelty(published) == 0.15


def test_novelty_old():
    published = _now() - timedelta(hours=72)
    assert _novelty(published) == 0.05


# --- _severity ---

def test_severity_earnings_high_sentiment():
    sev = _severity("earnings", 0.9)
    assert sev == pytest.approx(min(1.0, 0.9 * 1.5))


def test_severity_macro_low():
    sev = _severity("macro", 0.5)
    assert sev == pytest.approx(min(1.0, 0.5 * 0.4))


def test_severity_capped_at_1():
    sev = _severity("earnings", 1.5)
    assert sev == 1.0


def test_severity_uses_abs():
    pos = _severity("regulation", 0.8)
    neg = _severity("regulation", -0.8)
    assert pos == neg


# --- extract_features ---

def test_extract_features_returns_article_features():
    from app.services.scoring import ArticleFeatures
    published = _now() - timedelta(hours=3)
    result = extract_features(
        headline="Strong earnings beat analyst estimates",
        url="https://reuters.com/article/abc",
        published_at=published,
    )
    assert isinstance(result, ArticleFeatures)
    assert result.event_type == "earnings"
    assert result.credibility_score == 0.92
    assert result.novelty_score == 0.85
    assert result.sentiment_score > 0
    assert 0.0 <= result.severity <= 1.0


# --- _sentiment (LM blend) ---

def test_sentiment_uses_lm_blend_when_lm_words_found():
    # "bankruptcy losses liabilities" → LM_NEGATIVE heavy → score must be < 0
    # VADER alone on this phrase is also negative, but LM blend makes it more so
    from app.services.lm_lexicon import lm_score
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    headline = "company faces bankruptcy amid mounting losses and liabilities"
    lm = lm_score(headline)
    vader_val = SentimentIntensityAnalyzer().polarity_scores(headline)["compound"]
    expected_blend = round(0.7 * lm + 0.3 * vader_val, 4)
    assert _sentiment(headline) == pytest.approx(expected_blend, abs=1e-4)


def test_sentiment_uses_vader_only_when_no_lm_words():
    # "the cat sat on the mat" has no LM words → VADER only
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    headline = "the cat sat on the mat today"
    vader_val = round(SentimentIntensityAnalyzer().polarity_scores(headline)["compound"], 4)
    assert _sentiment(headline) == pytest.approx(vader_val, abs=1e-4)
