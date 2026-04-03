# backend/tests/test_alerts.py
from unittest.mock import MagicMock, patch

try:
    from app.services.pipeline import check_and_push_alerts
except ImportError:
    check_and_push_alerts = None


def test_subscribe_returns_subscribed(client):
    c, mock_db = client
    response = c.post("/alerts/subscribe", json={
        "endpoint": "https://fcm.example.com/abc",
        "keys": {"p256dh": "key1", "auth": "auth1"},
    })
    assert response.status_code == 200
    assert response.json() == {"status": "subscribed"}


def test_subscribe_upserts_into_push_subscriptions(client):
    c, mock_db = client
    c.post("/alerts/subscribe", json={
        "endpoint": "https://fcm.example.com/abc",
        "keys": {"p256dh": "pkey", "auth": "akey"},
    })
    mock_db.table.assert_called_with("push_subscriptions")
    mock_db.table.return_value.upsert.assert_called_once_with(
        {"endpoint": "https://fcm.example.com/abc", "p256dh": "pkey", "auth": "akey"},
        on_conflict="endpoint",
    )


def test_unsubscribe_returns_unsubscribed(client):
    c, mock_db = client
    response = c.request("DELETE", "/alerts/unsubscribe", json={
        "endpoint": "https://fcm.example.com/abc",
    })
    assert response.status_code == 200
    assert response.json() == {"status": "unsubscribed"}


def test_unsubscribe_deletes_from_push_subscriptions(client):
    c, mock_db = client
    c.request("DELETE", "/alerts/unsubscribe", json={
        "endpoint": "https://fcm.example.com/abc",
    })
    mock_db.table.assert_called_with("push_subscriptions")
    mock_db.table.return_value.delete.return_value.eq.assert_called_with(
        "endpoint", "https://fcm.example.com/abc"
    )
    mock_db.table.return_value.delete.return_value.eq.return_value.execute.assert_called_once()


# --- check_and_push_alerts ---


def _make_db(signals_data, subs_data):
    """Return a MagicMock db that returns different data per table name.

    push_subscriptions: db.table(...).select("*").execute().data
    stocks:             db.table(...).select("id, ticker").execute().data
    signals:            db.table(...).select(...).gte(...).execute().data
    """
    db = MagicMock()

    signals_table = MagicMock()
    signals_table.select.return_value.gte.return_value.execute.return_value = MagicMock(
        data=signals_data
    )

    subs_table = MagicMock()
    subs_table.select.return_value.execute.return_value = MagicMock(data=subs_data)

    stocks_table = MagicMock()
    stocks_table.select.return_value.execute.return_value = MagicMock(data=[
        {"id": "stock-aapl", "ticker": "AAPL"},
        {"id": "stock-tsla", "ticker": "TSLA"},
        {"id": "stock-gme", "ticker": "GME"},
        {"id": "stock-nvda", "ticker": "NVDA"},
    ])

    def table_side_effect(t):
        if t == "signals":
            return signals_table
        if t == "stocks":
            return stocks_table
        return subs_table

    db.table.side_effect = table_side_effect
    return db


_SUB = [{"endpoint": "https://fcm.example.com/sub", "p256dh": "key1", "auth": "auth1"}]


def test_check_and_push_alerts_sends_for_high_confidence_signal():
    db = _make_db(
        signals_data=[{
            "stock_id": "stock-aapl",
            "direction": "bullish",
            "confidence": 0.85,
            "crash_risk_score": 0.3,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "horizon_days": 5,
        }],
        subs_data=_SUB,
    )
    with patch("app.services.pipeline.send_push_notification") as mock_push:
        check_and_push_alerts(db)
    mock_push.assert_called_once()
    title = mock_push.call_args.args[1]
    assert "AAPL" in title
    assert "Bullish" in title
    assert "85%" in title


def test_check_and_push_alerts_sends_crash_risk_notification():
    db = _make_db(
        signals_data=[{
            "stock_id": "stock-tsla",
            "direction": "crash_risk",
            "confidence": 0.82,
            "crash_risk_score": 0.88,
            "expected_move_low": 0.01,
            "expected_move_high": 0.02,
            "horizon_days": 5,
        }],
        subs_data=_SUB,
    )
    with patch("app.services.pipeline.send_push_notification") as mock_push:
        check_and_push_alerts(db)
    mock_push.assert_called_once()
    title = mock_push.call_args.args[1]
    assert "TSLA" in title
    assert "Crash Risk" in title


def test_check_and_push_alerts_crash_risk_takes_precedence_over_high_conf():
    """Signal with both crash_risk >= 0.8 AND confidence >= 0.8 sends only crash risk."""
    db = _make_db(
        signals_data=[{
            "stock_id": "stock-gme",
            "direction": "crash_risk",
            "confidence": 0.90,
            "crash_risk_score": 0.85,
            "expected_move_low": 0.01,
            "expected_move_high": 0.02,
            "horizon_days": 5,
        }],
        subs_data=_SUB,
    )
    with patch("app.services.pipeline.send_push_notification") as mock_push:
        check_and_push_alerts(db)
    mock_push.assert_called_once()
    assert "Crash Risk" in mock_push.call_args.args[1]
    assert "90%" not in mock_push.call_args.args[1]


def test_check_and_push_alerts_skips_below_threshold():
    db = _make_db(
        signals_data=[{
            "stock_id": "stock-aapl",
            "direction": "bullish",
            "confidence": 0.75,
            "crash_risk_score": 0.40,
            "expected_move_low": 0.02,
            "expected_move_high": 0.04,
            "horizon_days": 5,
        }],
        subs_data=_SUB,
    )
    with patch("app.services.pipeline.send_push_notification") as mock_push:
        check_and_push_alerts(db)
    mock_push.assert_not_called()


def test_check_and_push_alerts_skips_if_no_subscriptions():
    db = _make_db(
        signals_data=[{
            "stock_id": "stock-aapl",
            "direction": "bullish",
            "confidence": 0.90,
            "crash_risk_score": 0.3,
            "expected_move_low": 0.03,
            "expected_move_high": 0.07,
            "horizon_days": 5,
        }],
        subs_data=[],  # no subscribers
    )
    with patch("app.services.pipeline.send_push_notification") as mock_push:
        check_and_push_alerts(db)
    mock_push.assert_not_called()


def test_check_and_push_alerts_sends_to_all_subscriptions():
    subs = [
        {"endpoint": "https://fcm.example.com/sub1", "p256dh": "k1", "auth": "a1"},
        {"endpoint": "https://fcm.example.com/sub2", "p256dh": "k2", "auth": "a2"},
    ]
    db = _make_db(
        signals_data=[{
            "stock_id": "stock-nvda",
            "direction": "bullish",
            "confidence": 0.82,
            "crash_risk_score": 0.2,
            "expected_move_low": 0.04,
            "expected_move_high": 0.08,
            "horizon_days": 5,
        }],
        subs_data=subs,
    )
    with patch("app.services.pipeline.send_push_notification") as mock_push:
        check_and_push_alerts(db)
    assert mock_push.call_count == 2
