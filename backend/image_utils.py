"""Shared image utilities for backend services."""
import io
from PIL import Image

# AI models require dimensions divisible by 16 (Flux, Imagen, Stable Diffusion)
PATCH_SIZE = 16


def ensure_divisible_by_patch_size(width: int, height: int, patch_size: int = PATCH_SIZE) -> tuple[int, int]:
    """Ensure dimensions are divisible by patch size for model compatibility."""
    new_width = (width // patch_size) * patch_size
    new_height = (height // patch_size) * patch_size
    # Ensure minimum size
    new_width = max(patch_size, new_width)
    new_height = max(patch_size, new_height)
    return new_width, new_height


def resize_image_if_needed(pil_image: Image.Image, patch_size: int = PATCH_SIZE) -> Image.Image:
    """Resize PIL image to ensure dimensions divisible by patch size."""
    orig_width, orig_height = pil_image.size
    new_width, new_height = ensure_divisible_by_patch_size(orig_width, orig_height, patch_size)
    
    if (orig_width, orig_height) != (new_width, new_height):
        pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    return pil_image


def resize_bytes_if_needed(image_bytes: bytes, patch_size: int = PATCH_SIZE) -> bytes:
    """Resize image bytes to ensure dimensions divisible by patch size."""
    img = Image.open(io.BytesIO(image_bytes))
    orig_width, orig_height = img.size
    new_width, new_height = ensure_divisible_by_patch_size(orig_width, orig_height, patch_size)
    
    if (orig_width, orig_height) != (new_width, new_height):
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        img_format = img.format if img.format else "WEBP"
        img.save(buffer, format=img_format, quality=95)
        return buffer.getvalue()
    
    return image_bytes
