"""Prompt refinement using xAI (Grok) primary, Groq fallback when credits/rate limit hit."""
import logging
from config import settings
from llm_client import chat_completion

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
    "- CRITICAL: Preserve ALL user-specified colors exactly. If the user says 'black and blue', "
    "'red and gold', 'green background', etc., those colors MUST appear in the output. "
    "For logos, brands, or known subjects with default colors: if the user requests different "
    "colors, explicitly add 'in [user colors] color scheme, replacing default colors with "
    "[user colors]' so the model overrides its training priors.\n"
    "- Do NOT add NSFW content. Do NOT remove creative details. Do NOT change the mood, "
    "setting, colors, lighting, or composition.\n"
    "- Respond with ONLY the rewritten prompt — no explanation, no quotes, no preamble."
)


def refine_prompt(user_text: str) -> str:
    """
    Rewrite a rough user idea into a rich Flux image generation prompt.
    Uses xAI first, Groq fallback. Raises RuntimeError if no LLM configured.
    """
    if not settings.xai_api_key and not settings.groq_api_key:
        raise RuntimeError("Prompt refinement is not available (XAI_API_KEY or GROQ_API_KEY not set).")

    try:
        refined = chat_completion(
            [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_text[:500]},
            ],
            max_tokens=250,
            temperature=0.7,
            timeout=8,
        )
        return refined if refined else user_text
    except Exception as e:
        logger.exception("Prompt refinement failed")
        raise RuntimeError(f"Refinement failed: {e}") from e


def sanitize_for_replicate(prompt: str) -> str:
    """
    Rewrite a prompt so it is unlikely to trigger Replicate's NSFW safety filter.
    Uses xAI first, Groq fallback. Falls back to original if both fail or slow.
    """
    if not settings.xai_api_key and not settings.groq_api_key:
        return prompt

    try:
        rewritten = chat_completion(
            [
                {"role": "system", "content": _SANITIZE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt[:1500]},
            ],
            max_tokens=400,
            temperature=0.3,
            timeout=8,
        )
        if rewritten:
            logger.info("Prompt sanitized: %r → %r", prompt[:80], rewritten[:80])
            return rewritten
    except Exception as e:
        logger.warning("Prompt sanitization failed (using original): %s", e)
    return prompt


def analyze_conversation_context(messages: list[dict]) -> dict:
    """Analyze conversation and return themes, styles, next_variations. Uses xAI first, Groq fallback."""
    if (not settings.xai_api_key and not settings.groq_api_key) or not messages:
        return {"themes": [], "preferred_styles": [], "complexity": "medium", "next_variations": []}

    recent_prompts = [m["content"] for m in messages if m.get("role") == "user"][-5:]
    conversation_text = "\n".join([f"User: {p}" for p in recent_prompts])

    system_prompt = (
        "Analyze the user's image generation requests and respond with a JSON object: "
        '{"themes": list[str] (main topics/subjects), '
        '"preferred_styles": list[str] (artistic styles mentioned), '
        '"complexity": str (simple/medium/complex), '
        '"next_variations": list[str] (2-3 suggested variations)} '
        "Respond ONLY with valid JSON, no other text."
    )

    try:
        content = chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analyze these requests:\n{conversation_text}"},
            ],
            max_tokens=200,
            temperature=0.5,
            timeout=5,
        )
        import json
        # Handle cases where LLM returns markdown code blocks or extra text
        content = content.strip()
        # Extract JSON from markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        # Find the first JSON object (from first { to matching })
        start_idx = content.find("{")
        end_idx = content.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx+1]
        result = json.loads(content)
        return {
            "themes": result.get("themes", []),
            "preferred_styles": result.get("preferred_styles", []),
            "complexity": result.get("complexity", "medium"),
            "next_variations": result.get("next_variations", []),
        }
    except Exception as e:
        logger.warning("Conversation context analysis failed: %s", e)
        return {"themes": [], "preferred_styles": [], "complexity": "medium", "next_variations": []}


def get_chat_insights(user_message: str, previous_prompts: list[str] | None = None) -> dict:
    """Analyze user intent. Uses xAI first, Groq fallback."""
    if not settings.xai_api_key and not settings.groq_api_key:
        return {"should_refine": False, "is_variation": False, "insight": ""}

    system_prompt = (
        "You are a helpful AI chat assistant that understands user intent for image generation. "
        "Analyze the user's message and respond with a JSON object: "
        '{"should_refine": bool, "is_variation": bool, '
        '"insight": str (brief insight)} '
        "Respond ONLY with valid JSON, no other text."
    )
    context = ""
    if previous_prompts:
        context = f"\nPrevious prompts: {', '.join(previous_prompts[-3:])}"

    try:
        content = chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{user_message}{context}"},
            ],
            max_tokens=150,
            temperature=0.5,
            timeout=5,
        )
        import json
        # Handle cases where LLM returns markdown code blocks or extra text
        content = content.strip()
        # Extract JSON from markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        # Find the first JSON object (from first { to matching })
        start_idx = content.find("{")
        end_idx = content.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx+1]
        result = json.loads(content)
        return {
            "should_refine": result.get("should_refine", False),
            "is_variation": result.get("is_variation", False),
            "insight": result.get("insight", ""),
        }
    except Exception as e:
        logger.warning("Chat insights analysis failed: %s", e)
        return {"should_refine": False, "is_variation": False, "insight": ""}


def get_content_policy_suggestions(blocked_prompt: str) -> list[str]:
    """
    Generate alternative phrasings for a prompt that hit content policy filters.
    Uses xAI/Groq to create dynamic suggestions. Falls back to defaults if LLM unavailable.
    """
    if not settings.xai_api_key and not settings.groq_api_key:
        # Fallback to static suggestions
        return [
            "age progression visualization",
            "artistic time-lapse style portrait",
            "stylized character version",
        ]

    system_prompt = (
        "You are an expert at rephrasing image generation prompts to avoid content policy violations "
        "while preserving the user's intent. The user's prompt was blocked. "
        "Generate 3-5 alternative phrasings that achieve the same visual result but use safer language. "
        "Focus on: artistic/educational framing, avoiding direct physical transformation words, "
        "using 'visualization', 'interpretation', 'stylized' instead of direct commands. "
        "Respond with ONLY a JSON array of strings, no other text."
    )

    try:
        content = chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Blocked prompt: '{blocked_prompt}'. Generate alternative phrasings."},
            ],
            max_tokens=200,
            temperature=0.7,
            timeout=5,
        )
        import json
        content = content.strip()
        # Extract JSON array
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        start_idx = content.find("[")
        end_idx = content.rfind("]")
        if start_idx != -1 and end_idx != -1:
            suggestions = json.loads(content[start_idx:end_idx+1])
            if isinstance(suggestions, list) and len(suggestions) > 0:
                return suggestions[:5]
    except Exception as e:
        logger.warning(f"Failed to generate dynamic suggestions: {e}")

    # Fallback defaults
    return [
        "age progression visualization",
        "artistic time-lapse style portrait",
        "stylized character version",
        "artistic interpretation with modified features",
        "visual transformation keeping core identity",
    ]

