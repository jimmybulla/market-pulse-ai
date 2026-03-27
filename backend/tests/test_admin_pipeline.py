# backend/tests/test_admin_pipeline.py
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _make_client():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    return client, db


def test_pipeline_run_returns_started():
    client, db = _make_client()
    with patch("app.routers.admin.run_pipeline") as mock_pipeline:
        resp = client.post("/admin/pipeline/run?secret=dev-secret")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    mock_pipeline.assert_called_once()


def test_pipeline_run_requires_secret():
    client, _ = _make_client()
    resp = client.post("/admin/pipeline/run?secret=wrong-secret")
    assert resp.status_code == 403


def test_pipeline_run_missing_secret():
    client, _ = _make_client()
    resp = client.post("/admin/pipeline/run")
    assert resp.status_code == 422
