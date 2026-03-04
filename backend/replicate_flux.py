"""Run Replicate Flux text-to-image and image-to-image models."""
import base64
import io
import os
import re
import replicate
from config import settings
from PIL import Image

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

# Flux models require dimensions divisible by 16 (not just 8) for VAE compatibility
PATCH_SIZE = 16
print(f"[FLUX_INIT] PATCH_SIZE = {PATCH_SIZE}")


def _ensure_divisible_by_patch_size(width: int, height: int) -> tuple[int, int]:
    """Ensure dimensions are divisible by patch size for model compatibility."""
    new_width = (width // PATCH_SIZE) * PATCH_SIZE
    new_height = (height // PATCH_SIZE) * PATCH_SIZE
    # Ensure minimum size
    new_width = max(PATCH_SIZE, new_width)
    new_height = max(PATCH_SIZE, new_height)
    print(f"[FLUX_MATH] {width}x{height} // {PATCH_SIZE} = {width // PATCH_SIZE}x{height // PATCH_SIZE} -> {new_width}x{new_height}")
    return new_width, new_height


def _resize_image_if_needed(raw: bytes) -> bytes:
    """Resize image to ensure dimensions divisible by patch size."""
    try:
        img = Image.open(io.BytesIO(raw))
        orig_width, orig_height = img.size
        print(f"[FLUX_RESIZE] Input image size: {orig_width}x{orig_height}, mode={img.mode}")
        new_width, new_height = _ensure_divisible_by_patch_size(orig_width, orig_height)
        print(f"[FLUX_RESIZE] Target size: {new_width}x{new_height} (divisible by {PATCH_SIZE})")
        
        if (orig_width, orig_height) != (new_width, new_height):
            print(f"[FLUX_RESIZE] RESIZING from {orig_width}x{orig_height} to {new_width}x{new_height}")
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            img_format = img.format if img.format else "WEBP"
            img.save(buffer, format=img_format, quality=95)
            result = buffer.getvalue()
            print(f"[FLUX_RESIZE] Resized image bytes: {len(result)} bytes")
            return result
        else:
            print(f"[FLUX_RESIZE] NO RESIZE needed - already compatible")
    except Exception as e:
        print(f"[FLUX_RESIZE] Error during resize: {e}")
        import traceback
        traceback.print_exc()
    return raw


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
    raw = _resize_image_if_needed(raw)
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


def run_flux_img2img(prompt: str, image_base64: str, *, num_outputs: int = 1, strength: float = 0.8, guidance_scale: float = 7.5, num_inference_steps: int = 28) -> list[str]:
    """
    Run Flux img2img model using the user's uploaded image and prompt.
    Uploads the image to Replicate, then runs bxclib2/flux_img2img.
    
    Args:
        strength: 0-1, how much to transform (0=original, 1=completely new)
        guidance_scale: how strictly to follow prompt (higher=more adherence)
        num_inference_steps: quality vs speed (more steps=better quality but slower)
    """
    try:
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
SD_IMG2IMG_MODEL = "stability-ai/stable-diffusion-xl-base-1.0"

def run_stable_diffusion_img2img(prompt: str, image_base64: str, *, num_outputs: int = 1, strength: float = 0.75, guidance_scale: float = 7.5, num_inference_steps: int = 50) -> list[str]:
    """
    Run Stable Diffusion XL img2img model.
    Better quality for style transfers and photo transformations.
    
    Args:
        strength: 0-1, how much to transform (0=original, 1=completely new). Default 0.75
        guidance_scale: how strictly to follow prompt. Default 7.5
        num_inference_steps: quality vs speed. Default 50 (higher = better quality)
    """
    try:
        print(f"[SD_IMG2IMG] Starting with prompt: {prompt[:50]}...")
        _ensure_replicate_token()
        print(f"[SD_IMG2IMG] Token valid, uploading image...")
        image_url = _upload_image_to_replicate(image_base64)
        print(f"[SD_IMG2IMG] Image uploaded: {image_url[:80]}...")
        print(f"[SD_IMG2IMG] Running SDXL with strength={strength}, steps={num_inference_steps}")
        
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
