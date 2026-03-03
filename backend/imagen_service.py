"""Google Imagen 3 / Nano Banana image generation service."""
import os
import logging
import base64
from io import BytesIO
from typing import Optional
from PIL import Image
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
    model: str = "gemini-2.5-flash-image",
) -> str:
    """
    Generate an image using Gemini Nano Banana API.
    
    Args:
        prompt: The text prompt for image generation
        aspect_ratio: Image aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9)
        model: Model to use (gemini-2.5-flash-image, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview)
        
    Returns:
        Data URI of the generated image
    """
    client = _get_client()
    
    try:
        logger.info(f"Generating image with {model}, prompt: {prompt[:100]}...")
        
        # Map aspect ratio
        ratio_map = {
            "1:1": "1:1",
            "3:4": "3:4", 
            "4:3": "4:3",
            "9:16": "9:16",
            "16:9": "16:9",
        }
        imagen_ratio = ratio_map.get(aspect_ratio, "1:1")
        
        # Use generate_content API (not generate_image)
        response = client.models.generate_content(
            model=model,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=["Image"],
                image_config=types.ImageConfig(
                    aspect_ratio=imagen_ratio,
                    # Lower steps to reduce resource load (default is usually higher)
                    # Note: Gemini Nano Banana may ignore this, but we try anyway
                ),
            )
        )
        
        # Extract image from response parts
        for part in response.parts:
            if part.inline_data is not None:
                # Get image bytes and convert to base64
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
    model: str = "gemini-2.5-flash-image",
) -> str:
    """
    Edit/transform an existing image using Gemini Nano Banana.
    
    Args:
        prompt: The transformation prompt
        reference_image_base64: Base64 encoded reference image
        model: Model to use
        
    Returns:
        Data URI of the generated image
    """
    client = _get_client()
    
    try:
        logger.info(f"Generating image edit with {model}, prompt: {prompt[:100]}...")
        
        # Decode base64 image
        if "base64," in reference_image_base64:
            reference_image_base64 = reference_image_base64.split("base64,")[1]
        
        image_bytes = base64.b64decode(reference_image_base64)
        
        # Convert to PIL Image
        pil_image = Image.open(BytesIO(image_bytes))
        
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
