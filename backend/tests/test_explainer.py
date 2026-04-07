# backend/tests/test_explainer.py
import pytest
from unittest.mock import patch, MagicMock
from app.services.explainer import generate_explanation


def _mock_anthropic(text: str):
    """Return a mock anthropic client that yields `text` as the response."""
    mock_content = MagicMock()
    mock_content.text = text
    mock_message = MagicMock()
    mock_message.content = [mock_content]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    return mock_client


def test_returns_explanation_string():
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_anthropic_cls.return_value = _mock_anthropic("PFE is showing bullish momentum driven by strong earnings.")
        result = generate_explanation(
            ticker="PFE",
            direction="bullish",
            confidence=0.82,
            drivers=["Strong earnings sentiment"],
            headlines=["Pfizer beats Q1 earnings estimates"],
        )
    assert result == "PFE is showing bullish momentum driven by strong earnings."


def test_returns_none_when_api_key_missing():
    with patch("app.services.explainer.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        result = generate_explanation(
            ticker="AAPL",
            direction="bullish",
            confidence=0.75,
            drivers=["Strong earnings sentiment"],
            headlines=["Apple beats revenue expectations"],
        )
    assert result is None


def test_returns_none_on_api_exception():
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_anthropic_cls.return_value.messages.create.side_effect = Exception("API error")
        result = generate_explanation(
            ticker="TSLA",
            direction="bearish",
            confidence=0.65,
            drivers=["Macro headwinds"],
            headlines=["Tesla misses delivery targets"],
        )
    assert result is None


def test_strips_whitespace_from_response():
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_anthropic_cls.return_value = _mock_anthropic("  Explanation with whitespace.  ")
        result = generate_explanation(
            ticker="MSFT",
            direction="bullish",
            confidence=0.70,
            drivers=["Strong earnings sentiment"],
            headlines=["Microsoft cloud revenue up 20%"],
        )
    assert result == "Explanation with whitespace."


def test_uses_top_five_headlines_only():
    """Verify the API is called with at most 5 headlines."""
    with patch("app.services.explainer.settings") as mock_settings, \
         patch("app.services.explainer.Anthropic") as mock_anthropic_cls:
        mock_settings.anthropic_api_key = "test-key"
        mock_client = _mock_anthropic("Some explanation.")
        mock_anthropic_cls.return_value = mock_client
        generate_explanation(
            ticker="AAPL",
            direction="bullish",
            confidence=0.80,
            drivers=["Strong earnings sentiment"],
            headlines=[f"Headline {i}" for i in range(10)],
        )
    call_kwargs = mock_client.messages.create.call_args
    prompt = call_kwargs[1]["messages"][0]["content"]
    # Only headlines 0-4 should appear; headline 5+ should not
    assert "Headline 4" in prompt
    assert "Headline 5" not in prompt
