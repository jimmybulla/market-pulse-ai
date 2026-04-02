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
