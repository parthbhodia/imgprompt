"""OpenAI image generation and image-to-image editing via gpt-image-1.

Pipeline for img2img (replicating ChatGPT's approach):
  1. GPT-4o Vision analyzes the uploaded photo and describes the person in detail
  2. That description is injected into the edit prompt to lock identity
  3. gpt-image-1 performs the edit with the enriched prompt
"""
import base64
import io
from openai import OpenAI
from config import settings


def _client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)


def is_openai_available() -> bool:
    return bool(getattr(settings, "openai_api_key", ""))


def _describe_person(client: OpenAI, image_b64: str) -> str:
    """Use GPT-4o Vision to extract a detailed description of the person in the photo."""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Describe the person in this photo in precise detail for use in an image editing prompt. "
                            "Include: exact skin tone, face shape, eye color and shape, nose shape, lip shape, "
                            "beard/facial hair details (length, style, color), hair color/texture/style, "
                            "age range, and any distinguishing features. "
                            "Be specific and technical. Output only the description, no preamble."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"},
                    },
                ],
            }],
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[OPENAI] GPT-4o vision describe failed: {e}")
        return ""


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
    Image-to-image edit via gpt-image-1 with GPT-4o Vision identity anchoring.
    image_base64: data URL (data:image/...;base64,...) or raw base64 string.
    Returns base64 data URL.
    """
    client = _client()

    # Strip data URL prefix if present
    if "," in image_base64:
        raw_b64 = image_base64.split(",", 1)[1]
    else:
        raw_b64 = image_base64

    # Step 1: GPT-4o Vision describes the person in detail
    person_description = _describe_person(client, raw_b64)
    print(f"[OPENAI] Person description: {person_description[:120]}...")

    # Step 2: Build enriched prompt with locked identity
    if person_description:
        enriched_prompt = (
            f"Edit this real photograph. Keep it looking like a real photograph — photorealistic, "
            f"not illustrated or AI-generated. "
            f"The subject is: {person_description}. "
            f"Their face, skin texture, beard, hair, and all facial characteristics must remain "
            f"IDENTICAL — do not smooth, idealize, or change the person at all. "
            f"Only apply this transformation: {prompt}"
        )
    else:
        enriched_prompt = (
            f"Edit this real photograph photorealistically. "
            f"Preserve the person's exact face, skin texture, beard, hair, and identity completely. "
            f"Only apply this transformation: {prompt}"
        )

    image_bytes = base64.b64decode(raw_b64)
    image_file = io.BytesIO(image_bytes)
    image_file.name = "reference.png"

    response = client.images.edit(
        model="gpt-image-1",
        image=image_file,
        prompt=enriched_prompt,
        n=1,
        size="1024x1024",
        quality="high",
    )
    b64 = response.data[0].b64_json
    return f"data:image/png;base64,{b64}"
