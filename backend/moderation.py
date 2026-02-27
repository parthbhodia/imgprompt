"""Content moderation using xAI (primary) or Groq (fallback) LLM classification."""
import logging
from config import settings
from llm_client import chat_completion

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a content moderation classifier. "
    "Respond with exactly one word: SAFE or UNSAFE.\n"
    "Respond UNSAFE if the text requests, describes, or implies: "
    "sexual/NSFW content, graphic violence, hate speech, self-harm, child exploitation, "
    "or illegal activities. Otherwise respond SAFE."
)


def check_moderation(text: str) -> None:
    """
    Check whether a prompt is safe using xAI (primary) or Groq (fallback).
    Raises ValueError if the prompt is flagged.
    Skips if neither LLM is configured.
    """
    if not settings.xai_api_key and not settings.groq_api_key:
        return

    try:
        verdict = chat_completion(
            [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text[:1000]},
            ],
            max_tokens=5,
            temperature=0,
            timeout=6,
        )
        if verdict and verdict.strip().upper().startswith("UNSAFE"):
            raise ValueError("Prompt contains content that cannot be generated.")
    except ValueError:
        raise
    except Exception as e:
        logger.warning("Moderation check failed (allowing): %s", e)
