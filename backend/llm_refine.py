"""Prompt refinement using Groq LLM — rewrites a rough user idea into a Flux-optimized prompt."""
import logging
from config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an expert at writing image generation prompts for the Flux AI model. "
    "Transform the user's rough idea into a rich, detailed image generation prompt. "
    "Include: subject description, art style or photography style, lighting, mood, "
    "color palette, composition, and camera angle where relevant. "
    "Keep the result to 1-3 sentences. "
    "Respond with ONLY the refined prompt — no explanation, no quotes, no preamble."
)


def refine_prompt(user_text: str) -> str:
    """
    Rewrite a rough user idea into a rich Flux image generation prompt using Groq.
    Raises RuntimeError if Groq is not configured.
    Raises RuntimeError with a user-facing message on API failure.
    """
    key = settings.groq_api_key
    if not key:
        raise RuntimeError("Prompt refinement is not available (GROQ_API_KEY not set).")

    from groq import Groq
    client = Groq(api_key=key)
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_text[:500]},
            ],
            max_tokens=250,
            temperature=0.7,
        )
        refined = resp.choices[0].message.content.strip()
        if not refined:
            return user_text
        return refined
    except Exception as e:
        logger.exception("Groq prompt refinement failed")
        raise RuntimeError(f"Refinement failed: {e}") from e
