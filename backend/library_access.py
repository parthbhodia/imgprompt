"""Library unlock entitlement for ImgPrompt photo-transform prompts."""
from __future__ import annotations

from typing import Optional

from auth import get_supabase_admin

ACTIVE_STATUSES = {"active", "trialing"}


def has_library_access(user_id: Optional[str]) -> bool:
    """True when the user has an active paid subscription."""
    if not user_id:
        return False
    supabase = get_supabase_admin()
    row = (
        supabase.table("profiles")
        .select("stripe_status, stripe_plan")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not row.data:
        return False
    data = row.data[0]
    status = (data.get("stripe_status") or "").lower()
    plan = data.get("stripe_plan")
    return status in ACTIVE_STATUSES and bool(plan)


def get_slide_prompt_text(prompt_id: int, slide_index: int = 0) -> Optional[str]:
    """Load full prompt_text for a library look (server-side only)."""
    supabase = get_supabase_admin()
    slides = (
        supabase.table("slides")
        .select("prompt_text, sort_order")
        .eq("prompt_id", prompt_id)
        .order("sort_order")
        .execute()
    )
    rows = slides.data or []
    if not rows:
        return None
    if slide_index < 0 or slide_index >= len(rows):
        slide_index = 0
    return rows[slide_index].get("prompt_text") or None


def get_full_library_prompts() -> list[dict]:
    """Return all prompts with full slide prompt_text (admin/service use)."""
    supabase = get_supabase_admin()
    # Prefer enriched select; fall back if packs migration not applied yet.
    try:
        result = (
            supabase.table("prompts")
            .select(
                "id, title, slug, featured, is_premium, "
                "category:categories(name, slug), "
                "slides(id, prompt_text, prompt_preview, image_url, before_image_url, sort_order), "
                "prompt_platforms(platform:platforms(name, url)), "
                "prompt_packs(pack:packs(id, name, slug))"
            )
            .order("id")
            .execute()
        )
        return result.data or []
    except Exception:
        result = (
            supabase.table("prompts")
            .select(
                "id, title, slug, featured, "
                "category:categories(name, slug), "
                "slides(id, prompt_text, image_url, sort_order), "
                "prompt_platforms(platform:platforms(name, url))"
            )
            .order("id")
            .execute()
        )
        return result.data or []
