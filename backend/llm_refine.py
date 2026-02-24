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

_SANITIZE_SYSTEM_PROMPT = (
    "You are an AI image prompt safety editor. "
    "Rewrite the given prompt so it passes strict image model safety filters, "
    "while fully preserving the original artistic intent and all descriptive detail.\n\n"
    "Rules:\n"
    "- Replace 'photograph' / 'photo-realistic' / 'photographic' with 'digital painting', "
    "'illustration', or 'concept art'.\n"
    "- When a prompt describes two versions of the same person at different ages "
    "('versions of yourself', 'past self', 'younger self', 'child and adult version', "
    "'inner child', 'younger me' etc.): rewrite using this exact pattern — "
    "'a [boy/girl/person] aged around 8 and the same [boy/girl/person] grown into an adult, "
    "age progression of a single individual, same face same hair same gender, "
    "identical facial features throughout'. "
    "If the user's gender is not stated, default to 'a young boy and the same boy as an adult man'. "
    "NEVER use both male and female figures for a single-person age progression.\n"
    "- Replace physical-contact words ('embracing', 'hugging', 'holding', 'touching') with "
    "'standing beside', 'close to', or 'near'.\n"
    "- Do NOT add NSFW content. Do NOT remove creative details. Do NOT change the mood, "
    "setting, colors, lighting, or composition.\n"
    "- Respond with ONLY the rewritten prompt — no explanation, no quotes, no preamble."
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


def sanitize_for_replicate(prompt: str) -> str:
    """
    Use Groq to rewrite a prompt so it is unlikely to trigger Replicate's
    internal NSFW safety filter, while keeping the full artistic intent intact.
    Falls back to the original prompt if Groq is unavailable or slow (>8s).
    """
    key = settings.groq_api_key
    if not key:
        return prompt  # Groq not configured — pass through unchanged

    from groq import Groq
    client = Groq(api_key=key)
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": _SANITIZE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt[:1500]},
            ],
            max_tokens=400,
            temperature=0.3,
            timeout=8,  # Fall back to original if Groq is slow
        )
        rewritten = resp.choices[0].message.content.strip()
        if not rewritten:
            return prompt
        logger.info("Prompt sanitized by Groq: %r → %r", prompt[:80], rewritten[:80])
        return rewritten
    except Exception as e:
        logger.warning("Groq prompt sanitization failed (using original): %s", e)
        return prompt  # Always fall back gracefully
