"""OpenAI image generation and image-to-image editing via gpt-image-1."""
import base64
import io
from openai import OpenAI
from config import settings


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

    response = client.images.edit(
        model="gpt-image-1",
        image=image_file,
        prompt=prompt,
        n=1,
        size="1024x1024",
    )
    b64 = response.data[0].b64_json
    return f"data:image/png;base64,{b64}"
