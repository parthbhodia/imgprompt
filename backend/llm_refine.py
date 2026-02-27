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


def analyze_conversation_context(messages: list[dict]) -> dict:
    """
    Analyze the full conversation history and provide context-aware suggestions.
    
    Args:
        messages: List of dicts with 'role' ('user'/'assistant') and 'content' keys
    
    Returns:
        Dict with themes, style preferences, complexity level, etc.
    """
    key = settings.groq_api_key
    if not key or not messages:
        return {"themes": [], "preferred_styles": [], "complexity": "medium"}

    from groq import Groq
    client = Groq(api_key=key)
    
    # Summarize conversation for context
    recent_prompts = [m["content"] for m in messages if m.get("role") == "user"][-5:]
    conversation_text = "\n".join([f"User: {p}" for p in recent_prompts])
    
    system_prompt = (
        "Analyze the user's image generation requests and respond with a JSON object: "
        '{"themes": list[str] (main topics/subjects, e.g., ["nature", "fantasy"]), '
        '"preferred_styles": list[str] (artistic styles mentioned, e.g., ["cinematic", "watercolor"]), '
        '"complexity": str (simple/medium/complex - how detailed are their requests?), '
        '"next_variations": list[str] (2-3 suggested variations they might want)} '
        "Respond ONLY with valid JSON, no other text."
    )
    
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analyze these requests:\n{conversation_text}"},
            ],
            max_tokens=200,
            temperature=0.5,
            timeout=5,
        )
        content = resp.choices[0].message.content.strip()
        
        import json
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
    """
    Analyze user message and provide contextual insights:
    - Whether they want to refine/improve a prompt
    - Whether they're doing variations
    - Suggestions for next steps
    
    Falls back gracefully if Groq is unavailable.
    """
    key = settings.groq_api_key
    if not key:
        return {"should_refine": False, "is_variation": False, "insight": ""}

    from groq import Groq
    client = Groq(api_key=key)
    
    system_prompt = (
        "You are a helpful AI chat assistant that understands user intent for image generation. "
        "Analyze the user's message and respond with a JSON object: "
        '{"should_refine": bool (true if user wants AI to enhance the prompt), '
        '"is_variation": bool (true if user wants variations of previous image), '
        '"insight": str (brief insight about what user might want, e.g., "User wants cinematic style variations")} '
        "Respond ONLY with valid JSON, no other text."
    )
    
    context = ""
    if previous_prompts and len(previous_prompts) > 0:
        context = f"\nPrevious prompts this session: {', '.join(previous_prompts[-3:])}"
    
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{user_message}{context}"},
            ],
            max_tokens=150,
            temperature=0.5,
            timeout=5,
        )
        content = resp.choices[0].message.content.strip()
        
        import json
        result = json.loads(content)
        return {
            "should_refine": result.get("should_refine", False),
            "is_variation": result.get("is_variation", False),
            "insight": result.get("insight", ""),
        }
    except Exception as e:
        logger.warning("Chat insights analysis failed: %s", e)
        return {"should_refine": False, "is_variation": False, "insight": ""}
