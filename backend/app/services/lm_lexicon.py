# backend/app/services/lm_lexicon.py
"""
Loughran-McDonald (2011) financial sentiment lexicon.
Source: "When Is a Liability Not a Liability?" — public domain word lists.
"""
import re
from typing import Optional

# Subset of ~354 LM positive words most relevant to financial headlines
LM_POSITIVE = frozenset({
    "able", "abundance", "acclaimed", "achieve", "achievement", "acumen",
    "adequate", "advance", "advantage", "agile", "agree", "appealing",
    "asset", "attractive", "best", "booming", "breakthrough", "brilliant",
    "capable", "celebrate", "certain", "clean", "commitment", "competent",
    "competitive", "complete", "confident", "consistent", "creative",
    "decisive", "dedicated", "deliver", "dependable", "distinguished",
    "diverse", "dominant", "dynamic", "effective", "efficient", "elite",
    "enhance", "excellent", "exceptional", "exciting", "expand", "expert",
    "extraordinary", "fair", "favorable", "flexible", "flourish",
    "focused", "foremost", "forward", "gain", "gains", "good", "great",
    "grow", "growing", "growth", "guarantee", "highest", "honorable",
    "ideal", "improve", "improved", "improvement", "improves", "increase",
    "increased", "increases", "increasing", "innovative",
    "integrity", "leader", "leading", "legitimate", "lucrative", "momentum",
    "notable", "opportunity", "optimal", "outstanding", "outperform",
    "perfect", "positive", "premium", "proactive", "productive", "profit",
    "profitable", "profitability", "progress", "promising", "proper",
    "proven", "quality", "recover", "recovery", "reliable", "reputable",
    "resilient", "resolution", "restore", "robust", "secure", "solid",
    "stable", "strength", "strong", "success", "successful", "superior",
    "support", "surge", "sustainable", "transparent", "trust", "trusted",
    "upgrade", "upside", "valuable", "value", "victory", "well",
    "thriving", "beats", "beat", "outperformed", "record",
})

# Subset of ~2345 LM negative words most relevant to financial headlines
LM_NEGATIVE = frozenset({
    "abandon", "abrupt", "absence", "abuse", "accident", "accusations",
    "adverse", "against", "allegation", "allegations", "alleged",
    "ambiguity", "ambiguous", "amendment", "anomaly", "antitrust",
    "arbitrary", "arrest", "bankrupt", "bankruptcy", "barrier",
    "below", "bribe", "burden", "cancel", "catastrophe", "caution",
    "cease", "challenge", "charges", "close", "collapse", "complaint",
    "concern", "concerns", "conflict", "consequence", "constrain",
    "contagion", "contentious", "controversy", "correction", "costly",
    "crash", "crime", "criminal", "crisis", "critical", "cut",
    "damage", "danger", "decline", "default", "defect", "deficit",
    "delay", "delisted", "denial", "depress", "depressed", "difficulties",
    "difficulty", "disaster", "disclosure", "disruption", "dispute",
    "disrupt", "doubt", "downgrade", "downside", "drop",
    "embezzlement", "erosion", "exposure", "fail", "failed", "failing",
    "failure", "fall", "falling", "fallen", "false", "fine", "fines",
    "fired", "force", "forfeit", "fraud", "guilty", "halt", "harm",
    "headwind", "heavy", "illegal", "illiquid", "impair", "impairment",
    "inability", "inadequate", "indicted", "inefficient", "inflation",
    "insolvency", "instability", "insufficient", "investigation",
    "irregular", "issue", "lawsuit", "layoff", "layoffs", "liability",
    "liabilities", "liquidity", "litigation", "loophole", "loss",
    "losses", "lowered", "mismanagement", "miss", "missed", "misses",
    "misconduct", "negative", "nonperforming", "obstruction", "offence",
    "outflow", "overburdened", "overspend", "pain", "penalty",
    "plunge", "poor", "problem", "problems", "probe", "questioned",
    "recession", "reduce", "redundancy", "regulatory", "rejected",
    "resign", "resignation", "risk", "riskier", "risky", "scandal",
    "shortage", "shortfall", "shrink", "shutdown", "sink", "slump",
    "stagnant", "struggling", "substandard", "suffer", "suspend",
    "termination", "troubled", "turmoil", "uncertain", "uncertainty",
    "underfunded", "unethical", "unfair", "violation", "volatile",
    "volatility", "warn", "warning", "weak", "weakened", "weakness",
    "withdrawn",
})

_TOKEN_RE = re.compile(r"[a-z]+")


def lm_score(headline: str) -> Optional[float]:
    """
    Score a headline using the LM financial lexicon.

    Returns:
        float in [-1.0, 1.0] when at least one LM word is found.
        None when no LM words are found (signals: use VADER only).
    """
    if not headline:
        return None
    tokens = _TOKEN_RE.findall(headline.lower())
    pos = sum(1 for t in tokens if t in LM_POSITIVE)
    neg = sum(1 for t in tokens if t in LM_NEGATIVE)
    total = pos + neg
    if total == 0:
        return None
    raw = (pos - neg) / total
    return max(-1.0, min(1.0, raw))
