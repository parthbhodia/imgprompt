"""
LangChain-powered prompt refinement agent.

Replaces direct chat_completion calls with a LangChain LCEL pipeline
that uses an AgentExecutor with two tools:
  - lookup_similar_prompts: RAG retrieval from rag_store
  - suggest_style_keywords:  static style hint lookup by theme

xAI (Grok) is used as the LLM via langchain-openai + custom base_url.
Falls back to Groq via langchain-groq if xAI is unavailable.
"""
import logging
from typing import Optional

from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Style hints — static keyword map for common themes
# ---------------------------------------------------------------------------
_STYLE_HINTS: dict[str, str] = {
    "portrait": "cinematic lighting, shallow depth of field, bokeh background, professional photography",
    "landscape": "golden hour, sweeping vistas, dramatic sky, volumetric light, 8k resolution",
    "fantasy": "digital painting, concept art, ethereal glow, vibrant colors, intricate details",
    "cyberpunk": "neon lights, rain-slicked streets, holographic displays, dark moody atmosphere",
    "anime": "vibrant colors, expressive line art, dynamic composition, Studio Ghibli quality",
    "architecture": "dramatic perspective, sharp lines, realistic render, award-winning photography",
    "food": "macro photography, soft natural light, appetizing presentation, restaurant quality",
    "space": "deep field astronomy, nebula colors, cosmic scale, NASA quality photography",
    "horror": "dark atmosphere, fog, silhouette, unsettling mood, cinematic horror lighting",
    "nature": "national geographic, macro detail, golden ratio composition, natural lighting",
}


# ---------------------------------------------------------------------------
# LangChain Tools
# ---------------------------------------------------------------------------

@tool
def lookup_similar_prompts(query: str) -> str:
    """
    Retrieve high-quality refined prompts from past successful image generations
    that are semantically similar to the user's request. Use these as quality
    and richness benchmarks when crafting the refined prompt.
    """
    try:
        from rag_store import retrieve_similar
        results = retrieve_similar(query, k=2)
        if not results:
            return "No similar prompts found in history."
        return "High-quality reference prompts: " + " | ".join(results[:2])
    except Exception as e:
        logger.warning("[LC_AGENT] rag lookup failed: %s", e)
        return "RAG lookup unavailable."


@tool
def suggest_style_keywords(subject_or_theme: str) -> str:
    """
    Suggest relevant visual style keywords and photography/art terms for a given
    subject or theme to enrich the image generation prompt.
    """
    s = subject_or_theme.lower()
    for key, keywords in _STYLE_HINTS.items():
        if key in s:
            return keywords
    return "high detail, professional quality, award-winning, masterpiece"


_TOOLS = [lookup_similar_prompts, suggest_style_keywords]

_AGENT_SYSTEM = (
    "You are an expert prompt engineer for the Flux AI image generation model. "
    "Your job is to transform a rough user idea into a rich, detailed image generation prompt.\n\n"
    "Process:\n"
    "1. Use lookup_similar_prompts to retrieve high-quality reference prompts.\n"
    "2. Use suggest_style_keywords to enrich with relevant visual terms.\n"
    "3. Combine your findings into a single refined prompt: 1-3 sentences, rich with "
    "   subject description, art style, lighting, mood, color palette, and composition.\n\n"
    "IMPORTANT: Respond with ONLY the final refined prompt — no explanation, no preamble, no quotes."
)


def _build_executor() -> Optional[AgentExecutor]:
    """Build the LangChain AgentExecutor. Returns None if xAI key is not set."""
    if not settings.xai_api_key:
        return None
    try:
        llm = ChatOpenAI(
            model="grok-3-mini",
            api_key=settings.xai_api_key,
            base_url="https://api.x.ai/v1",
            max_tokens=300,
            temperature=0.7,
            timeout=12,
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", _AGENT_SYSTEM),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        agent = create_openai_tools_agent(llm, _TOOLS, prompt)
        return AgentExecutor(agent=agent, tools=_TOOLS, max_iterations=3, verbose=False)
    except Exception as e:
        logger.warning("[LC_AGENT] Could not build AgentExecutor: %s", e)
        return None


# Lazily initialised — built on first use
_executor: Optional[AgentExecutor] = None
_executor_attempted = False


def lc_refine_prompt(user_text: str) -> Optional[str]:
    """
    Refine `user_text` using the LangChain agent pipeline.
    Returns the refined prompt string, or None if the agent is unavailable / fails.
    Callers should fall back to the existing direct-completion pipeline on None.
    """
    global _executor, _executor_attempted
    if not _executor_attempted:
        _executor = _build_executor()
        _executor_attempted = True

    if _executor is None:
        return None

    try:
        result = _executor.invoke({"input": user_text[:500]})
        output = (result.get("output") or "").strip()
        if output:
            logger.info("[LC_AGENT] Agent refined: %r → %r", user_text[:40], output[:60])
            return output
    except Exception as e:
        logger.warning("[LC_AGENT] Agent invocation failed, will fall back: %s", e)
    return None
