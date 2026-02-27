"""
Unified LLM client: tries xAI (Grok) first, falls back to Groq on credit/rate limit.
"""
import logging
from typing import Any, Optional

from config import settings

logger = logging.getLogger(__name__)

XAI_MODEL = "grok-3-mini"
GROQ_MODEL = "llama-3.1-8b-instant"


def _is_limit_error(e: Exception) -> bool:
    """Return True if error indicates rate/credit limit (should fall back to Groq)."""
    msg = str(e).lower()
    if "429" in msg or "rate" in msg or "throttl" in msg:
        return True
    if "402" in msg or "payment" in msg or "credit" in msg or "quota" in msg or "limit" in msg or "insufficient" in msg:
        return True
    return False


def _call_xai(messages: list[dict], **kwargs: Any) -> str:
    """Call xAI (Grok) API. Raises on failure."""
    from openai import OpenAI
    client = OpenAI(api_key=settings.xai_api_key, base_url="https://api.x.ai/v1")
    create_kwargs = {
        "model": kwargs.get("model", XAI_MODEL),
        "messages": messages,
        "max_tokens": kwargs.get("max_tokens", 400),
        "temperature": kwargs.get("temperature", 0.5),
    }
    if kwargs.get("timeout"):
        create_kwargs["timeout"] = kwargs["timeout"]
    resp = client.chat.completions.create(**create_kwargs)
    return (resp.choices[0].message.content or "").strip()


def _call_groq(messages: list[dict], **kwargs: Any) -> str:
    """Call Groq API. Raises on failure."""
    from groq import Groq
    client = Groq(api_key=settings.groq_api_key)
    resp = client.chat.completions.create(
        model=kwargs.get("model", GROQ_MODEL),
        messages=messages,
        max_tokens=kwargs.get("max_tokens", 400),
        temperature=kwargs.get("temperature", 0.5),
        timeout=kwargs.get("timeout"),
    )
    return (resp.choices[0].message.content or "").strip()


def chat_completion(
    messages: list[dict],
    max_tokens: int = 400,
    temperature: float = 0.5,
    timeout: Optional[int] = 8,
) -> str:
    """
    Call LLM: try xAI first, fall back to Groq on credit/rate limit.
    Returns the text response. Raises if both fail.
    """
    use_xai = bool(settings.xai_api_key)
    use_groq = bool(settings.groq_api_key)

    if use_xai:
        try:
            out = _call_xai(messages, max_tokens=max_tokens, temperature=temperature)
            if out:
                return out
        except Exception as e:
            if _is_limit_error(e):
                logger.warning("xAI credit/rate limit hit, falling back to Groq: %s", e)
            else:
                logger.warning("xAI call failed, falling back to Groq: %s", e)
            use_xai = False

    if use_groq:
        return _call_groq(messages, max_tokens=max_tokens, temperature=temperature, timeout=timeout)

    raise RuntimeError("No LLM configured. Set XAI_API_KEY or GROQ_API_KEY.")
