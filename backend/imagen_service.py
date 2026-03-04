"""Google Imagen 3 / Nano Banana image generation service."""
import os
import sys
import logging
import base64
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image
from google import genai
from google.genai import types

from image_utils import resize_image_if_needed, PATCH_SIZE

logger = logging.getLogger(__name__)

# Weak prompt expansions - map vague user inputs to detailed instructions
# This prevents identity loss when users type generic terms like "make it hd"
WEAK_PROMPT_EXPANSIONS = {
    # Quality enhancements
    "hd": "enhance photo quality, increase sharpness and detail, improve lighting",
    "make it hd": "enhance photo quality, increase sharpness and detail, improve lighting",
    "high quality": "enhance photo quality, increase sharpness and detail, improve lighting",
    "enhance": "enhance photo quality, increase sharpness and detail, improve lighting",
    "better quality": "enhance photo quality, increase sharpness and detail, improve lighting",
    "improve": "enhance photo quality, increase sharpness and detail, improve lighting",
    "upgrade": "enhance photo quality, increase sharpness and detail, improve lighting",
    "4k": "enhance photo quality to 4K resolution, increase sharpness and detail",
    "8k": "enhance photo quality to 8K resolution, increase sharpness and detail",
    # Style transformations
    "cartoon": "convert to cartoon illustration style",
    "anime": "convert to anime art style",
    "sketch": "convert to pencil sketch drawing",
    "painting": "convert to oil painting style",
    "cinematic": "apply cinematic color grading and dramatic lighting",
    "oil painting": "convert to oil painting style",
    "watercolor": "convert to watercolor painting style",
    "pencil": "convert to pencil sketch drawing",
    "drawing": "convert to hand-drawn illustration style",
    "3d": "convert to 3D rendered style",
    "pixar": "convert to Pixar 3D animation style",
    "disney": "convert to Disney animation style",
    "marvel": "convert to Marvel comic book style",
    "comic": "convert to comic book illustration style",
    "vintage": "apply vintage film photography style",
    "retro": "apply retro aesthetic style",
    "cyberpunk": "apply cyberpunk futuristic style with neon lighting",
    "steampunk": "apply steampunk Victorian-futuristic style",
}

IMG2IMG_PRESERVATION_PREFIX = (
    "Edit this exact photo while preserving the original person's "
    "face, skin tone, body, pose, and identity. "
    "Do not replace or alter the subject. "
    "Apply only this change: "
)


def _expand_weak_prompt(prompt: str) -> str:
    """Expand weak/vague prompts to detailed instructions."""
    normalized = prompt.lower().strip()
    
    # Check for exact match in dictionary
    if normalized in WEAK_PROMPT_EXPANSIONS:
        expanded = WEAK_PROMPT_EXPANSIONS[normalized]
        print(f"[IMAGEN_EDIT] WEAK PROMPT EXPANDED: '{prompt}' -> '{expanded}'")
        return expanded
    
    # Check for partial matches (e.g., "make it cartoon style" contains "cartoon")
    for key, expansion in WEAK_PROMPT_EXPANSIONS.items():
        if key in normalized and len(normalized) < 30:  # Short prompt containing keyword
            print(f"[IMAGEN_EDIT] WEAK PROMPT PARTIAL MATCH: '{prompt}' contains '{key}' -> '{expansion}'")
            return expansion
    
    # No expansion needed - return original
    return prompt


def _build_img2img_prompt(user_prompt: str) -> str:
    """Build a safe img2img prompt that preserves subject identity."""
    # Expand weak prompts
    expanded_prompt = _expand_weak_prompt(user_prompt)
    
    # Detect removal requests
    removal_keywords = ['remove', 'delete', 'erase', 'take off', 'get rid of', 'without the', 'no ']
    is_removal = any(keyword in user_prompt.lower() for keyword in removal_keywords)
    
    if is_removal:
        # For removal: specific instruction with identity preservation
        return (
            f"Edit this exact photo to: {user_prompt}. "
            f"CRITICAL: Keep the exact same person - same face, same hair, same skin tone, "
            f"same pose angle, same clothing. Only make the specific change requested. "
            f"Preserve facial features and identity perfectly."
        )
    else:
        # Standard preservation prefix + expanded prompt
        return f"{IMG2IMG_PRESERVATION_PREFIX}{expanded_prompt}"


# Initialize Gemini client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Log Imagen availability on module load
print(f"[IMAGEN_INIT] GEMINI_API_KEY present: {bool(GEMINI_API_KEY)} (length: {len(GEMINI_API_KEY)})")
sys.stdout.flush()


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
    model: str = "imagen-3.0-fast-generate-001",
) -> str:
    """
    Generate an image using Google Imagen API.
    
    Args:
        prompt: The text prompt for image generation
        aspect_ratio: Image aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9)
        model: Model to use (default: imagen-3.0-fast-generate-001 for best rate limits)
        
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
    model: str = "imagen-3.0-fast-generate-001",
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
    # CRITICAL: Log entry to confirm this function is being called
    print(f"\n[IMAGEN_EDIT] ========== FUNCTION ENTERED ==========")
    print(f"[IMAGEN_EDIT] Prompt received: {prompt[:50]}...")
    print(f"[IMAGEN_EDIT] Image data length: {len(reference_image_base64)} chars")
    sys.stdout.flush()
    
    # Native Imagen models don't support image input - fall back to Gemini for edits
    actual_model = model
    if _is_native_imagen_model(model):
        logger.warning(f"Model {model} doesn't support image editing, falling back to gemini-2.5-flash-image")
        print(f"[IMAGEN_EDIT] Model swap: {model} -> gemini-2.5-flash-image (native Imagen doesn't support img2img)")
        sys.stdout.flush()
        model = "gemini-2.5-flash-image"
    client = _get_client()
    
    try:
        # Build subject-preserving prompt with weak prompt expansion
        anchored_prompt = _build_img2img_prompt(prompt)
        
        logger.info(f"Generating image edit with {model}, anchored prompt: {anchored_prompt[:100]}...")
        print(f"[IMAGEN_EDIT] Using model: {model} (requested: {actual_model})")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] Anchored prompt: {anchored_prompt[:80]}...")
        sys.stdout.flush()
        
        # Decode base64 image
        if "base64," in reference_image_base64:
            reference_image_base64 = reference_image_base64.split("base64,")[1]
        
        image_bytes = base64.b64decode(reference_image_base64)
        print(f"[IMAGEN_EDIT] Decoded image bytes: {len(image_bytes)} bytes")
        
        # DEBUG: Save received image to verify correct image is being processed
        debug_path = "/tmp/debug_input_image.jpg"
        try:
            with open(debug_path, "wb") as f:
                f.write(image_bytes)
            print(f"[IMAGEN_EDIT] DEBUG: Saved input image to {debug_path}")
        except Exception as save_err:
            print(f"[IMAGEN_EDIT] DEBUG: Could not save image: {save_err}")
        
        sys.stdout.flush()
        
        # Convert to PIL Image and resize to ensure dimensions divisible by 16
        pil_image = Image.open(BytesIO(image_bytes))
        print(f"[IMAGEN_EDIT] PIL Image opened: {pil_image.size[0]}x{pil_image.size[1]}, mode={pil_image.mode}")
        sys.stdout.flush()
        pil_image = resize_image_if_needed(pil_image)
        print(f"[IMAGEN_EDIT] After resize: {pil_image.size[0]}x{pil_image.size[1]}")
        sys.stdout.flush()
        
        # Use generate_content with image input
        # Image FIRST, then prompt - this tells model "edit this image" rather than "generate something like this"
        print(f"[IMAGEN_EDIT] ====== REQUEST DETAILS ======")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] Model: {model}")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] Image size: {pil_image.size}")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] Image mode: {pil_image.mode}")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] Prompt: {anchored_prompt}")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] Content array: [PIL.Image, str] (image object first)")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] ====== REQUEST PARAMETERS ======")
        print(f"[IMAGEN_EDIT] Model: {model}")
        print(f"[IMAGEN_EDIT] Prompt: {anchored_prompt}")
        print(f"[IMAGEN_EDIT] Image size: {pil_image.size}")
        print(f"[IMAGEN_EDIT] Image mode: {pil_image.mode}")
        print(f"[IMAGEN_EDIT] Config:")
        print(f"[IMAGEN_EDIT]   - response_modalities: ['Image']")
        print(f"[IMAGEN_EDIT]   - temperature: 0.8 (higher for portrait/img2img)")
        print(f"[IMAGEN_EDIT]   - top_p: 0.95")
        print(f"[IMAGEN_EDIT]   - safety_settings: BLOCK_NONE for all categories")
        sys.stdout.flush()
        print(f"[IMAGEN_EDIT] ====== CALLING GEMINI ======")
        sys.stdout.flush()
        
        response = client.models.generate_content(
            model=model,
            contents=[pil_image, anchored_prompt],  # Image FIRST, then prompt
            config=types.GenerateContentConfig(
                response_modalities=["Image"],
                temperature=0.8,  # Higher temp for portrait/img2img - more creative freedom, less hallucination
                top_p=0.95,
                safety_settings=[
                    types.SafetySetting(
                        category="HARM_CATEGORY_HARASSMENT",
                        threshold="BLOCK_NONE"
                    ),
                    types.SafetySetting(
                        category="HARM_CATEGORY_HATE_SPEECH",
                        threshold="BLOCK_NONE"
                    ),
                    types.SafetySetting(
                        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold="BLOCK_NONE"
                    ),
                    types.SafetySetting(
                        category="HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold="BLOCK_NONE"
                    ),
                ]
            )
        )
        
        print(f"[IMAGEN_EDIT] ====== RESPONSE RECEIVED ======")
        print(f"[IMAGEN_EDIT] Response type: {type(response)}")
        print(f"[IMAGEN_EDIT] Has parts: {hasattr(response, 'parts')}")
        if response.parts:
            print(f"[IMAGEN_EDIT] Number of parts: {len(response.parts)}")
            for i, part in enumerate(response.parts):
                print(f"[IMAGEN_EDIT] Part {i}: inline_data={part.inline_data is not None}")
        else:
            print(f"[IMAGEN_EDIT] NO PARTS in response - this means no image was generated!")
            print(f"[IMAGEN_EDIT] Response text (if any): {getattr(response, 'text', 'N/A')}")
        
        # Extract image from response parts
        for part in response.parts:
            if part.inline_data is not None:
                result_bytes = part.inline_data.data
                mime_type = part.inline_data.mime_type or "image/png"
                base64_result = base64.b64encode(result_bytes).decode('utf-8')
                return f"data:{mime_type};base64,{base64_result}"
        
        raise RuntimeError("No image generated in response")
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Image edit failed: {e}")
        print(f"[IMAGEN_EDIT] ERROR: {error_msg[:300]}")
        print(f"[IMAGEN_EDIT] ERROR type: {type(e).__name__}")
        
        error_lower = error_msg.lower()
        
        # Check for quota/rate limit errors FIRST (highest priority)
        if "429" in error_msg:
            print(f"[IMAGEN_EDIT] 429 error detected - raising quota error")
            raise RuntimeError(
                "Gemini API quota exceeded (429). You've reached the free tier limit. "
                "Please wait ~40 seconds and try again, or upgrade your API key."
            )
        
        if "quota" in error_lower or "resource_exhausted" in error_lower:
            print(f"[IMAGEN_EDIT] Quota error detected")
            raise RuntimeError(
                "Gemini API quota exceeded. You've reached the free tier limit. "
                "Please wait a few minutes and try again, or upgrade your API key."
            )
        
        # Only check for content policy if it's NOT a quota error
        # Be very specific to avoid false positives from API error JSON structure
        is_content_policy = (
            ("content policy" in error_lower) or 
            ("safety" in error_lower and "blocked" in error_lower) or
            ("cannot be generated" in error_lower and "quota" not in error_lower and "429" not in error_msg) or
            ("person" in error_lower and ("depict" in error_lower or "image" in error_lower))
        )
        
        print(f"[IMAGEN_EDIT] is_content_policy check: {is_content_policy}")
        print(f"[IMAGEN_EDIT] Error contains 'content policy': {'content policy' in error_lower}")
        print(f"[IMAGEN_EDIT] Error contains '429': {'429' in error_msg}")
        
        if is_content_policy:
            print(f"[IMAGEN_EDIT] Content policy detected, getting suggestions for: {prompt[:50]}")
            try:
                # Import here to avoid circular dependency
                from llm_refine import get_content_policy_suggestions
                suggestions = get_content_policy_suggestions(prompt)
                print(f"[IMAGEN_EDIT] Got {len(suggestions)} suggestions: {suggestions[:3]}")
                raise RuntimeError(
                    f"Content policy violation: '{prompt}' cannot be processed. "
                    f"Try these alternatives: {', '.join(suggestions[:3])}"
                )
            except Exception as suggestion_error:
                print(f"[IMAGEN_EDIT] Failed to get suggestions: {suggestion_error}")
                # Fallback with generic suggestions
                fallback = [
                    "artistic stylized interpretation",
                    "digital illustration version",
                    "concept art transformation"
                ]
                raise RuntimeError(
                    f"Content policy violation: '{prompt}' cannot be processed. "
                    f"Try these alternatives: {', '.join(fallback)}"
                )
        
        raise RuntimeError(f"Image edit failed: {error_msg}")


def is_imagen_available() -> bool:
    """Check if Imagen is configured and available."""
    return bool(GEMINI_API_KEY)


def get_imagen_models() -> list[dict]:
    """Get list of available Imagen models - prioritized by rate limits."""
    if not is_imagen_available():
        return []
    
    # Top 4 models prioritized by rate limits (higher = better)
    # Rate limits: Imagen 3 models = 25/day, Gemini Flash = varies
    return [
        {
            "id": "imagen-3.0-fast-generate-001",
            "name": "Imagen 3.0 Fast",
            "provider": "google",
            "description": "Fastest generation (25 req/day)",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 1,
        },
        {
            "id": "imagen-3.0-generate-001", 
            "name": "Imagen 3.0",
            "provider": "google",
            "description": "Balanced quality & speed (25 req/day)",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 2,
        },
        {
            "id": "imagen-3.0-ultra-generate-001",
            "name": "Imagen 3.0 Ultra", 
            "provider": "google",
            "description": "Highest quality (25 req/day)",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 3,
        },
        {
            "id": "gemini-2.5-flash-image",
            "name": "Gemini 2.5 Flash (Image)",
            "provider": "google",
            "description": "Experimental image model",
            "supports_img2img": True,
            "max_resolution": "1024x1024",
            "priority": 4,
        },
    ]
