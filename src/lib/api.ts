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
};

export type GenerateResponse = {
  image_url: string;
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
  const res = await fetch(url, { ...init, headers });
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

export async function listMessages(
  token: string | null,
  sessionId: string
): Promise<MessageResponse[]> {
  return fetchApi<MessageResponse[]>(`/sessions/${sessionId}/messages`, {
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
  text: string
): Promise<{ refined: string }> {
  return fetchApi<{ refined: string }>("/refine-prompt", {
    method: "POST",
    token,
    body: JSON.stringify({ text }),
  });
}

export type SubscriptionStatus = {
  plan: string | null;
  status: string | null;
  credits: number;
};

export async function getSubscriptionStatus(
  token: string | null
): Promise<SubscriptionStatus> {
  return fetchApi<SubscriptionStatus>("/payments/subscription", {
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
