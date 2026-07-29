/**
 * Client for VibeIMG AI Image FastAPI backend.
 * Requires user to be authenticated; pass Supabase session access_token.
 */

const getBaseUrl = () =>
  (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

export type GenerateRequest = {
  prompt: string;
  session_id?: string | null;
  /** Optional base64 data URL (e.g. data:image/jpeg;base64,...) for reference / img2img */
  image_base64?: string | null;
  model?: string;
  /** When true, generate 4 variations and return all URLs in image_urls */
  variations?: boolean;
  /** Server loads full library prompt (keeps copy gated for free users) */
  library_prompt_id?: number | null;
  library_slide_index?: number;
};

export type GenerateResponse = {
  image_url: string;
  /** All variation URLs (populated when variations=true) */
  image_urls: string[];
  message_id: string | null;
  credits_remaining: number;
};

export type CreditsResponse = {
  credits: number;
};

export type SuggestResponse = {
  suggestions: Array<{ prompt_text: string; title: string; category: string }>;
};

export type SessionResponse = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageResponse = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  created_at: string;
};

export type ChatInsightsResponse = {
  should_refine: boolean;
  is_variation: boolean;
  insight: string;
};

export type ConversationContextResponse = {
  themes: string[];
  preferred_styles: string[];
  complexity: string;
  next_variations: string[];
};

export type PromptFramework = {
  subject_definition: string;
  action_context: string;
  environment_setting: string;
  mood_story: string;
  visual_style: string;
  lighting_color: string;
  camera_composition: string;
  detail_texture: string;
  quality_realism: string;
  negative_constraints: string;
};

export type BuildPromptResponse = {
  full_prompt: string;
  compact_prompt: string;
  tips: string;
};

export type FrameworkFromNaturalLanguageResponse = {
  framework: PromptFramework;
  confidence: string;
};

export type QuickFixResponse = {
  issue: string;
  fixes: string[];
};

export type NegativeConstraintsResponse = {
  constraints: string;
  count: number;
};

export type PresetsResponse = {
  presets: Record<string, PromptFramework>;
};

export type LoRAStyle = {
  id: string;
  name: string;
  description: string;
  trigger_word: string;
  recommended_strength: number;
  negative_tags: string[];
  artist_name: string;
  artist_url?: string;
  credit_text: string;
  recommended_model?: string;
  recommended_cfg?: number;
  recommended_steps?: number;
  recommended_sampler?: string;
  category: string;
  tags: string[];
  preview_image_url?: string;
};

export type StylesResponse = {
  styles: LoRAStyle[];
};

export type StyleDetailResponse = {
  style: LoRAStyle;
  formatted_prompt: string;
  with_credit: string;
  parameters: Record<string, unknown>;
};

export type StyleCategoriesResponse = {
  categories: string[];
};

/**
 * Dev bypass: only active when VITE_DEV_NO_AUTH=1 is set in the frontend .env.
 * Set it in your root .env for local testing without sign-in.
 * Leave it unset (or set to 0) to require real auth even in dev.
 */
const isDevNoAuth = () =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_NO_AUTH === "1";

import { supabase } from "@/lib/supabase";

async function fetchApi<T>(
  path: string,
  options: RequestInit & { token: string | null }
): Promise<T> {
  const { token, ...init } = options;
  const url = `${getBaseUrl().replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (isDevNoAuth()) {
    headers["X-Dev-No-Auth"] = "1";
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new Error("Server is busy, please try again in a moment.");
  }
  
  // Handle 401 - try to refresh token once
  if (res.status === 401 && token) {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (session?.access_token && !error) {
        // Retry with new token
        headers.Authorization = `Bearer ${session.access_token}`;
        res = await fetch(url, { ...init, headers });
        
        // Update stored token if retry succeeds
        if (res.ok) {
          // Token refreshed successfully
          console.log("Token refreshed successfully");
        }
      }
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
    }
  }
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || res.statusText);
  }
  return res.json() as Promise<T>;
}

/** True only when VITE_DEV_NO_AUTH=1 is explicitly set in the frontend .env. */
export function canUseDevNoAuth(): boolean {
  return isDevNoAuth();
}

export async function getCredits(token: string | null): Promise<CreditsResponse> {
  return fetchApi<CreditsResponse>("/credits", { method: "GET", token });
}

// ============================================================================
// CREDIT EARNING API
// ============================================================================

export type CreditStructureResponse = {
  new_user_bonus: number;
  costs: {
    standard: number;
    hd: number;
    batch: number;
  };
  earnings: {
    daily_login: number;
    share_creation: number;
    community_engagement: number;
  };
};

export type CreditEarningResponse = {
  success: boolean;
  credits_earned: number;
  new_balance: number;
  message: string;
};

export type CreditTransaction = {
  type: string;
  amount: number;
  balance_after: number;
  created_at: string;
};

export type CreditHistoryResponse = {
  transactions: CreditTransaction[];
};

export async function getCreditStructure(): Promise<CreditStructureResponse> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/credits/structure`);
  if (!response.ok) {
    throw new Error(`Failed to fetch credit structure: ${response.statusText}`);
  }
  return response.json();
}

export async function claimDailyLoginCredit(
  token: string | null
): Promise<CreditEarningResponse> {
  return fetchApi<CreditEarningResponse>("/credits/claim-daily", {
    method: "POST",
    token,
  });
}

export async function claimShareCredit(
  token: string | null
): Promise<CreditEarningResponse> {
  return fetchApi<CreditEarningResponse>("/credits/claim-share", {
    method: "POST",
    token,
  });
}

export async function claimCommunityCredit(
  token: string | null
): Promise<CreditEarningResponse> {
  return fetchApi<CreditEarningResponse>("/credits/claim-community", {
    method: "POST",
    token,
  });
}

export async function getCreditHistory(
  token: string | null,
  limit: number = 50
): Promise<CreditHistoryResponse> {
  return fetchApi<CreditHistoryResponse>(`/credits/history?limit=${limit}`, {
    method: "GET",
    token,
  });
}

export async function getSuggestions(
  token: string | null,
  options?: { limit?: number; category?: string }
): Promise<SuggestResponse> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.category) params.set("category", options.category);
  const q = params.toString();
  return fetchApi<SuggestResponse>(`/suggest${q ? `?${q}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function generateImage(
  token: string | null,
  body: GenerateRequest
): Promise<GenerateResponse> {
  return fetchApi<GenerateResponse>("/generate", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function createSession(
  token: string | null,
  title?: string
): Promise<SessionResponse> {
  return fetchApi<SessionResponse>("/sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ title: title ?? "New chat" }),
  });
}

export async function listSessions(token: string | null): Promise<SessionResponse[]> {
  return fetchApi<SessionResponse[]>("/sessions", { method: "GET", token });
}

export async function deleteSession(token: string | null, sessionId: string): Promise<void> {
  return fetchApi<void>(`/sessions/${sessionId}`, { method: "DELETE", token });
}

export type GenerationRecord = {
  id: string;
  session_id: string;
  content: string;
  image_url: string;
  created_at: string;
};

export async function getMyGenerations(token: string | null): Promise<{ generations: GenerationRecord[] }> {
  return fetchApi<{ generations: GenerationRecord[] }>("/my-generations", { method: "GET", token });
}

export async function listMessages(
  token: string | null,
  sessionId: string,
  options?: { limit?: number; beforeId?: string }
): Promise<MessageResponse[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.beforeId) params.set("before_id", options.beforeId);
  const query = params.toString();
  return fetchApi<MessageResponse[]>(`/sessions/${sessionId}/messages${query ? `?${query}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function getChatInsights(
  token: string | null,
  message: string,
  previousPrompts?: string[]
): Promise<ChatInsightsResponse> {
  return fetchApi<ChatInsightsResponse>("/chat/insights", {
    method: "POST",
    token,
    body: JSON.stringify({ message, previous_prompts: previousPrompts }),
  });
}

export async function getConversationContext(
  token: string | null,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ConversationContextResponse> {
  return fetchApi<ConversationContextResponse>("/chat/context", {
    method: "POST",
    token,
    body: JSON.stringify({ messages }),
  });
}

export async function refinePrompt(
  token: string | null,
  text: string,
  hasReferenceImage: boolean = false
): Promise<{ refined: string }> {
  return fetchApi<{ refined: string }>("/refine-prompt", {
    method: "POST",
    token,
    body: JSON.stringify({ text, has_reference_image: hasReferenceImage }),
  });
}

export type SubscriptionStatus = {
  plan: string | null;
  status: string | null;
  credits: number;
  library_unlocked?: boolean;
};

export async function getSubscriptionStatus(
  token: string | null
): Promise<SubscriptionStatus> {
  return fetchApi<SubscriptionStatus>("/payments/subscription", {
    method: "GET",
    token,
  });
}

export type LibraryUnlockResponse = {
  unlocked: boolean;
  prompts: Array<{
    id: number;
    title: string;
    slug: string;
    featured: boolean;
    is_premium: boolean;
    category: string;
    platforms: string[];
    packs: string[];
    slides: Array<{
      prompt: string;
      preview: string;
      image: string;
      before_image: string;
      sort_order: number;
    }>;
  }>;
};

export async function getUnlockedLibrary(
  token: string | null
): Promise<LibraryUnlockResponse> {
  return fetchApi<LibraryUnlockResponse>("/prompts/library", {
    method: "GET",
    token,
  });
}

export async function createSubscriptionCheckout(
  token: string | null,
  plan: string
): Promise<{ checkout_url: string }> {
  return fetchApi<{ checkout_url: string }>("/payments/create-checkout", {
    method: "POST",
    token,
    body: JSON.stringify({ plan }),
  });
}

export async function openCustomerPortal(
  token: string | null
): Promise<{ portal_url: string }> {
  return fetchApi<{ portal_url: string }>("/payments/customer-portal", {
    method: "POST",
    token,
  });
}

export async function syncCreditsFromStripe(
  token: string | null
): Promise<{ status: string; credits: number; plan: string; subscription_id: string }> {
  return fetchApi<{ status: string; credits: number; plan: string; subscription_id: string }>("/payments/sync-credits", {
    method: "POST",
    token,
  });
}

export type PlanInfo = {
  slug: string;
  label: string;
  price: string;
  credits: number;
  features?: string[];
};

export async function getPlans(): Promise<{ plans: PlanInfo[] }> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/pricing/plans`);
  if (!response.ok) {
    throw new Error(`Failed to fetch plans: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// PROMPT FRAMEWORK API
// ============================================================================

export async function getFrameworkPresets(
  token: string | null
): Promise<PresetsResponse> {
  return fetchApi<PresetsResponse>("/framework/presets", {
    method: "GET",
    token,
  });
}

export async function buildPromptFromFramework(
  token: string | null,
  framework: PromptFramework,
  format: "full" | "compact" = "compact"
): Promise<BuildPromptResponse> {
  return fetchApi<BuildPromptResponse>("/framework/build", {
    method: "POST",
    token,
    body: JSON.stringify({ framework, format }),
  });
}

export async function createFrameworkFromDescription(
  token: string | null,
  description: string
): Promise<FrameworkFromNaturalLanguageResponse> {
  return fetchApi<FrameworkFromNaturalLanguageResponse>("/framework/from-description", {
    method: "POST",
    token,
    body: JSON.stringify({ description }),
  });
}

export async function getQuickFixes(
  token: string | null,
  issue: string
): Promise<QuickFixResponse> {
  return fetchApi<QuickFixResponse>(`/framework/quick-fixes/${issue}`, {
    method: "GET",
    token,
  });
}

export async function buildNegativeConstraints(
  token: string | null,
  categories?: string[]
): Promise<NegativeConstraintsResponse> {
  return fetchApi<NegativeConstraintsResponse>("/framework/negatives", {
    method: "POST",
    token,
    body: JSON.stringify({ categories: categories || ["text_and_artifacts", "anatomy", "quality"] }),
  });
}

// ============================================================================
// STYLE LIBRARY API
// ============================================================================

export async function getAllStyles(
  token: string | null
): Promise<StylesResponse> {
  return fetchApi<StylesResponse>("/styles/all", {
    method: "GET",
    token,
  });
}

export async function getStyleCategories(
  token: string | null
): Promise<StyleCategoriesResponse> {
  return fetchApi<StyleCategoriesResponse>("/styles/categories", {
    method: "GET",
    token,
  });
}

export async function getStyleDetail(
  token: string | null,
  styleId: string
): Promise<StyleDetailResponse> {
  return fetchApi<StyleDetailResponse>(`/styles/${styleId}`, {
    method: "GET",
    token,
  });
}

export async function searchStyles(
  token: string | null,
  query: string,
  category?: string
): Promise<StylesResponse> {
  return fetchApi<StylesResponse>("/styles/search", {
    method: "POST",
    token,
    body: JSON.stringify({ query, category }),
  });
}

// ============================================================================
// MODELS API
// ============================================================================

export type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  description: string;
  available: boolean;
};

export async function getModels(token: string | null): Promise<{ models: ModelInfo[] }> {
  return fetchApi<{ models: ModelInfo[] }>("/models", {
    method: "GET",
    token,
  });
}

// ============================================================================
// THINKING API
// ============================================================================

export type ThinkingStep = {
  id: string;
  title: string;
  content: string;
  status: "pending" | "active" | "complete";
  icon: string;
};

export type ThinkingRequest = {
  prompt: string;
  has_uploaded_image?: boolean;
  is_refinement?: boolean;
  is_img2img?: boolean;
};

export async function getThinkingSteps(
  token: string | null,
  body: ThinkingRequest
): Promise<ThinkingStep[]> {
  return fetchApi<ThinkingStep[]>("/thinking/generate", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

// ============================================================================
// FEEDBACK API
// ============================================================================

export type FeedbackSubmitRequest = {
  message_id: string;
  feedback_type: "thumbs_up" | "thumbs_down" | "rating" | "report" | "suggestion";
  rating?: number; // 1-5
  categories?: {
    style_accuracy?: number;
    prompt_following?: number;
    overall_quality?: number;
  };
  report_reason?: "inappropriate" | "low_quality" | "not_matching_prompt" | "copyright" | "other";
  report_details?: string;
  improvement_suggestion?: string;
};

export type FeedbackSubmitResponse = {
  success: boolean;
  message: string;
};

export type FeedbackStatsResponse = {
  thumbs_up: number;
  thumbs_down: number;
  total_ratings: number;
  average_rating: number | null;
};

export type FeedbackHistoryItem = {
  id: string;
  message_id: string;
  feedback_type: string;
  rating?: number;
  created_at: string;
  chat_messages?: {
    image_url: string;
    content: string;
  };
};

export async function submitFeedback(
  token: string | null,
  body: FeedbackSubmitRequest
): Promise<FeedbackSubmitResponse> {
  return fetchApi<FeedbackSubmitResponse>("/feedback/submit", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function getFeedbackStats(
  token: string | null,
  messageId: string
): Promise<FeedbackStatsResponse> {
  return fetchApi<FeedbackStatsResponse>(`/feedback/stats/${messageId}`, {
    method: "GET",
    token,
  });
}

export async function getFeedbackHistory(
  token: string | null,
  limit: number = 50
): Promise<{ feedback: FeedbackHistoryItem[] }> {
  return fetchApi<{ feedback: FeedbackHistoryItem[] }>(`/feedback/history?limit=${limit}`, {
    method: "GET",
    token,
  });
}

// ============================================================================
// INTELLIGENT PROMPT SUGGESTIONS API
// ============================================================================

export type PromptSuggestion = {
  type: "style" | "quality" | "variation" | "style_transfer" | "refinement";
  text: string;
  icon: string;
  action?: string;
};

export type PromptSuggestionsRequest = {
  conversation_history: Array<{ role: "user" | "assistant"; content: string }>;
  current_prompt: string;
};

export type PromptSuggestionsResponse = {
  suggestions: PromptSuggestion[];
};

export type PromptEnhanceResponse = {
  original: string;
  enhanced: string;
  suggested_additions: string[];
  trending_hashtags: string[];
  seasonal_suggestions: string[];
};

export type StyleCompletionResponse = {
  completions: string[];
};

export type TrendingElementsResponse = {
  styles: string[];
  hashtags: string[];
  quality_boosters: string[];
  seasonal: {
    current_season: string;
    elements: string[];
  };
  updated_at: string;
};

export async function getPromptSuggestions(
  token: string | null,
  body: PromptSuggestionsRequest
): Promise<PromptSuggestionsResponse> {
  return fetchApi<PromptSuggestionsResponse>("/prompts/suggestions", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function enhancePrompt(
  token: string | null,
  prompt: string
): Promise<PromptEnhanceResponse> {
  return fetchApi<PromptEnhanceResponse>("/prompts/enhance", {
    method: "POST",
    token,
    body: JSON.stringify({ prompt }),
  });
}

export async function getStyleCompletions(
  token: string | null,
  partialText: string
): Promise<StyleCompletionResponse> {
  return fetchApi<StyleCompletionResponse>("/prompts/complete", {
    method: "POST",
    token,
    body: JSON.stringify({ partial_text: partialText }),
  });
}

export async function getTrendingElements(): Promise<TrendingElementsResponse> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/prompts/trending`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trending elements: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// SEARCH & ANALYTICS API
// ============================================================================

export type SearchResult = {
  prompt: string;
  image_url: string;
};

export async function searchGenerations(
  token: string | null,
  query: string,
  k: number = 12
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, k: String(k) });
  return fetchApi<SearchResult[]>(`/search?${params.toString()}`, {
    method: "GET",
    token,
  });
}

export type DailyCount = {
  date: string;
  count: number;
};

export type AnalyticsData = {
  total_generations: number;
  credits_used: number;
  generations_by_day: DailyCount[];
  top_prompts: string[];
};

export async function getAnalytics(token: string | null): Promise<AnalyticsData> {
  return fetchApi<AnalyticsData>("/analytics", { method: "GET", token });
}
