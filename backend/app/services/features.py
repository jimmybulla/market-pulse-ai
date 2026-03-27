# backend/app/services/features.py
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.services.scoring import ArticleFeatures

logger = logging.getLogger(__name__)

_analyzer = SentimentIntensityAnalyzer()

EVENT_KEYWORDS: dict[str, list[str]] = {
    "earnings":   ["earnings", "revenue", "profit", "eps", "beat", "miss", "guidance", "quarterly"],
    "m&a":        ["acqui", "merger", "takeover", "buyout", "deal", "bid"],
    "regulation": ["fda", "sec", "ftc", "doj", "regulation", "antitrust", "fine", "penalty", "lawsuit"],
    "product":    ["launch", "product", "release", "unveil", "announce", "new model"],
    "executive":  ["ceo", "cfo", "coo", "resign", "appoint", "executive", "leadership"],
}

CREDIBILITY: dict[str, float] = {
    "reuters.com":       0.92,
    "bloomberg.com":     0.92,
    "wsj.com":           0.90,
    "ft.com":            0.90,
    "cnbc.com":          0.82,
    "marketwatch.com":   0.80,
    "seekingalpha.com":  0.72,
    "yahoo.com":         0.70,
    "finance.yahoo.com": 0.70,
    "benzinga.com":      0.65,
    "motleyfool.com":    0.65,
}
_DEFAULT_CREDIBILITY = 0.55

EVENT_WEIGHTS: dict[str, float] = {
    "earnings":   1.0,
    "regulation": 1.0,
    "m&a":        0.9,
    "executive":  0.8,
    "product":    0.7,
    "macro":      0.5,
}


def _sentiment(headline: str) -> float:
    return _analyzer.polarity_scores(headline)["compound"]


def _event_type(headline: str) -> str:
    lower = headline.lower()
    # First keyword match wins; priority follows insertion order:
    # earnings → m&a → regulation → product → executive → fallback macro
    for event, keywords in EVENT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return event
    return "macro"


def _credibility(url: str) -> float:
    try:
        host = urlparse(url).hostname or ""
        # strip leading www.
        if host.startswith("www."):
            host = host[4:]
        return CREDIBILITY.get(host, _DEFAULT_CREDIBILITY)
    except Exception as exc:
        logger.debug("_credibility: failed to parse URL %r — %s", url, exc)
        return _DEFAULT_CREDIBILITY


def _novelty(published_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    # ensure published_at is timezone-aware
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age_hours = (now - published_at).total_seconds() / 3600
    if age_hours < 2:
        return 1.0
    elif age_hours < 6:
        return 0.85
    elif age_hours < 12:
        return 0.70
    elif age_hours < 24:
        return 0.50
    elif age_hours < 48:
        return 0.30
    return 0.10


def _severity(event_type: str, sentiment_score: float) -> float:
    weight = EVENT_WEIGHTS.get(event_type, 0.5)
    return min(1.0, abs(sentiment_score) * weight)


def extract_features(headline: str, url: str, published_at: datetime) -> ArticleFeatures:
    sentiment = _sentiment(headline)
    event = _event_type(headline)
    cred = _credibility(url)
    novelty = _novelty(published_at)
    sev = _severity(event, sentiment)
    return ArticleFeatures(
        sentiment_score=sentiment,
        credibility_score=cred,
        novelty_score=novelty,
        severity=sev,
        event_type=event,
    )
