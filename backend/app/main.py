# backend/app/main.py
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import signals, stocks, news, analytics, admin, charts
from app.scheduler import scheduler, configure_scheduler
from app.database import get_db
from app.services.pipeline import run_pipeline

logger = logging.getLogger(__name__)


def _pipeline_runner():
    """Sync wrapper: get a DB client and run the pipeline."""
    try:
        db = get_db()
        run_pipeline(db)
    except Exception as exc:
        logger.error("[scheduler] Pipeline run failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_scheduler(_pipeline_runner)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Market Pulse AI API",
    version="0.1.0",
    description="AI-powered market intelligence and prediction engine — MVP",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signals.router, prefix="/signals", tags=["signals"])
app.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
app.include_router(news.router, prefix="/news", tags=["news"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(charts.router, prefix="/stocks", tags=["charts"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "0.1.0"}
