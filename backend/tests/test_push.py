# backend/tests/test_push.py
import json
from unittest.mock import MagicMock, patch

import pytest


def _sub(endpoint="https://fcm.example.com/test"):
    return {"endpoint": endpoint, "keys": {"p256dh": "key1", "auth": "auth1"}}


def test_send_push_notification_calls_webpush():
    from app.services.push import send_push_notification

    db = MagicMock()
    with patch("app.services.push.webpush") as mock_wp:
        send_push_notification(_sub(), "Title", "Body text", "/stock/AAPL", db)

    mock_wp.assert_called_once()
    kwargs = mock_wp.call_args.kwargs
    assert kwargs["subscription_info"] == _sub()
    payload = json.loads(kwargs["data"])
    assert payload["title"] == "Title"
    assert payload["body"] == "Body text"
    assert payload["url"] == "/stock/AAPL"


def test_send_push_notification_deletes_stale_sub_on_410():
    from pywebpush import WebPushException
    from app.services.push import send_push_notification

    db = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 410
    exc = WebPushException("Gone", response=mock_response)

    with patch("app.services.push.webpush", side_effect=exc):
        send_push_notification(_sub("https://fcm.example.com/stale"), "T", "B", "/", db)

    db.table.assert_called_with("push_subscriptions")
    db.table.return_value.delete.return_value.eq.assert_called_with(
        "endpoint", "https://fcm.example.com/stale"
    )
    db.table.return_value.delete.return_value.eq.return_value.execute.assert_called_once()


def test_send_push_notification_deletes_stale_sub_on_404():
    from pywebpush import WebPushException
    from app.services.push import send_push_notification

    db = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 404
    exc = WebPushException("Not Found", response=mock_response)

    with patch("app.services.push.webpush", side_effect=exc):
        send_push_notification(_sub(), "T", "B", "/", db)

    db.table.return_value.delete.return_value.eq.return_value.execute.assert_called_once()


def test_send_push_notification_does_not_raise_on_other_error():
    from app.services.push import send_push_notification

    db = MagicMock()
    with patch("app.services.push.webpush", side_effect=Exception("network timeout")):
        send_push_notification(_sub(), "T", "B", "/", db)  # must not raise


def test_send_push_notification_does_not_delete_on_non_stale_webpush_exception():
    from pywebpush import WebPushException
    from app.services.push import send_push_notification

    db = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 500
    exc = WebPushException("Server Error", response=mock_response)

    with patch("app.services.push.webpush", side_effect=exc):
        send_push_notification(_sub(), "T", "B", "/", db)

    db.table.return_value.delete.assert_not_called()
