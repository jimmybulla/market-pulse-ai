# backend/app/services/seed.py
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from supabase import Client

from app.services.scoring import ArticleFeatures, score_articles

SEED_DIR = Path(__file__).parent.parent / "seed_data"
_FAKE_UUID = "00000000-0000-0000-0000-000000000000"


def _clear_tables(db: Client) -> None:
    for table in ("signal_history", "signals", "events", "news_articles", "stocks", "sources"):
        db.table(table).delete().neq("id", _FAKE_UUID).execute()


def load_seed_data(db: Client) -> dict:
    _clear_tables(db)

    # 1. Sources
    sources_raw = json.loads((SEED_DIR / "sources.json").read_text())
    sources_result = db.table("sources").insert(sources_raw).execute()
    sources_by_name = {s["name"]: s["id"] for s in sources_result.data}

    # 2. Stocks
    stocks_raw = json.loads((SEED_DIR / "stocks.json").read_text())
    stocks_result = db.table("stocks").insert(stocks_raw).execute()
    stocks_by_ticker = {s["ticker"]: s["id"] for s in stocks_result.data}

    # 3. News articles — strip source_name, replace with source_id
    news_raw = json.loads((SEED_DIR / "news.json").read_text())
    articles_to_insert = []
    for article in news_raw:
        row = dict(article)
        source_name = row.pop("source_name")
        row["source_id"] = sources_by_name.get(source_name)
        articles_to_insert.append(row)

    articles_result = db.table("news_articles").insert(articles_to_insert).execute()
    articles_by_url = {a["url"]: a["id"] for a in articles_result.data}

    # 4. Group raw articles by ticker for scoring
    articles_by_ticker: dict[str, list[dict]] = {}
    for article in news_raw:
        for ticker in article["tickers"]:
            articles_by_ticker.setdefault(ticker, []).append(article)

    # 5. Score each stock and collect signals
    signals_to_insert = []
    for ticker, raw_articles in articles_by_ticker.items():
        stock_id = stocks_by_ticker.get(ticker)
        if not stock_id:
            continue

        features = [
            ArticleFeatures(
                sentiment_score=a["sentiment_score"],
                credibility_score=a["credibility_score"],
                novelty_score=a["novelty_score"],
                severity=a["severity"],
                event_type=a["event_type"],
            )
            for a in raw_articles
        ]

        result = score_articles(features)
        if result is None:
            continue

        horizon = 30 if result.direction == "bearish" else 5
        expires_at = (datetime.now(timezone.utc) + timedelta(days=horizon)).isoformat()

        signals_to_insert.append({
            "stock_id": stock_id,
            "direction": result.direction,
            "confidence": result.confidence,
            "expected_move_low": result.expected_move_low,
            "expected_move_high": result.expected_move_high,
            "horizon_days": horizon,
            "opportunity_score": result.opportunity_score,
            "crash_risk_score": result.crash_risk_score,
            "rank": 0,
            "explanation": "AI analysis pending",
            "drivers": result.drivers,
            "evidence": {
                "article_count": len(raw_articles),
                "sources": list({a["source_name"] for a in raw_articles}),
                "avg_credibility": round(
                    sum(a["credibility_score"] for a in raw_articles) / len(raw_articles), 2
                ),
                "article_ids": [articles_by_url.get(a.get("url", "")) for a in raw_articles],
            },
            "historical_analog": {
                "avg_move": round((result.expected_move_low + result.expected_move_high) / 2, 4),
                "hit_rate": 0.64,
                "sample_size": 15,
            },
            "risk_flags": result.risk_flags,
            "expires_at": expires_at,
        })

    # Sort by opportunity_score descending and assign ranks
    signals_to_insert.sort(key=lambda s: s["opportunity_score"], reverse=True)
    for i, signal in enumerate(signals_to_insert):
        signal["rank"] = i + 1

    if signals_to_insert:
        db.table("signals").insert(signals_to_insert).execute()

    return {
        "sources": len(sources_by_name),
        "stocks": len(stocks_by_ticker),
        "articles": len(articles_result.data),
        "signals": len(signals_to_insert),
    }
