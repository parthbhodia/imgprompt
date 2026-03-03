"""
Intelligent prompt suggestions with context-awareness and trending elements.
"""
import random
from typing import List, Dict, Any, Optional
from datetime import datetime
import os

# Trending elements database (updated periodically)
TRENDING_ELEMENTS = {
    "styles": [
        "cinematic lighting", "moody atmosphere", "dreamy soft focus",
        "vibrant pop art", "minimalist aesthetic", "retro vintage",
        "cyberpunk neon", "cozy cottagecore", "dark academia",
        "Y2K aesthetic", "steampunk", "art deco", "boho chic"
    ],
    "instagram_trends": [
        "#aesthetic", "#mood", "#vibes", "#aesthetics",
        "#visualstorytelling", "#contentcreator", "#digitalart"
    ],
    "quality_boosters": [
        "8k resolution", "highly detailed", "professional photography",
        "award winning", "trending on artstation", "masterpiece",
        "ultra realistic", "cinematic composition"
    ],
    "seasonal_elements": {
        "spring": ["cherry blossoms", "pastel colors", "fresh blooms", "soft light"],
        "summer": ["golden hour", "tropical vibes", "vibrant sunset", "beach aesthetic"],
        "fall": ["warm tones", "cozy atmosphere", "pumpkin spice", "autumn leaves"],
        "winter": ["frosted", "cozy winter", "snowy landscape", "warm glow"]
    }
}

# Style completion patterns
STYLE_COMPLETIONS = {
    "make it more": ["vibrant", "dramatic", "minimal", "detailed", "moody", "bright", "dark"],
    "make it less": ["busy", "dark", "bright", "saturation", "contrast"],
    "add": ["texture", "depth", "lighting effects", "shadows", "highlights", "atmosphere"],
    "change to": ["watercolor", "oil painting", "digital art", "photorealistic", "anime", "sketch"]
}

# Context-aware suggestions based on conversation history
def get_context_aware_suggestions(
    conversation_history: List[Dict[str, Any]],
    current_prompt: str
) -> List[Dict[str, str]]:
    """Generate context-aware prompt suggestions based on conversation."""
    suggestions = []
    
    if not conversation_history:
        # New conversation - suggest starters
        suggestions.extend([
            {"type": "style", "text": "Make it cinematic with golden hour lighting", "icon": "sun"},
            {"type": "style", "text": "Add moody atmosphere with dramatic shadows", "icon": "moon"},
            {"type": "quality", "text": "Enhance to 8k resolution with ultra details", "icon": "sparkles"},
        ])
        return suggestions[:3]
    
    # Analyze last assistant message (the generated image)
    last_assistant_msgs = [m for m in conversation_history if m.get("role") == "assistant"]
    last_user_msgs = [m for m in conversation_history if m.get("role") == "user"]
    
    if last_assistant_msgs:
        last_image = last_assistant_msgs[-1]
        
        # Suggest variations
        suggestions.append({
            "type": "variation", 
            "text": "Show me 3 different versions of this",
            "icon": "copy",
            "action": "generate_variations"
        })
        
        # Style transfer suggestions
        suggestions.extend([
            {"type": "style_transfer", "text": "Same but in watercolor style", "icon": "palette"},
            {"type": "style_transfer", "text": "Convert to oil painting", "icon": "brush"},
            {"type": "style_transfer", "text": "Make it look like anime art", "icon": "image"},
        ])
        
        # Iterative refinement
        suggestions.extend([
            {"type": "refinement", "text": "Make it brighter and more vibrant", "icon": "sun"},
            {"type": "refinement", "text": "Add more dramatic lighting", "icon": "zap"},
            {"type": "refinement", "text": "Increase the detail level", "icon": "zoom-in"},
        ])
    
    return suggestions[:6]


def get_trending_hashtags(style: Optional[str] = None) -> List[str]:
    """Get trending hashtags based on style."""
    base_tags = TRENDING_ELEMENTS["instagram_trends"]
    
    if style:
        style_tags = {
            "cinematic": ["#cinematography", "#filmaesthetic", "#cinematic"],
            "anime": ["#animeart", "#manga", "#kawaii"],
            "minimalist": ["#minimalism", "#lessismore", "#cleandesign"],
            "vintage": ["#vintagestyle", "#retro", "#nostalgia"],
        }
        for key, tags in style_tags.items():
            if key in style.lower():
                return tags + base_tags
    
    return base_tags[:5]


def enhance_prompt_with_trends(prompt: str) -> Dict[str, Any]:
    """Enhance user prompt with trending elements and quality boosters."""
    enhanced = prompt
    additions = []
    
    # Determine current season
    month = datetime.now().month
    if month in [3, 4, 5]:
        season = "spring"
    elif month in [6, 7, 8]:
        season = "summer"
    elif month in [9, 10, 11]:
        season = "fall"
    else:
        season = "winter"
    
    # Check if seasonal element could be added
    seasonal_elements = TRENDING_ELEMENTS["seasonal_elements"][season]
    
    # Analyze prompt for missing quality boosters
    prompt_lower = prompt.lower()
    missing_boosters = []
    
    for booster in TRENDING_ELEMENTS["quality_boosters"]:
        if not any(word in prompt_lower for word in booster.lower().split()):
            missing_boosters.append(booster)
    
    # Suggest 1-2 quality boosters
    if missing_boosters:
        selected = random.sample(missing_boosters, min(2, len(missing_boosters)))
        additions.extend(selected)
    
    return {
        "original": prompt,
        "enhanced": enhanced + ", " + ", ".join(additions) if additions else enhanced,
        "suggested_additions": additions,
        "trending_hashtags": get_trending_hashtags(prompt),
        "seasonal_suggestions": seasonal_elements[:2],
    }


def get_style_completions(partial_text: str) -> List[str]:
    """Get style completion suggestions for partial text."""
    completions = []
    
    for pattern, options in STYLE_COMPLETIONS.items():
        if pattern in partial_text.lower():
            completions.extend([f"{pattern} {opt}" for opt in options])
    
    # If no pattern match, suggest style starters
    if not completions:
        completions = [
            "Make it more vibrant",
            "Add cinematic lighting",
            "Make it moody and atmospheric",
            "Add watercolor effect",
            "Convert to oil painting style"
        ]
    
    return completions[:5]


# Multi-turn conversation context tracking
class ConversationContext:
    """Track and manage multi-turn conversation context."""
    
    def __init__(self):
        self.iteration_count = 0
        self.applied_styles = set()
        self.preferred_mood = None
        self.quality_level = "standard"
        self.variation_count = 0
    
    def add_iteration(self, prompt: str):
        """Track an iteration of the conversation."""
        self.iteration_count += 1
        
        # Extract styles from prompt
        style_keywords = ["watercolor", "oil painting", "digital art", "photorealistic", 
                         "anime", "sketch", "cinematic", "moody", "vibrant"]
        for style in style_keywords:
            if style in prompt.lower():
                self.applied_styles.add(style)
        
        # Track mood
        mood_keywords = ["moody", "bright", "dark", "cheerful", "dramatic", "soft"]
        for mood in mood_keywords:
            if mood in prompt.lower():
                self.preferred_mood = mood
    
    def get_suggestions_for_next_turn(self) -> List[str]:
        """Generate suggestions based on conversation context."""
        suggestions = []
        
        if self.iteration_count == 1:
            suggestions = [
                "Make it brighter",
                "Add more detail",
                "Change the mood"
            ]
        elif self.iteration_count >= 2:
            # Suggest based on accumulated context
            if len(self.applied_styles) > 0:
                suggestions.append(f"Try a different style than {list(self.applied_styles)[-1]}")
            
            if self.variation_count < 3:
                suggestions.append("Generate 3 variations of this")
            
            suggestions.extend([
                "Make subtle changes",
                "Add more depth",
                "Adjust the lighting"
            ])
        
        return suggestions[:4]
    
    def mark_variation_generated(self):
        """Track that variations were generated."""
        self.variation_count += 1
