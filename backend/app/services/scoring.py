# backend/app/services/scoring.py
from dataclasses import dataclass, field
from typing import Optional

DRIVER_LABELS: dict[tuple[str, bool], str] = {
    ("earnings", True): "Strong earnings sentiment",
    ("earnings", False): "Earnings disappointment",
    ("regulation", True): "Favorable regulatory outcome",
    ("regulation", False): "Regulatory headwinds",
    ("m&a", True): "Positive M&A activity",
    ("m&a", False): "M&A uncertainty",
    ("product", True): "Strong product momentum",
    ("product", False): "Product concerns raised",
    ("executive", True): "Positive leadership news",
    ("executive", False): "Leadership instability",
    ("macro", True): "Favorable macro environment",
    ("macro", False): "Macro headwinds",
}


@dataclass
class ArticleFeatures:
    sentiment_score: float    # -1.0 to 1.0
    credibility_score: float  # 0.0 to 1.0
    novelty_score: float      # 0.0 to 1.0
    severity: float           # 0.0 to 1.0
    event_type: str           # earnings | regulation | m&a | product | executive | macro


@dataclass
class SignalResult:
    direction: str
    confidence: float
    expected_move_low: float
    expected_move_high: float
    opportunity_score: float
    crash_risk_score: float
    drivers: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)


def score_articles(articles: list[ArticleFeatures], momentum: float = 0.0) -> Optional[SignalResult]:
    """Score a list of articles for one stock. Returns None if below signal threshold.

    momentum: 5-day price trend clamped to [-1.0, 1.0]. Positive momentum boosts
    opportunity score; negative momentum boosts crash risk. Weight capped at 0.3
    so news remains the primary signal driver.
    """
    if not articles:
        return None

    positive = [a for a in articles if a.sentiment_score > 0]
    negative = [a for a in articles if a.sentiment_score <= 0]

    raw_opportunity = _weighted_score(positive, lambda a: a.credibility_score)
    raw_crash_risk = _weighted_score(negative, lambda a: a.severity)

    # Apply momentum: positive trend boosts opportunity, negative trend boosts crash risk
    opportunity_score = min(1.0, max(0.0, raw_opportunity * (1 + 0.3 * momentum)))
    crash_risk_score = min(1.0, max(0.0, raw_crash_risk * (1 - 0.3 * momentum)))

    if crash_risk_score > 0.75:
        direction, confidence = "crash_risk", crash_risk_score
    elif opportunity_score > 0.15 and crash_risk_score < 0.4:
        direction, confidence = "bullish", opportunity_score
    elif opportunity_score < 0.2 and crash_risk_score > 0.45:
        direction, confidence = "bearish", crash_risk_score
    else:
        return None

    low, high = _move_range(confidence)

    return SignalResult(
        direction=direction,
        confidence=round(confidence, 4),
        expected_move_low=round(low, 4),
        expected_move_high=round(high, 4),
        opportunity_score=round(opportunity_score, 4),
        crash_risk_score=round(crash_risk_score, 4),
        drivers=_extract_drivers(articles),
        risk_flags=_risk_flags(opportunity_score, crash_risk_score, direction),
    )


def _weighted_score(articles: list[ArticleFeatures], weight_fn) -> float:
    if not articles:
        return 0.0
    total_weight = sum(weight_fn(a) for a in articles)
    if total_weight == 0:
        return 0.0
    return sum(
        (abs(a.sentiment_score) * a.credibility_score + a.severity * a.novelty_score) * weight_fn(a)
        for a in articles
    ) / total_weight


def _move_range(confidence: float) -> tuple[float, float]:
    if confidence >= 0.80:
        return confidence * 0.05, confidence * 0.10
    elif confidence >= 0.60:
        return confidence * 0.03, confidence * 0.08
    return confidence * 0.01, confidence * 0.06


def _extract_drivers(articles: list[ArticleFeatures]) -> list[str]:
    scored: list[tuple[float, str]] = []
    for a in articles:
        label = DRIVER_LABELS.get((a.event_type, a.sentiment_score > 0))
        if label:
            scored.append((abs(a.sentiment_score) * a.credibility_score, label))
    scored.sort(reverse=True)
    seen: set[str] = set()
    drivers: list[str] = []
    for _, label in scored:
        if label not in seen:
            seen.add(label)
            drivers.append(label)
        if len(drivers) == 3:
            break
    return drivers


def _risk_flags(opportunity: float, crash_risk: float, direction: str) -> list[str]:
    flags: list[str] = []
    if direction == "bullish" and opportunity > 0.65:
        flags.append("Overextended rally — high conviction")
    if direction == "bullish" and crash_risk > 0.20:
        flags.append("Elevated crash risk despite bullish signal")
    if direction == "bearish" and crash_risk > 0.70:
        flags.append("Near crash-risk territory")
    return flags
