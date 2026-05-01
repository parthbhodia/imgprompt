"""OpenAI image generation and image-to-image editing via gpt-image-1."""
import base64
import io
from openai import OpenAI
from config import settings

# Prepended to every img2img prompt so gpt-image-1 anchors to the uploaded person
IDENTITY_PRESERVATION_PREFIX = (
    "Edit this real photograph. Keep it looking like a real photograph — photorealistic, "
    "not illustrated, not painted, not AI-generated looking. "
    "The person's face, skin texture, pores, beard stubble, eye shape, nose, lips, "
    "skin tone, hair texture, and all facial characteristics must remain IDENTICAL to the uploaded photo. "
    "Do NOT smooth, idealize, or beautify the face. Do NOT change the person. "
    "Only modify the background and/or clothing as described. "
    "The person must look exactly like themselves from the original photo. "
    "Transformation to apply: "
)


def _client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)


def is_openai_available() -> bool:
    return bool(getattr(settings, "openai_api_key", ""))


def generate_openai_image(prompt: str) -> str:
    """Text-to-image via gpt-image-1. Returns base64 data URL."""
    client = _client()
    response = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        n=1,
        size="1024x1024",
        quality="high",
    )
    b64 = response.data[0].b64_json
    return f"data:image/png;base64,{b64}"


def edit_openai_image(prompt: str, image_base64: str) -> str:
    """
    Image-to-image edit via gpt-image-1.
    image_base64: data URL (data:image/...;base64,...) or raw base64 string.
    Returns base64 data URL.
    """
    client = _client()

    # Strip data URL prefix if present
    if "," in image_base64:
        raw_b64 = image_base64.split(",", 1)[1]
    else:
        raw_b64 = image_base64

    image_bytes = base64.b64decode(raw_b64)
    image_file = io.BytesIO(image_bytes)
    image_file.name = "reference.png"

    anchored_prompt = f"{IDENTITY_PRESERVATION_PREFIX}{prompt}"

    response = client.images.edit(
        model="gpt-image-1",
        image=image_file,
        prompt=anchored_prompt,
        n=1,
        size="1024x1024",
        quality="high",
    )
    b64 = response.data[0].b64_json
    return f"data:image/png;base64,{b64}"
