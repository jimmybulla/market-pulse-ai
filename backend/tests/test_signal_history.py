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
