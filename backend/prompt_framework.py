"""
10-Part AI Image Prompt Framework
Helps users build cinematic, consistent image generation prompts.
"""
import logging
from typing import Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class PromptFramework(BaseModel):
    """Structured prompt template following the 10-part framework."""
    subject_definition: str = Field(..., min_length=5, max_length=200)
    action_context: str = Field(..., min_length=5, max_length=200)
    environment_setting: str = Field(..., min_length=5, max_length=200)
    mood_story: str = Field(..., min_length=5, max_length=200)
    visual_style: str = Field(..., min_length=5, max_length=200)
    lighting_color: str = Field(..., min_length=5, max_length=200)
    camera_composition: str = Field(..., min_length=5, max_length=200)
    detail_texture: str = Field(..., min_length=5, max_length=200)
    quality_realism: str = Field(..., min_length=5, max_length=200)
    negative_constraints: str = Field(..., min_length=5, max_length=400)


class FrameworkHint(BaseModel):
    """Quick fix hints for common issues."""
    issue: str
    fixes: list[str]


FRAMEWORK_HINTS = {
    "flat_image": FrameworkHint(
        issue="Image looks flat",
        fixes=[
            "Add rim light + volumetric haze + contrast grade",
            "Increase lighting direction (side/rim light)",
            "Add atmospheric depth and light rays",
        ]
    ),
    "anatomy_weird": FrameworkHint(
        issue="Anatomy is weird or distorted",
        fixes=[
            "Tighten negatives (no extra limbs, no distorted anatomy)",
            "Simplify pose - avoid complex hand positions",
            "Specify hands not visible or hands in pockets",
            "Be explicit about body proportions",
        ]
    ),
    "too_generic": FrameworkHint(
        issue="Result is too generic",
        fixes=[
            "Add 3 specific details a photographer would capture",
            "Include micro-textures and material specifics",
            "Add a distinctive foreground or background element",
            "Reference a specific visual style or era",
        ]
    ),
    "style_drift": FrameworkHint(
        issue="Style keeps shifting between images",
        fixes=[
            "Strengthen visual style line (be specific about era, medium)",
            "Keep style references consistent across iterations",
            "Lock the visual style section before adjusting other parts",
            "Use reference artists or photographers by name",
        ]
    ),
    "background_mess": FrameworkHint(
        issue="Background is cluttered or distracting",
        fixes=[
            "Specify clean background, minimal props",
            "Add controlled depth of field (specify f-stop equivalent)",
            "Use negative constraints: no clutter, no chaotic patterns",
            "Describe background simply (blurred, uniform color, soft gradient)",
        ]
    ),
}


NEGATIVE_CONSTRAINTS_LIBRARY = {
    "text_and_artifacts": [
        "no text",
        "no watermark",
        "no logo",
        "no signature",
        "no frame",
        "no UI elements",
        "no typography",
    ],
    "anatomy": [
        "no extra limbs",
        "no extra fingers",
        "no fused hands",
        "no distorted anatomy",
        "no weird proportions",
        "no anatomical errors",
    ],
    "quality": [
        "no blurry face",
        "no out of focus subject",
        "no low resolution",
        "no compression artifacts",
        "no pixelation",
        "no bad quality",
    ],
    "geometry_and_artifacts": [
        "no duplicated subjects",
        "no warped geometry",
        "no unnatural reflections",
        "no melted objects",
        "no impossible shapes",
    ],
    "skin_and_texture": [
        "no over-smoothed skin",
        "no plastic texture",
        "no uncanny eyes",
        "no doll-like appearance",
    ],
}


PRESET_TEMPLATES = {
    "cinematic_portrait": {
        "subject_definition": "A person with distinctive features, confident expression",
        "action_context": "Looking directly at camera, candid moment",
        "environment_setting": "Studio with controlled lighting, minimal background",
        "mood_story": "Professional yet approachable, confident presence",
        "visual_style": "Contemporary portrait photography, editorial magazine style",
        "lighting_color": "Three-point lighting with warm key light, rim light, cool fill light",
        "camera_composition": "85mm lens, shallow depth of field f/1.8, centered framing, looking into space",
        "detail_texture": "Detailed skin texture, sharp eyes with catchlight, fine hair detail",
        "quality_realism": "Photorealistic, high fidelity, cinematic grade, professional polish",
        "negative_constraints": "no makeup, no filters, no soft focus, no beauty mode, no distortion",
    },
    "fantasy_landscape": {
        "subject_definition": "Majestic mountain landscape with fantasy elements",
        "action_context": "Serene, timeless moment in a magical world",
        "environment_setting": "Otherworldly mountains, ancient forests, mystical lighting",
        "mood_story": "Awe-inspiring, adventurous, slightly ominous",
        "visual_style": "Fantasy concept art, oil painting, epic fantasy novel cover style",
        "lighting_color": "Golden hour light filtered through mist, cool shadows with warm highlights",
        "camera_composition": "Wide 24mm landscape lens, rule of thirds, deep depth of field, dramatic horizon",
        "detail_texture": "Intricate rock formations, detailed foliage, visible brushwork, atmospheric haze",
        "quality_realism": "Painterly but detailed, fantasy-grounded realism, high-fantasy polish",
        "negative_constraints": "no people, no text, no modern elements, no flat lighting, no muddy colors",
    },
    "product_showcase": {
        "subject_definition": "Product with elegant design, premium aesthetic",
        "action_context": "Displayed prominently, hero shot",
        "environment_setting": "Minimalist white or neutral background, clean studio lighting",
        "mood_story": "Luxury, professional, desirable",
        "visual_style": "Commercial product photography, luxury brand aesthetic",
        "lighting_color": "Bright, even lighting with subtle shadows, neutral color temperature",
        "camera_composition": "50mm lens, frontal or 3/4 view, perfectly centered, sharp focus throughout",
        "detail_texture": "Crisp material details, pristine surface, no dust or imperfections",
        "quality_realism": "Hyper-realistic, perfect clarity, advertising-ready, flawless",
        "negative_constraints": "no dust, no fingerprints, no shadows, no background clutter, no perspective distortion",
    },
    "moody_atmosphere": {
        "subject_definition": "A solitary figure or object in atmospheric setting",
        "action_context": "Contemplative, waiting, mysterious moment",
        "environment_setting": "Foggy alley, rain-soaked streets, dimly lit interior",
        "mood_story": "Melancholic, introspective, film noir energy",
        "visual_style": "Film noir, cinematography, moody drama, dark academia",
        "lighting_color": "Low-key lighting with strong contrast, deep shadows, cool color grade",
        "camera_composition": "35mm lens, off-center composition, low angle, compositional depth",
        "detail_texture": "Visible texture in shadows, wet surfaces, grain or texture",
        "quality_realism": "Cinematic, contrasty, desaturated color, film grain, analog quality",
        "negative_constraints": "no bright colors, no cheerful mood, no overexposed areas, no flat lighting",
    },
}


def build_prompt_from_framework(framework: PromptFramework) -> str:
    """
    Assemble the 10-part framework into a cohesive, generation-ready prompt.
    """
    parts = [
        f"Subject Definition: {framework.subject_definition}",
        f"Action and Context: {framework.action_context}",
        f"Environment and Setting: {framework.environment_setting}",
        f"Mood and Story: {framework.mood_story}",
        f"Visual Style and References: {framework.visual_style}",
        f"Lighting and Color: {framework.lighting_color}",
        f"Camera and Composition: {framework.camera_composition}",
        f"Detail and Texture Control: {framework.detail_texture}",
        f"Quality and Realism Control: {framework.quality_realism}",
        f"Negative Constraints: {framework.negative_constraints}",
    ]
    return "\n".join(parts)


def build_compact_prompt(framework: PromptFramework) -> str:
    """
    Build a more concise, generation-optimized version.
    Strips labels and flows naturally.
    """
    negative = f" | Avoid: {framework.negative_constraints}" if framework.negative_constraints else ""
    
    prompt = (
        f"{framework.subject_definition}. "
        f"{framework.action_context} in {framework.environment_setting}. "
        f"{framework.mood_story}. "
        f"{framework.visual_style}, "
        f"{framework.lighting_color}. "
        f"{framework.camera_composition}. "
        f"{framework.detail_texture}. "
        f"{framework.quality_realism}{negative}"
    )
    return prompt


def get_quick_fixes_for_issue(issue_key: str) -> Optional[FrameworkHint]:
    """Get quick fix suggestions for a common issue."""
    return FRAMEWORK_HINTS.get(issue_key)


def build_negative_constraints_from_categories(categories: list[str]) -> str:
    """
    Build comprehensive negative constraints from selected categories.
    
    Args:
        categories: List of keys like 'text_and_artifacts', 'anatomy', etc.
    
    Returns:
        Comma-separated string of negative constraints.
    """
    constraints = []
    for category in categories:
        if category in NEGATIVE_CONSTRAINTS_LIBRARY:
            constraints.extend(NEGATIVE_CONSTRAINTS_LIBRARY[category])
    return ", ".join(constraints)


def enhance_framework_with_ai(user_input: str) -> dict:
    """
    Use xAI/Groq to help user fill in framework sections from natural language input.
    
    Args:
        user_input: Natural language description from user
    
    Returns:
        Dict with populated framework sections
    """
    try:
        from llm_client import chat_completion
        system_prompt = (
            "You are an expert at breaking down image descriptions into the 10-part AI Image Prompt Framework. "
            "The user will give you a natural description of an image they want to create. "
            "Respond with a JSON object with these exact keys: "
            '"subject_definition", "action_context", "environment_setting", "mood_story", '
            '"visual_style", "lighting_color", "camera_composition", "detail_texture", '
            '"quality_realism", "negative_constraints". '
            "Each value should be 1-2 sentences. "
            "Respond ONLY with valid JSON, no other text."
        )
        content = chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input[:1000]},
            ],
            max_tokens=600,
            temperature=0.7,
            timeout=8,
        )
        
        import json
        result = json.loads(content)
        
        # Validate and clean up
        framework_data = {
            "subject_definition": (result.get("subject_definition") or "")[:200],
            "action_context": (result.get("action_context") or "")[:200],
            "environment_setting": (result.get("environment_setting") or "")[:200],
            "mood_story": (result.get("mood_story") or "")[:200],
            "visual_style": (result.get("visual_style") or "")[:200],
            "lighting_color": (result.get("lighting_color") or "")[:200],
            "camera_composition": (result.get("camera_composition") or "")[:200],
            "detail_texture": (result.get("detail_texture") or "")[:200],
            "quality_realism": (result.get("quality_realism") or "")[:200],
            "negative_constraints": (result.get("negative_constraints") or "")[:400],
        }
        
        return framework_data
    except Exception as e:
        logger.warning("AI framework enhancement failed: %s", e)
        return {}
