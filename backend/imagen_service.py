"""Google Imagen 3 / Nano Banana image generation service."""
import os
import logging
import base64
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Initialize Gemini client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Log Imagen availability on module load
print(f"[IMAGEN_INIT] GEMINI_API_KEY present: {bool(GEMINI_API_KEY)} (length: {len(GEMINI_API_KEY)})")

# Imagen models require dimensions divisible by 16 for best compatibility
PATCH_SIZE = 16


def _ensure_divisible_by_patch_size(width: int, height: int) -> Tuple[int, int]:
    """Ensure dimensions are divisible by patch size for model compatibility."""
    new_width = (width // PATCH_SIZE) * PATCH_SIZE
    new_height = (height // PATCH_SIZE) * PATCH_SIZE
    # Ensure minimum size
    new_width = max(PATCH_SIZE, new_width)
    new_height = max(PATCH_SIZE, new_height)
    return new_width, new_height


def _resize_image_if_needed(pil_image: Image.Image) -> Image.Image:
    """Resize image to ensure dimensions divisible by patch size."""
    orig_width, orig_height = pil_image.size
    print(f"[IMAGEN_RESIZE] Input image size: {orig_width}x{orig_height}")
    new_width, new_height = _ensure_divisible_by_patch_size(orig_width, orig_height)
    print(f"[IMAGEN_RESIZE] Target size: {new_width}x{new_height} (divisible by {PATCH_SIZE})")
    
    if (orig_width, orig_height) != (new_width, new_height):
        pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        print(f"[IMAGEN_RESIZE] RESIZED to {pil_image.size[0]}x{pil_image.size[1]}")
    else:
        print(f"[IMAGEN_RESIZE] NO RESIZE needed - already compatible")
    
    return pil_image


def _get_client():
    """Get Gemini client, or raise if not configured."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")
    return genai.Client(api_key=GEMINI_API_KEY)


def _is_native_imagen_model(model: str) -> bool:
    """Check if model is a native Imagen model (uses generate_images API)."""
    return model.startswith("imagen-")


def generate_imagen(
    prompt: str,
    *,
    aspect_ratio: str = "1:1",
    model: str = "imagen-4-fast-generate-001",
) -> str:
    """
    Generate an image using Google Imagen API.
    
    Args:
        prompt: The text prompt for image generation
        aspect_ratio: Image aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9)
        model: Model to use (default: imagen-4-fast-generate-001 for best rate limits)
        
    Returns:
        Data URI of the generated image
    """
    client = _get_client()
    
    try:
        logger.info(f"Generating image with {model}, prompt: {prompt[:100]}...")
        
        if _is_native_imagen_model(model):
            # Native Imagen 4 models use generate_images API
            response = client.models.generate_images(
                model=model,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                ),
            )
            for generated_image in response.generated_images:
                image_bytes = generated_image.image.image_bytes
                base64_str = base64.b64encode(image_bytes).decode('utf-8')
                return f"data:image/png;base64,{base64_str}"
            raise RuntimeError("No image generated in response")
        else:
            # Gemini models use generate_content with Image modality
            ratio_map = {"1:1": "1:1", "3:4": "3:4", "4:3": "4:3", "9:16": "9:16", "16:9": "16:9"}
            imagen_ratio = ratio_map.get(aspect_ratio, "1:1")
            response = client.models.generate_content(
                model=model,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["Image"],
                    image_config=types.ImageConfig(aspect_ratio=imagen_ratio),
                )
            )
            for part in response.parts:
                if part.inline_data is not None:
                    image_bytes = part.inline_data.data
                    mime_type = part.inline_data.mime_type or "image/png"
                    base64_str = base64.b64encode(image_bytes).decode('utf-8')
                    return f"data:{mime_type};base64,{base64_str}"
            raise RuntimeError("No image generated in response")
        
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        raise RuntimeError(f"Image generation failed: {str(e)}")


def generate_imagen_edit(
    prompt: str,
    reference_image_base64: str,
    *,
    model: str = "imagen-4-fast-generate-001",
) -> str:
    """
    Edit/transform an existing image using Google Imagen API.
    Native Imagen models don't support image input via Google AI SDK,
    so we always use gemini-2.5-flash-image for edits.
    
    Args:
        prompt: The transformation prompt
        reference_image_base64: Base64 encoded reference image
        model: Requested model (native Imagen models fall back to gemini-2.5-flash-image)
        
    Returns:
        Data URI of the generated image
    """
    # Native Imagen models don't support image input - fall back to Gemini for edits
    if _is_native_imagen_model(model):
        logger.info(f"Model {model} doesn't support image editing, falling back to gemini-2.5-flash-image")
        model = "gemini-2.5-flash-image"
    client = _get_client()
    
    try:
        logger.info(f"Generating image edit with {model}, prompt: {prompt[:100]}...")
        
        # Decode base64 image
        if "base64," in reference_image_base64:
            reference_image_base64 = reference_image_base64.split("base64,")[1]
        
        image_bytes = base64.b64decode(reference_image_base64)
        print(f"[IMAGEN_EDIT] Decoded image bytes: {len(image_bytes)} bytes")
        
        # Convert to PIL Image and resize to ensure dimensions divisible by 16
        pil_image = Image.open(BytesIO(image_bytes))
        print(f"[IMAGEN_EDIT] PIL Image opened: {pil_image.size[0]}x{pil_image.size[1]}, mode={pil_image.mode}")
        pil_image = _resize_image_if_needed(pil_image)
        print(f"[IMAGEN_EDIT] After resize: {pil_image.size[0]}x{pil_image.size[1]}")
        
        # Use generate_content with image input
        response = client.models.generate_content(
            model=model,
            contents=[prompt, pil_image],
            config=types.GenerateContentConfig(
                response_modalities=["Image"],
            )
        )
        
        # Extract image from response parts
        for part in response.parts:
            if part.inline_data is not None:
                result_bytes = part.inline_data.data
                mime_type = part.inline_data.mime_type or "image/png"
                base64_result = base64.b64encode(result_bytes).decode('utf-8')
                return f"data:{mime_type};base64,{base64_result}"
        
        raise RuntimeError("No image generated in response")
        
    except Exception as e:
        logger.error(f"Image edit failed: {e}")
        raise RuntimeError(f"Image edit failed: {str(e)}")


def is_imagen_available() -> bool:
    """Check if Imagen is configured and available."""
    return bool(GEMINI_API_KEY)


def get_imagen_models() -> list[dict]:
    """Get list of available Imagen models - prioritized by rate limits."""
    if not is_imagen_available():
        return []
    
    # Top 4 models prioritized by rate limits (higher = better)
    # Rate limits: Imagen 4 models = 25/day, Nano Banana = varies
    return [
        {
            "id": "imagen-4-fast-generate-001",
            "name": "Imagen 4 Fast",
            "provider": "google",
            "description": "Fastest generation (25 req/day)",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 1,
        },
        {
            "id": "imagen-4-generate-001", 
            "name": "Imagen 4",
            "provider": "google",
            "description": "Balanced quality & speed (25 req/day)",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 2,
        },
        {
            "id": "imagen-4-ultra-generate-001",
            "name": "Imagen 4 Ultra", 
            "provider": "google",
            "description": "Highest quality (25 req/day)",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 3,
        },
        {
            "id": "gemini-2.5-flash-image",
            "name": "Nano Banana (Flash)",
            "provider": "google",
            "description": "Experimental image model",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 4,
        },
    ]
