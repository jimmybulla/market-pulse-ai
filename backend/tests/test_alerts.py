# backend/tests/test_alerts.py
from unittest.mock import MagicMock, patch


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
