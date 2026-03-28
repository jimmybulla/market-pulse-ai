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
    assert update_payload["actual_move"] == pytest.approx(0.01, abs=1e-4)


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


def test_signal_history_returns_404_for_unknown_ticker(client):
    c, mock_db = client
    mock_db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
    response = c.get("/signals/history/FAKEXYZ")
    assert response.status_code == 404


def test_signal_history_returns_rows_for_known_ticker(client):
    c, mock_db = client

    stock_mock = MagicMock()
    stock_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "stock-aapl"}
    )

    history_mock = MagicMock()
    from datetime import datetime, timezone
    history_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "hist-1",
            "direction": "bullish",
            "confidence": 0.75,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "horizon_days": 5,
            "price_at_signal": 150.0,
            "actual_move": None,
            "was_correct": None,
            "accuracy_notes": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }]
    )

    def side(t):
        if t == "stocks":
            return stock_mock
        if t == "signal_history":
            return history_mock
        return MagicMock()

    mock_db.table.side_effect = side

    response = c.get("/signals/history/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["direction"] == "bullish"


def test_backtesting_returns_zeros_when_no_resolved_signals(client):
    c, mock_db = client
    mock_db.table.return_value.select.return_value.neq.return_value.execute.return_value = MagicMock(data=[])
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    data = response.json()
    assert data["total_resolved"] == 0
    assert data["overall_hit_rate"] == 0.0


def test_backtesting_computes_hit_rate_correctly(client):
    c, mock_db = client
    rows = [
        {"direction": "bullish", "confidence": 0.82, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": 0.05, "was_correct": True},
        {"direction": "bullish", "confidence": 0.75, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": 0.01, "was_correct": False},
        {"direction": "bearish", "confidence": 0.65, "expected_move_low": 0.03,
         "expected_move_high": 0.07, "actual_move": -0.04, "was_correct": True},
    ]
    mock_db.table.return_value.select.return_value.neq.return_value.execute.return_value = MagicMock(data=rows)
    response = c.get("/analytics/backtesting")
    assert response.status_code == 200
    data = response.json()
    assert data["total_resolved"] == 3
    assert data["overall_hit_rate"] == pytest.approx(2 / 3, abs=0.001)
    assert "bullish" in data["by_direction"]
    assert data["by_direction"]["bullish"]["total"] == 2
    assert "high" in data["by_confidence_tier"]   # confidence 0.82 → high
    assert "medium" in data["by_confidence_tier"]  # 0.75, 0.65 → medium
