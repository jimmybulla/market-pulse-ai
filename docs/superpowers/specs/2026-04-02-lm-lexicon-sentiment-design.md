# Loughran-McDonald Financial Lexicon Sentiment Design

**Date:** 2026-04-02  
**Status:** Approved

---

## Problem

VADER was trained on social media text and underperforms on financial headlines. It misreads financial terminology — words like "liability", "loss", "risk" carry negative signal in finance but VADER scores them near-neutral. This leads to imprecise sentiment scores and weak opportunity/crash-risk signals on real news.

---

## Solution

Blend the Loughran-McDonald (LM) financial lexicon with VADER:

- When LM finds keyword matches in the headline → `0.7 × lm_score + 0.3 × vader_score`
- When no LM keywords found → VADER score only (unchanged behaviour)

This improves precision on financial terminology while preserving VADER's coverage on headlines with no LM vocabulary.

---

## Architecture

### New file: `backend/app/services/lm_lexicon.py`

- Two `frozenset[str]` constants: `LM_POSITIVE` (~354 words) and `LM_NEGATIVE` (~2,345 words) — both lowercase
- One public function: `lm_score(headline: str) -> float | None`
  - Lowercases and tokenises headline (split on non-alpha chars)
  - Counts hits against `LM_POSITIVE` and `LM_NEGATIVE`
  - Returns `None` when no LM words found (signals "no domain signal")
  - Returns `(pos - neg) / total_lm_words` clipped to `[-1.0, 1.0]` otherwise

Word lists are sourced from Loughran & McDonald (2011) "When Is a Liability Not a Liability?" — public domain word lists used in academic research.

---

### Modified: `backend/app/services/features.py` — `_sentiment()`

Current: returns `vader.polarity_scores(headline)["compound"]` directly.

Updated logic:
```
lm = lm_score(headline)
vader_val = vader.polarity_scores(headline)["compound"]
if lm is not None:
    return round(0.7 * lm + 0.3 * vader_val, 4)
return round(vader_val, 4)
```

No other changes to `features.py`.

---

## Data Flow

```
headline
   │
   ├─→ lm_score() ──→ None?  ──yes──→ VADER only
   │                    │
   │                    no
   │                    │
   └─→ VADER compound   ↓
              0.7 × lm + 0.3 × vader  →  sentiment_score
```

---

## Error Handling

- `lm_score` handles empty strings (returns `None`)
- No external calls, no I/O — pure function, cannot raise at runtime
- Existing `try/except` in `features.py` around sentiment scoring remains untouched

---

## Testing

### `backend/tests/test_lm_lexicon.py` (new)

| Test | Assertion |
|------|-----------|
| Positive headline ("company reported record earnings growth") | `lm_score() > 0` |
| Negative headline ("bankruptcy losses liabilities") | `lm_score() < 0` |
| No-match headline ("the cat sat on the mat") | `lm_score() is None` |
| Empty string | `lm_score("") is None` |
| Score clamped to [-1, 1] | Both edges |

### `backend/tests/test_features.py` (updated)

| Test | Assertion |
|------|-----------|
| Headline with LM matches → blend used | `sentiment_score` between -1 and 1; blended path exercised |
| Headline without LM matches → VADER-only | VADER score returned unchanged |

---

## Scope

- Only `lm_lexicon.py` (new) and `features.py` (`_sentiment` function) are touched
- No schema changes
- No API changes
- No frontend changes
- Scoring thresholds unchanged
