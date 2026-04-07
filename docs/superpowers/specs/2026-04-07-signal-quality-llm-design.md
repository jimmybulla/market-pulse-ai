# Signal Quality & LLM Explanations — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Goal

Improve signal quality on two fronts:
1. Smarter rule-based scoring (event weighting, price momentum, recency tuning)
2. Real LLM-generated explanations via Claude API, replacing the "AI analysis pending" placeholder

---

## Approach

Two new services (`explainer.py`, `momentum.py`) with targeted changes to `scoring.py`, `features.py`, and `pipeline.py`. No new tables, no schema migrations, no frontend changes.

---

## Section 1 — Scoring Improvements

### 1a. Event weight overhaul (`features.py`)

Current `EVENT_WEIGHTS` under-differentiates high-signal events from noise. New values:

| Event type  | Old weight | New weight |
|-------------|-----------|------------|
| earnings    | 1.0       | 1.5        |
| m&a         | 0.9       | 1.3        |
| regulation  | 1.0       | 1.2        |
| product     | 0.7       | 0.9        |
| executive   | 0.8       | 0.8        |
| macro       | 0.5       | 0.4        |

A genuine earnings beat signal becomes ~3× stronger relative to generic macro noise.

### 1b. Recency tuning (`features.py`)

Tighten the novelty decay so fresh articles dominate stale ones more aggressively:

| Age         | Old score | New score |
|-------------|-----------|-----------|
| < 1h        | 1.0 (was <2h) | 1.0   |
| 1h – 6h     | 0.85      | 0.85      |
| 6h – 12h    | 0.70      | 0.65      |
| 12h – 24h   | 0.50      | 0.40      |
| 24h – 48h   | 0.30      | 0.15      |
| > 48h       | 0.10      | 0.05      |

### 1c. Price momentum factor (`momentum.py` + `scoring.py`)

New `backend/app/services/momentum.py`:
- Fetches 5-day price change for a ticker using `yf.Ticker(ticker).fast_info.last_price` and a 5-day history call
- Returns a float clamped to [-1.0, 1.0] representing recent price trend
- Returns `0.0` on any error (neutral — never breaks scoring)

`score_articles()` gains an optional `momentum: float = 0.0` parameter. The momentum value is applied as a multiplier on `opportunity_score` for bullish signals and `crash_risk_score` for bearish/crash_risk signals:

```
adjusted_opportunity = opportunity_score * (1 + 0.3 * momentum)
```

A bullish signal on a stock already up 5% in 5 days gets a ~15% boost. A bullish signal on a stock down 5% gets a ~15% penalty. Momentum weight capped at 0.3 to keep news as the primary driver.

---

## Section 2 — LLM Explanations

### New service: `backend/app/services/explainer.py`

Uses `anthropic` Python SDK with model `claude-haiku-4-5-20251001` (fast, cheap).

**Function:**
```python
def generate_explanation(
    ticker: str,
    direction: str,
    confidence: float,
    drivers: list[str],
    headlines: list[str],  # top 5 article headlines driving the signal
) -> str | None
```

**Prompt design:** Instructs Claude to write 2-3 sentences explaining why the signal was generated, written for a retail investor. Includes the ticker, direction, confidence %, top drivers, and headline snippets as context. No markdown, no bullet points — plain prose only.

**Error handling:** Any exception (API error, timeout, rate limit) logs a warning and returns `None`. The caller never overwrites an existing explanation with `None`.

**Cost:** `claude-haiku-4-5` is ~$0.25/1M input tokens. A typical prompt is ~300 tokens. At 50 stocks with ~1 meaningful signal change per run = ~15K tokens/day ≈ $0.004/day.

### New env var

`ANTHROPIC_API_KEY` — added to Railway environment variables.

---

## Section 3 — Pipeline Wiring

Changes to `generate_signals()` in `pipeline.py`:

### Before scoring (per stock)
```python
from app.services.momentum import get_momentum
momentum = get_momentum(stock["ticker"])  # float, defaults to 0.0 on error
result = score_articles(features, momentum=momentum)
```

### After signal upsert (per stock, only if signal changed)

The existing change detection logic (direction flip or confidence shift ≥5%) already gates `_record_signal_history`. Reuse this check to also gate the explanation call:

```python
signal_changed = (
    not existing
    or prev["direction"] != result.direction
    or abs(prev["confidence"] - result.confidence) >= 0.05
)

if signal_changed:
    headlines = [r["headline"] for r in article_rows[:5]]
    explanation = generate_explanation(
        ticker=stock["ticker"],
        direction=result.direction,
        confidence=result.confidence,
        drivers=result.drivers,
        headlines=headlines,
    )
    if explanation:
        signal_data["explanation"] = explanation
```

`article_rows` already exists at this point in the function — no extra DB query needed.

---

## Files Changed

| File | Action |
|------|--------|
| `backend/app/services/momentum.py` | Create |
| `backend/app/services/explainer.py` | Create |
| `backend/app/services/features.py` | Modify — event weights + recency decay |
| `backend/app/services/scoring.py` | Modify — add `momentum` param to `score_articles` |
| `backend/app/services/pipeline.py` | Modify — wire momentum + explainer into `generate_signals` |
| `backend/app/config.py` | Modify — add `anthropic_api_key: str = ""` setting |
| `backend/requirements.txt` | Modify — add `anthropic` package |

No frontend changes. No database migrations.

---

## Testing

- Unit tests for `momentum.py` (mock yfinance, verify clamping and error fallback)
- Unit tests for `explainer.py` (mock anthropic client, verify None-safety)
- Unit tests for updated `score_articles()` (verify momentum adjusts scores correctly)
- Update existing `features.py` tests to match new weight/decay values
