"""
FastAPI backend for VibeIMG AI image generation.
- Replicate Flux integration
- Supabase auth (JWT), credits, chat_sessions, chat_messages, image_generations
- Prompt suggestions from existing prompt library
"""
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
from prompt_suggest import get_suggestions
from moderation import check_moderation
from llm_refine import refine_prompt

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
    text: str = Field(..., min_length=1, max_length=500)


class RefineResponse(BaseModel):
    refined: str


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

    try:
        if body.image_base64:
            urls = run_flux_img2img(prompt, body.image_base64)
        else:
            urls = run_flux(prompt)
    except Exception as e:
        logger.exception("Image generation failed")
        msg = str(e) if str(e) else "Image generation failed"
        # Replicate billing 402 → surface as 402 so frontend can handle it specifically
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
