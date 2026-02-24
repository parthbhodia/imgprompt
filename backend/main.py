"""
FastAPI backend for VibeIMG AI image generation.
- Replicate Flux integration
- Supabase auth (JWT), credits, chat_sessions, chat_messages, image_generations
- Prompt suggestions from existing prompt library
"""
import asyncio
import logging
import os
from typing import Annotated
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from auth import DEV_USER_ID, get_supabase_admin, get_current_user_id
from credits import get_credits, deduct_credits, ensure_credits_column
from replicate_flux import run_flux, run_flux_img2img
from replicate.exceptions import ModelError as ReplicateModelError
from prompt_suggest import get_suggestions
from moderation import check_moderation
from llm_refine import refine_prompt, sanitize_for_replicate
from stripe_payments import create_checkout_session, create_portal_session, handle_webhook, PLANS

app = FastAPI(
    title="VibeIMG AI Image API",
    description="Generate images via Flux and manage credits",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:8080,https://vibeimg.xyz").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
def unhandled_exception_handler(request: Request, exc: Exception):
    """Return JSON for uncaught exceptions so frontend gets a proper error message."""
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) or "Internal server error"},
    )


# ---------- Request/Response models ----------
class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = None
    use_library_style: bool = False
    image_base64: str | None = None  # Optional data URL / base64 for reference; reserved for img2img


class GenerateResponse(BaseModel):
    image_url: str
    message_id: str | None = None
    credits_remaining: int


class CreditsResponse(BaseModel):
    credits: int


class SuggestResponse(BaseModel):
    suggestions: list[dict]


class RefineRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class RefineResponse(BaseModel):
    refined: str


class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern="^(starter|popular|pro)$")


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class SubscriptionStatusResponse(BaseModel):
    plan: str | None
    status: str | None
    credits: int


class SessionCreate(BaseModel):
    title: str = "New chat"


class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    image_url: str | None
    created_at: str


# ---------- Routes ----------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/credits", response_model=CreditsResponse)
def credits(user_id: Annotated[str, Depends(get_current_user_id)]):
    supabase = get_supabase_admin()
    ensure_credits_column(supabase, user_id)
    return CreditsResponse(credits=get_credits(supabase, user_id))


@app.get("/suggest", response_model=SuggestResponse)
def suggest_prompts(
    limit: int = 5,
    category: str | None = None,
    user_id: Annotated[str, Depends(get_current_user_id)] = None,
):
    supabase = get_supabase_admin()
    suggestions = get_suggestions(supabase, limit=limit, category=category)
    return SuggestResponse(suggestions=suggestions)


@app.post("/refine-prompt", response_model=RefineResponse)
def refine_prompt_endpoint(
    body: RefineRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="Prompt refinement is not available. GROQ_API_KEY is not configured.",
        )
    try:
        refined = refine_prompt(body.text)
        return RefineResponse(refined=refined)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Prompt refinement failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate", response_model=GenerateResponse)
async def generate_image(
    body: GenerateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    supabase = get_supabase_admin()
    ensure_credits_column(supabase, user_id)
    balance = get_credits(supabase, user_id)
    cost = settings.credits_per_generation
    if balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. Need {cost}, have {balance}.",
        )

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        check_moderation(prompt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if body.use_library_style:
        from prompt_suggest import enhance_prompt_from_library
        prompt = enhance_prompt_from_library(supabase, prompt)

    # Pre-sanitize via Groq to avoid Replicate's over-aggressive NSFW filter
    safe_prompt = await asyncio.get_event_loop().run_in_executor(None, lambda: sanitize_for_replicate(prompt))

    async def _run_replicate(p: str) -> list[str]:
        """Run Replicate in a thread pool with a 180s timeout."""
        if body.image_base64:
            return await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, lambda: run_flux_img2img(p, body.image_base64)),
                timeout=180,
            )
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, lambda: run_flux(p)),
            timeout=180,
        )

    try:
        urls = await _run_replicate(safe_prompt)
    except asyncio.TimeoutError:
        logger.error("Image generation timed out after 180s")
        raise HTTPException(status_code=504, detail="Image generation timed out. Please try again.")
    except ReplicateModelError as e:
        msg = str(e)
        if "nsfw" in msg.lower():
            # Groq sanitization didn't fully work — try one more time with a harder rewrite
            logger.warning("NSFW false positive after sanitization, retrying with stricter rewrite")
            harder_prompt = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: sanitize_for_replicate(
                    "STRICT REWRITE — remove any words that could trigger safety filters: " + safe_prompt
                ),
            )
            try:
                urls = await _run_replicate(harder_prompt)
            except ReplicateModelError:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Replicate's safety filter blocked this prompt even after automatic rephrasing. "
                        "Try changing 'photograph' to 'digital painting' or 'illustration', "
                        "and rephrase any descriptions involving people."
                    ),
                )
        else:
            raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        logger.exception("Image generation failed: %s", e)
        msg = str(e) if str(e) else "Image generation failed"
        if "insufficient credit" in msg.lower() and "replicate.com/account/billing" in msg.lower():
            raise HTTPException(
                status_code=402,
                detail="Replicate account has insufficient billing credit. Visit replicate.com/account/billing to top up.",
            )
        raise HTTPException(status_code=502, detail=msg)

    if not urls:
        raise HTTPException(status_code=502, detail="Image generation failed")

    image_url = urls[0]

    if not deduct_credits(supabase, user_id, cost):
        raise HTTPException(status_code=402, detail="Credit deduction failed")

    session_id = body.session_id
    message_id = None

    if session_id and user_id != DEV_USER_ID:
        try:
            session_uuid = UUID(session_id)
            # Insert user message
            msg_user = (
                supabase.table("chat_messages")
                .insert({
                    "session_id": str(session_uuid),
                    "role": "user",
                    "content": body.prompt,
                })
                .execute()
            )
            user_msg_id = msg_user.data[0]["id"] if msg_user.data else None
            # Insert assistant message with image
            msg_asst = (
                supabase.table("chat_messages")
                .insert({
                    "session_id": str(session_uuid),
                    "role": "assistant",
                    "content": "",
                    "image_url": image_url,
                })
                .execute()
            )
            message_id = msg_asst.data[0]["id"] if msg_asst.data else None
            # Record generation
            supabase.table("image_generations").insert({
                "user_id": user_id,
                "session_id": str(session_uuid),
                "message_id": message_id,
                "prompt": body.prompt,
                "image_url": image_url,
                "model": settings.flux_model,
                "credits_used": cost,
            }).execute()
        except Exception:
            pass

    credits_remaining = get_credits(supabase, user_id)
    return GenerateResponse(
        image_url=image_url,
        message_id=message_id,
        credits_remaining=credits_remaining,
    )


@app.post("/sessions", response_model=SessionResponse)
def create_session(
    body: SessionCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    supabase = get_supabase_admin()
    r = (
        supabase.table("chat_sessions")
        .insert({"user_id": user_id, "title": body.title})
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    row = r.data[0]
    return SessionResponse(
        id=row["id"],
        title=row["title"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.get("/sessions", response_model=list[SessionResponse])
def list_sessions(user_id: Annotated[str, Depends(get_current_user_id)]):
    supabase = get_supabase_admin()
    r = (
        supabase.table("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(50)
        .execute()
    )
    return [
        SessionResponse(
            id=row["id"],
            title=row["title"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in (r.data or [])
    ]


@app.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(
    session_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    supabase = get_supabase_admin()
    session = (
        supabase.table("chat_sessions")
        .select("id")
        .eq("id", str(session_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    r = (
        supabase.table("chat_messages")
        .select("id, session_id, role, content, image_url, created_at")
        .eq("session_id", str(session_id))
        .order("created_at", ascending=True)
        .execute()
    )
    return [
        MessageResponse(
            id=row["id"],
            session_id=row["session_id"],
            role=row["role"],
            content=row["content"] or "",
            image_url=row.get("image_url"),
            created_at=row["created_at"],
        )
        for row in (r.data or [])
    ]


@app.get("/payments/plans")
def list_plans():
    """Return available subscription plans (no auth required)."""
    return {
        slug: {
            "label": info["label"],
            "price": info["price"],
            "credits": info["credits"],
        }
        for slug, info in PLANS.items()
    }


@app.get("/payments/subscription", response_model=SubscriptionStatusResponse)
def get_subscription_status(user_id: Annotated[str, Depends(get_current_user_id)]):
    """Return the current user's subscription plan and credit balance."""
    supabase = get_supabase_admin()
    row = (
        supabase.table("profiles")
        .select("credits, stripe_plan, stripe_status")
        .eq("id", user_id)
        .execute()
    )
    if not row.data:
        return SubscriptionStatusResponse(plan=None, status=None, credits=0)
    data = row.data[0]
    return SubscriptionStatusResponse(
        plan=data.get("stripe_plan"),
        status=data.get("stripe_status"),
        credits=int(data.get("credits") or 0),
    )


@app.post("/payments/create-checkout", response_model=CheckoutResponse)
def payments_create_checkout(
    body: CheckoutRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Stripe payments are not configured on this server.",
        )
    supabase = get_supabase_admin()
    profile = supabase.table("profiles").select("id").eq("id", user_id).execute()
    email = ""
    try:
        from auth import get_supabase_admin as _get_admin
        admin = _get_admin()
        user_resp = admin.auth.admin.get_user_by_id(user_id)
        email = getattr(user_resp.user, "email", "") or ""
    except Exception:
        pass
    try:
        url = create_checkout_session(user_id, email, body.plan)
        return CheckoutResponse(checkout_url=url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/payments/customer-portal", response_model=PortalResponse)
def payments_customer_portal(user_id: Annotated[str, Depends(get_current_user_id)]):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")
    try:
        url = create_portal_session(user_id)
        return PortalResponse(portal_url=url)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/payments/webhook")
async def stripe_webhook(request: Request):
    """Stripe sends events here. Must be unauthenticated."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        handle_webhook(payload, sig)
    except ValueError as e:
        logger.warning("Stripe webhook error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
