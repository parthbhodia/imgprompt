"""Run Replicate Flux text-to-image and image-to-image models."""
import base64
import io
import os
import re
import replicate
from config import settings

# Ensure Replicate client can see the token (from env or backend .env)
_token = os.environ.get("REPLICATE_API_TOKEN") or getattr(settings, "replicate_api_token", None) or ""
if _token:
    os.environ["REPLICATE_API_TOKEN"] = _token

# Model for img2img when user uploads an image (bxclib2/flux_img2img)
FLUX_IMG2IMG_MODEL = "bxclib2/flux_img2img:0ce45202d83c6bd379dfe58f4c0c41e6cadf93ebbd9d938cc63cc0f2fcb729a5"

# Image limits: 5MB per image; dimension check (8000px) is enforced on the frontend.
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGES_PER_REQUEST = 1


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
    raw, media_type = _data_url_to_bytes(image_base64)
    _validate_image_size(raw)
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
    Uses flux-schnell by default for speed; set FLUX_MODEL for flux-1.1-pro etc.
    """
    _ensure_replicate_token()
    model = settings.flux_model
    output = replicate.run(
        model,
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
    _ensure_replicate_token()
    image_url = _upload_image_to_replicate(image_base64)
    # Model accepts image (required) and prompt (optional but important for control)
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
    return _output_to_urls(output)
