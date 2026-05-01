"""OpenAI image generation and image-to-image editing via gpt-image-1.

Pipeline for img2img (replicating ChatGPT's approach):
  1. GPT-4o Vision analyzes the uploaded photo + user intent
  2. Builds a structured prompt (subject / style / environment / lighting / camera / quality)
  3. gpt-image-1 performs the edit with the enriched structured prompt
"""
import base64
import io
from openai import OpenAI
from config import settings


def _client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)


def is_openai_available() -> bool:
    return bool(getattr(settings, "openai_api_key", ""))


def _build_structured_prompt(client: OpenAI, image_b64: str, user_intent: str) -> str:
    """
    Use GPT-4o Vision to analyze the photo + user intent, then return a
    fully structured, realism-optimised prompt for gpt-image-1.
    """
    try:
        system = (
            "You are an expert prompt engineer for photorealistic AI image editing. "
            "The user's edit request is the PRIMARY directive — it MUST be honored exactly and literally. "
            "Your job is to describe the person from the photo in detail, then place them in the EXACT scenario the user requested. "
            "Do NOT reinterpret, generalize, or soften the user's request. "
            "Follow the exact output format — no extra commentary."
        )

        user_msg = f"""The user wants this specific edit applied to the photo: "{user_intent}"

CRITICAL: The edit request above must appear LITERALLY in your output. If the user says 'Starbucks', the environment must be Starbucks. If the user says 'beach', it must be a beach. Do not substitute or generalize.

Analyze the photo and write a structured prompt that:
1. Places this EXACT person (described from the photo) in the EXACT scenario from the edit request
2. Preserves their face, skin tone, hair, and identity completely

Output format:

A highly realistic photo of [describe the exact person — skin tone, face shape, eye color, hair, beard/stubble].

Style: photorealistic, candid
Clothing: [keep original clothing unless user specified different]
Environment: [MUST match the user's request exactly — "{user_intent}" — expand with specific details: exact location, props, background, atmosphere that fits this scene]
Lighting: [match the lighting that would naturally occur in the environment from the user's request]
Camera: 85mm lens, shallow depth of field, candid framing
Expression: [match the original photo]

Details:
- natural skin texture and pores, slight asymmetry
- accurate facial features identical to the uploaded photo
- realistic proportions and anatomy
- depth of field, background blurred but recognizable as the requested location
- subtle imperfections: natural lighting falloff, real-world shadows

Quality:
- ultra high resolution, sharp focus, photorealistic
- preserve exact identity of the person in the uploaded photo"""

        resp = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=500,
            messages=[
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_msg},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64}",
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
        )
        structured = resp.choices[0].message.content.strip()
        print(f"[OPENAI] Structured prompt built ({len(structured)} chars):\n{structured}\n")
        return structured

    except Exception as e:
        print(f"[OPENAI] GPT-4o prompt build failed, using fallback: {e}")
        return (
            f"A highly realistic photo edit. "
            f"Preserve the exact person's face, skin texture, beard, hair, and identity completely. "
            f"Natural skin texture and pores, slight asymmetry, accurate facial features. "
            f"Depth of field, softly blurred background. Photorealistic, ultra high resolution, sharp focus. "
            f"Apply this transformation: {user_intent}"
        )


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
    Image-to-image edit via gpt-image-1 with GPT-4o structured prompt building.
    image_base64: data URL (data:image/...;base64,...) or raw base64 string.
    Returns base64 data URL.
    """
    client = _client()

    if "," in image_base64:
        raw_b64 = image_base64.split(",", 1)[1]
    else:
        raw_b64 = image_base64

    # Step 1: GPT-4o builds a full structured prompt from photo + user intent
    structured_prompt = _build_structured_prompt(client, raw_b64, prompt)

    # Step 2: gpt-image-1 edits with the structured prompt
    image_bytes = base64.b64decode(raw_b64)

    def _do_edit(edit_prompt: str) -> str:
        image_file = io.BytesIO(image_bytes)
        image_file.name = "reference.png"
        resp = client.images.edit(
            model="gpt-image-1",
            image=image_file,
            prompt=edit_prompt,
            n=1,
            size="1024x1024",
            quality="high",
        )
        return f"data:image/png;base64,{resp.data[0].b64_json}"

    try:
        return _do_edit(structured_prompt)
    except Exception as e:
        msg = str(e)
        # Safety rejection — retry with the plain user prompt (no detailed body description)
        if "400" in msg and ("safety" in msg.lower() or "rejected" in msg.lower() or "policy" in msg.lower()):
            print(f"[OPENAI] Safety rejection on structured prompt, retrying with simple prompt")
            safe_fallback = (
                f"Edit this photo: {prompt}. "
                f"Keep the person's appearance identical. Photorealistic."
            )
            return _do_edit(safe_fallback)
        raise
