# backend/tests/test_momentum.py
import pandas as pd
import pytest
from unittest.mock import patch
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
    hist = _make_hist([1.0, -1.0])  # change = (-1-1)/1 = -2.0, clamped to -1.0
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
