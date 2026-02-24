"""Content moderation using Groq LLM classification."""
import logging
from config import settings

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
    Check whether a prompt is safe using Groq LLM classification.
    Raises ValueError with a user-facing message if the prompt is flagged.
    Falls back silently (allows) if Groq is not configured.
    """
    key = settings.groq_api_key
    if not key:
        return  # Moderation is best-effort; skip if not configured

    try:
        from groq import Groq
        client = Groq(api_key=key)
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text[:1000]},  # cap input size
            ],
            max_tokens=5,
            temperature=0,
        )
        verdict = resp.choices[0].message.content.strip().upper()
        if verdict.startswith("UNSAFE"):
            raise ValueError("Prompt contains content that cannot be generated.")
    except ValueError:
        raise
    except Exception as e:
        logger.warning("Moderation check failed (allowing): %s", e)
