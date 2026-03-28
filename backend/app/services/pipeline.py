# backend/app/services/pipeline.py
import logging
import time
from datetime import datetime, timezone, timedelta
from statistics import mean
from typing import Optional

import yfinance as yf
from supabase import Client

from app.services.features import extract_features
from app.services.ingestor import ingest_news
from app.services.push import send_push_notification
from app.services.scoring import ArticleFeatures, score_articles

logger = logging.getLogger(__name__)


def extract_features_for_articles(db: Client, articles: list[dict]) -> None:
    """Run VADER + keyword feature extraction on articles that lack sentiment."""
    for article in articles:
        try:
            published_at = datetime.fromisoformat(article["published_at"])
            features = extract_features(
                headline=article["headline"],
                url=article["url"],
                published_at=published_at,
            )
            db.table("news_articles").update({
                "sentiment_score":   features.sentiment_score,
                "event_type":        features.event_type,
                "credibility_score": features.credibility_score,
                "novelty_score":     features.novelty_score,
                "severity":          features.severity,
            }).eq("id", article["id"]).execute()
        except Exception as exc:
            logger.error(
                "[pipeline] ERROR: feature extraction failed for article %s — %s",
                article.get("id"),
                exc,
            )

    logger.info("[pipeline] Features extracted for %d articles", len(articles))


def generate_signals(db: Client) -> None:
    """Score articles per stock and upsert signals. Re-ranks all signals after."""
    stocks = db.table("stocks").select("id, ticker, last_price").execute().data or []
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()

    updated = 0
    unchanged = 0

    for stock in stocks:
        try:
            rows = (
                db.table("news_articles")
                .select("id, sentiment_score, credibility_score, novelty_score, severity, event_type, url")
                .gte("published_at", cutoff)
                .filter("tickers", "cs", f'{{{stock["ticker"]}}}')  # PostgreSQL array @> (contains)
                .neq("sentiment_score", "null")
                .execute()
                .data or []
            )

            features = [
                ArticleFeatures(
                    sentiment_score=r["sentiment_score"],
                    credibility_score=r["credibility_score"],
                    novelty_score=r["novelty_score"],
                    severity=r["severity"],
                    event_type=r["event_type"],
                )
                for r in rows
            ]

            result = score_articles(features)
            if result is None:
                unchanged += 1
                continue

            article_ids = [r["id"] for r in rows]
            credibilities = [r["credibility_score"] for r in rows]
            domains = list({r.get("url", "").split("/")[2] for r in rows if r.get("url")})

            evidence = {
                "article_count":   len(features),
                "avg_credibility": round(mean(credibilities), 4) if credibilities else 0.0,
                "sources":         domains,
                "article_ids":     article_ids,
            }
            # TODO: replace with real backtesting data (hit_rate and sample_size are MVP placeholders)
            historical_analog = {
                "avg_move":    round(result.expected_move_high * 0.9, 4),
                "hit_rate":    0.64,   # placeholder
                "sample_size": 15,     # placeholder
            }

            now = datetime.now(timezone.utc)
            signal_data = {
                "stock_id":           stock["id"],
                "direction":          result.direction,
                "confidence":         result.confidence,
                "expected_move_low":  result.expected_move_low,
                "expected_move_high": result.expected_move_high,
                "opportunity_score":  result.opportunity_score,
                "crash_risk_score":   result.crash_risk_score,
                "drivers":            result.drivers,
                "risk_flags":         result.risk_flags,
                "evidence":           evidence,
                "historical_analog":  historical_analog,
                "horizon_days":       5,
                "expires_at":         (now + timedelta(days=7)).isoformat(),
                "updated_at":         now.isoformat(),
            }

            existing = (
                db.table("signals")
                .select("id")
                .eq("stock_id", stock["id"])
                .execute()
                .data or []
            )

            if existing:
                db.table("signals").update(signal_data).eq("stock_id", stock["id"]).execute()
                signal_id = existing[0]["id"]
            else:
                signal_data["created_at"] = now.isoformat()
                insert_result = db.table("signals").insert(signal_data).execute()
                signal_id = insert_result.data[0]["id"] if insert_result.data else None

            try:
                _record_signal_history(
                    db,
                    stock["id"],
                    signal_data,
                    stock.get("last_price"),
                    signal_id,
                )
            except Exception as hist_exc:
                logger.error(
                    "[pipeline] ERROR: history recording failed for %s — %s",
                    stock.get("ticker"),
                    hist_exc,
                )

            updated += 1

        except Exception as exc:
            logger.error(
                "[pipeline] ERROR: signal generation failed for %s — %s",
                stock.get("ticker"),
                exc,
            )

    # Re-rank all signals by opportunity_score DESC
    try:
        all_signals = (
            db.table("signals")
            .select("id, opportunity_score")
            .order("opportunity_score", desc=True)
            .execute()
            .data or []
        )
        for rank, sig in enumerate(all_signals, start=1):
            db.table("signals").update({"rank": rank}).eq("id", sig["id"]).execute()
    except Exception as exc:
        logger.error("[pipeline] ERROR: re-ranking failed — %s", exc)

    logger.info(
        "[pipeline] Signals: %d updated, %d unchanged (below threshold)",
        updated,
        unchanged,
    )


def update_prices(db: Client) -> None:
    """Update last_price for all stocks from yfinance."""
    stocks = db.table("stocks").select("id, ticker").execute().data or []
    count = 0

    for stock in stocks:
        try:
            price = yf.Ticker(stock["ticker"]).fast_info.last_price
            if price is None:
                continue
            db.table("stocks").update({
                "last_price": price,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", stock["id"]).execute()
            count += 1
        except Exception as exc:
            logger.error(
                "[pipeline] ERROR: price update failed for %s — %s",
                stock.get("ticker"),
                exc,
            )

    logger.info("[pipeline] Prices: %d updated", count)


def _record_signal_history(
    db: Client,
    stock_id: str,
    signal_data: dict,
    last_price: Optional[float],
    signal_id: Optional[str],
) -> None:
    """Insert a signal_history snapshot if direction or confidence changed >= 5%."""
    last = (
        db.table("signal_history")
        .select("direction, confidence")
        .eq("stock_id", stock_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data or []
    )

    direction = signal_data["direction"]
    confidence = signal_data["confidence"]

    if last:
        prev = last[0]
        if prev["direction"] == direction and abs(prev["confidence"] - confidence) < 0.05:
            return  # no meaningful change

    db.table("signal_history").insert({
        "stock_id":           stock_id,
        "signal_id":          signal_id,
        "direction":          direction,
        "confidence":         confidence,
        "expected_move_low":  signal_data["expected_move_low"],
        "expected_move_high": signal_data["expected_move_high"],
        "horizon_days":       signal_data["horizon_days"],
        "price_at_signal":    last_price,
    }).execute()


def check_and_push_alerts(db: Client) -> None:
    """After a pipeline run, push notifications for high-confidence and crash-risk signals."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=31)).isoformat()

    subs = db.table("push_subscriptions").select("*").execute().data or []
    if not subs:
        return

    # Build stock_id → ticker map (signals table stores stock_id, not ticker)
    stocks = db.table("stocks").select("id, ticker").execute().data or []
    stock_ticker = {s["id"]: s["ticker"] for s in stocks}

    rows = (
        db.table("signals")
        .select(
            "stock_id, direction, confidence, crash_risk_score, "
            "expected_move_low, expected_move_high, horizon_days"
        )
        .gte("created_at", cutoff)
        .execute()
        .data or []
    )

    for row in rows:
        ticker = stock_ticker.get(row["stock_id"])
        if not ticker:
            continue

        crash_triggered = row["crash_risk_score"] >= 0.8
        conf_triggered = row["confidence"] >= 0.8

        if crash_triggered:
            title = f"\u26a0 {ticker} Crash Risk"
            body = f"Risk score: {row['crash_risk_score']:.2f} \u00b7 Take caution"
            url = f"/stock/{ticker}"
        elif conf_triggered:
            direction = row["direction"].replace("_", " ").title()
            pct = (
                f"+{row['expected_move_low'] * 100:.0f}%"
                f"\u2013{row['expected_move_high'] * 100:.0f}%"
            )
            title = f"{ticker} \u2192 {direction} ({row['confidence'] * 100:.0f}%)"
            body = f"Expected {pct} \u00b7 {row['horizon_days']} days"
            url = f"/stock/{ticker}"
        else:
            continue

        for sub in subs:
            subscription = {
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            }
            send_push_notification(subscription, title, body, url, db)

    logger.info("[pipeline] Alert check complete — %d signals evaluated", len(rows))


def run_pipeline(db: Client) -> None:
    """Run all four pipeline steps in sequence."""
    start = time.monotonic()

    stocks = db.table("stocks").select("id, ticker").execute().data or []
    tickers = [s["ticker"] for s in stocks]
    logger.info("[pipeline] Starting pipeline run — %d stocks", len(tickers))

    # Step 1: Ingest news
    new_article_ids = ingest_news(db, tickers)

    # Step 2: Extract features on new articles
    if new_article_ids:
        new_articles = (
            db.table("news_articles")
            .select("id, headline, url, published_at")
            .in_("id", new_article_ids)
            .execute()
            .data or []
        )
        extract_features_for_articles(db, new_articles)

    # Step 3: Generate signals
    generate_signals(db)

    # Step 4: Update prices
    update_prices(db)

    # Step 5: Push alerts for newly created high-confidence signals
    try:
        check_and_push_alerts(db)
    except Exception as exc:
        logger.error("[pipeline] Alert check failed: %s", exc)

    elapsed = time.monotonic() - start
    logger.info("[pipeline] Pipeline complete in %.1fs", elapsed)
