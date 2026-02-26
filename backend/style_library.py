"""
Style Library & LoRA Management
Stores custom AI model styles, trigger words, and artist credits.
"""
import logging
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)


class LoRAStyle(BaseModel):
    """A custom LoRA style or art model."""
    id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=5, max_length=500)
    trigger_word: str = Field(..., min_length=1, max_length=100)
    recommended_strength: float = Field(default=0.9, ge=0.0, le=1.0)
    negative_tags: list[str] = Field(default_factory=list)
    
    # Artist & Credit info
    artist_name: str = Field(..., min_length=1, max_length=100)
    artist_url: Optional[str] = Field(default=None, max_length=500)
    credit_text: str = Field(..., min_length=5, max_length=200)
    
    # Generation parameters
    recommended_model: Optional[str] = Field(default=None)
    recommended_cfg: Optional[float] = Field(default=None, ge=0, le=50)
    recommended_steps: Optional[int] = Field(default=None, ge=10, le=100)
    recommended_sampler: Optional[str] = Field(default=None)
    
    # Category & tags
    category: str = Field(default="custom")  # anime, illustration, photorealistic, etc.
    tags: list[str] = Field(default_factory=list)
    preview_image_url: Optional[str] = Field(default=None)
    

class UserSavedStyle(BaseModel):
    """A user's saved favorite style."""
    style_id: str
    saved_at: str
    custom_notes: Optional[str] = None


# Built-in curated styles library
CURATED_STYLES = {
    "1wa0": LoRAStyle(
        id="1wa0",
        name="WAI Illustrious Style",
        description="High-quality anime and illustration style with excellent detail and character consistency",
        trigger_word="1wa0",
        recommended_strength=0.95,
        negative_tags=["censored", "mosaic censoring"],
        artist_name="WAI Community",
        artist_url="https://huggingface.co/spaces/wai-models",
        credit_text="Support the artist at their HuggingFace page",
        recommended_model="WAI Illustrious V15",
        recommended_cfg=5.0,
        recommended_steps=35,
        recommended_sampler="Euler a",
        category="anime",
        tags=["anime", "illustration", "character", "high-quality"],
    ),
    "niji": LoRAStyle(
        id="niji",
        name="Niji Journey",
        description="Japanese anime and manga art style with vibrant colors and expressive characters",
        trigger_word="niji",
        recommended_strength=0.8,
        negative_tags=["low quality", "blurry"],
        artist_name="Midjourney",
        artist_url="https://midjourney.com",
        credit_text="Powered by Midjourney's Niji model",
        category="anime",
        tags=["anime", "manga", "japanese", "vibrant"],
    ),
    "lomo": LoRAStyle(
        id="lomo",
        name="Lomography Film",
        description="Vintage lomography film aesthetic with rich colors and vignetting",
        trigger_word="lomo film",
        recommended_strength=0.85,
        negative_tags=["digital blur", "noise"],
        artist_name="Film Community",
        artist_url="None",
        credit_text="Inspired by classic film photography",
        category="photorealistic",
        tags=["film", "vintage", "analog", "lomo"],
    ),
    "cinemagraph": LoRAStyle(
        id="cinemagraph",
        name="Cinemagraph Style",
        description="Cinematic photography with dramatic lighting and composition",
        trigger_word="cinemagraph, cinematic",
        recommended_strength=0.9,
        negative_tags=["overexposed", "underexposed"],
        artist_name="Cinematic Community",
        artist_url="None",
        credit_text="Professional cinematic photography style",
        recommended_cfg=7.0,
        recommended_steps=40,
        category="photorealistic",
        tags=["cinematic", "film", "dramatic", "professional"],
    ),
}


def get_all_curated_styles() -> dict[str, LoRAStyle]:
    """Get all built-in curated styles."""
    return CURATED_STYLES


def get_style(style_id: str) -> Optional[LoRAStyle]:
    """Get a specific style by ID."""
    return CURATED_STYLES.get(style_id)


def search_styles(query: str, category: Optional[str] = None) -> list[LoRAStyle]:
    """
    Search styles by name, description, or tags.
    
    Args:
        query: Search term
        category: Optional category filter
    
    Returns:
        List of matching styles
    """
    query_lower = query.lower()
    results = []
    
    for style in CURATED_STYLES.values():
        # Apply category filter if provided
        if category and style.category != category:
            continue
        
        # Search in name, description, tags, and trigger word
        if (query_lower in style.name.lower() or
            query_lower in style.description.lower() or
            query_lower in style.trigger_word.lower() or
            any(query_lower in tag.lower() for tag in style.tags)):
            results.append(style)
    
    return results


def get_categories() -> list[str]:
    """Get all available style categories."""
    categories = set()
    for style in CURATED_STYLES.values():
        categories.add(style.category)
    return sorted(list(categories))


def format_style_for_prompt(style: LoRAStyle, include_strength: bool = False) -> str:
    """
    Format a style into a prompt-ready string.
    
    Args:
        style: The LoRA style
        include_strength: Whether to include strength info
    
    Returns:
        Formatted prompt text
    """
    base = f"{style.trigger_word}"
    
    if include_strength:
        base += f" (strength: {style.recommended_strength})"
    
    if style.negative_tags:
        base += f" | Avoid: {', '.join(style.negative_tags)}"
    
    return base


def format_style_with_credit(style: LoRAStyle) -> str:
    """
    Format a style with artist credit for display.
    """
    credit_line = f"🎨 {style.credit_text}"
    
    if style.artist_url:
        credit_line += f"\n👤 {style.artist_name}: {style.artist_url}"
    else:
        credit_line += f"\n👤 By {style.artist_name}"
    
    return credit_line


def build_style_parameters(style: LoRAStyle) -> dict:
    """
    Build generation parameters from style recommendations.
    """
    params = {
        "trigger_word": style.trigger_word,
        "strength": style.recommended_strength,
    }
    
    if style.recommended_model:
        params["model"] = style.recommended_model
    if style.recommended_cfg is not None:
        params["cfg"] = style.recommended_cfg
    if style.recommended_steps is not None:
        params["steps"] = style.recommended_steps
    if style.recommended_sampler:
        params["sampler"] = style.recommended_sampler
    
    if style.negative_tags:
        params["negative_tags"] = style.negative_tags
    
    return params
