"""Credit balance, deduction, earning, and history using Supabase profiles.credits."""
from datetime import datetime, timedelta
from typing import Literal, Optional
from supabase import Client

from config import settings
from auth import DEV_USER_ID

# Credit costs for different generation types
class CreditCosts:
    STANDARD = 1
    HD = 2
    BATCH = 3

# Credit earning amounts
class CreditEarnings:
    DAILY_LOGIN = 1
    SHARE_CREATION = 1
    COMMUNITY_ENGAGEMENT = 0.5

CreditTransactionType = Literal[
    "spend_standard", "spend_hd", "spend_batch",
    "earn_daily_login", "earn_share", "earn_community",
    "purchase", "bonus"
]


def get_credits(supabase: Client, user_id: str) -> float:
    if user_id == DEV_USER_ID:
        return 100.0  # Dev no-auth: 100 credits for testing
    row = (
        supabase.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .execute()
    )
    if not row.data or len(row.data) == 0:
        return 0.0
    return float(row.data[0].get("credits", 0))


def ensure_credits_column(supabase: Client, user_id: str) -> None:
    """Ensure profile exists and has credits column; init to default if missing."""
    if user_id == DEV_USER_ID:
        return
    try:
        row = (
            supabase.table("profiles")
            .select("credits")
            .eq("id", user_id)
            .execute()
        )
        if row.data and len(row.data) > 0:
            return
    except Exception:
        pass  # Column might not exist yet
    
    # New user - give welcome bonus (only set id and credits, other columns may not exist yet)
    try:
        supabase.table("profiles").upsert(
            {
                "id": user_id, 
                "credits": settings.default_credits_new_user,
            },
            on_conflict="id",
        ).execute()
    except Exception as e:
        print(f"Failed to create profile: {e}")


def deduct_credits(supabase: Client, user_id: str, amount: float, 
                     transaction_type: CreditTransactionType = "spend_standard") -> bool:
    if user_id == DEV_USER_ID:
        return True
    ensure_credits_column(supabase, user_id)
    current = get_credits(supabase, user_id)
    if current < amount:
        return False
    new_balance = current - amount
    
    # Update credits with error handling - convert to int for database
    try:
        r = (
            supabase.table("profiles")
            .update({"credits": int(new_balance)})
            .eq("id", user_id)
            .execute()
        )
    except Exception as e:
        print(f"Failed to deduct credits for user {user_id}: {e}")
        import traceback
        print(traceback.format_exc())
        return False
    
    # Log transaction
    try:
        supabase.table("credit_transactions").insert({
            "user_id": user_id,
            "amount": -amount,
            "type": transaction_type,
            "balance_after": new_balance,
        }).execute()
    except:
        pass  # Non-critical
    
    return True


def add_credits(supabase: Client, user_id: str, amount: float,
                transaction_type: CreditTransactionType = "bonus") -> bool:
    """Add credits to user balance with transaction logging."""
    if user_id == DEV_USER_ID:
        return True
    ensure_credits_column(supabase, user_id)
    current = get_credits(supabase, user_id)
    new_balance = current + amount
    
    # Update credits - convert to int for database
    r = (
        supabase.table("profiles")
        .update({"credits": int(new_balance)})
        .eq("id", user_id)
        .execute()
    )
    
    # Log transaction
    try:
        supabase.table("credit_transactions").insert({
            "user_id": user_id,
            "amount": amount,
            "type": transaction_type,
            "balance_after": new_balance,
        }).execute()
    except:
        pass  # Non-critical
    
    return bool(r.data)


def claim_daily_login(supabase: Client, user_id: str) -> tuple[bool, float]:
    """Claim daily login credit. Returns (success, new_balance)."""
    if user_id == DEV_USER_ID:
        return True, 100.0
    
    ensure_credits_column(supabase, user_id)
    
    try:
        # Check last claim - safely handle missing column
        row = (
            supabase.table("profiles")
            .select("credits, last_daily_login")
            .eq("id", user_id)
            .execute()
        )
        
        if not row.data:
            return False, 0.0
        
        data = row.data[0]
        last_login = data.get("last_daily_login")
        
        # Check if already claimed today
        if last_login:
            last_date = datetime.fromisoformat(last_login.replace('Z', '+00:00'))
            now = datetime.now(last_date.tzinfo)
            if last_date.date() == now.date():
                return False, float(data.get("credits", 0))
        
        # Grant daily login credit
        new_balance = int(float(data.get("credits", 0)) + CreditEarnings.DAILY_LOGIN)
        
        # Try to update with last_daily_login, but don't fail if column doesn't exist
        try:
            supabase.table("profiles").update({
                "credits": int(new_balance),
                "last_daily_login": datetime.now().isoformat(),
            }).eq("id", user_id).execute()
        except:
            # Fallback: just update credits
            supabase.table("profiles").update({
                "credits": int(new_balance),
            }).eq("id", user_id).execute()
        
        # Log transaction
        try:
            supabase.table("credit_transactions").insert({
                "user_id": user_id,
                "amount": CreditEarnings.DAILY_LOGIN,
                "type": "earn_daily_login",
                "balance_after": new_balance,
            }).execute()
        except:
            pass
        
        return True, new_balance
    except Exception as e:
        print(f"Claim daily login failed: {e}")
        # Fallback: just get current credits
        current = get_credits(supabase, user_id)
        return False, current


def claim_share_credit(supabase: Client, user_id: str) -> tuple[bool, float]:
    """Claim credit for sharing a creation. Returns (success, new_balance)."""
    if user_id == DEV_USER_ID:
        return True, 100.0
    
    ensure_credits_column(supabase, user_id)
    
    row = (
        supabase.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .execute()
    )
    
    if not row.data:
        return False, 0.0
    
    current = float(row.data[0].get("credits", 0))
    new_balance = int(current + CreditEarnings.SHARE_CREATION)
    
    supabase.table("profiles").update({
        "credits": int(new_balance),
    }).eq("id", user_id).execute()
    
    # Log transaction
    try:
        supabase.table("credit_transactions").insert({
            "user_id": user_id,
            "amount": CreditEarnings.SHARE_CREATION,
            "type": "earn_share",
            "balance_after": new_balance,
        }).execute()
    except:
        pass
    
    return True, new_balance


def claim_community_engagement(supabase: Client, user_id: str) -> tuple[bool, float]:
    """Claim credit for community engagement. Returns (success, new_balance)."""
    if user_id == DEV_USER_ID:
        return True, 100.0
    
    ensure_credits_column(supabase, user_id)
    
    row = (
        supabase.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .execute()
    )
    
    if not row.data:
        return False, 0.0
    
    current = float(row.data[0].get("credits", 0))
    new_balance = int(current + CreditEarnings.COMMUNITY_ENGAGEMENT)
    
    supabase.table("profiles").update({
        "credits": int(new_balance),
    }).eq("id", user_id).execute()
    
    # Log transaction
    try:
        supabase.table("credit_transactions").insert({
            "user_id": user_id,
            "amount": CreditEarnings.COMMUNITY_ENGAGEMENT,
            "type": "earn_community",
            "balance_after": new_balance,
        }).execute()
    except:
        pass
    
    return True, new_balance


def get_credit_history(supabase: Client, user_id: str, limit: int = 50):
    """Get user's credit transaction history."""
    if user_id == DEV_USER_ID:
        return []
    
    try:
        r = (
            supabase.table("credit_transactions")
            .select("type, amount, balance_after, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return r.data or []
    except:
        return []
