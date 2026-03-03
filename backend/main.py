"""
FastAPI backend for VibeIMG AI image generation.
- Replicate Flux integration
- Supabase auth (JWT), credits, chat_sessions, chat_messages, image_generations
- Prompt suggestions from existing prompt library
"""
import asyncio
import logging
import os
import requests
from typing import Annotated, Optional, Dict, List, Any
from uuid import UUID, uuid4
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Request, status, Query
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
from llm_refine import refine_prompt, sanitize_for_replicate, get_chat_insights, analyze_conversation_context
from stripe_payments import create_checkout_session, create_portal_session, handle_webhook, PLANS
from prompt_framework import (
    PromptFramework, build_prompt_from_framework, build_compact_prompt,
    get_quick_fixes_for_issue, build_negative_constraints_from_categories,
    enhance_framework_with_ai, PRESET_TEMPLATES, FRAMEWORK_HINTS,
)
from style_library import (
    LoRAStyle, get_all_curated_styles, get_style, search_styles,
    get_categories, format_style_for_prompt, format_style_with_credit,
    build_style_parameters,
)
from thinking import generate_thinking_steps, update_thinking_step
from imagen_service import generate_imagen, generate_imagen_edit, is_imagen_available, get_imagen_models

# Image archival helpers
def archive_image_to_storage(supabase, user_id: str, image_url: str, message_id: str) -> Optional[str]:
    """
    Download image from Replicate CDN and save to Supabase Storage.
    Returns the permanent Storage URL or None if failed.
    """
    try:
        logger.info(f"Starting image archival for user {user_id}, message {message_id}")
        logger.info(f"Downloading from: {image_url[:50]}...")
        
        # Download image from Replicate CDN
        response = requests.get(image_url, timeout=30)
        if response.status_code != 200:
            logger.warning(f"Failed to download image from {image_url}: status {response.status_code}")
            return None
        
        logger.info(f"Downloaded {len(response.content)} bytes")

        # Upload to Supabase Storage
        bucket_name = "user-generations"
        file_path = f"{user_id}/{message_id}.webp"
        
        logger.info(f"Uploading to bucket: {bucket_name}, path: {file_path}")
        
        try:
            supabase.storage.from_(bucket_name).upload(
                file_path,
                response.content,
                {"content-type": "image/webp"}
            )
            logger.info("Upload successful")
        except Exception as upload_error:
            logger.error(f"Supabase upload failed: {upload_error}")
            # Try to create bucket if it doesn't exist
            logger.info("Attempting to create bucket...")
            try:
                supabase.storage.create_bucket(
                    bucket_name,
                    {"public": True, "file_size_limit": 52428800}  # 50MB limit
                )
                logger.info(f"Created bucket {bucket_name}, retrying upload...")
                supabase.storage.from_(bucket_name).upload(
                    file_path,
                    response.content,
                    {"content-type": "image/webp"}
                )
                logger.info("Upload successful after creating bucket")
            except Exception as create_error:
                logger.error(f"Failed to create bucket or upload: {create_error}")
                return None
        
        # Get public URL
        storage_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        logger.info(f"Image archived to storage: {storage_url}")
        return storage_url
    except Exception as e:
        logger.error(f"Failed to archive image to storage: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None


def cleanup_old_archives(supabase, user_id: str, plan: Optional[str] = None):
    """
    Keep only recent images in storage. Free users: 5 images, Paid: 50 images.
    """
    try:
        # Determine limit based on subscription
        limit = 50 if plan and plan != "free" else 5
        
        # Get all archived images for this user
        bucket_name = "user-generations"
        files = supabase.storage.from_(bucket_name).list(user_id)
        
        if not files or len(files) <= limit:
            return
        
        # Get files sorted by created_at (oldest first)
        files_to_delete = sorted(files, key=lambda x: x.get("created_at", ""))[:len(files) - limit]
        
        for file in files_to_delete:
            try:
                supabase.storage.from_(bucket_name).remove([f"{user_id}/{file['name']}"])
                logger.info(f"Deleted old archived image: {file['name']}")
            except Exception as e:
                logger.warning(f"Failed to delete old archive: {e}")
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")


app = FastAPI(
    title="VibeIMG AI Image API",
    description="Generate images via Flux and manage credits",
    version="1.0.0",
)

# CORS - Explicitly include all required origins
CORS_ORIGINS = [
    "https://vibeimg.xyz",
    "https://www.vibeimg.xyz",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:5173",
]

# Add any additional origins from env var
env_origins = os.environ.get("CORS_ORIGINS", "")
if env_origins:
    CORS_ORIGINS.extend([o.strip() for o in env_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # Cache preflight for 24 hours
)


@app.exception_handler(Exception)
def unhandled_exception_handler(request: Request, exc: Exception):
    """Return JSON for uncaught exceptions so frontend gets a proper error message."""
    logger.exception("Unhandled exception")
    
    # Determine origin for CORS headers
    origin = request.headers.get("origin", "")
    cors_origin = None
    for allowed in CORS_ORIGINS:
        if origin and (allowed == "*" or origin == allowed or origin.endswith(allowed.replace("https://", "").replace("http://", ""))):
            cors_origin = origin if origin else allowed
            break
    if not cors_origin:
        cors_origin = CORS_ORIGINS[0] if CORS_ORIGINS else "*"
    
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) or "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        },
    )


# ---------- Request/Response models ----------
class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = None
    image_base64: str | None = None
    model: str = Field(
        default="replicate-flux",
        pattern=r"^(replicate-flux|imagen-4-fast-generate-001|imagen-4-generate-001|imagen-4-ultra-generate-001|gemini-2\.5-flash-image|gemini-3\.1-flash-image-preview|gemini-3-pro-image-preview)$"
    )


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    description: str
    available: bool


@app.get("/models", response_model=list[ModelInfo])
def list_models():
    """List available image generation models."""
    models = [
        ModelInfo(
            id="replicate-flux",
            name="Flux 1.1 Ultra",
            provider="Replicate",
            description="Best quality, supports img2img transformations",
            available=True,
        ),
    ]
    
    # Add Imagen models from imagen_service
    imagen_models = get_imagen_models()
    if imagen_models:
        logger.info(f"Adding {len(imagen_models)} Imagen models to available list")
        for img_model in imagen_models:
            models.append(
                ModelInfo(
                    id=img_model["id"],
                    name=img_model["name"],
                    provider=img_model["provider"],
                    description=img_model["description"],
                    available=True,
                )
            )
    else:
        logger.warning("GEMINI_API_KEY not set - Imagen models unavailable")
    
    logger.info(f"Returning {len(models)} models: {[m.id for m in models]}")
    return models


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


class ChatInsightsRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    previous_prompts: list[str] | None = None


class ChatInsightsResponse(BaseModel):
    should_refine: bool
    is_variation: bool
    insight: str


class ConversationContextRequest(BaseModel):
    messages: list[dict]  # [{role: "user"|"assistant", content: str}, ...]


class ConversationContextResponse(BaseModel):
    themes: list[str]
    preferred_styles: list[str]
    complexity: str
    next_variations: list[str]


class BuildPromptRequest(BaseModel):
    framework: PromptFramework
    format: str = Field(default="full", pattern="^(full|compact)$")


class BuildPromptResponse(BaseModel):
    full_prompt: str
    compact_prompt: str
    tips: str


class FrameworkFromNaturalLanguageRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=2000)


class FrameworkFromNaturalLanguageResponse(BaseModel):
    framework: dict  # PromptFramework as dict
    confidence: str  # low, medium, high


class QuickFixResponse(BaseModel):
    issue: str
    fixes: list[str]


class NegativeConstraintsRequest(BaseModel):
    categories: list[str] = Field(default=["text_and_artifacts", "anatomy", "quality"])


class NegativeConstraintsResponse(BaseModel):
    constraints: str
    count: int


class PresetsResponse(BaseModel):
    presets: dict


class StylesResponse(BaseModel):
    styles: list[LoRAStyle]


class StyleDetailResponse(BaseModel):
    style: LoRAStyle
    formatted_prompt: str
    with_credit: str
    parameters: dict


class StyleSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = None


class StyleCategoriesResponse(BaseModel):
    categories: list[str]


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


# Credit earning and structure endpoints
class CreditStructureResponse(BaseModel):
    new_user_bonus: int
    costs: dict
    earnings: dict


class CreditEarningResponse(BaseModel):
    success: bool
    credits_earned: float
    new_balance: float
    message: str


class CreditHistoryResponse(BaseModel):
    transactions: list[dict]


@app.get("/credits/structure", response_model=CreditStructureResponse)
def get_credit_structure():
    """Get the credit structure: costs and earning methods."""
    return CreditStructureResponse(
        new_user_bonus=settings.default_credits_new_user,
        costs={
            "standard": settings.credits_per_generation,
            "hd": settings.credits_hd_generation,
            "batch": settings.credits_batch_generation,
        },
        earnings={
            "daily_login": settings.credits_daily_login,
            "share_creation": settings.credits_share_creation,
            "community_engagement": settings.credits_community_engagement,
        }
    )


@app.post("/credits/claim-daily", response_model=CreditEarningResponse)
def claim_daily_login_credit(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Claim daily login credit (1 credit per day)."""
    from credits import claim_daily_login
    supabase = get_supabase_admin()
    success, new_balance = claim_daily_login(supabase, user_id)
    if success:
        return CreditEarningResponse(
            success=True,
            credits_earned=settings.credits_daily_login,
            new_balance=new_balance,
            message="Daily login credit claimed!"
        )
    return CreditEarningResponse(
        success=False,
        credits_earned=0,
        new_balance=new_balance,
        message="Daily login already claimed today. Come back tomorrow!"
    )


@app.post("/credits/claim-share", response_model=CreditEarningResponse)
def claim_share_credit(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Claim credit for sharing a creation (1 credit per share)."""
    from credits import claim_share_credit
    supabase = get_supabase_admin()
    success, new_balance = claim_share_credit(supabase, user_id)
    return CreditEarningResponse(
        success=success,
        credits_earned=settings.credits_share_creation if success else 0,
        new_balance=new_balance,
        message="Share credit claimed!" if success else "Failed to claim share credit."
    )


@app.post("/credits/claim-community", response_model=CreditEarningResponse)
def claim_community_credit(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Claim credit for community engagement (0.5 credits)."""
    from credits import claim_community_engagement
    supabase = get_supabase_admin()
    success, new_balance = claim_community_engagement(supabase, user_id)
    return CreditEarningResponse(
        success=success,
        credits_earned=settings.credits_community_engagement if success else 0,
        new_balance=new_balance,
        message="Community engagement credit claimed!" if success else "Failed to claim community credit."
    )


@app.get("/credits/history", response_model=CreditHistoryResponse)
def get_user_credit_history(
    user_id: Annotated[str, Depends(get_current_user_id)],
    limit: int = Query(50, ge=1, le=100),
):
    """Get user's credit transaction history."""
    from credits import get_credit_history
    supabase = get_supabase_admin()
    transactions = get_credit_history(supabase, user_id, limit)
    return CreditHistoryResponse(transactions=transactions)


class PlanInfo(BaseModel):
    slug: str
    label: str
    price: str
    credits: int


class PlansResponse(BaseModel):
    plans: list[PlanInfo]


@app.get("/pricing/plans", response_model=PlansResponse)
def get_plans():
    """Get all available subscription plans. Public endpoint."""
    plans = [
        PlanInfo(
            slug=slug,
            label=info["label"],
            price=info["price"],
            credits=info["credits"],
        )
        for slug, info in PLANS.items()
    ]
    return PlansResponse(plans=plans)


# ============================================================================
# PROMPT FRAMEWORK ENDPOINTS - 10-Part AI Image Prompt Framework
# ============================================================================

@app.get("/framework/presets", response_model=PresetsResponse)
def get_framework_presets():
    """Get preset templates for different image types (cinematic, fantasy, etc.)."""
    return PresetsResponse(presets=PRESET_TEMPLATES)


@app.post("/framework/build", response_model=BuildPromptResponse)
def build_prompt(
    body: BuildPromptRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Build a generation-ready prompt from the 10-part framework structure.
    Returns both full and compact versions with tips.
    """
    try:
        full_prompt = build_prompt_from_framework(body.framework)
        compact_prompt = build_compact_prompt(body.framework)
        
        tips = (
            "✓ This prompt includes all 10 framework sections for consistent results\n"
            "✓ The compact version flows naturally for generation\n"
            "✓ Try the 'Lock and Iterate' approach: fix one section at a time\n"
            "✓ If results are inconsistent, strengthen the visual style section"
        )
        
        return BuildPromptResponse(
            full_prompt=full_prompt if body.format == "full" else "",
            compact_prompt=compact_prompt,
            tips=tips,
        )
    except Exception as e:
        logger.exception("Prompt building failed")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/framework/from-description", response_model=FrameworkFromNaturalLanguageResponse)
def create_framework_from_natural_language(
    body: FrameworkFromNaturalLanguageRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Use Groq LLM to help user fill the 10-part framework from natural language description.
    User describes what they want, AI breaks it down into framework sections.
    """
    if not settings.xai_api_key and not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="Framework AI enhancement not available (XAI_API_KEY or GROQ_API_KEY not set)",
        )
    
    try:
        framework_data = enhance_framework_with_ai(body.description)
        
        if not framework_data:
            raise ValueError("Failed to generate framework from description")
        
        return FrameworkFromNaturalLanguageResponse(
            framework=framework_data,
            confidence="high",
        )
    except Exception as e:
        logger.exception("Framework generation from natural language failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/framework/quick-fixes/{issue}", response_model=QuickFixResponse)
def get_quick_fixes(
    issue: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Get quick fix suggestions for common image generation issues.
    Issues: flat_image, anatomy_weird, too_generic, style_drift, background_mess
    """
    hint = get_quick_fixes_for_issue(issue)
    if not hint:
        raise HTTPException(status_code=404, detail=f"Unknown issue: {issue}")
    
    return QuickFixResponse(issue=hint.issue, fixes=hint.fixes)


@app.post("/framework/negatives", response_model=NegativeConstraintsResponse)
def build_negative_constraints(
    body: NegativeConstraintsRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Build comprehensive negative constraints from selected categories.
    Categories: text_and_artifacts, anatomy, quality, geometry_and_artifacts, skin_and_texture
    """
    constraints = build_negative_constraints_from_categories(body.categories)
    return NegativeConstraintsResponse(
        constraints=constraints,
        count=len([c for c in constraints.split(",")]),
    )


# ============================================================================
# STYLE LIBRARY ENDPOINTS - LoRA Management & Artist Credits
# ============================================================================

@app.get("/styles/all", response_model=StylesResponse)
def get_all_styles(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get all available curated styles and LoRAs."""
    styles = list(get_all_curated_styles().values())
    return StylesResponse(styles=styles)


@app.get("/styles/categories", response_model=StyleCategoriesResponse)
def get_style_categories(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get all available style categories."""
    categories = get_categories()
    return StyleCategoriesResponse(categories=categories)


@app.get("/styles/{style_id}", response_model=StyleDetailResponse)
def get_style_detail(
    style_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Get detailed information about a specific style."""
    style = get_style(style_id)
    if not style:
        raise HTTPException(status_code=404, detail=f"Style not found: {style_id}")
    
    return StyleDetailResponse(
        style=style,
        formatted_prompt=format_style_for_prompt(style, include_strength=True),
        with_credit=format_style_with_credit(style),
        parameters=build_style_parameters(style),
    )


@app.post("/styles/search", response_model=StylesResponse)
def search_styles_endpoint(
    body: StyleSearchRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Search styles by name, tags, or category."""
    results = search_styles(body.query, body.category)
    return StylesResponse(styles=results)


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
    if not settings.xai_api_key and not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="Prompt refinement is not available (XAI_API_KEY or GROQ_API_KEY not set).",
        )
    try:
        refined = refine_prompt(body.text)
        return RefineResponse(refined=refined)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Prompt refinement failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/insights", response_model=ChatInsightsResponse)
def chat_insights_endpoint(
    body: ChatInsightsRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Analyze user's chat message and provide conversational insights.
    Helps frontend adapt the UI based on user's intent.
    """
    try:
        insights = get_chat_insights(body.message, body.previous_prompts or [])
        return ChatInsightsResponse(
            should_refine=insights["should_refine"],
            is_variation=insights["is_variation"],
            insight=insights["insight"],
        )
    except Exception as e:
        logger.exception("Chat insights failed")
        # Return defaults on error instead of failing
        return ChatInsightsResponse(
            should_refine=False,
            is_variation=False,
            insight="",
        )


@app.post("/chat/context", response_model=ConversationContextResponse)
def conversation_context_endpoint(
    body: ConversationContextRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Analyze full conversation history to understand user preferences
    and suggest relevant next steps.
    """
    try:
        context = analyze_conversation_context(body.messages)
        return ConversationContextResponse(
            themes=context.get("themes", []),
            preferred_styles=context.get("preferred_styles", []),
            complexity=context.get("complexity", "medium"),
            next_variations=context.get("next_variations", []),
        )
    except Exception as e:
        logger.exception("Conversation context analysis failed")
        # Return defaults on error
        return ConversationContextResponse(
            themes=[],
            preferred_styles=[],
            complexity="medium",
            next_variations=[],
        )


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

    # Pre-sanitize via Groq to avoid Replicate's over-aggressive NSFW filter
    safe_prompt = await asyncio.get_event_loop().run_in_executor(None, lambda: sanitize_for_replicate(prompt))

    # Log incoming image dimensions for debugging
    if body.image_base64:
        try:
            import base64
            from io import BytesIO
            from PIL import Image
            
            # Decode and check original dimensions
            img_data = body.image_base64
            if "base64," in img_data:
                img_data = img_data.split("base64,")[1]
            
            raw_bytes = base64.b64decode(img_data)
            img = Image.open(BytesIO(raw_bytes))
            logger.info(f"[GENERATE_ENDPOINT] Session:{body.session_id[:8] if body.session_id else 'none'} Prompt:'{body.prompt[:30]}...' Image:{img.size[0]}x{img.size[1]}, mode={img.mode}, bytes={len(raw_bytes)}")
        except Exception as e:
            logger.warning(f"[GENERATE_ENDPOINT] Failed to decode image: {e}")

    # Determine which model to use
    use_imagen = (body.model.startswith("gemini-") or body.model.startswith("imagen-")) and is_imagen_available()
    imagen_model = body.model if use_imagen else None
    logger.info(f"Using model: {imagen_model if use_imagen else 'Replicate Flux'}")
    
    # When img2img is requested, require Imagen (Flux doesn't support proper img2img)
    if body.image_base64 and not use_imagen:
        raise HTTPException(
            status_code=503,
            detail="Image-to-image transformation requires Imagen. Please set GEMINI_API_KEY in your backend .env file."
        )
    # Define helper functions outside try block for proper scope
    async def _run_imagen(p: str) -> list[str]:
        """Run Imagen in a thread pool with a 60s timeout."""
        if body.image_base64:
            return await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: [generate_imagen_edit(p, body.image_base64, model=imagen_model)]
                ),
                timeout=60,
            )
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: [generate_imagen(p, model=imagen_model)]
            ),
            timeout=60,
        )
    
    async def _run_replicate(p: str) -> list[str]:
        """Run Replicate in a thread pool with a 180s timeout."""
        # img2img is handled by Imagen only, this is text-to-image only
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, lambda: run_flux(p)),
            timeout=180,
        )
    
    urls: list[str] = []
    fallback_to_flux = False
    
    try:
        if use_imagen:
            try:
                urls = await _run_imagen(safe_prompt)
            except Exception as imagen_error:
                msg = str(imagen_error)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    logger.warning(f"Imagen rate limit hit, falling back to Flux: {msg[:100]}")
                    fallback_to_flux = True
                else:
                    raise
        
        if not use_imagen or fallback_to_flux:
            logger.info(f"Using Flux (fallback={fallback_to_flux})")
            urls = await _run_replicate(safe_prompt)
            
    except asyncio.TimeoutError:
        logger.error("Image generation timed out")
        raise HTTPException(status_code=504, detail="Image generation timed out. Please try again.")
    except ReplicateModelError as e:
        msg = str(e)
        if "429" in msg or "throttled" in msg.lower():
            logger.warning("Rate limit hit from Replicate: %s", msg)
            raise HTTPException(
                status_code=429,
                detail="We're experiencing high demand. Please wait a moment and try again.",
            )
        elif "nsfw" in msg.lower():
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
        if "429" in msg or "throttled" in msg.lower():
            logger.warning("Rate limit detected: %s", msg)
            raise HTTPException(
                status_code=429,
                detail="We're experiencing high demand. Please wait a moment and try again.",
            )
        elif "insufficient credit" in msg.lower() and "replicate.com/account/billing" in msg.lower():
            raise HTTPException(
                status_code=402,
                detail="Replicate account has insufficient billing credit. Visit replicate.com/account/billing to top up.",
            )
        raise HTTPException(status_code=502, detail=msg)

    if not urls:
        raise HTTPException(status_code=502, detail="Image generation failed")

    image_url = urls[0]
    
    # Archive image to Supabase Storage FIRST (blocking, before returning response)
    archived_url = None
    try:
        loop = asyncio.get_event_loop()
        archived_url = await loop.run_in_executor(
            None, 
            lambda: archive_image_to_storage(supabase, user_id, image_url, str(uuid4()))
        )
        if archived_url:
            logger.info(f"Image archived to Supabase: {archived_url}")
            image_url = archived_url  # Use Supabase URL instead of Replicate
        else:
            logger.warning("Failed to archive image, using original URL")
    except Exception as e:
        logger.error(f"Error archiving image: {e}")
        # Continue with original URL if archiving fails

    logger.info(f"About to deduct credits for user {user_id}. Current balance: {get_credits(supabase, user_id)}, cost: {cost}")
    
    if not deduct_credits(supabase, user_id, cost):
        logger.error(f"Credit deduction failed for user {user_id} after image generation")
        raise HTTPException(
            status_code=402, 
            detail="Credit deduction failed. Please refresh the page and try again. If this persists, contact support."
        )

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
            
            # Auto-generate session title from first prompt
            try:
                session_row = supabase.table("chat_sessions").select("title").eq("id", str(session_uuid)).single().execute()
                if session_row.data and session_row.data.get("title", "New chat") == "New chat":
                    new_title = body.prompt[:50].strip()
                    if len(body.prompt) > 50:
                        new_title += "..."
                    supabase.table("chat_sessions").update({"title": new_title}).eq("id", str(session_uuid)).execute()
            except Exception as title_err:
                logger.warning(f"Failed to update session title: {title_err}")
            
            # Insert assistant message with image (using archived URL if available)
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
            
            # Cleanup old archives in background (non-blocking)
            if message_id:
                try:
                    loop = asyncio.get_event_loop()
                    loop.run_in_executor(None, lambda: cleanup_old_archives(supabase, user_id))
                except Exception as e:
                    logger.warning(f"Failed to start cleanup task: {e}")
            
            # Record generation with the final URL (archived if available)
            try:
                supabase.table("image_generations").insert({
                    "user_id": user_id,
                    "session_id": str(session_uuid),
                    "message_id": message_id,
                    "prompt": body.prompt,
                    "image_url": image_url,  # This will be archived URL if successful
                    "model": settings.flux_model,
                    "credits_used": cost,
                }).execute()
            except Exception as gen_error:
                logger.warning(f"Failed to record generation: {gen_error}")
        except Exception as e:
            logger.warning(f"Failed to archive image: {e}")

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


@app.delete("/sessions/{session_id}")
def delete_session(
    session_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Delete a chat session and all its messages."""
    supabase = get_supabase_admin()
    
    # Verify the session belongs to this user
    session = (
        supabase.table("chat_sessions")
        .select("id")
        .eq("id", str(session_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete messages first (cascade will handle this if set up, but being explicit)
    supabase.table("chat_messages").delete().eq("session_id", str(session_id)).execute()
    
    # Delete the session
    supabase.table("chat_sessions").delete().eq("id", str(session_id)).execute()
    
    return {"success": True, "message": "Session deleted"}


@app.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(
    session_id: UUID,
    user_id: Annotated[str, Depends(get_current_user_id)],
    limit: int = Query(50, ge=1, le=200, description="Number of messages to return"),
    before_id: Optional[str] = Query(None, description="Return messages before this message ID (for pagination)"),
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
    
    # Build query with pagination - get latest messages first
    query = (
        supabase.table("chat_messages")
        .select("id, session_id, role, content, image_url, created_at")
        .eq("session_id", str(session_id))
        .order("created_at", desc=True)  # Latest first
    )
    
    # Apply pagination - if before_id provided, get messages before that one
    if before_id:
        # Get the created_at of the reference message
        ref_msg = supabase.table("chat_messages").select("created_at").eq("id", before_id).execute()
        if ref_msg.data:
            query = query.lt("created_at", ref_msg.data[0]["created_at"])
    
    # Apply limit
    query = query.limit(limit)
    
    r = query.execute()
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


class GenerationRecord(BaseModel):
    id: str
    session_id: str
    content: str
    image_url: str
    created_at: str


@app.get("/my-generations")
def my_generations(user_id: Annotated[str, Depends(get_current_user_id)]):
    """Return all images generated by this user, newest first (with prompts from image_generations table)."""
    supabase = get_supabase_admin()
    
    # Query image_generations table which has both prompt and image_url
    r = (
        supabase.table("image_generations")
        .select("id, session_id, message_id, prompt, image_url, model, credits_used, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    
    return {
        "generations": [
            GenerationRecord(
                id=row["id"],
                session_id=row.get("session_id") or "",
                content=row.get("prompt") or "",  # prompt is stored here
                image_url=row["image_url"],
                created_at=row["created_at"],
            )
            for row in (r.data or [])
        ]
    }


class ThinkingRequest(BaseModel):
    prompt: str
    has_uploaded_image: bool = False
    is_refinement: bool = False
    is_img2img: bool = False


class ThinkingStep(BaseModel):
    id: str
    title: str
    content: str
    status: str  # "pending", "active", "complete"
    icon: str


@app.post("/thinking/generate", response_model=list[ThinkingStep])
def get_thinking_steps(body: ThinkingRequest):
    """Generate thinking/reasoning steps for image generation."""
    steps = generate_thinking_steps(
        prompt=body.prompt,
        has_uploaded_image=body.has_uploaded_image,
        is_refinement=body.is_refinement,
        is_img2img=body.is_img2img,
    )
    return steps


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


@app.post("/payments/sync-credits")
def payments_sync_credits(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Debug endpoint: manually sync credits from Stripe subscription. For testing only."""
    import stripe as stripe_lib
    from stripe_payments import (
        _get_or_create_stripe_customer, _resolve_plan_from_subscription,
        _user_id_from_customer, PLANS
    )
    
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    
    supabase = get_supabase_admin()
    
    # Get user's stripe customer ID
    row = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).execute()
    if not row.data or not row.data[0].get("stripe_customer_id"):
        raise HTTPException(status_code=404, detail="No Stripe customer found for this user")
    
    customer_id = row.data[0]["stripe_customer_id"]
    stripe_lib.api_key = settings.stripe_secret_key
    
    try:
        # Get the most recent active subscription
        subs = stripe_lib.Subscription.list(customer=customer_id, status="active", limit=1)
        if not subs.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        sub = subs.data[0]
        plan = _resolve_plan_from_subscription(sub.id)
        if not plan:
            raise HTTPException(status_code=400, detail="Could not resolve plan from subscription")
        
        credits = PLANS[plan]["credits"]
        supabase.table("profiles").update({
            "credits": credits,
            "stripe_subscription_id": sub.id,
            "stripe_plan": plan,
            "stripe_status": sub.get("status", "active"),  # Use Stripe's actual status
        }).eq("id", user_id).execute()
        
        logger.info("Manually synced %d credits for user %s (plan=%s)", credits, user_id, plan)
        return {
            "status": "synced",
            "credits": credits,
            "plan": plan,
            "subscription_id": sub.id,
        }
    except stripe_lib.error.StripeError as e:
        logger.error("Stripe error during sync: %s", e)
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error("Error syncing credits: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# USER FEEDBACK SYSTEM - Thumbs, Ratings, Reports
# ============================================================================

class FeedbackSubmitRequest(BaseModel):
    message_id: str
    feedback_type: str  # thumbs_up, thumbs_down, rating, report, suggestion
    rating: Optional[int] = None  # 1-5 for ratings
    categories: Optional[Dict[str, int]] = None  # {style_accuracy: 4, prompt_following: 5}
    report_reason: Optional[str] = None  # inappropriate, low_quality, etc.
    report_details: Optional[str] = None
    improvement_suggestion: Optional[str] = None


class FeedbackSubmitResponse(BaseModel):
    success: bool
    message: str


class FeedbackStatsResponse(BaseModel):
    thumbs_up: int
    thumbs_down: int
    total_ratings: int
    average_rating: Optional[float]


@app.post("/feedback/submit", response_model=FeedbackSubmitResponse)
def submit_user_feedback(
    body: FeedbackSubmitRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """Submit feedback for a generated image (thumbs, rating, report)."""
    from feedback_system import submit_feedback, FeedbackType, ReportReason
    
    supabase = get_supabase_admin()
    
    # Convert string to enum
    try:
        feedback_type = FeedbackType(body.feedback_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid feedback_type: {body.feedback_type}")
    
    # Convert report reason if provided
    report_reason = None
    if body.report_reason:
        try:
            report_reason = ReportReason(body.report_reason)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid report_reason: {body.report_reason}")
    
    success = submit_feedback(
        supabase=supabase,
        user_id=user_id,
        message_id=body.message_id,
        feedback_type=feedback_type,
        rating=body.rating,
        categories=body.categories,
        report_reason=report_reason,
        report_details=body.report_details,
        improvement_suggestion=body.improvement_suggestion,
    )
    
    if success:
        return FeedbackSubmitResponse(success=True, message="Feedback submitted successfully")
    raise HTTPException(status_code=500, detail="Failed to submit feedback")


@app.get("/feedback/stats/{message_id}", response_model=FeedbackStatsResponse)
def get_feedback_stats_endpoint(
    message_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)] = None,
):
    """Get aggregated feedback stats for a message (public endpoint)."""
    from feedback_system import get_feedback_stats
    
    supabase = get_supabase_admin()
    stats = get_feedback_stats(supabase, message_id)
    
    return FeedbackStatsResponse(**stats)


@app.get("/feedback/history")
def get_user_feedback_history_endpoint(
    user_id: Annotated[str, Depends(get_current_user_id)],
    limit: int = Query(50, ge=1, le=100),
):
    """Get current user's feedback history."""
    from feedback_system import get_user_feedback_history
    
    supabase = get_supabase_admin()
    history = get_user_feedback_history(supabase, user_id, limit)
    
    return {"feedback": history}


# ============================================================================
# INTELLIGENT PROMPT SUGGESTIONS - Context-aware, Trending, Style Completion
# ============================================================================

class PromptSuggestionsRequest(BaseModel):
    conversation_history: List[Dict[str, Any]] = []
    current_prompt: str = ""


class PromptSuggestionsResponse(BaseModel):
    suggestions: List[Dict[str, str]]


class PromptEnhanceRequest(BaseModel):
    prompt: str


class PromptEnhanceResponse(BaseModel):
    original: str
    enhanced: str
    suggested_additions: List[str]
    trending_hashtags: List[str]
    seasonal_suggestions: List[str]


class StyleCompletionRequest(BaseModel):
    partial_text: str


class StyleCompletionResponse(BaseModel):
    completions: List[str]


@app.post("/prompts/suggestions", response_model=PromptSuggestionsResponse)
def get_prompt_suggestions_endpoint(
    body: PromptSuggestionsRequest,
    user_id: Annotated[str, Depends(get_current_user_id)] = None,
):
    """Get context-aware prompt suggestions based on conversation history."""
    from prompt_suggestions import get_context_aware_suggestions
    
    suggestions = get_context_aware_suggestions(
        conversation_history=body.conversation_history,
        current_prompt=body.current_prompt,
    )
    
    return PromptSuggestionsResponse(suggestions=suggestions)


@app.post("/prompts/enhance", response_model=PromptEnhanceResponse)
def enhance_prompt_endpoint(
    body: PromptEnhanceRequest,
    user_id: Annotated[str, Depends(get_current_user_id)] = None,
):
    """Enhance a prompt with trending elements, quality boosters, and seasonal suggestions."""
    from prompt_suggestions import enhance_prompt_with_trends
    
    result = enhance_prompt_with_trends(body.prompt)
    
    return PromptEnhanceResponse(**result)


@app.post("/prompts/complete", response_model=StyleCompletionResponse)
def style_completion_endpoint(
    body: StyleCompletionRequest,
    user_id: Annotated[str, Depends(get_current_user_id)] = None,
):
    """Get style completion suggestions for partial text (e.g., 'Make it more...')."""
    from prompt_suggestions import get_style_completions
    
    completions = get_style_completions(body.partial_text)
    
    return StyleCompletionResponse(completions=completions)


@app.get("/prompts/trending")
def get_trending_elements_endpoint(
    user_id: Annotated[str, Depends(get_current_user_id)] = None,
):
    """Get trending styles, hashtags, and seasonal elements."""
    from prompt_suggestions import TRENDING_ELEMENTS
    from datetime import datetime
    
    # Determine current season
    month = datetime.now().month
    if month in [3, 4, 5]:
        season = "spring"
    elif month in [6, 7, 8]:
        season = "summer"
    elif month in [9, 10, 11]:
        season = "fall"
    else:
        season = "winter"
    
    return {
        "styles": TRENDING_ELEMENTS["styles"][:10],
        "hashtags": TRENDING_ELEMENTS["instagram_trends"],
        "quality_boosters": TRENDING_ELEMENTS["quality_boosters"],
        "seasonal": {
            "current_season": season,
            "elements": TRENDING_ELEMENTS["seasonal_elements"][season],
        },
        "updated_at": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
