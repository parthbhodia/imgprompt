"""Google Imagen 3 image generation service."""
import os
import logging
import time
from typing import Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Initialize Gemini client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def _get_client():
    """Get Gemini client, or raise if not configured."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")
    return genai.Client(api_key=GEMINI_API_KEY)


def generate_imagen(
    prompt: str,
    *,
    aspect_ratio: str = "1:1",
    safety_filter_level: str = "block_some",
    person_generation: str = "allow_adult",
) -> str:
    """
    Generate an image using Google Imagen 3 via Gemini API.
    
    Args:
        prompt: The text prompt for image generation
        aspect_ratio: Image aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9)
        safety_filter_level: Content safety level
        person_generation: Person generation policy
        
    Returns:
        URL or data URI of the generated image
    """
    client = _get_client()
    
    try:
        logger.info(f"Generating Imagen image with prompt: {prompt[:100]}...")
        
        # Map aspect ratio to Imagen format
        ratio_map = {
            "1:1": "1:1",
            "3:4": "3:4", 
            "4:3": "4:3",
            "9:16": "9:16",
            "16:9": "16:9",
        }
        imagen_ratio = ratio_map.get(aspect_ratio, "1:1")
        
        # Generate image
        response = client.models.generate_image(
            model='imagen-3.0-generate-002',
            prompt=prompt,
            config=types.GenerateImageConfig(
                aspect_ratio=imagen_ratio,
                safety_filter_level=safety_filter_level,
                person_generation=person_generation,
                number_of_images=1,
            )
        )
        
        # Imagen returns bytes, convert to base64 for consistency
        if response.generated_images:
            image_bytes = response.generated_images[0].image.image_bytes
            import base64
            base64_str = base64.b64encode(image_bytes).decode('utf-8')
            return f"data:image/png;base64,{base64_str}"
        
        raise RuntimeError("No image generated")
        
    except Exception as e:
        logger.error(f"Imagen generation failed: {e}")
        raise RuntimeError(f"Imagen generation failed: {str(e)}")


def generate_imagen_edit(
    prompt: str,
    reference_image_base64: str,
    *,
    edit_mode: str = "inpainting",  # or "outpainting"
    mask_dilation: float = 0.03,
) -> str:
    """
    Edit/transform an existing image using Imagen 3.
    
    Args:
        prompt: The transformation prompt
        reference_image_base64: Base64 encoded reference image
        edit_mode: Type of edit (inpainting for transformations)
        mask_dilation: How much to extend the mask
        
    Returns:
        URL or data URI of the generated image
    """
    client = _get_client()
    
    try:
        logger.info(f"Generating Imagen edit with prompt: {prompt[:100]}...")
        
        # Decode base64 image
        import base64
        from io import BytesIO
        
        # Remove data URL prefix if present
        if "base64," in reference_image_base64:
            reference_image_base64 = reference_image_base64.split("base64,")[1]
        
        image_bytes = base64.b64decode(reference_image_base64)
        
        # For Imagen edit, we use the image generation with reference
        # Note: Imagen 3 has different API for editing vs generating
        # This is a simplified version - Imagen's edit API is more complex
        
        # Upload to temporary storage or inline
        response = client.models.generate_image(
            model='imagen-3.0-generate-002',
            prompt=prompt,
            reference_images=[
                types.ReferenceImage(
                    reference_id=1,
                    reference_image=types.Image(image_bytes=image_bytes),
                    reference_type="REFERENCE_TYPE_SUBJECT",  # or REFERENCE_TYPE_STYLE
                )
            ],
            config=types.GenerateImageConfig(
                number_of_images=1,
            )
        )
        
        if response.generated_images:
            result_bytes = response.generated_images[0].image.image_bytes
            base64_result = base64.b64encode(result_bytes).decode('utf-8')
            return f"data:image/png;base64,{base64_result}"
        
        raise RuntimeError("No image generated")
        
    except Exception as e:
        logger.error(f"Imagen edit failed: {e}")
        raise RuntimeError(f"Imagen edit failed: {str(e)}")


def is_imagen_available() -> bool:
    """Check if Imagen is configured and available."""
    return bool(GEMINI_API_KEY)


def get_imagen_models() -> list[dict]:
    """Get list of available Imagen models."""
    if not is_imagen_available():
        return []
    
    return [
        {
            "id": "imagen-3.0-generate-002",
            "name": "Imagen 3",
            "provider": "google",
            "description": "High quality, fast generation",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
        }
    ]
