"""Generate thinking/reasoning steps for image generation."""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def generate_thinking_steps(
    prompt: str,
    has_uploaded_image: bool = False,
    is_refinement: bool = False,
    is_img2img: bool = False,
) -> list[dict]:
    """
    Generate thinking steps that simulate the AI's reasoning process.
    Returns a list of steps with title, content, and status.
    """
    steps = []
    
    # Step 1: Analyzing prompt
    steps.append({
        "id": "analyze",
        "title": "Analyzing your prompt",
        "content": f'Looking at: "{prompt[:100]}{"..." if len(prompt) > 100 else ""}"',
        "status": "complete",
        "icon": "search"
    })
    
    # Step 2: Detecting style keywords
    style_keywords = []
    if "cyberpunk" in prompt.lower():
        style_keywords.append("cyberpunk aesthetic")
    if "neon" in prompt.lower():
        style_keywords.append("neon lighting")
    if "portrait" in prompt.lower():
        style_keywords.append("portrait composition")
    if "anime" in prompt.lower() or "manga" in prompt.lower():
        style_keywords.append("anime style")
    if "photorealistic" in prompt.lower() or "photo" in prompt.lower():
        style_keywords.append("photorealistic rendering")
    
    if style_keywords:
        steps.append({
            "id": "styles",
            "title": "Detecting style elements",
            "content": f"Found: {', '.join(style_keywords)}",
            "status": "complete",
            "icon": "palette"
        })
    
    # Step 3: Image transformation analysis (if img2img)
    if has_uploaded_image or is_img2img:
        steps.append({
            "id": "transform",
            "title": "Planning image transformation",
            "content": "Analyzing uploaded image structure and planning modifications while preserving identity",
            "status": "complete",
            "icon": "wand"
        })
        
        if "cyberpunk" in prompt.lower():
            steps.append({
                "id": "lighting",
                "title": "Designing lighting scheme",
                "content": "Mapping cyberpunk neon aesthetic: magenta and cyan accent lighting, high contrast",
                "status": "complete",
                "icon": "lightbulb"
            })
    
    # Step 4: Refinement (if applicable)
    if is_refinement:
        steps.append({
            "id": "refine",
            "title": "Enhancing prompt details",
            "content": "Adding depth, texture, and professional photography terms for better results",
            "status": "complete",
            "icon": "sparkles"
        })
    
    # Step 5: Generation planning
    steps.append({
        "id": "plan",
        "title": "Planning generation approach",
        "content": "Selecting optimal parameters for Flux model inference",
        "status": "complete",
        "icon": "settings"
    })
    
    # Step 6: Active generation
    steps.append({
        "id": "generate",
        "title": "Generating your image",
        "content": "Running diffusion model... this may take 10-20 seconds",
        "status": "active",
        "icon": "image"
    })
    
    return steps


def update_thinking_step(steps: list[dict], step_id: str, new_status: str, new_content: Optional[str] = None) -> list[dict]:
    """Update the status of a thinking step."""
    for step in steps:
        if step["id"] == step_id:
            step["status"] = new_status
            if new_content:
                step["content"] = new_content
    return steps
