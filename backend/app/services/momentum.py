# backend/app/services/momentum.py
import logging
import math
import yfinance as yf

logger = logging.getLogger(__name__)


def get_momentum(ticker: str) -> float:
    """
    Return the 5-day price momentum for a ticker as a float clamped to [-1.0, 1.0].
    Returns 0.0 on any error (neutral — never breaks signal scoring).
    """
    try:
        hist = yf.Ticker(ticker).history(period="5d")
        if hist.empty or len(hist) < 2:
            return 0.0
        first_close = float(hist["Close"].iloc[0])
        last_close = float(hist["Close"].iloc[-1])
        if first_close == 0.0 or math.isnan(first_close) or math.isnan(last_close):
            return 0.0
        change = (last_close - first_close) / first_close
        return max(-1.0, min(1.0, change))
    except Exception as exc:
        logger.warning("[momentum] Failed to fetch momentum for %s: %s", ticker, exc)
        return 0.0
