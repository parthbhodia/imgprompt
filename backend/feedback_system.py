"""
User feedback system for image quality, ratings, and reports.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class FeedbackType(str, Enum):
    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"
    RATING = "rating"
    REPORT = "report"
    SUGGESTION = "suggestion"

class ReportReason(str, Enum):
    INAPPROPRIATE = "inappropriate"
    LOW_QUALITY = "low_quality"
    NOT_MATCHING_PROMPT = "not_matching_prompt"
    COPYRIGHT = "copyright"
    OTHER = "other"


def submit_feedback(
    supabase,
    user_id: str,
    message_id: str,
    feedback_type: FeedbackType,
    rating: Optional[int] = None,
    categories: Optional[Dict[str, int]] = None,
    report_reason: Optional[ReportReason] = None,
    report_details: Optional[str] = None,
    improvement_suggestion: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Submit user feedback for a generated image.
    
    Args:
        rating: 1-5 overall rating
        categories: Dict with keys like 'style_accuracy', 'prompt_following', 'overall_quality'
    """
    try:
        data = {
            "user_id": user_id,
            "message_id": message_id,
            "feedback_type": feedback_type.value,
            "rating": rating,
            "categories": categories,
            "report_reason": report_reason.value if report_reason else None,
            "report_details": report_details,
            "improvement_suggestion": improvement_suggestion,
            "metadata": metadata or {},
            "created_at": datetime.now().isoformat(),
        }
        
        supabase.table("user_feedback").insert(data).execute()
        return True
    except Exception as e:
        print(f"Failed to submit feedback: {e}")
        return False


def get_feedback_stats(
    supabase,
    message_id: str
) -> Dict[str, Any]:
    """Get aggregated feedback stats for a message/image."""
    try:
        # Get thumbs counts
        thumbs_result = (
            supabase.table("user_feedback")
            .select("feedback_type")
            .eq("message_id", message_id)
            .execute()
        )
        
        thumbs_up = sum(1 for r in thumbs_result.data if r["feedback_type"] == "thumbs_up")
        thumbs_down = sum(1 for r in thumbs_result.data if r["feedback_type"] == "thumbs_down")
        
        # Get average rating
        ratings_result = (
            supabase.table("user_feedback")
            .select("rating")
            .eq("message_id", message_id)
            .not_.is_("rating", "null")
            .execute()
        )
        
        ratings = [r["rating"] for r in ratings_result.data if r["rating"]]
        avg_rating = sum(ratings) / len(ratings) if ratings else None
        
        return {
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down,
            "total_ratings": len(ratings),
            "average_rating": round(avg_rating, 2) if avg_rating else None,
        }
    except Exception as e:
        print(f"Failed to get feedback stats: {e}")
        return {"thumbs_up": 0, "thumbs_down": 0, "total_ratings": 0, "average_rating": None}


def get_user_feedback_history(
    supabase,
    user_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get feedback history for a user."""
    try:
        result = (
            supabase.table("user_feedback")
            .select("*, chat_messages!inner(image_url, content)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
    except Exception as e:
        print(f"Failed to get feedback history: {e}")
        return []


def analyze_feedback_trends(supabase) -> Dict[str, Any]:
    """Analyze overall feedback trends for admin dashboard."""
    try:
        # Get last 7 days feedback
        from datetime import timedelta
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        
        result = (
            supabase.table("user_feedback")
            .select("feedback_type, rating, created_at")
            .gte("created_at", week_ago)
            .execute()
        )
        
        data = result.data
        
        total = len(data)
        thumbs_up = sum(1 for r in data if r["feedback_type"] == "thumbs_up")
        thumbs_down = sum(1 for r in data if r["feedback_type"] == "thumbs_down")
        
        ratings = [r["rating"] for r in data if r["rating"]]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        
        return {
            "period": "last_7_days",
            "total_feedback": total,
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down,
            "thumbs_up_percentage": round(thumbs_up / total * 100, 2) if total > 0 else 0,
            "average_rating": round(avg_rating, 2),
            "response_rate": len(ratings) / total * 100 if total > 0 else 0,
        }
    except Exception as e:
        print(f"Failed to analyze trends: {e}")
        return {}
