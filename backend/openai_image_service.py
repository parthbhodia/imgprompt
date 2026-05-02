"""OpenAI image generation and image-to-image editing via gpt-image-2.

Pipeline for img2img:
  1. GPT-4o Vision analyzes the photo — detects face position, describes person
  2. Builds a background-focused scene prompt for the user's requested environment
  3. gpt-image-2 edits with a face-lock mask: face pixels are kept from original,
     everything else (background, clothing, lighting) is regenerated
"""
import base64
import io
from PIL import Image, ImageDraw, ImageFilter
from openai import OpenAI
from config import settings


def _client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)


def is_openai_available() -> bool:
    return bool(getattr(settings, "openai_api_key", ""))


def _create_face_lock_mask(image_bytes: bytes) -> tuple[bytes, bool]:
    """
    Create a face-lock mask and return (mask_bytes, is_closeup).

    is_closeup=True means the face fills most of the frame — caller should
    skip the mask and rely on prompting instead (no room for background).

    Mask: opaque = keep (face), transparent = edit (background).
    For OpenAI images.edit(): transparent pixels are the regions to edit.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    w, h = img.size

    # Face ellipse heuristic for standard portrait photos
    cx = w // 2
    cy = int(h * 0.28)
    rx = int(w * 0.20)
    ry = int(h * 0.20)

    face_area = 3.14159 * rx * ry
    image_area = w * h
    face_fraction = face_area / image_area

    # If face covers >35% of frame it's a close-up — mask won't help
    if face_fraction > 0.35:
        print(f"[OPENAI] Close-up detected (face={face_fraction:.0%} of frame), skipping mask")
        return b"", True

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=int(min(w, h) * 0.05)))

    rgba = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rgba.putalpha(mask)

    buf = io.BytesIO()
    rgba.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue(), False


def _build_scene_prompt(client: OpenAI, image_b64: str, user_intent: str, is_closeup: bool = False) -> str:
    """
    Use GPT-4o Vision to:
    1. Briefly describe the person (for continuity cues in the unmasked area)
    2. Build a rich scene description matching the user's EXACT request

    With a face-lock mask, the face is preserved from the original, so the
    prompt focuses primarily on the environment/scene and lighting.
    """
    try:
        system = (
            "You are an expert prompt engineer for photorealistic AI image editing. "
            "A face-preserving mask is already applied — the person's face will be kept from the original photo. "
            "Your job is to write a prompt focused on the SCENE and ENVIRONMENT the user wants, "
            "with brief cues about the person's appearance for lighting/clothing continuity. "
            "The user's request is the PRIMARY directive — honor it EXACTLY and LITERALLY. "
            "No extra commentary — output only the prompt."
        )

        closeup_instruction = (
            "\nIMPORTANT: The source photo is an extreme close-up. "
            "The output MUST be a wider shot (waist-up or half-body) so the background scene is clearly visible. "
            "Explicitly include 'wider shot showing [scene] in background' in the prompt.\n"
            if is_closeup else ""
        )

        user_msg = f"""User's edit request: "{user_intent}"
{closeup_instruction}
CRITICAL: Honor the request EXACTLY. If the user says 'Starbucks', the scene must be inside a Starbucks. If they say 'beach at sunset', it must be a beach at sunset. Do not generalize or substitute.

Analyze the photo, then write a prompt using this format:

[Brief person description: skin tone, hair, clothing visible in photo] — placed in [EXACT scene from user's request].

Scene: [Rich, specific description of the EXACT location from the user's request — furniture, signage, props, colors, atmosphere]
{"Framing: wider shot, waist-up or half-body, clearly showing the background scene" if is_closeup else "Framing: natural candid framing"}
Lighting: [Natural lighting for this specific environment and time of day]
Camera: 85mm lens, f/1.8, shallow depth of field
Style: photorealistic, high resolution, natural photography

Keep it under 200 words. Output only the prompt."""

        resp = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=400,
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
        scene_prompt = resp.choices[0].message.content.strip()
        print(f"[OPENAI] Scene prompt built ({len(scene_prompt)} chars):\n{scene_prompt}\n")
        return scene_prompt

    except Exception as e:
        print(f"[OPENAI] GPT-4o scene prompt failed, using fallback: {e}")
        return (
            f"Photorealistic photo. {user_intent}. "
            f"Natural lighting, 85mm lens, shallow depth of field. "
            f"High resolution, candid photography style."
        )


def generate_openai_image(prompt: str) -> str:
    """Text-to-image via gpt-image-2. Returns base64 data URL."""
    client = _client()
    response = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        n=1,
        size="1024x1024",
        quality="high",
    )
    b64 = response.data[0].b64_json
    return f"data:image/png;base64,{b64}"


def edit_openai_image(prompt: str, image_base64: str) -> str:
    """
    Image-to-image edit via gpt-image-2 with face-lock masking.

    Pipeline:
      1. GPT-4o Vision builds a scene-focused prompt
      2. Pillow generates a face-lock mask (face = opaque/keep, rest = transparent/edit)
      3. gpt-image-2 edits only the non-face regions

    image_base64: data URL or raw base64 string. Returns base64 data URL.
    """
    client = _client()

    if "," in image_base64:
        raw_b64 = image_base64.split(",", 1)[1]
    else:
        raw_b64 = image_base64

    image_bytes = base64.b64decode(raw_b64)

    # Step 1: create face-lock mask (also detects if close-up)
    try:
        mask_bytes, is_closeup = _create_face_lock_mask(image_bytes)
        use_mask = not is_closeup and len(mask_bytes) > 0
        if use_mask:
            print(f"[OPENAI] Face-lock mask created, size={len(mask_bytes)} bytes")
    except Exception as e:
        print(f"[OPENAI] Mask creation failed, editing without mask: {e}")
        mask_bytes, is_closeup, use_mask = b"", False, False

    # Step 2: build scene prompt (close-up flag adjusts framing instructions)
    scene_prompt = _build_scene_prompt(client, raw_b64, prompt, is_closeup=is_closeup)

    def _do_edit(edit_prompt: str, with_mask: bool = True) -> str:
        image_file = io.BytesIO(image_bytes)
        image_file.name = "reference.png"

        kwargs = dict(
            model="gpt-image-2",
            image=image_file,
            prompt=edit_prompt,
            n=1,
            size="1024x1024",
            quality="high",
        )

        if with_mask and use_mask:
            mask_file = io.BytesIO(mask_bytes)
            mask_file.name = "mask.png"
            kwargs["mask"] = mask_file

        resp = client.images.edit(**kwargs)
        return f"data:image/png;base64,{resp.data[0].b64_json}"

    try:
        return _do_edit(scene_prompt, with_mask=use_mask)
    except Exception as e:
        msg = str(e)

        # If mask caused an error, retry without it
        if use_mask and ("mask" in msg.lower() or "400" in msg):
            print(f"[OPENAI] Masked edit failed ({msg[:80]}), retrying without mask")
            try:
                return _do_edit(scene_prompt, with_mask=False)
            except Exception as e2:
                msg = str(e2)

        # Safety rejection — retry with plain prompt, no mask
        if "400" in msg and ("safety" in msg.lower() or "rejected" in msg.lower() or "policy" in msg.lower()):
            print(f"[OPENAI] Safety rejection, retrying with simple prompt")
            safe_fallback = f"Edit this photo: {prompt}. Keep the person's appearance identical. Photorealistic."
            return _do_edit(safe_fallback, with_mask=False)

        raise
