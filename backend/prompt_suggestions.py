"""
Unified prompt suggestion engine with proper architecture.
"""
import json
import random
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
    initial_suggestions: List[Dict[str, Any]] = field(default_factory=list)
    refinement_suggestions: List[Dict[str, Any]] = field(default_factory=list)
    
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
            },
            initial_suggestions=[
                {"type": "style", "text": "Make it cinematic with golden hour lighting", "icon": "sun", "relevance": 0.9},
                {"type": "style", "text": "Add moody atmosphere with dramatic shadows", "icon": "moon", "relevance": 0.8},
                {"type": "quality", "text": "Enhance to professional quality", "icon": "sparkles", "relevance": 0.85},
            ],
            refinement_suggestions=[
                {"type": "refinement", "text": "Make it brighter and more vibrant", "icon": "sun", "relevance": 0.9},
                {"type": "variation", "text": "Generate 3 variations of this", "icon": "copy", "action": "generate_variations", "relevance": 0.85},
                {"type": "refinement", "text": "Add more dramatic lighting", "icon": "zap", "relevance": 0.8},
            ]
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
    seed_hash = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    
    rng = random.Random(seed_hash)
    return rng.sample(items, min(n, len(items)))


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
    
    def __init__(self, history: List[Dict[str, Any]] = None, config: Optional['PromptConfig'] = None):
        self.history = history or []
        self.config = config or PromptConfig.default()
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
        """Generate suggestions based on conversation context and config."""
        if self.iteration_count == 0:
            suggestions_data = self.config.initial_suggestions
        else:
            suggestions_data = self.config.refinement_suggestions
        
        suggestions = [
            Suggestion(
                type=s.get("type", "style"),
                text=s.get("text", ""),
                icon=s.get("icon", "sparkles"),
                action=s.get("action"),
                relevance_score=s.get("relevance", 0.5)
            )
            for s in suggestions_data
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
    
    def set_context(self, conversation_history: List[Dict[str, Any]]) -> 'PromptSuggestionEngine':
        """Set conversation context. Returns self for fluent interface."""
        self.context = ConversationContext(conversation_history, self.config)
        return self
    
    def get_suggestions(self) -> List[Suggestion]:
        """Get context-aware suggestions."""
        if self.context is None:
            self.context = ConversationContext([], self.config)
        return self.context.get_suggestions()
    
    def enhance(self, prompt: str) -> EnhancedPrompt:
        """Intelligently enhance a prompt based on analysis."""
        prompt_lower = prompt.lower()
        added_elements = []
        enhancement_types = []
        
        # Check for existing quality markers
        has_quality = any(term in prompt_lower for term in ["high quality", "detailed", "8k"])
        
        # Add quality boosters if missing
        if not has_quality:
            ranked = rank_by_relevance(self.config.quality_boosters, prompt)
            selected = deterministic_sample(ranked[:5], 2, prompt[:50])
            for booster in selected:
                added_elements.append(booster["term"])
            enhancement_types.append("quality")
        
        # Add seasonal element if appropriate
        season = get_current_season()
        seasonal = self.config.seasonal_elements.get(season, [])
        
        if seasonal and not any(term in prompt_lower for term in seasonal):
            selected = deterministic_sample(seasonal, 1, f"{prompt}:{season}")
            if selected:
                added_elements.append(selected[0])
                enhancement_types.append("seasonal")
        
        # Build enhanced prompt
        if added_elements:
            enhanced = f"{prompt}, {', '.join(added_elements)}"
        else:
            enhanced = prompt
        
        # Determine enhancement type
        if len(enhancement_types) > 1:
            enhancement_type = "mixed"
        elif enhancement_types:
            enhancement_type = enhancement_types[0]
        else:
            enhancement_type = "none"
        
        return EnhancedPrompt(
            original=prompt,
            enhanced=enhanced,
            added_elements=added_elements,
            trending_hashtags=self.config.hashtags[:3],
            seasonal_elements=seasonal[:2],
            enhancement_type=enhancement_type
        )
    
    def get_completions(self, partial_text: str) -> List[str]:
        """Get style completion suggestions for partial text."""
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
# MODULE-LEVEL SINGLETON (avoid recreating engine on every call)
# ============================================================================

_engine: Optional[PromptSuggestionEngine] = None

def _get_engine() -> PromptSuggestionEngine:
    """Get or create the module-level engine singleton."""
    global _engine
    if _engine is None:
        _engine = PromptSuggestionEngine()
    return _engine


# ============================================================================
# BACKWARD COMPATIBILITY
# ============================================================================

TRENDING_ELEMENTS = PromptConfig.default().__dict__

def get_context_aware_suggestions(
    conversation_history: List[Dict[str, Any]],
    current_prompt: str = ""
) -> List[Dict[str, str]]:
    """Get context-aware suggestions using singleton engine."""
    engine = _get_engine()
    engine.set_context(conversation_history)
    suggestions = engine.get_suggestions()
    
    return [
        {"type": s.type, "text": s.text, "icon": s.icon, **({"action": s.action} if s.action else {})}
        for s in suggestions
    ]


def enhance_prompt_with_trends(prompt: str) -> Dict[str, Any]:
    """Enhance prompt using singleton engine."""
    engine = _get_engine()
    result = engine.enhance(prompt)
    
    return {
        "original": result.original,
        "enhanced": result.enhanced,
        "suggested_additions": result.added_elements,
        "trending_hashtags": result.trending_hashtags,
        "seasonal_suggestions": result.seasonal_elements,
    }


def get_style_completions(partial_text: str) -> List[str]:
    """Get style completions using singleton engine."""
    engine = _get_engine()
    return engine.get_completions(partial_text)
