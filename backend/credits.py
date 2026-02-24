"""Credit balance and deduction using Supabase profiles.credits."""
from supabase import Client

from config import settings
from auth import DEV_USER_ID


def get_credits(supabase: Client, user_id: str) -> int:
    if user_id == DEV_USER_ID:
        return 100  # Dev no-auth: 100 credits for testing (no DB)
    row = (
        supabase.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .execute()
    )
    if not row.data or len(row.data) == 0:
        return 0
    return int(row.data[0].get("credits", 0))


def ensure_credits_column(supabase: Client, user_id: str) -> None:
    """Ensure profile exists and has credits column; init to default if missing."""
    if user_id == DEV_USER_ID:
        return  # Dev no-auth: skip DB
    row = (
        supabase.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .execute()
    )
    if row.data and len(row.data) > 0:
        return
    supabase.table("profiles").upsert(
        {"id": user_id, "credits": settings.default_credits_new_user},
        on_conflict="id",
    ).execute()


def deduct_credits(supabase: Client, user_id: str, amount: int = 1) -> bool:
    if user_id == DEV_USER_ID:
        return True  # Dev no-auth: no-op, always allow
    ensure_credits_column(supabase, user_id)
    current = get_credits(supabase, user_id)
    if current < amount:
        return False
    new_balance = current - amount
    r = (
        supabase.table("profiles")
        .update({"credits": new_balance})
        .eq("id", user_id)
        .execute()
    )
    return bool(r.data)


def add_credits(supabase: Client, user_id: str, amount: int) -> None:
    ensure_credits_column(supabase, user_id)
    current = get_credits(supabase, user_id)
    supabase.table("profiles").update({"credits": current + amount}).eq("id", user_id).execute()
