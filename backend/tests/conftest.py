# backend/tests/conftest.py
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db


@pytest.fixture(autouse=True)
def clear_price_cache():
    """Clear the in-memory price cache between tests to avoid cross-test pollution."""
    from app.routers import charts
    charts._PRICE_CACHE.clear()
    yield
    charts._PRICE_CACHE.clear()


@pytest.fixture(autouse=True)
def no_scheduler(monkeypatch):
    """Prevent APScheduler from starting during tests."""
    from app import scheduler as sched_module
    monkeypatch.setattr("app.main.configure_scheduler", lambda fn: None)
    # Also prevent scheduler.start() from running
    monkeypatch.setattr(sched_module.scheduler, "start", lambda: None)
    monkeypatch.setattr(sched_module.scheduler, "shutdown", lambda **kwargs: None)


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.order.return_value.range.return_value.execute.return_value.count = 0
    db.table.return_value.select.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.execute.return_value.count = 0
    db.table.return_value.select.return_value.maybe_single.return_value.execute.return_value.data = None
    db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    with TestClient(app) as c:
        yield c, mock_db
    app.dependency_overrides.clear()
