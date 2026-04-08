# backend/app/services/explainer.py
import logging
from typing import Optional
from anthropic import Anthropic
from app.config import settings

logger = logging.getLogger(__name__)


def generate_explanation(
    ticker: str,
    direction: str,
    confidence: float,
    drivers: list[str],
    headlines: list[str],
) -> Optional[str]:
    """
    Call Claude to generate a 2-3 sentence plain-English explanation of a signal.
    Returns None if the API key is missing or the call fails.
    Never raises — safe to call from pipeline without try/except.
    """
    if not settings.anthropic_api_key:
        logger.warning("[explainer] ANTHROPIC_API_KEY not set — skipping explanation for %s", ticker)
        return None

    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        direction_label = direction.replace("_", " ")
        confidence_pct = f"{confidence * 100:.0f}%"
        drivers_str = "\n".join(f"- {d}" for d in drivers) if drivers else "- No specific drivers identified"
        headlines_str = "\n".join(f"- {h}" for h in headlines[:5]) if headlines else "- No headlines available"

        prompt = (
            f"You are a financial analyst writing a brief signal explanation for a retail investor.\n\n"
            f"Stock: {ticker}\n"
            f"Signal: {direction_label} ({confidence_pct} confidence)\n"
            f"Key drivers:\n{drivers_str}\n\n"
            f"Recent headlines driving this signal:\n{headlines_str}\n\n"
            f"Write 2-3 sentences explaining why this signal was generated. "
            f"Be specific — reference the actual drivers and news. "
            f"Write for a retail investor, no jargon. "
            f"Plain prose only, no bullet points, no markdown."
        )

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as exc:
        logger.warning("[explainer] Failed to generate explanation for %s: %s", ticker, exc)
        return None


def generate_verdict(signal: dict) -> Optional[str]:
    """
    Generate a plain-English verdict for a resolved signal.
    Successes: 2 sentences. Failures: 3-4 sentences explaining the miss.
    Returns None if API key is missing or call fails.
    """
    if not settings.anthropic_api_key:
        logger.warning("[explainer] ANTHROPIC_API_KEY not set — skipping verdict for %s", signal.get("ticker"))
        return None
    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        ticker = signal.get("ticker", "")
        direction = signal.get("direction", "").replace("_", " ")
        actual_move = signal.get("actual_move")
        actual_pct = f"{actual_move * 100:.1f}%" if actual_move is not None else "unknown"
        exp_low = (signal.get("expected_move_low") or 0) * 100
        exp_high = (signal.get("expected_move_high") or 0) * 100
        was_correct = signal.get("was_correct")
        drivers = signal.get("drivers") or []
        accuracy_notes = signal.get("accuracy_notes") or ""

        if was_correct:
            prompt = (
                f"Stock: {ticker}\n"
                f"Signal: {direction} (expected +{exp_low:.0f}%–{exp_high:.0f}%)\n"
                f"Actual move: {actual_pct}\n"
                f"Key drivers: {', '.join(drivers) if drivers else 'none'}\n\n"
                f"Write 2 sentences explaining why this signal worked. "
                f"Reference the actual move and the drivers. Plain prose, no bullet points, no markdown."
            )
        else:
            prompt = (
                f"Stock: {ticker}\n"
                f"Signal: {direction} (expected +{exp_low:.0f}%–{exp_high:.0f}%)\n"
                f"Actual move: {actual_pct}\n"
                f"Key drivers at signal time: {', '.join(drivers) if drivers else 'none'}\n"
                f"Notes: {accuracy_notes}\n\n"
                f"Write 3-4 sentences explaining why this signal failed. "
                f"Be specific — what actually happened? What overrode the {direction} thesis? "
                f"Consider macro shifts, news reversals, sector rotation, earnings surprise, rate changes. "
                f"Plain prose, no bullet points, no markdown."
            )

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as exc:
        logger.warning("[explainer] Failed to generate verdict for %s: %s", signal.get("ticker"), exc)
        return None
