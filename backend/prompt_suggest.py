"""Prompt suggestions from existing prompts/slides in Supabase (prompt evaluation library)."""
import random
from supabase import Client


def get_suggestions(supabase: Client, limit: int = 5, category: str | None = None) -> list[dict]:
    """
    Fetch prompt texts from slides (and optionally filter by category) for inspiration.
    Returns list of { "prompt_text", "title", "category" }.
    Category filter is case-insensitive and partial (substring match).
    """
    query = (
        supabase.table("prompts")
        .select("id, title, category:categories(name), slides(prompt_text)")
        .limit(500)
    )
    rows = query.execute()
    if not rows.data:
        return []

    category_lower = category.lower().replace("-", " ").replace("_", " ").strip() if category else None

    out: list[dict] = []
    for row in rows.data:
        cat = row.get("category") or {}
        cat_name = cat.get("name", "Uncategorized") if isinstance(cat, dict) else "Uncategorized"

        if category_lower:
            cat_normalized = cat_name.lower().replace("-", " ").replace("_", " ").strip()
            # Match if either contains the other (handles "Portrait Editing" ↔ "portrait")
            if category_lower not in cat_normalized and cat_normalized not in category_lower:
                continue

        slides = row.get("slides") or []
        for s in slides:
            text = (s if isinstance(s, str) else s.get("prompt_text")) if s else ""
            if text:
                out.append({
                    "prompt_text": text,
                    "title": row.get("title", ""),
                    "category": cat_name,
                })

    if not category_lower:
        random.shuffle(out)
    return out[:limit]


def enhance_prompt_from_library(supabase: Client, user_prompt: str, limit: int = 3) -> str:
    """
    Optionally prepend or suggest style from library. For now returns user_prompt as-is;
    can be extended to prepend a style phrase from similar prompts.
    """
    suggestions = get_suggestions(supabase, limit=limit)
    if not suggestions:
        return user_prompt
    # Optional: take one random style hint and prepend
    one = random.choice(suggestions)
    style_hint = one.get("prompt_text", "")[:200]
    if style_hint and user_prompt.strip():
        return user_prompt.strip() + ". Style reference: " + style_hint[:150]
    return user_prompt
