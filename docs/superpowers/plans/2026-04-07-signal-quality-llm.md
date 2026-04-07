# Signal Quality & LLM Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve signal quality with smarter event/recency scoring, price momentum factor, and real LLM-generated explanations via Claude API.

**Architecture:** Two new services (`momentum.py`, `explainer.py`), targeted changes to `features.py` and `scoring.py`, and wiring in `pipeline.py`. No schema migrations. No frontend changes — `signals.explanation` already exists and is already rendered.

**Tech Stack:** Python, FastAPI, yfinance, Anthropic Python SDK (`claude-haiku-4-5-20251001`), pytest + unittest.mock

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/requirements.txt` | Modify | Add `anthropic` package |
| `backend/app/config.py` | Modify | Add `anthropic_api_key` setting |
| `backend/app/services/momentum.py` | Create | Fetch 5-day price trend for a ticker via yfinance, return float [-1, 1] |
| `backend/app/services/explainer.py` | Create | Call Claude API to generate signal explanation prose |
| `backend/app/services/features.py` | Modify | Tighten event weights and recency decay |
| `backend/app/services/scoring.py` | Modify | Accept `momentum` param, apply to opportunity/crash scores |
| `backend/app/services/pipeline.py` | Modify | Wire momentum + explainer into `generate_signals()` |
| `backend/tests/test_momentum.py` | Create | Unit tests for momentum service |
| `backend/tests/test_explainer.py` | Create | Unit tests for explainer service |
| `backend/tests/test_features.py` | Modify | Update assertions to match new decay/weight values |
| `backend/tests/test_scoring.py` | Modify | Add momentum parameter tests |

---

## Task 1: Add `anthropic` dependency and config setting

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add anthropic to requirements.txt**

Open `backend/requirements.txt` and add this line at the end:

```
anthropic>=0.40.0
```

- [ ] **Step 2: Add `anthropic_api_key` to Settings**

Open `backend/app/config.py`. Add `anthropic_api_key` field to the `Settings` class:

Find:
```python
    newsapi_key: str = ""
```
Replace with:
```python
    newsapi_key: str = ""
    anthropic_api_key: str = ""
```

- [ ] **Step 3: Install the package**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
pip install anthropic>=0.40.0
```

Expected: `Successfully installed anthropic-...`

- [ ] **Step 4: Run existing tests to confirm nothing broke**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/ -q --tb=short 2>&1 | tail -5
```

Expected: all tests passing (same count as before).

---

## Task 2: Create `momentum.py` with tests (TDD)

**Files:**
- Create: `backend/tests/test_momentum.py`
- Create: `backend/app/services/momentum.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_momentum.py`:

```python
# backend/tests/test_momentum.py
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock
from app.services.momentum import get_momentum


def _make_hist(closes: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"Close": closes})


def test_positive_momentum():
    hist = _make_hist([100.0, 102.0, 104.0, 106.0, 108.0])
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = hist
        result = get_momentum("AAPL")
    assert result == pytest.approx(0.08, abs=0.001)


def test_negative_momentum():
    hist = _make_hist([100.0, 98.0, 96.0, 94.0, 92.0])
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = hist
        result = get_momentum("AAPL")
    assert result == pytest.approx(-0.08, abs=0.001)


def test_momentum_clamped_to_positive_one():
    hist = _make_hist([10.0, 20.0])
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = hist
        result = get_momentum("AAPL")
    assert result == 1.0


def test_momentum_clamped_to_negative_one():
    hist = _make_hist([20.0, 10.0])
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = hist
        result = get_momentum("AAPL")
    assert result == -1.0


def test_empty_history_returns_zero():
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = pd.DataFrame({"Close": []})
        result = get_momentum("AAPL")
    assert result == 0.0


def test_single_row_returns_zero():
    hist = _make_hist([100.0])
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = hist
        result = get_momentum("AAPL")
    assert result == 0.0


def test_exception_returns_zero():
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.side_effect = Exception("rate limited")
        result = get_momentum("AAPL")
    assert result == 0.0


def test_zero_first_close_returns_zero():
    hist = _make_hist([0.0, 100.0])
    with patch("app.services.momentum.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = hist
        result = get_momentum("AAPL")
    assert result == 0.0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_momentum.py -v 2>&1 | tail -15
```

Expected: 8 errors — `ModuleNotFoundError: No module named 'app.services.momentum'`

- [ ] **Step 3: Create `momentum.py`**

Create `backend/app/services/momentum.py`:

```python
# backend/app/services/momentum.py
import logging
import yfinance as yf

logger = logging.getLogger(__name__)


def get_momentum(ticker: str) -> float:
    """
    Return the 5-day price momentum for a ticker as a float clamped to [-1.0, 1.0].
    Returns 0.0 on any error (neutral — never breaks signal scoring).
    """
    try:
        hist = yf.Ticker(ticker).history(period="5d")
        if hist.empty or len(hist) < 2:
            return 0.0
        first_close = float(hist["Close"].iloc[0])
        last_close = float(hist["Close"].iloc[-1])
        if first_close == 0.0:
            return 0.0
        change = (last_close - first_close) / first_close
        return max(-1.0, min(1.0, change))
    except Exception as exc:
        logger.warning("[momentum] Failed to fetch momentum for %s: %s", ticker, exc)
        return 0.0
```

- [ ] **Step 4: Run tests to verify all 8 pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_momentum.py -v 2>&1 | tail -15
```

Expected: 8 passed.

---

## Task 3: Update `features.py` — event weights and recency decay

**Files:**
- Modify: `backend/app/services/features.py`
- Modify: `backend/tests/test_features.py`

- [ ] **Step 1: Update `EVENT_WEIGHTS` in `features.py`**

Open `backend/app/services/features.py`. Find and replace the `EVENT_WEIGHTS` dict:

Find:
```python
EVENT_WEIGHTS: dict[str, float] = {
    "earnings":   1.0,
    "regulation": 1.0,
    "m&a":        0.9,
    "executive":  0.8,
    "product":    0.7,
    "macro":      0.5,
}
```
Replace with:
```python
EVENT_WEIGHTS: dict[str, float] = {
    "earnings":   1.5,
    "m&a":        1.3,
    "regulation": 1.2,
    "product":    0.9,
    "executive":  0.8,
    "macro":      0.4,
}
```

- [ ] **Step 2: Update `_novelty` decay in `features.py`**

Find:
```python
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
```
Replace with:
```python
def _novelty(published_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    # ensure published_at is timezone-aware
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age_hours = (now - published_at).total_seconds() / 3600
    if age_hours < 1:
        return 1.0
    elif age_hours < 6:
        return 0.85
    elif age_hours < 12:
        return 0.65
    elif age_hours < 24:
        return 0.40
    elif age_hours < 48:
        return 0.15
    return 0.05
```

- [ ] **Step 3: Run tests to see which break**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_features.py -v 2>&1 | tail -25
```

Expected: several failures on novelty and severity tests.

- [ ] **Step 4: Update `test_features.py` to match new values**

Open `backend/tests/test_features.py`. Make these replacements:

**Replace `test_novelty_very_fresh`** — old threshold was <2h, now <1h, so use 30 minutes:
Find:
```python
def test_novelty_very_fresh():
    published = _now() - timedelta(hours=1)
    assert _novelty(published) == 1.0
```
Replace with:
```python
def test_novelty_very_fresh():
    published = _now() - timedelta(minutes=30)
    assert _novelty(published) == 1.0
```

**Replace `test_novelty_under_12h`**:
Find:
```python
def test_novelty_under_12h():
    published = _now() - timedelta(hours=8)
    assert _novelty(published) == 0.70
```
Replace with:
```python
def test_novelty_under_12h():
    published = _now() - timedelta(hours=8)
    assert _novelty(published) == 0.65
```

**Replace `test_novelty_under_24h`**:
Find:
```python
def test_novelty_under_24h():
    published = _now() - timedelta(hours=20)
    assert _novelty(published) == 0.50
```
Replace with:
```python
def test_novelty_under_24h():
    published = _now() - timedelta(hours=20)
    assert _novelty(published) == 0.40
```

**Replace `test_novelty_under_48h`**:
Find:
```python
def test_novelty_under_48h():
    published = _now() - timedelta(hours=36)
    assert _novelty(published) == 0.30
```
Replace with:
```python
def test_novelty_under_48h():
    published = _now() - timedelta(hours=36)
    assert _novelty(published) == 0.15
```

**Replace `test_novelty_old`**:
Find:
```python
def test_novelty_old():
    published = _now() - timedelta(hours=72)
    assert _novelty(published) == 0.10
```
Replace with:
```python
def test_novelty_old():
    published = _now() - timedelta(hours=72)
    assert _novelty(published) == 0.05
```

**Replace `test_severity_earnings_high_sentiment`** — earnings weight is now 1.5:
Find:
```python
def test_severity_earnings_high_sentiment():
    sev = _severity("earnings", 0.9)
    assert sev == pytest.approx(min(1.0, 0.9 * 1.0))
```
Replace with:
```python
def test_severity_earnings_high_sentiment():
    sev = _severity("earnings", 0.9)
    assert sev == pytest.approx(min(1.0, 0.9 * 1.5))
```

**Replace `test_severity_macro_low`** — macro weight is now 0.4:
Find:
```python
def test_severity_macro_low():
    sev = _severity("macro", 0.5)
    assert sev == pytest.approx(min(1.0, 0.5 * 0.5))
```
Replace with:
```python
def test_severity_macro_low():
    sev = _severity("macro", 0.5)
    assert sev == pytest.approx(min(1.0, 0.5 * 0.4))
```

- [ ] **Step 5: Run features tests to verify all pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_features.py -v 2>&1 | tail -25
```

Expected: all tests passing.

---

## Task 4: Update `scoring.py` — add momentum parameter

**Files:**
- Modify: `backend/app/services/scoring.py`
- Modify: `backend/tests/test_scoring.py`

- [ ] **Step 1: Write the new failing tests**

Open `backend/tests/test_scoring.py`. Add these tests at the bottom:

```python
def test_positive_momentum_boosts_bullish_opportunity():
    articles = [
        make_article(sentiment=0.60, credibility=0.75, novelty=0.70, severity=0.55),
    ]
    result_flat = score_articles(articles, momentum=0.0)
    result_up = score_articles(articles, momentum=0.5)
    assert result_flat is not None and result_up is not None
    assert result_up.opportunity_score > result_flat.opportunity_score


def test_negative_momentum_reduces_bullish_opportunity():
    articles = [
        make_article(sentiment=0.60, credibility=0.75, novelty=0.70, severity=0.55),
    ]
    result_flat = score_articles(articles, momentum=0.0)
    result_down = score_articles(articles, momentum=-0.5)
    assert result_flat is not None and result_down is not None
    assert result_down.opportunity_score < result_flat.opportunity_score


def test_momentum_scores_clamped_to_one():
    articles = [make_article(sentiment=0.99, credibility=0.99, novelty=0.99, severity=0.99)]
    result = score_articles(articles, momentum=1.0)
    assert result is not None
    assert result.opportunity_score <= 1.0
    assert result.crash_risk_score <= 1.0


def test_momentum_defaults_to_zero():
    articles = [make_article(sentiment=0.75)]
    result_default = score_articles(articles)
    result_explicit = score_articles(articles, momentum=0.0)
    assert result_default is not None and result_explicit is not None
    assert result_default.opportunity_score == result_explicit.opportunity_score
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_scoring.py::test_positive_momentum_boosts_bullish_opportunity tests/test_scoring.py::test_negative_momentum_reduces_bullish_opportunity tests/test_scoring.py::test_momentum_scores_clamped_to_one tests/test_scoring.py::test_momentum_defaults_to_zero -v 2>&1 | tail -15
```

Expected: 4 failures — `TypeError: score_articles() got an unexpected keyword argument 'momentum'`

- [ ] **Step 3: Update `score_articles` in `scoring.py`**

Open `backend/app/services/scoring.py`. Replace the `score_articles` function:

Find:
```python
def score_articles(articles: list[ArticleFeatures]) -> Optional[SignalResult]:
    """Score a list of articles for one stock. Returns None if below signal threshold."""
    if not articles:
        return None

    positive = [a for a in articles if a.sentiment_score > 0]
    negative = [a for a in articles if a.sentiment_score <= 0]

    opportunity_score = min(1.0, max(0.0, _weighted_score(positive, lambda a: a.credibility_score)))
    crash_risk_score = min(1.0, max(0.0, _weighted_score(negative, lambda a: a.severity)))

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
```
Replace with:
```python
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
```

- [ ] **Step 4: Run all scoring tests to verify they pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_scoring.py -v 2>&1 | tail -20
```

Expected: all tests passing (previous tests + 4 new ones).

---

## Task 5: Create `explainer.py` with tests (TDD)

**Files:**
- Create: `backend/tests/test_explainer.py`
- Create: `backend/app/services/explainer.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_explainer.py`:

```python
# backend/tests/test_explainer.py
import pytest
from unittest.mock import patch, MagicMock
from app.services.explainer import generate_explanation


def _mock_anthropic(text: str):
    """Return a mock anthropic client that yields `text` as the response."""
    mock_content = MagicMock()
    mock_content.text = text
    mock_message = MagicMock()
    mock_message.content = [mock_content]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    return mock_client


def test_returns_explanation_string():
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_anthropic_cls.return_value = _mock_anthropic("PFE is showing bullish momentum driven by strong earnings.")
        result = generate_explanation(
            ticker="PFE",
            direction="bullish",
            confidence=0.82,
            drivers=["Strong earnings sentiment"],
            headlines=["Pfizer beats Q1 earnings estimates"],
        )
    assert result == "PFE is showing bullish momentum driven by strong earnings."


def test_returns_none_when_api_key_missing():
    with patch("app.services.explainer.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        result = generate_explanation(
            ticker="AAPL",
            direction="bullish",
            confidence=0.75,
            drivers=["Strong earnings sentiment"],
            headlines=["Apple beats revenue expectations"],
        )
    assert result is None


def test_returns_none_on_api_exception():
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_anthropic_cls.return_value.messages.create.side_effect = Exception("API error")
        result = generate_explanation(
            ticker="TSLA",
            direction="bearish",
            confidence=0.65,
            drivers=["Macro headwinds"],
            headlines=["Tesla misses delivery targets"],
        )
    assert result is None


def test_strips_whitespace_from_response():
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_anthropic_cls.return_value = _mock_anthropic("  Explanation with whitespace.  ")
        result = generate_explanation(
            ticker="MSFT",
            direction="bullish",
            confidence=0.70,
            drivers=["Strong earnings sentiment"],
            headlines=["Microsoft cloud revenue up 20%"],
        )
    assert result == "Explanation with whitespace."


def test_uses_top_five_headlines_only():
    """Verify the API is called with at most 5 headlines."""
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_client = _mock_anthropic("Some explanation.")
        mock_anthropic_cls.return_value = mock_client
        generate_explanation(
            ticker="AAPL",
            direction="bullish",
            confidence=0.80,
            drivers=["Strong earnings sentiment"],
            headlines=[f"Headline {i}" for i in range(10)],
        )
    call_kwargs = mock_client.messages.create.call_args
    prompt = call_kwargs[1]["messages"][0]["content"]
    # Only headlines 0-4 should appear; headline 5+ should not
    assert "Headline 4" in prompt
    assert "Headline 5" not in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_explainer.py -v 2>&1 | tail -15
```

Expected: 5 errors — `ModuleNotFoundError: No module named 'app.services.explainer'`

- [ ] **Step 3: Create `explainer.py`**

Create `backend/app/services/explainer.py`:

```python
# backend/app/services/explainer.py
import logging
from anthropic import Anthropic
from app.config import settings

logger = logging.getLogger(__name__)


def generate_explanation(
    ticker: str,
    direction: str,
    confidence: float,
    drivers: list[str],
    headlines: list[str],
) -> str | None:
    """
    Call Claude to generate a 2-3 sentence plain-English explanation of a signal.
    Returns None if the API key is missing or the call fails.
    Never raises — safe to call from pipeline without try/except.
    """
    if not settings.anthropic_api_key:
        logger.warning("[explainer] ANTHROPIC_API_KEY not set — skipping explanation for %s", ticker)
        return None

    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        direction_label = direction.replace("_", " ")
        confidence_pct = f"{confidence * 100:.0f}%"
        drivers_str = "\n".join(f"- {d}" for d in drivers) if drivers else "- No specific drivers identified"
        headlines_str = "\n".join(f"- {h}" for h in headlines[:5]) if headlines else "- No headlines available"

        prompt = (
            f"You are a financial analyst writing a brief signal explanation for a retail investor.\n\n"
            f"Stock: {ticker}\n"
            f"Signal: {direction_label} ({confidence_pct} confidence)\n"
            f"Key drivers:\n{drivers_str}\n\n"
            f"Recent headlines driving this signal:\n{headlines_str}\n\n"
            f"Write 2-3 sentences explaining why this signal was generated. "
            f"Be specific — reference the actual drivers and news. "
            f"Write for a retail investor, no jargon. "
            f"Plain prose only, no bullet points, no markdown."
        )

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as exc:
        logger.warning("[explainer] Failed to generate explanation for %s: %s", ticker, exc)
        return None
```

- [ ] **Step 4: Run tests to verify all 5 pass**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/test_explainer.py -v 2>&1 | tail -15
```

Expected: 5 passed.

---

## Task 6: Wire momentum + explainer into `pipeline.py`

**Files:**
- Modify: `backend/app/services/pipeline.py`

- [ ] **Step 1: Add imports to `pipeline.py`**

Open `backend/app/services/pipeline.py`. Find the existing imports block:

Find:
```python
from app.services.features import extract_features
from app.services.ingestor import ingest_news
from app.services.newsapi_ingestor import ingest_newsapi
from app.services.push import send_push_notification
from app.services.scoring import ArticleFeatures, score_articles
```
Replace with:
```python
from app.services.explainer import generate_explanation
from app.services.features import extract_features
from app.services.ingestor import ingest_news
from app.services.momentum import get_momentum
from app.services.newsapi_ingestor import ingest_newsapi
from app.services.push import send_push_notification
from app.services.scoring import ArticleFeatures, score_articles
```

- [ ] **Step 2: Add `headline` to the article select query**

Inside `generate_signals()`, find the news_articles select:

Find:
```python
            rows = (
                db.table("news_articles")
                .select("id, sentiment_score, credibility_score, novelty_score, severity, event_type, url")
                .gte("published_at", cutoff)
                .filter("tickers", "cs", f'{{{stock["ticker"]}}}')  # PostgreSQL array @> (contains)
                .execute()
                .data or []
            )
```
Replace with:
```python
            rows = (
                db.table("news_articles")
                .select("id, headline, sentiment_score, credibility_score, novelty_score, severity, event_type, url")
                .gte("published_at", cutoff)
                .filter("tickers", "cs", f'{{{stock["ticker"]}}}')  # PostgreSQL array @> (contains)
                .execute()
                .data or []
            )
```

- [ ] **Step 3: Update `existing` select to include direction, confidence, explanation**

Inside `generate_signals()`, find:

Find:
```python
            existing = (
                db.table("signals")
                .select("id")
                .eq("stock_id", stock["id"])
                .execute()
                .data or []
            )
```
Replace with:
```python
            existing = (
                db.table("signals")
                .select("id, direction, confidence")
                .eq("stock_id", stock["id"])
                .execute()
                .data or []
            )
```

- [ ] **Step 4: Add momentum fetch and wire into `score_articles`**

Inside `generate_signals()`, find:

Find:
```python
            result = score_articles(features)
```
Replace with:
```python
            momentum = get_momentum(stock["ticker"])
            result = score_articles(features, momentum=momentum)
```

- [ ] **Step 5: Add signal change detection and explainer call**

Inside `generate_signals()`, find:

Find:
```python
            if existing:
                db.table("signals").update(signal_data).eq("stock_id", stock["id"]).execute()
                signal_id = existing[0]["id"]
            else:
                signal_data["created_at"] = now.isoformat()
                insert_result = db.table("signals").insert(signal_data).execute()
                signal_id = insert_result.data[0]["id"] if insert_result.data else None
```
Replace with:
```python
            signal_changed = (
                not existing
                or existing[0]["direction"] != result.direction
                or abs(existing[0]["confidence"] - result.confidence) >= 0.05
            )

            if signal_changed:
                headlines = [r["headline"] for r in rows if r.get("headline")][:5]
                explanation = generate_explanation(
                    ticker=stock["ticker"],
                    direction=result.direction,
                    confidence=result.confidence,
                    drivers=result.drivers,
                    headlines=headlines,
                )
                if explanation:
                    signal_data["explanation"] = explanation

            if existing:
                db.table("signals").update(signal_data).eq("stock_id", stock["id"]).execute()
                signal_id = existing[0]["id"]
            else:
                signal_data["created_at"] = now.isoformat()
                insert_result = db.table("signals").insert(signal_data).execute()
                signal_id = insert_result.data[0]["id"] if insert_result.data else None
```

- [ ] **Step 6: Run full backend test suite**

```bash
cd "/Users/chidoziejim/Documents/CLAUDE PROJECTS/Market Pulse AI/backend"
python -m pytest tests/ -q --tb=short 2>&1 | tail -10
```

Expected: all tests passing.

- [ ] **Step 7: Add `ANTHROPIC_API_KEY` to Railway**

In Railway → your backend service → Variables, add:
```
ANTHROPIC_API_KEY=<your Anthropic API key>
```

Then redeploy.
