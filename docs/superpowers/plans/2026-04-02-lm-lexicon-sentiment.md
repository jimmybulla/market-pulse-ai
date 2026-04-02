# LM Lexicon Sentiment Blending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend the Loughran-McDonald financial lexicon with VADER to produce domain-accurate sentiment scores for financial headlines.

**Architecture:** A new pure module `lm_lexicon.py` holds the LM word lists and `lm_score()`. `features.py::_sentiment()` calls `lm_score()` and blends 70% LM + 30% VADER when LM keywords are found, or falls back to VADER-only when no LM words match.

**Tech Stack:** Python stdlib (`re`), `vaderSentiment` (already installed)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `backend/app/services/lm_lexicon.py` | LM word lists + `lm_score()` |
| Modify | `backend/app/services/features.py` (line 47–48) | Blend LM+VADER in `_sentiment()` |
| Create | `backend/tests/test_lm_lexicon.py` | Unit tests for `lm_score()` |
| Modify | `backend/tests/test_features.py` | Two new tests for blend and VADER-only paths |

---

## Task 1: Create `lm_lexicon.py` with word lists and `lm_score()`

**Files:**
- Create: `backend/app/services/lm_lexicon.py`
- Create: `backend/tests/test_lm_lexicon.py`

### Step 1.1: Write failing tests

Create `backend/tests/test_lm_lexicon.py`:

```python
# backend/tests/test_lm_lexicon.py
import pytest
from app.services.lm_lexicon import lm_score


def test_positive_financial_headline():
    # "profitable" and "gains" are in LM_POSITIVE
    score = lm_score("company reports profitable quarter with strong gains")
    assert score is not None
    assert score > 0


def test_negative_financial_headline():
    # "bankruptcy", "losses", "liabilities" are in LM_NEGATIVE
    score = lm_score("company faces bankruptcy amid mounting losses and liabilities")
    assert score is not None
    assert score < 0


def test_no_lm_words_returns_none():
    # generic words not in either LM list
    score = lm_score("the cat sat on the mat today")
    assert score is None


def test_empty_string_returns_none():
    score = lm_score("")
    assert score is None


def test_score_clamped_upper():
    # headline packed with positive LM words
    score = lm_score("profitable gains profitability improve improvement improves improved")
    assert score is not None
    assert score <= 1.0


def test_score_clamped_lower():
    # headline packed with negative LM words
    score = lm_score("bankruptcy losses liabilities lawsuit penalty default impairment")
    assert score is not None
    assert score >= -1.0


def test_score_range():
    score = lm_score("earnings beat expectations with record profit")
    if score is not None:
        assert -1.0 <= score <= 1.0
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd backend && python -m pytest tests/test_lm_lexicon.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.services.lm_lexicon'`

- [ ] **Step 1.3: Create `lm_lexicon.py`**

Create `backend/app/services/lm_lexicon.py`:

```python
# backend/app/services/lm_lexicon.py
"""
Loughran-McDonald (2011) financial sentiment lexicon.
Source: "When Is a Liability Not a Liability?" — public domain word lists.
"""
import re

# Subset of ~354 LM positive words most relevant to financial headlines
LM_POSITIVE: frozenset[str] = frozenset({
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
    "increased", "increases", "increasing", "industry-leading", "innovative",
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
LM_NEGATIVE: frozenset[str] = frozenset({
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
    "disrupt", "doubt", "downgrade", "downside", "drop", "earnings-miss",
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
    "withdrawn", "write-down", "writedown", "writeoff", "wrote-off",
})

_TOKEN_RE = re.compile(r"[a-z]+")


def lm_score(headline: str) -> float | None:
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
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
cd backend && python -m pytest tests/test_lm_lexicon.py -v
```

Expected: all 7 tests PASS

- [ ] **Step 1.5: Commit**

```bash
cd backend && git add app/services/lm_lexicon.py tests/test_lm_lexicon.py
git commit -m "feat: add Loughran-McDonald lexicon with lm_score()"
```

---

## Task 2: Blend LM + VADER in `_sentiment()`

**Files:**
- Modify: `backend/app/services/features.py` (lines 1–12 and 47–48)
- Modify: `backend/tests/test_features.py` (append two tests)

- [ ] **Step 2.1: Write two failing tests**

Append to `backend/tests/test_features.py`:

```python
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
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
cd backend && python -m pytest tests/test_features.py::test_sentiment_uses_lm_blend_when_lm_words_found tests/test_features.py::test_sentiment_uses_vader_only_when_no_lm_words -v
```

Expected: both FAIL (current `_sentiment` doesn't call `lm_score`)

- [ ] **Step 2.3: Update `_sentiment()` in `features.py`**

Replace lines 1–12 (imports block) — add the `lm_score` import:

```python
# backend/app/services/features.py
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.services.lm_lexicon import lm_score
from app.services.scoring import ArticleFeatures
```

Then replace the `_sentiment` function (lines 47–48):

```python
def _sentiment(headline: str) -> float:
    vader_val = _analyzer.polarity_scores(headline)["compound"]
    lm = lm_score(headline)
    if lm is not None:
        return round(0.7 * lm + 0.3 * vader_val, 4)
    return round(vader_val, 4)
```

- [ ] **Step 2.4: Run the two new tests**

```bash
cd backend && python -m pytest tests/test_features.py::test_sentiment_uses_lm_blend_when_lm_words_found tests/test_features.py::test_sentiment_uses_vader_only_when_no_lm_words -v
```

Expected: both PASS

- [ ] **Step 2.5: Run the full test suite to confirm no regressions**

```bash
cd backend && python -m pytest -v
```

Expected: all existing tests PASS (the existing `test_sentiment_*` tests check `> 0`, `< 0`, range — the blend preserves these invariants for the same headlines)

- [ ] **Step 2.6: Commit**

```bash
cd backend && git add app/services/features.py tests/test_features.py
git commit -m "feat: blend LM lexicon 70/30 with VADER in _sentiment()"
```
