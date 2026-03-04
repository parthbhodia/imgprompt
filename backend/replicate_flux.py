"""Run Replicate Flux text-to-image and image-to-image models."""
import base64
import io
import os
import re
import replicate
from config import settings
from PIL import Image

from image_utils import resize_bytes_if_needed, PATCH_SIZE

# Ensure Replicate client can see the token (from env or backend .env)
_token = os.environ.get("REPLICATE_API_TOKEN") or getattr(settings, "replicate_api_token", None) or ""
if _token:
    os.environ["REPLICATE_API_TOKEN"] = _token

# Model for text-to-image (no image upload)
FLUX_TEXT2IMG_MODEL = "black-forest-labs/flux-1.1-pro-ultra"

# Model for img2img (when user uploads an image) - Flux dev supports image input
FLUX_IMG2IMG_MODEL = "black-forest-labs/flux-dev"

# Image limits: 5MB per image; dimension check (8000px) is enforced on the frontend.
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGES_PER_REQUEST = 1

print(f"[FLUX_INIT] PATCH_SIZE = {PATCH_SIZE} (imported from image_utils)")

# Strong preservation prefix for background edits - locks the person completely
IMG2IMG_PRESERVATION_PREFIX = (
    "Edit ONLY the background of this photo. "
    "The person in the foreground must remain IDENTICAL - "
    "same gender, same skin tone, same body shape, same exact clothing, "
    "same pose, same position in frame. "
    "Treat the person as completely locked and untouchable. "
    "Only modify what is behind them. "
    "Apply this background change: "
)

# Dynamic strength mapping for img2img based on prompt intent
# Lower strength = preserve original more, higher = transform more
STRENGTH_BY_INTENT = {
    "background": 0.15,      # "make background sunny/darker/blurred" - preserve subject (was 0.25)
    "lighting": 0.20,        # "adjust lighting, add shadows" - subtle changes (was 0.30)
    "color": 0.35,           # "change colors" - moderate
    "enhance": 0.10,         # "make it hd/sharper" - preserve everything (was 0.20)
    "style": 0.55,           # "make it cartoon/anime/sketch" - allow style change
    "default": 0.40,         # fallback - balanced
}


def get_strength_for_prompt(prompt: str) -> float:
    """
    Determine appropriate img2img strength based on prompt intent.
    
    Strength guide:
    - 0.20-0.30: Background/lighting changes, subject fully preserved
    - 0.40-0.55: Style transfer (cartoon, anime) - some transformation allowed
    - 0.60+: Heavy transformation, subject identity may be lost
    
    Using 0.75 for background changes causes the model to rebuild the entire
    image, replacing the subject with a random person.
    """
    p = prompt.lower()
    
    # Explicit preservation requests - use minimum strength
    preservation_phrases = [
        "keep the subject", "keep subject", "same subject", "same person",
        "keep the person", "keep person", "keep the same", "same face",
        "preserve subject", "preserve the subject", "preserve identity",
        "keep identity", "same identity", "don't change the person",
        "dont change the person", "keep me", "keep my face"
    ]
    if any(phrase in p for phrase in preservation_phrases):
        print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' has EXPLICIT PRESERVATION request -> strength=0.10")
        return 0.10
    
    # Background/scene changes - low strength to preserve subject
    if any(w in p for w in ["background", "sky", "sunny", "weather", "scene", "beach", "mountain", "city"]):
        print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' detected as BACKGROUND -> strength=0.15")
        return 0.15
    
    # Lighting adjustments - very subtle
    if any(w in p for w in ["lighting", "light", "bright", "dark", "shadow", "glow", "sunlight", "golden hour"]):
        print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' detected as LIGHTING -> strength=0.20")
        return 0.20
    
    # Quality enhancements - minimal change, just improve details
    if any(w in p for w in ["hd", "enhance", "sharpen", "quality", "4k", "8k", "high res", "clear", "crisp", "sharp"]):
        print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' detected as ENHANCE -> strength=0.10")
        return 0.10
    
    # Color adjustments - moderate
    if any(w in p for w in ["color", "vibrant", "saturated", "warm", "cool tone", "sepia", "black and white", "monochrome"]):
        print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' detected as COLOR -> strength=0.35")
        return 0.35
    
    # Style transfers - allow more transformation
    if any(w in p for w in ["cartoon", "anime", "sketch", "drawing", "painting", "art", "style", "oil", "watercolor", "comic", "pixar", "disney", "3d", "render", "cinematic", "vintage", "retro", "cyberpunk", "steampunk"]):
        print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' detected as STYLE -> strength=0.55")
        return 0.55
    
    # Default - balanced approach
    print(f"[FLUX_STRENGTH] Prompt '{prompt[:30]}...' no specific intent -> default strength=0.40")
    return 0.40


def _data_url_to_bytes(data_url: str) -> tuple[bytes, str]:
    """Parse data URL (e.g. data:image/png;base64,...) to (raw_bytes, media_type)."""
    match = re.match(r"data:([^;]+);base64,(.+)", data_url.strip())
    if not match:
        raise ValueError("Invalid image data URL; expected data:image/...;base64,...")
    media_type = match.group(1).strip()
    b64 = match.group(2)
    raw = base64.standard_b64decode(b64)
    return raw, media_type


def _validate_image_size(raw: bytes) -> None:
    """Enforce max size 5MB per image. Dimension limit (8000px) is enforced on the frontend."""
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError(
            f"Image too large. Max size is {MAX_IMAGE_BYTES // (1024*1024)}MB (got {len(raw)/(1024*1024):.1f}MB)."
        )


def _upload_image_to_replicate(image_base64: str) -> str:
    """Upload image (data URL) to Replicate and return the file URL for use as model input. Enforces max 5MB."""
    print(f"[FLUX_UPLOAD] Starting image upload, base64 length: {len(image_base64)}")
    raw, media_type = _data_url_to_bytes(image_base64)
    print(f"[FLUX_UPLOAD] Decoded bytes: {len(raw)}, media_type: {media_type}")
    
    # Log original dimensions before resize
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(raw))
        print(f"[FLUX_UPLOAD] Original dimensions before resize: {img.size[0]}x{img.size[1]}, mode={img.mode}")
    except Exception as e:
        print(f"[FLUX_UPLOAD] Could not read original dimensions: {e}")
    
    _validate_image_size(raw)
    # Resize to ensure dimensions divisible by patch size (Flux requirement)
    print(f"[FLUX_UPLOAD] Calling resize function...")
    raw = resize_bytes_if_needed(raw)
    print(f"[FLUX_UPLOAD] After resize: {len(raw)} bytes")
    
    # Log final dimensions after resize
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(raw))
        print(f"[FLUX_UPLOAD] Final dimensions after resize: {img.size[0]}x{img.size[1]}, mode={img.mode}")
        print(f"[FLUX_UPLOAD] CHECK: {img.size[0]} % 16 = {img.size[0] % 16}, {img.size[1]} % 16 = {img.size[1] % 16}")
    except Exception as e:
        print(f"[FLUX_UPLOAD] Could not read final dimensions: {e}")
    media_type_to_ext = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp"
    }
    ext = next(
        (ext for mtype, ext in media_type_to_ext.items() if mtype in media_type),
        "webp"
    )
    filename = f"input.{ext}"
    f = replicate.files.create(io.BytesIO(raw), filename=filename, content_type=media_type)
    if not f.urls:
        raise ValueError("Replicate file upload returned no URL")
    return f.urls.get("get") or next(iter(f.urls.values()))


def _ensure_replicate_token() -> None:
    token = os.environ.get("REPLICATE_API_TOKEN") or getattr(settings, "replicate_api_token", None)
    if not token or token.startswith("your-") or token == "your-replicate-api-token":
        raise ValueError(
            "Replicate API token is missing or invalid. "
            "Set REPLICATE_API_TOKEN in backend/.env with a token from https://replicate.com/account/api-tokens"
        )


def _output_to_urls(output) -> list[str]:
    """
    Convert any Replicate output shape to a list of HTTPS URL strings.
    Handles: str, list[str|FileOutput], single FileOutput (newer SDK).
    """
    if output is None:
        return []
    if isinstance(output, str):
        return [output] if output.startswith("http") else []
    if isinstance(output, list):
        return [str(u) for u in output if str(u).startswith("http")]
    # FileOutput or any object whose str() is the URL (newer replicate SDK)
    url = str(output)
    return [url] if url.startswith("http") else []


def run_flux(prompt: str, *, num_outputs: int = 1, guidance_scale: float = 3.5, num_inference_steps: int = 28) -> list[str]:
    """
    Run Flux text-to-image model and return list of image URLs.
    Uses flux-1.1-pro-ultra for best quality text-to-image generation.
    """
    _ensure_replicate_token()
    output = replicate.run(
        FLUX_TEXT2IMG_MODEL,
        input={
            "prompt": prompt,
            "num_outputs": num_outputs,
            "guidance_scale": guidance_scale,
            "num_inference_steps": num_inference_steps,
        },
    )
    return _output_to_urls(output)


def run_flux_img2img(prompt: str, image_base64: str, *, num_outputs: int = 1, strength: float = None, guidance_scale: float = 7.5, num_inference_steps: int = 28) -> list[str]:
    """
    Run Flux img2img model using the user's uploaded image and prompt.
    Uploads the image to Replicate, then runs bxclib2/flux_img2img.
    
    Args:
        strength: 0-1, how much to transform (0=original, 1=completely new).
                  If None, automatically determined from prompt intent.
        guidance_scale: how strictly to follow prompt (higher=more adherence)
        num_inference_steps: quality vs speed (more steps=better quality but slower)
    """
    try:
        # Auto-determine strength if not provided
        if strength is None:
            strength = get_strength_for_prompt(prompt)
        
        print(f"[FLUX_IMG2IMG] Starting with prompt: {prompt[:50]}...")
        _ensure_replicate_token()
        print(f"[FLUX_IMG2IMG] Token valid, uploading image...")
        image_url = _upload_image_to_replicate(image_base64)
        print(f"[FLUX_IMG2IMG] Image uploaded: {image_url[:80]}...")
        # Model accepts image (required) and prompt (optional but important for control)
        print(f"[FLUX_IMG2IMG] Running model with strength={strength}, steps={num_inference_steps}")
        output = replicate.run(
            FLUX_IMG2IMG_MODEL,
            input={
                "image": image_url, 
                "prompt": prompt,
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
            },
        )
        print(f"[FLUX_IMG2IMG] Model output received")
        return _output_to_urls(output)
    except Exception as e:
        print(f"[FLUX_IMG2IMG] ERROR: {type(e).__name__}: {str(e)[:200]}")
        import traceback
        traceback.print_exc()
        raise


# Stable Diffusion for img2img - better quality and more control
# Using Flux dev for img2img as it's more reliable on Replicate
SD_IMG2IMG_MODEL = "black-forest-labs/flux-dev"

def run_stable_diffusion_img2img(prompt: str, image_base64: str, *, num_outputs: int = 1, strength: float = None, guidance_scale: float = 7.5, num_inference_steps: int = 50) -> list[str]:
    """
    Run Stable Diffusion XL img2img model.
    Better quality for style transfers and photo transformations.
    
    Args:
        strength: 0-1, how much to transform (0=original, 1=completely new).
                  If None, automatically determined from prompt intent.
        guidance_scale: how strictly to follow prompt. Default 7.5
        num_inference_steps: quality vs speed. Default 50 (higher = better quality)
    """
    try:
        # Auto-determine strength if not provided
        if strength is None:
            strength = get_strength_for_prompt(prompt)
        
        print(f"[SD_IMG2IMG] Starting with prompt: {prompt[:50]}...")
        _ensure_replicate_token()
        print(f"[SD_IMG2IMG] Token valid, uploading image...")
        image_url = _upload_image_to_replicate(image_base64)
        print(f"[SD_IMG2IMG] Image uploaded: {image_url[:80]}...")
        print(f"[SD_IMG2IMG] ====== REQUEST PARAMETERS ======")
        print(f"[SD_IMG2IMG] Model: {SD_IMG2IMG_MODEL}")
        print(f"[SD_IMG2IMG] Prompt: {prompt}")
        print(f"[SD_IMG2IMG] Image URL: {image_url[:80]}...")
        print(f"[SD_IMG2IMG] Parameters:")
        print(f"[SD_IMG2IMG]   - strength: {strength} (0=original, 1=new)")
        print(f"[SD_IMG2IMG]   - guidance_scale: {guidance_scale}")
        print(f"[SD_IMG2IMG]   - num_inference_steps: {num_inference_steps}")
        print(f"[SD_IMG2IMG]   - num_outputs: {num_outputs}")
        print(f"[SD_IMG2IMG] ====== CALLING REPLICATE ======")
        
        output = replicate.run(
            SD_IMG2IMG_MODEL,
            input={
                "image": image_url,
                "prompt": prompt,
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
                "num_outputs": num_outputs,
            },
        )
        print(f"[SD_IMG2IMG] Model output received")
        return _output_to_urls(output)
    except Exception as e:
        print(f"[SD_IMG2IMG] ERROR: {type(e).__name__}: {str(e)[:200]}")
        import traceback
        traceback.print_exc()
        raise
