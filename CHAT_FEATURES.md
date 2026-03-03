# Chat Features Documentation

Complete guide to the three core chat systems: User Feedback, Credit System, and Prompt Suggestions.

---

## Table of Contents
1. [User Feedback System](#user-feedback-system)
2. [Credit System](#credit-system)
3. [Prompt Suggestions](#prompt-suggestions)
4. [Integration Guide](#integration-guide)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)

---

## User Feedback System

### Overview
Multi-level feedback mechanism for users to rate, report, and suggest improvements for generated images.

### Feedback Types

| Type | Purpose | Data Captured |
|------|---------|---------------|
| **Thumbs Up/Down** | Quick binary feedback | feedback_type only |
| **Rating** | 1-5 star overall rating | rating (1-5) |
| **Detailed Rating** | Category-specific ratings | categories: {style_accuracy, prompt_following, overall_quality} |
| **Report** | Flag problematic images | report_reason, report_details |
| **Suggestion** | User improvement ideas | improvement_suggestion text |

### Backend Implementation

**File:** `backend/feedback_system.py`

**Core Functions:**

```python
submit_feedback(
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
) -> bool
```
Stores feedback in `user_feedback` table.

```python
get_feedback_stats(supabase, message_id: str) -> Dict[str, Any]
```
Returns aggregated stats:
- `thumbs_up`: count
- `thumbs_down`: count
- `total_ratings`: count
- `average_rating`: float (1-5)

```python
get_user_feedback_history(supabase, user_id: str, limit: int = 50) -> List[Dict]
```
Returns user's feedback history with related image data.

```python
analyze_feedback_trends(supabase) -> Dict[str, Any]
```
Admin analytics for last 7 days:
- `total_feedback`: count
- `thumbs_up_percentage`: %
- `average_rating`: float
- `response_rate`: % of users who rated

### Frontend Implementation

**File:** `src/components/FeedbackWidget.tsx`

**Component Props:**
```typescript
interface FeedbackWidgetProps {
  messageId: string;
  token: string | null;
  imageUrl?: string;
  onFeedbackSubmitted?: () => void;
}
```

**Features:**
- Quick thumbs up/down buttons (green/red)
- 5-star rating system
- Expandable detailed rating panel (4-5 stars)
- Report dialog with reason selection
- Suggestion dialog for improvements
- Success/error toast notifications

**Usage:**
```tsx
<FeedbackWidget 
  messageId={message.id}
  token={token}
  imageUrl={message.image_url}
  onFeedbackSubmitted={() => refetchStats()}
/>
```

### API Endpoints

```
POST /feedback/submit
Request: {
  message_id: string,
  feedback_type: "thumbs_up" | "thumbs_down" | "rating" | "report" | "suggestion",
  rating?: number (1-5),
  categories?: { style_accuracy?: number, prompt_following?: number, overall_quality?: number },
  report_reason?: "inappropriate" | "low_quality" | "not_matching_prompt" | "copyright" | "other",
  report_details?: string,
  improvement_suggestion?: string
}
Response: { success: boolean, message: string }

GET /feedback/stats/{message_id}
Response: {
  thumbs_up: number,
  thumbs_down: number,
  total_ratings: number,
  average_rating: number | null
}

GET /feedback/history?limit=50
Response: { feedback: FeedbackHistoryItem[] }
```

### Database Schema

**Table:** `user_feedback`
```sql
id UUID PRIMARY KEY
user_id UUID (FK auth.users)
message_id VARCHAR
feedback_type VARCHAR (enum: thumbs_up, thumbs_down, rating, report, suggestion)
rating INT (1-5, nullable)
categories JSONB (nullable)
report_reason VARCHAR (nullable)
report_details TEXT (nullable)
improvement_suggestion TEXT (nullable)
metadata JSONB
created_at TIMESTAMP
```

**Indexes:**
- `user_id` - for user history queries
- `message_id` - for aggregation queries
- `feedback_type` - for analytics
- `created_at` - for time-range queries

**RLS Policies:**
- Users can SELECT only their own feedback
- Users can INSERT only their own feedback
- Admins can SELECT all feedback

---

## Credit System

### Overview
Freemium credit system with:
- New user bonus (10 credits)
- Generation costs (standard: 1, HD: 2, batch: 3)
- Earning methods (daily login: 1, share: 1, community: 0.5)
- Transaction history and analytics

### Credit Costs & Earnings

**Generation Costs:**
| Type | Cost |
|------|------|
| Standard Generation | 1 credit |
| HD Generation | 2 credits |
| Batch Generation (3 images) | 3 credits |

**Earning Methods:**
| Method | Amount | Frequency |
|--------|--------|-----------|
| Daily Login Bonus | 1 credit | Once per day |
| Share Creation | 1 credit | Per share |
| Community Engagement | 0.5 credit | Per engagement |
| Welcome Bonus | 10 credits | New users only |

### Backend Implementation

**File:** `backend/credits.py`

**Core Functions:**

```python
get_credits(supabase: Client, user_id: str) -> float
```
Returns current credit balance.

```python
deduct_credits(supabase: Client, user_id: str, amount: float, 
               transaction_type: str = "spend_standard") -> bool
```
Deducts credits and logs transaction. Returns False if insufficient balance.

```python
add_credits(supabase: Client, user_id: str, amount: float,
            transaction_type: str = "bonus") -> bool
```
Adds credits and logs transaction.

```python
claim_daily_login(supabase: Client, user_id: str) -> tuple[bool, float]
```
Claims daily login bonus (once per day). Returns (success, new_balance).

```python
claim_share_credit(supabase: Client, user_id: str) -> tuple[bool, float]
```
Awards credit for sharing. Returns (success, new_balance).

```python
claim_community_engagement(supabase: Client, user_id: str) -> tuple[bool, float]
```
Awards credit for community engagement. Returns (success, new_balance).

```python
get_credit_history(supabase: Client, user_id: str, limit: int = 50) -> List[Dict]
```
Returns transaction history with type, amount, balance_after, created_at.

### Frontend Implementation

**File:** `src/lib/api.ts`

**API Functions:**
```typescript
getCredits(token: string | null): Promise<CreditsResponse>
claimDailyLogin(token: string | null): Promise<{ success: boolean, credits: number }>
claimShareCredit(token: string | null): Promise<{ success: boolean, credits: number }>
claimCommunityEngagement(token: string | null): Promise<{ success: boolean, credits: number }>
getCreditHistory(token: string | null, limit?: number): Promise<CreditTransaction[]>
getCreditStructure(): Promise<CreditStructure>
```

### API Endpoints

```
GET /credits
Response: { credits: number, user_id: string }

POST /credits/claim-daily
Response: { success: boolean, credits: number }

POST /credits/claim-share
Response: { success: boolean, credits: number }

POST /credits/claim-community
Response: { success: boolean, credits: number }

GET /credits/history?limit=50
Response: { transactions: CreditTransaction[] }

GET /credits/structure
Response: {
  costs: { standard: 1, hd: 2, batch: 3 },
  earnings: { daily_login: 1, share: 1, community: 0.5 },
  new_user_bonus: 10
}
```

### Database Schema

**Table:** `credit_transactions`
```sql
id UUID PRIMARY KEY
user_id UUID (FK auth.users)
amount DECIMAL (positive for earnings, negative for spending)
type VARCHAR (enum: spend_standard, spend_hd, spend_batch, earn_daily_login, earn_share, earn_community, purchase, bonus)
balance_after DECIMAL
metadata JSONB (optional: generation_id, etc.)
created_at TIMESTAMP
```

**Profiles Table Updates:**
```sql
ALTER TABLE profiles ADD COLUMN credits DECIMAL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_daily_login TIMESTAMP;
```

**Indexes:**
- `user_id` - for user history
- `created_at DESC` - for recent transactions
- `type` - for analytics

---

## Prompt Suggestions

### Overview
Intelligent, context-aware prompt suggestion engine with:
- Conversation context analysis
- Trending element integration
- Style completion suggestions
- Deterministic sampling (consistent UX)
- Config-driven (not hardcoded)

### Architecture

**File:** `backend/prompt_suggestions.py`

**Core Classes:**

```python
@dataclass
class Suggestion:
    type: str  # "style", "quality", "variation", "style_transfer", "refinement"
    text: str
    icon: str
    action: Optional[str]
    relevance_score: float

@dataclass
class EnhancedPrompt:
    original: str
    enhanced: str
    added_elements: List[str]
    trending_hashtags: List[str]
    seasonal_elements: List[str]
    enhancement_type: str  # "quality", "style", "seasonal", "mixed", "none"

@dataclass
class PromptConfig:
    styles: List[str]
    hashtags: List[str]
    quality_boosters: List[Dict]  # with relevance scores
    seasonal_elements: Dict[str, List[str]]
    style_completions: Dict[str, List[str]]
    initial_suggestions: List[Dict]
    refinement_suggestions: List[Dict]
```

**Main Engine:**

```python
class PromptSuggestionEngine:
    def __init__(self, config_path: Optional[str] = None)
    def set_context(self, conversation_history: List[Dict]) -> PromptSuggestionEngine
    def get_suggestions(self) -> List[Suggestion]
    def enhance(self, prompt: str) -> EnhancedPrompt
    def get_completions(self, partial_text: str) -> List[str]
```

**Conversation Context:**

```python
class ConversationContext:
    def __init__(self, history: List[Dict], config: Optional[PromptConfig])
    def get_suggestions(self) -> List[Suggestion]
    def get_preferred_mood(self) -> Optional[str]
    def get_applied_styles(self) -> List[str]
```

### Key Features

**1. Deterministic Sampling**
- Uses MD5 hash of prompt + date as seed
- Same prompt = same suggestions every day
- Consistent, predictable UX

**2. Relevance Ranking**
- Analyzes prompt for keyword overlap
- Ranks quality boosters by relevance
- Selects top matches deterministically

**3. Context Analysis**
- Extracts styles from conversation history
- Detects mood preferences
- Tracks variation requests
- Provides iteration-aware suggestions

**4. Enhancement Logic**
- Detects missing quality markers
- Adds seasonal elements intelligently
- Tracks enhancement types (quality, seasonal, mixed)
- Builds enhanced prompt with proper formatting

**5. Config-Driven**
- All data in `PromptConfig` dataclass
- Can load from JSON file
- Default fallback included
- Easy to update without code changes

### Suggestion Flow

**First Message (iteration_count == 0):**
```
Initial Suggestions from config:
- "Make it cinematic with golden hour lighting" (style, 0.9)
- "Add moody atmosphere with dramatic shadows" (style, 0.8)
- "Enhance to professional quality" (quality, 0.85)
```

**Subsequent Messages (iteration_count > 0):**
```
Refinement Suggestions from config:
- "Make it brighter and more vibrant" (refinement, 0.9)
- "Generate 3 variations of this" (variation, 0.85)
- "Add more dramatic lighting" (refinement, 0.8)
```

### Enhancement Example

**Input:**
```
"A portrait of a woman in a forest"
```

**Analysis:**
- No quality markers detected
- Seasonal: winter (add "snowy" or "cozy")
- Enhancement type: "mixed"

**Output:**
```python
EnhancedPrompt(
    original="A portrait of a woman in a forest",
    enhanced="A portrait of a woman in a forest, highly detailed, professional quality, snowy",
    added_elements=["highly detailed", "professional quality", "snowy"],
    trending_hashtags=["#aesthetic", "#digitalart"],
    seasonal_elements=["snowy", "cozy"],
    enhancement_type="mixed"
)
```

### API Endpoints

```
POST /prompts/suggestions
Request: {
  conversation_history: Array<{ role: "user" | "assistant", content: string }>,
  current_prompt: string
}
Response: { suggestions: Suggestion[] }

POST /prompts/enhance
Request: { prompt: string }
Response: {
  original: string,
  enhanced: string,
  suggested_additions: string[],
  trending_hashtags: string[],
  seasonal_suggestions: string[]
}

POST /prompts/complete
Request: { partial_text: string }
Response: { completions: string[] }

GET /prompts/trending
Response: {
  styles: string[],
  hashtags: string[],
  quality_boosters: string[],
  seasonal: { current_season: string, elements: string[] },
  updated_at: string
}
```

### Module-Level Singleton

```python
_engine: Optional[PromptSuggestionEngine] = None

def _get_engine() -> PromptSuggestionEngine:
    global _engine
    if _engine is None:
        _engine = PromptSuggestionEngine()
    return _engine
```

**Benefits:**
- Single engine instance per process
- Config loaded once
- No wasteful re-instantiation
- Backward-compatible functions delegate to singleton

### Backward Compatibility

```python
# Old API still works, delegates to singleton
get_context_aware_suggestions(history, prompt)
enhance_prompt_with_trends(prompt)
get_style_completions(partial_text)
```

---

## Integration Guide

### Adding Feedback Widget to ImageChat

```tsx
import { FeedbackWidget } from "@/components/FeedbackWidget";

// In message rendering loop:
{message.role === "assistant" && (
  <>
    {/* Image display */}
    {message.image_url && (
      <img src={message.image_url} alt="Generated" />
    )}
    
    {/* Feedback widget */}
    <FeedbackWidget
      messageId={message.id}
      token={token}
      imageUrl={message.image_url}
      onFeedbackSubmitted={() => {
        // Refetch stats, update UI, etc.
      }}
    />
  </>
)}
```

### Deducting Credits Before Generation

```python
# In generation endpoint
if not deduct_credits(supabase, user_id, amount=1, transaction_type="spend_standard"):
    raise HTTPException(status_code=402, detail="Insufficient credits")

# Generate image...
```

### Getting Prompt Suggestions

```tsx
import { getPromptSuggestions } from "@/lib/api";

const suggestions = await getPromptSuggestions(token, {
  conversation_history: messages,
  current_prompt: currentPrompt
});

// Display suggestions to user
```

### Enhancing User Prompt

```tsx
import { enhancePrompt } from "@/lib/api";

const enhanced = await enhancePrompt(token, userPrompt);
// Show enhancement preview
```

---

## Database Schema

### user_feedback Table
```sql
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    message_id VARCHAR NOT NULL,
    feedback_type VARCHAR NOT NULL,
    rating INT,
    categories JSONB,
    report_reason VARCHAR,
    report_details TEXT,
    improvement_suggestion TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_message_id ON user_feedback(message_id);
CREATE INDEX idx_user_feedback_created_at ON user_feedback(created_at DESC);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_feedback_select ON user_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_feedback_insert ON user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### credit_transactions Table
```sql
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    balance_after DECIMAL(10, 2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_transactions_select ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
```

### profiles Table Updates
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_daily_login TIMESTAMP WITH TIME ZONE;
```

---

## API Reference

### Feedback API

**Submit Feedback**
```
POST /feedback/submit
Authorization: Bearer {token}
Content-Type: application/json

{
  "message_id": "uuid",
  "feedback_type": "rating",
  "rating": 4,
  "categories": {
    "style_accuracy": 4,
    "prompt_following": 5,
    "overall_quality": 4
  }
}

Response: { "success": true, "message": "Feedback submitted successfully" }
```

**Get Feedback Stats**
```
GET /feedback/stats/{message_id}

Response: {
  "thumbs_up": 5,
  "thumbs_down": 1,
  "total_ratings": 12,
  "average_rating": 4.3
}
```

**Get User Feedback History**
```
GET /feedback/history?limit=50
Authorization: Bearer {token}

Response: {
  "feedback": [
    {
      "id": "uuid",
      "message_id": "uuid",
      "feedback_type": "rating",
      "rating": 5,
      "created_at": "2026-03-03T03:00:00Z"
    }
  ]
}
```

### Credit API

**Get Credit Balance**
```
GET /credits
Authorization: Bearer {token}

Response: { "credits": 8.5, "user_id": "uuid" }
```

**Claim Daily Login**
```
POST /credits/claim-daily
Authorization: Bearer {token}

Response: { "success": true, "credits": 9.5 }
```

**Get Credit History**
```
GET /credits/history?limit=50
Authorization: Bearer {token}

Response: {
  "transactions": [
    {
      "type": "spend_standard",
      "amount": -1,
      "balance_after": 8.5,
      "created_at": "2026-03-03T02:00:00Z"
    }
  ]
}
```

### Prompt Suggestion API

**Get Suggestions**
```
POST /prompts/suggestions
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversation_history": [
    { "role": "user", "content": "A portrait" },
    { "role": "assistant", "content": "Generated..." }
  ],
  "current_prompt": "Make it more vibrant"
}

Response: {
  "suggestions": [
    {
      "type": "refinement",
      "text": "Add cinematic lighting",
      "icon": "zap",
      "relevance_score": 0.9
    }
  ]
}
```

**Enhance Prompt**
```
POST /prompts/enhance
Authorization: Bearer {token}
Content-Type: application/json

{ "prompt": "A portrait of a woman" }

Response: {
  "original": "A portrait of a woman",
  "enhanced": "A portrait of a woman, highly detailed, professional quality",
  "suggested_additions": ["highly detailed", "professional quality"],
  "trending_hashtags": ["#aesthetic", "#digitalart"],
  "seasonal_suggestions": ["snowy", "cozy"]
}
```

---

## Configuration

### Loading Custom Prompt Config

```python
from prompt_suggestions import PromptSuggestionEngine

# Load from JSON
engine = PromptSuggestionEngine(config_path="/path/to/config.json")

# Or use defaults
engine = PromptSuggestionEngine()
```

**Config JSON Format:**
```json
{
  "styles": ["cinematic", "moody", "vibrant"],
  "hashtags": ["#aesthetic", "#digitalart"],
  "quality_boosters": [
    {"term": "highly detailed", "relevance": 0.9},
    {"term": "professional quality", "relevance": 0.8}
  ],
  "seasonal_elements": {
    "spring": ["cherry blossoms", "pastel colors"],
    "summer": ["golden hour", "tropical"]
  },
  "style_completions": {
    "make it more": ["vibrant", "dramatic"],
    "make it less": ["busy", "dark"]
  },
  "initial_suggestions": [...],
  "refinement_suggestions": [...]
}
```

---

## Status

✅ **Implemented & Deployed:**
- User Feedback System (backend + frontend)
- Credit System (backend + frontend API)
- Prompt Suggestions (backend with singleton pattern)
- All API endpoints
- Database migrations ready
- RLS policies configured

⏳ **Next Steps:**
- Run SQL migrations in Supabase
- Integrate FeedbackWidget into ImageChat
- Add credit deduction to generation endpoints
- Display prompt suggestions in chat UI
- Create admin dashboard for feedback analytics
