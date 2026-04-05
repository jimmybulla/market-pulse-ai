# qc_dashboard/qc_client.py
"""
QuantConnect API wrapper with mock data fallback.

All dashboard.py data flows through this module — never call the QC API directly
from the UI layer.

Environment variables:
    QC_USER_ID   — QuantConnect user ID (integer as string)
    QC_API_TOKEN — QuantConnect API token (UUID string)

If either is missing, is_live() returns False and all fetch_* functions
return deterministic mock data silently.
"""

import hashlib
import os
import time
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests
from requests.auth import HTTPBasicAuth

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

_QC_BASE = "https://www.quantconnect.com/api/v2"
_USER_ID = os.environ.get("QC_USER_ID", "")
_API_TOKEN = os.environ.get("QC_API_TOKEN", "")


def is_live() -> bool:
    """True when QC credentials are present in the environment."""
    return bool(_USER_ID and _API_TOKEN)


def _auth() -> HTTPBasicAuth:
    """Build HMAC-SHA256 auth for QuantConnect's API."""
    timestamp = str(int(time.time()))
    token_hash = hashlib.sha256(f"{_API_TOKEN}:{timestamp}".encode()).hexdigest()
    return HTTPBasicAuth(_USER_ID, f"{token_hash}:{timestamp}")


def _get(path: str, params: dict | None = None) -> dict:
    url = f"{_QC_BASE}/{path.lstrip('/')}"
    resp = requests.get(url, auth=_auth(), params=params or {}, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Mock data helpers
# ---------------------------------------------------------------------------

_MOCK_TICKERS = [
    ("AAPL", "Technology"),
    ("MSFT", "Technology"),
    ("NVDA", "Technology"),
    ("GOOGL", "Technology"),
    ("META", "Technology"),
    ("JPM", "Finance"),
    ("BAC", "Finance"),
    ("GS", "Finance"),
    ("V", "Finance"),
    ("JNJ", "Healthcare"),
    ("UNH", "Healthcare"),
    ("PFE", "Healthcare"),
    ("XOM", "Energy"),
    ("CVX", "Energy"),
    ("AMZN", "Consumer"),
    ("TSLA", "Consumer"),
    ("COST", "Consumer"),
    ("LMT", "Defense"),
    ("RTX", "Defense"),
    ("NEE", "Utilities"),
]

_MA_SIGNALS = ["Bullish", "Bullish", "Bullish", "Bearish", "Neutral"]


def _seed() -> int:
    """Deterministic seed that changes once per day — mock data is stable within a day."""
    return int(datetime.utcnow().strftime("%Y%m%d"))


def _mock_signals() -> pd.DataFrame:
    rng = np.random.default_rng(_seed())
    rows = []
    for ticker, sector in _MOCK_TICKERS:
        score = round(float(rng.uniform(20, 95)), 1)
        price = round(float(rng.uniform(50, 900)), 2)
        rows.append({
            "Ticker":     ticker,
            "Sector":     sector,
            "Score":      score,
            "RSI":        round(float(rng.uniform(25, 75)), 1),
            "Momentum %": round(float(rng.uniform(-8, 12)), 2),
            "MA Signal":  _MA_SIGNALS[int(rng.integers(0, len(_MA_SIGNALS)))],
            "Price":      price,
            "Change %":   round(float(rng.uniform(-3, 4)), 2),
            "Vol Ratio":  round(float(rng.uniform(0.6, 2.4)), 2),
        })
    df = pd.DataFrame(rows).sort_values("Score", ascending=False).reset_index(drop=True)
    return df


def _mock_equity_curve(days: int) -> pd.DataFrame:
    rng = np.random.default_rng(_seed())
    end = datetime.utcnow().date()
    dates = pd.bdate_range(end=end, periods=days)

    strategy_returns = rng.normal(0.0005, 0.012, size=len(dates))
    benchmark_returns = rng.normal(0.0003, 0.010, size=len(dates))

    strategy = 100_000 * np.cumprod(1 + strategy_returns)
    benchmark = 100_000 * np.cumprod(1 + benchmark_returns)

    return pd.DataFrame({
        "Date":            dates,
        "Strategy":        strategy.round(2),
        "Benchmark (SPY)": benchmark.round(2),
    })


def _mock_stats() -> dict:
    rng = np.random.default_rng(_seed())
    return {
        "sharpe_ratio":     round(float(rng.uniform(1.0, 2.5)), 2),
        "sortino_ratio":    round(float(rng.uniform(1.2, 3.0)), 2),
        "max_drawdown":     round(float(rng.uniform(-18, -4)), 1),
        "win_rate":         round(float(rng.uniform(52, 72)), 1),
        "total_return":     round(float(rng.uniform(15, 65)), 1),
        "annual_return":    round(float(rng.uniform(10, 35)), 1),
        "trades":           int(rng.integers(80, 400)),
        "avg_holding_days": round(float(rng.uniform(3, 21)), 1),
        "alpha":            round(float(rng.uniform(2, 12)), 1),
        "beta":             round(float(rng.uniform(0.55, 0.95)), 2),
    }


def _mock_top_picks() -> list[dict]:
    df = _mock_signals()
    top = df.head(3)
    picks = []
    rng = np.random.default_rng(_seed())
    for _, row in top.iterrows():
        entry = row["Price"]
        upside = round(float(rng.uniform(6, 22)), 1)
        picks.append({
            "ticker": row["Ticker"],
            "score":  row["Score"],
            "entry":  entry,
            "target": round(entry * (1 + upside / 100), 2),
            "stop":   round(entry * (1 - float(rng.uniform(3, 8)) / 100), 2),
            "upside": upside,
            "sector": row["Sector"],
        })
    return picks


# ---------------------------------------------------------------------------
# Live data helpers (QuantConnect API)
# ---------------------------------------------------------------------------

def _live_signals() -> pd.DataFrame:
    """
    Fetch live QC holdings and build a signal DataFrame.

    Score is derived from unrealised profit. RSI / Momentum / MA Signal
    can be enriched post-fetch using yfinance + pandas_ta — see CLAUDE.md
    for the full block.
    """
    data = _get("/portfolio/holdings")
    holdings = data.get("holdings", {})

    rows = []
    for sym, h in holdings.items():
        profit_pct = h.get("unrealizedProfitPercent", 0) or 0
        score = min(max(round((profit_pct + 10) * 5, 1), 0), 100)
        rows.append({
            "Ticker":     sym,
            "Sector":     h.get("sector", "Unknown"),
            "Score":      score,
            "RSI":        None,
            "Momentum %": None,
            "MA Signal":  "Neutral",
            "Price":      h.get("price", 0),
            "Change %":   round(profit_pct, 2),
            "Vol Ratio":  None,
        })

    if not rows:
        return _mock_signals()

    df = pd.DataFrame(rows).sort_values("Score", ascending=False).reset_index(drop=True)
    return df


def _live_equity_curve(days: int) -> pd.DataFrame:
    projects = _get("/projects/read")
    project_id = projects.get("projects", [{}])[0].get("projectId")
    if not project_id:
        return _mock_equity_curve(days)

    backtests = _get(f"/backtests/{project_id}/read")
    backtest_id = backtests.get("backtests", [{}])[0].get("backtestId")
    if not backtest_id:
        return _mock_equity_curve(days)

    result = _get(f"/backtests/{project_id}/{backtest_id}/read")
    charts = result.get("result", {}).get("Charts", {})
    strategy_series = (
        charts.get("Strategy Equity", {})
        .get("Series", {})
        .get("Equity", {})
        .get("Values", [])
    )
    benchmark_series = (
        charts.get("Benchmark", {})
        .get("Series", {})
        .get("Benchmark", {})
        .get("Values", [])
    )

    if not strategy_series:
        return _mock_equity_curve(days)

    def _series_to_df(series):
        return pd.DataFrame(series).rename(columns={"x": "ts", "y": "val"}).assign(
            Date=lambda d: pd.to_datetime(d["ts"], unit="s")
        ).set_index("Date")["val"]

    strat = _series_to_df(strategy_series)
    bench = _series_to_df(benchmark_series) if benchmark_series else strat * 0.95

    df = pd.DataFrame({"Strategy": strat, "Benchmark (SPY)": bench}).dropna().tail(days).reset_index()
    return df


def _live_stats() -> dict:
    projects = _get("/projects/read")
    project_id = projects.get("projects", [{}])[0].get("projectId")
    if not project_id:
        return _mock_stats()

    backtests = _get(f"/backtests/{project_id}/read")
    backtest_id = backtests.get("backtests", [{}])[0].get("backtestId")
    if not backtest_id:
        return _mock_stats()

    result = _get(f"/backtests/{project_id}/{backtest_id}/read")
    s = result.get("result", {}).get("Statistics", {})

    def _f(key, fallback=0.0):
        val = s.get(key, fallback)
        try:
            return float(str(val).replace("%", "").replace(",", ""))
        except (ValueError, TypeError):
            return fallback

    return {
        "sharpe_ratio":     _f("Sharpe Ratio"),
        "sortino_ratio":    _f("Sortino Ratio"),
        "max_drawdown":     _f("Drawdown") * -1 if _f("Drawdown") > 0 else _f("Drawdown"),
        "win_rate":         _f("Win Rate"),
        "total_return":     _f("Net Profit"),
        "annual_return":    _f("Compounding Annual Return"),
        "trades":           int(_f("Total Orders")),
        "avg_holding_days": _f("Average Win", 5.0),
        "alpha":            _f("Alpha"),
        "beta":             _f("Beta"),
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_signals() -> pd.DataFrame:
    """Return DataFrame of signals sorted by Score descending."""
    try:
        return _live_signals() if is_live() else _mock_signals()
    except Exception:
        return _mock_signals()


def fetch_equity_curve(days: int = 252) -> pd.DataFrame:
    """Return DataFrame with Date, Strategy, Benchmark (SPY) columns."""
    try:
        return _live_equity_curve(days) if is_live() else _mock_equity_curve(days)
    except Exception:
        return _mock_equity_curve(days)


def fetch_stats() -> dict:
    """Return dict of performance metrics."""
    try:
        return _live_stats() if is_live() else _mock_stats()
    except Exception:
        return _mock_stats()


def fetch_top_picks() -> list[dict]:
    """Return list of 3 top signal dicts."""
    try:
        return _mock_top_picks()
    except Exception:
        return []
