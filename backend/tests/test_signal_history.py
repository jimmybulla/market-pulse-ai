# backend/tests/test_signal_history.py
import pytest
from unittest.mock import MagicMock
from app.services.pipeline import _record_signal_history


def _make_hist_db(last_row=None):
    db = MagicMock()
    hist = MagicMock()
    hist.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[last_row] if last_row else []
    )
    db.table.return_value = hist
    return db, hist


def _signal_data(direction="bullish", confidence=0.72):
    return {
        "direction": direction,
        "confidence": confidence,
        "expected_move_low": 0.03,
        "expected_move_high": 0.07,
        "horizon_days": 5,
    }


def test_record_history_inserts_when_no_prior_row():
    db, hist = _make_hist_db(last_row=None)
    _record_signal_history(db, "stock-1", _signal_data(), 150.0, "sig-1")
    hist.insert.assert_called_once()
    inserted = hist.insert.call_args.args[0]
    assert inserted["direction"] == "bullish"
    assert inserted["price_at_signal"] == 150.0
    assert inserted["signal_id"] == "sig-1"


def test_record_history_inserts_on_direction_change():
    db, hist = _make_hist_db(last_row={"direction": "bearish", "confidence": 0.72})
    _record_signal_history(db, "stock-1", _signal_data(direction="bullish"), 150.0, None)
    hist.insert.assert_called_once()


def test_record_history_inserts_on_confidence_shift():
    db, hist = _make_hist_db(last_row={"direction": "bullish", "confidence": 0.65})
    # 0.72 - 0.65 = 0.07 >= 0.05 → should insert
    _record_signal_history(db, "stock-1", _signal_data(confidence=0.72), 150.0, None)
    hist.insert.assert_called_once()


def test_record_history_skips_when_unchanged():
    db, hist = _make_hist_db(last_row={"direction": "bullish", "confidence": 0.72})
    # same direction, |0.72 - 0.72| = 0.0 < 0.05 → skip
    _record_signal_history(db, "stock-1", _signal_data(confidence=0.72), 150.0, None)
    hist.insert.assert_not_called()


import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from app.services.pipeline import resolve_signal_outcomes


def _expired_row(direction="bullish", confidence=0.75, exp_low=0.03, exp_high=0.07,
                  price_at_signal=100.0, stock_id="stock-aapl"):
    """A signal_history row whose horizon_days=5 expired > 5 days ago."""
    created = (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
    return {
        "id": "hist-1",
        "stock_id": stock_id,
        "direction": direction,
        "confidence": confidence,
        "expected_move_low": exp_low,
        "expected_move_high": exp_high,
        "horizon_days": 5,
        "price_at_signal": price_at_signal,
        "created_at": created,
    }


def _pending_row():
    """A signal_history row whose horizon has NOT yet passed."""
    created = datetime.now(timezone.utc).isoformat()
    return {
        "id": "hist-2",
        "stock_id": "stock-aapl",
        "direction": "bullish",
        "confidence": 0.75,
        "expected_move_low": 0.03,
        "expected_move_high": 0.07,
        "horizon_days": 5,
        "price_at_signal": 100.0,
        "created_at": created,
    }


def _make_resolve_db(history_rows, stocks_data):
    db = MagicMock()
    hist = MagicMock()
    hist.select.return_value.is_.return_value.gte.return_value.execute.return_value = MagicMock(
        data=history_rows
    )
    stocks_tbl = MagicMock()
    stocks_tbl.select.return_value.execute.return_value = MagicMock(data=stocks_data)

    def side(t):
        if t == "signal_history":
            return hist
        if t == "stocks":
            return stocks_tbl
        return MagicMock()

    db.table.side_effect = side
    return db, hist


_STOCKS = [{"id": "stock-aapl", "ticker": "AAPL"}]


def test_resolve_marks_bullish_correct_when_move_meets_low():
    db, hist = _make_resolve_db([_expired_row(direction="bullish", exp_low=0.03, price_at_signal=100.0)], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 104.0  # +4% >= 3% → correct
        resolve_signal_outcomes(db)
    hist.update.assert_called_once()
    update_payload = hist.update.call_args.args[0]
    assert update_payload["was_correct"] is True
    assert update_payload["actual_move"] == pytest.approx(0.04, abs=1e-4)


def test_resolve_marks_bullish_incorrect_when_move_below_low():
    db, hist = _make_resolve_db([_expired_row(direction="bullish", exp_low=0.03, price_at_signal=100.0)], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 101.0  # +1% < 3% → incorrect
        resolve_signal_outcomes(db)
    update_payload = hist.update.call_args.args[0]
    assert update_payload["was_correct"] is False


def test_resolve_marks_bearish_correct_when_price_drops():
    db, hist = _make_resolve_db([_expired_row(direction="bearish", exp_low=0.03, price_at_signal=100.0)], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.fast_info.last_price = 96.0  # -4% <= -3% → correct
        resolve_signal_outcomes(db)
    update_payload = hist.update.call_args.args[0]
    assert update_payload["was_correct"] is True


def test_resolve_skips_rows_whose_horizon_has_not_passed():
    db, hist = _make_resolve_db([_pending_row()], _STOCKS)
    with patch("app.services.pipeline.yf.Ticker") as mock_ticker:
        resolve_signal_outcomes(db)
    hist.update.assert_not_called()
    mock_ticker.assert_not_called()
