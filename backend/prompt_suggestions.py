"""
Unified prompt suggestion engine with proper architecture.
"""
import json
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Suggestion:
    type: str  # style, quality, variation, style_transfer, refinement
    text: str
    icon: str
    action: Optional[str] = None
    relevance_score: float = 0.0


@dataclass 
class EnhancedPrompt:
    original: str
    enhanced: str
    added_elements: List[str]
    trending_hashtags: List[str]
    seasonal_elements: List[str]
    enhancement_type: str  # "quality", "style", "seasonal", "mixed"


@dataclass
class PromptConfig:
    """Configuration loaded from JSON, not hardcoded."""
    styles: List[str] = field(default_factory=list)
    hashtags: List[str] = field(default_factory=list)
    quality_boosters: List[Dict[str, Any]] = field(default_factory=list)
    seasonal_elements: Dict[str, List[str]] = field(default_factory=dict)
    style_completions: Dict[str, List[str]] = field(default_factory=dict)
    
    @classmethod
    def from_json(cls, path: str):
        """Load config from JSON file."""
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            return cls(**data)
        except Exception:
            return cls.default()
    
    @classmethod
    def default(cls):
        """Minimal default config."""
        return cls(
            styles=["cinematic", "moody", "vibrant", "minimalist"],
            hashtags=["#aesthetic", "#digitalart"],
            quality_boosters=[
                {"term": "highly detailed", "relevance": 0.9},
                {"term": "professional quality", "relevance": 0.8},
                {"term": "8k resolution", "relevance": 0.7},
            ],
            seasonal_elements={
                "spring": ["cherry blossoms", "pastel colors"],
                "summer": ["golden hour", "tropical"],
                "fall": ["warm tones", "autumn leaves"],
                "winter": ["snowy", "cozy"],
            },
            style_completions={
                "make it more": ["vibrant", "dramatic", "minimal"],
                "make it less": ["busy", "dark", "bright"],
            }
        )


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_current_season() -> str:
    """Get current season based on month."""
    month = datetime.now().month
    if month in [3, 4, 5]:
        return "spring"
    elif month in [6, 7, 8]:
        return "summer"
    elif month in [9, 10, 11]:
        return "fall"
    else:
        return "winter"


def deterministic_sample(items: List[Any], n: int, seed_input: str = "") -> List[Any]:
    """Deterministically sample n items based on hash of input."""
    if not items or n <= 0:
        return []
    
    seed_str = f"{seed_input}:{datetime.now().strftime('%Y%m%d')}"
    hash_val = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    
    items_copy = items.copy()
    rng_state = hash_val
    
    for i in range(len(items_copy) - 1, 0, -1):
        rng_state = (rng_state * 1103515245 + 12345) & 0x7fffffff
        j = rng_state % (i + 1)
        items_copy[i], items_copy[j] = items_copy[j], items_copy[i]
    
    return items_copy[:min(n, len(items_copy))]


def rank_by_relevance(items: List[Dict[str, Any]], prompt: str) -> List[Dict[str, Any]]:
    """Rank items by relevance to the prompt."""
    prompt_words = set(prompt.lower().split())
    
    def score(item):
        term = item.get("term", "").lower()
        base_relevance = item.get("relevance", 0.5)
        term_words = set(term.split())
        overlap = len(term_words & prompt_words)
        return base_relevance + (overlap * 0.1)
    
    return sorted(items, key=score, reverse=True)


# ============================================================================
# CONVERSATION CONTEXT
# ============================================================================

class ConversationContext:
    """Track and manage multi-turn conversation context."""
    
    def __init__(self, history: List[Dict[str, Any]] = None):
        self.history = history or []
        self.iteration_count = len([m for m in self.history if m.get("role") == "user"])
        self.applied_styles = set()
        self.preferred_mood = None
        self.quality_level = "standard"
        self.variation_count = 0
        self._analyze_history()
    
    def _analyze_history(self):
        """Extract context from conversation history."""
        style_keywords = [
            "watercolor", "oil painting", "digital art", "photorealistic",
            "anime", "sketch", "cinematic", "moody", "vibrant", "bright",
            "dark", "minimalist", "abstract", "surreal"
        ]
        mood_keywords = ["moody", "bright", "dark", "cheerful", "dramatic", "soft", "warm"]
        
        for msg in self.history:
            content = msg.get("content", "").lower()
            
            for style in style_keywords:
                if style in content:
                    self.applied_styles.add(style)
            
            for mood in mood_keywords:
                if mood in content:
                    self.preferred_mood = mood
            
            if any(word in content for word in ["variation", "versions", "different"]):
                self.variation_count += 1
    
    def get_suggestions(self) -> List[Suggestion]:
        """Generate suggestions based on conversation context."""
        suggestions = []
        
        if self.iteration_count == 0:
            suggestions = [
                Suggestion("style", "Make it cinematic with golden hour lighting", "sun", relevance_score=0.9),
                Suggestion("style", "Add moody atmosphere with dramatic shadows", "moon", relevance_score=0.8),
                Suggestion("quality", "Enhance to professional quality", "sparkles", relevance_score=0.85),
            ]
        else:
            suggestions = [
                Suggestion("refinement", "Make it brighter and more vibrant", "sun", relevance_score=0.9),
                Suggestion("variation", "Generate 3 variations of this", "copy", "generate_variations", 0.85),
            ]
        
        return sorted(suggestions, key=lambda s: s.relevance_score, reverse=True)[:6]


# ============================================================================
# UNIFIED ENGINE
# ============================================================================

class PromptSuggestionEngine:
    """Unified engine for all prompt suggestion functionality."""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config = PromptConfig.from_json(config_path) if config_path else PromptConfig.default()
        self.context: Optional[ConversationContext] = None
    
    def set_context(self, conversation_history: List[Dict[str, Any]]):
        self.context = ConversationContext(conversation_history)
        return self
    
    def get_suggestions(self) -> List[Suggestion]:
        if self.context is None:
            self.context = ConversationContext([])
        return self.context.get_suggestions()
    
    def enhance(self, prompt: str) -> EnhancedPrompt:
        """Intelligently enhance a prompt based on analysis."""
        prompt_lower = prompt.lower()
        added_elements = []
        
        has_quality = any(term in prompt_lower for term in ["high quality", "detailed", "8k"])
        
        if not has_quality:
            ranked = rank_by_relevance(self.config.quality_boosters, prompt)
            selected = deterministic_sample(ranked[:5], 2, prompt[:50])
            for booster in selected:
                added_elements.append(booster["term"])
        
        season = get_current_season()
        seasonal = self.config.seasonal_elements.get(season, [])
        
        if added_elements:
            enhanced = f"{prompt}, {', '.join(added_elements)}"
        else:
            enhanced = prompt
        
        return EnhancedPrompt(
            original=prompt,
            enhanced=enhanced,
            added_elements=added_elements,
            trending_hashtags=self.config.hashtags[:3],
            seasonal_elements=seasonal[:2],
            enhancement_type="quality" if added_elements else "none"
        )
    
    def get_completions(self, partial_text: str) -> List[str]:
        completions = []
        partial_lower = partial_text.lower()
        
        for pattern, options in self.config.style_completions.items():
            if pattern in partial_lower:
                for option in options:
                    completions.append(f"{pattern} {option}")
        
        if not completions:
            completions = [
                "Make it more vibrant",
                "Add cinematic lighting",
                "Make it moody and atmospheric",
            ]
        
        return completions[:5]


# ============================================================================
# BACKWARD COMPATIBILITY
# ============================================================================

TRENDING_ELEMENTS = PromptConfig.default().__dict__

def get_context_aware_suggestions(
    conversation_history: List[Dict[str, Any]],
    current_prompt: str = ""
) -> List[Dict[str, str]]:
    engine = PromptSuggestionEngine()
    engine.set_context(conversation_history)
    suggestions = engine.get_suggestions()
    
    return [
        {"type": s.type, "text": s.text, "icon": s.icon, **({"action": s.action} if s.action else {})}
        for s in suggestions
    ]


def enhance_prompt_with_trends(prompt: str) -> Dict[str, Any]:
    engine = PromptSuggestionEngine()
    result = engine.enhance(prompt)
    
    return {
        "original": result.original,
        "enhanced": result.enhanced,
        "suggested_additions": result.added_elements,
        "trending_hashtags": result.trending_hashtags,
        "seasonal_suggestions": result.seasonal_elements,
    }


def get_style_completions(partial_text: str) -> List[str]:
    engine = PromptSuggestionEngine()
    return engine.get_completions(partial_text)
