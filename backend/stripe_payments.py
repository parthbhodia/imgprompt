"""Stripe subscription payment integration.

Subscription plans → monthly credit top-ups:
  starter  — $1.99/mo →  20 credits
  popular  — $4.99/mo →  60 credits
  pro      — $9.99/mo → 150 credits
"""
import logging
import stripe
from config import settings
from auth import get_supabase_admin

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Plan catalog  (price_id is resolved at runtime from settings)
# ---------------------------------------------------------------------------
PLANS: dict[str, dict] = {
    "starter": {"credits": 10,  "label": "Starter",  "price": "$2.99"},
    "popular": {"credits": 25,  "label": "Popular",  "price": "$5.99"},
    "pro":     {"credits": 40,  "label": "Pro",       "price": "$9.99"},
}


def _price_id(plan: str) -> str:
    mapping = {
        "starter": settings.stripe_price_starter,
        "popular": settings.stripe_price_popular,
        "pro":     settings.stripe_price_pro,
    }
    pid = mapping.get(plan, "")
    if not pid:
        raise ValueError(
            f"Stripe price ID for plan '{plan}' is not configured. "
            "Set STRIPE_PRICE_{STARTER|PRO|UNLIMITED} in your .env."
        )
    return pid


def _stripe() -> stripe:
    if not settings.stripe_secret_key:
        raise RuntimeError(
            "Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env."
        )
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _get_or_create_stripe_customer(user_id: str, email: str) -> str:
    """Return existing Stripe customer ID, or create a new one and persist it."""
    supabase = get_supabase_admin()
    row = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).execute()
    if row.data and row.data[0].get("stripe_customer_id"):
        return row.data[0]["stripe_customer_id"]

    s = _stripe()
    customer = s.Customer.create(
        metadata={"supabase_user_id": user_id},
        email=email,
    )
    supabase.table("profiles").update(
        {"stripe_customer_id": customer.id}
    ).eq("id", user_id).execute()
    return customer.id


# ---------------------------------------------------------------------------
# Public functions called from main.py
# ---------------------------------------------------------------------------

def create_checkout_session(user_id: str, email: str, plan: str) -> str:
    """Create a Stripe Checkout Session and return the hosted URL."""
    s = _stripe()
    customer_id = _get_or_create_stripe_customer(user_id, email)
    app_url = settings.app_url.rstrip("/")

    session = s.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": _price_id(plan), "quantity": 1}],
        subscription_data={
            "metadata": {"supabase_user_id": user_id, "plan": plan},
        },
        success_url=f"{app_url}/profile?success=true&plan={plan}",
        cancel_url=f"{app_url}/profile?canceled=true",
        metadata={"supabase_user_id": user_id, "plan": plan},
        allow_promotion_codes=True,
    )
    return session.url


def create_portal_session(user_id: str) -> str:
    """Create a Stripe Customer Portal session and return the URL."""
    supabase = get_supabase_admin()
    row = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).execute()
    if not row.data or not row.data[0].get("stripe_customer_id"):
        raise ValueError("No Stripe customer found for this account.")

    s = _stripe()
    app_url = settings.app_url.rstrip("/")
    portal = s.billing_portal.Session.create(
        customer=row.data[0]["stripe_customer_id"],
        return_url=f"{app_url}/pricing",
    )
    return portal.url


def handle_webhook(payload: bytes, sig_header: str) -> None:
    """Verify and process a Stripe webhook event."""
    s = _stripe()
    secret = settings.stripe_webhook_secret
    try:
        event = s.Webhook.construct_event(payload, sig_header, secret)
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid Stripe webhook signature")

    event_type = event["type"]
    data_obj = event["data"]["object"]

    if event_type == "invoice.paid":
        _handle_invoice_paid(data_obj)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_payment_failed(data_obj)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data_obj)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data_obj)
    else:
        logger.debug("Unhandled Stripe event: %s", event_type)


# ---------------------------------------------------------------------------
# Webhook sub-handlers
# ---------------------------------------------------------------------------

def _resolve_plan_from_subscription(subscription_id: str) -> str | None:
    """Look up a subscription and return the plan slug from its metadata."""
    try:
        s = _stripe()
        sub = s.Subscription.retrieve(subscription_id)
        # stripe-python v5+ uses attribute access, not dict-style
        metadata = sub.metadata if hasattr(sub, "metadata") else {}
        plan = metadata.get("plan") if hasattr(metadata, "get") else getattr(metadata, "plan", None)
        if plan and plan in PLANS:
            return plan
        # Fall back to matching by price ID
        price_id = sub.items.data[0].price.id
        for slug in PLANS:
            try:
                if _price_id(slug) == price_id:
                    return slug
            except ValueError:
                pass
    except Exception as e:
        logger.warning("Could not resolve plan from subscription %s: %s", subscription_id, e)
    return None


def _user_id_from_customer(stripe_customer_id: str) -> str | None:
    supabase = get_supabase_admin()
    row = (
        supabase.table("profiles")
        .select("id")
        .eq("stripe_customer_id", stripe_customer_id)
        .execute()
    )
    if row.data:
        return row.data[0]["id"]
    # Also try Stripe customer metadata
    try:
        s = _stripe()
        customer = s.Customer.retrieve(stripe_customer_id)
        return customer.get("metadata", {}).get("supabase_user_id")
    except Exception:
        return None


def _handle_invoice_paid(invoice: dict) -> None:
    """Top up credits on successful payment (initial + each renewal)."""
    subscription_id = invoice.get("subscription")
    customer_id = invoice.get("customer")
    if not subscription_id or not customer_id:
        return

    user_id = _user_id_from_customer(customer_id)
    if not user_id:
        logger.warning("invoice.paid: no user found for Stripe customer %s", customer_id)
        return

    plan = _resolve_plan_from_subscription(subscription_id)
    if not plan:
        logger.warning("invoice.paid: could not resolve plan for subscription %s", subscription_id)
        return

    credits = PLANS[plan]["credits"]
    supabase = get_supabase_admin()
    supabase.table("profiles").update({
        "credits": credits,
        "stripe_subscription_id": subscription_id,
        "stripe_plan": plan,
        "stripe_status": "active",
    }).eq("id", user_id).execute()
    logger.info("Topped up %d credits for user %s (plan=%s)", credits, user_id, plan)


def _handle_invoice_payment_failed(invoice: dict) -> None:
    customer_id = invoice.get("customer")
    if not customer_id:
        return
    user_id = _user_id_from_customer(customer_id)
    if not user_id:
        return
    supabase = get_supabase_admin()
    supabase.table("profiles").update({"stripe_status": "past_due"}).eq("id", user_id).execute()
    logger.info("Marked user %s subscription as past_due", user_id)


def _handle_subscription_deleted(subscription: dict) -> None:
    customer_id = subscription.get("customer")
    if not customer_id:
        return
    user_id = _user_id_from_customer(customer_id)
    if not user_id:
        return
    supabase = get_supabase_admin()
    supabase.table("profiles").update({
        "stripe_status": "canceled",
        "stripe_subscription_id": None,
        "stripe_plan": None,
    }).eq("id", user_id).execute()
    logger.info("Subscription canceled for user %s", user_id)


def _handle_subscription_updated(subscription: dict) -> None:
    customer_id = subscription.get("customer")
    status = subscription.get("status")
    if not customer_id:
        return
    user_id = _user_id_from_customer(customer_id)
    if not user_id:
        return
    supabase = get_supabase_admin()
    supabase.table("profiles").update({"stripe_status": status}).eq("id", user_id).execute()
