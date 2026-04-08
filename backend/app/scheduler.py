# backend/app/scheduler.py
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()


def configure_scheduler(run_pipeline_fn) -> None:
    """Wire run_pipeline into the scheduler. Called once from lifespan."""
    scheduler.add_job(
        run_pipeline_fn,
        "interval",
        minutes=60,
        next_run_time=datetime.now(timezone.utc),  # run immediately on startup
        id="market_pipeline",
        max_instances=1,               # prevent overlapping runs
        coalesce=True,                 # skip missed runs if server was down
    )
