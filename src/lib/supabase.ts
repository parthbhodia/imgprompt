import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase environment variables missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");

/* ------------------------------------------------------------------ */
/*  Public fetch helpers (used by the public-facing site + admin)      */
/* ------------------------------------------------------------------ */

export type PackRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  cover_image_url: string;
  sort_order: number;
};

export type PromptRow = {
  id: number;
  title: string;
  slug: string;
  featured: boolean;
  is_premium?: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  category: { id: number; name: string; slug: string } | null;
  slides: {
    id: number;
    prompt_text?: string;
    prompt_preview?: string;
    image_url: string;
    before_image_url?: string;
    sort_order: number;
  }[];
  prompt_platforms: {
    platform: { id: number; name: string; url: string | null };
  }[];
  prompt_packs?: {
    pack: { id: number; name: string; slug: string } | null;
  }[];
};

export type NormalizedPrompt = {
  id: number;
  title: string;
  slug: string;
  category: string;
  platforms: string[];
  packs: string[];
  isPremium: boolean;
  unlocked: boolean;
  slides: {
    image: string;
    beforeImage: string;
    prompt: string;
    preview: string;
  }[];
  featured?: boolean;
};

export type FetchPromptsResponse = {
  prompts: NormalizedPrompt[];
  categories: string[];
  packs: PackRow[];
};

const makePreview = (text: string) => {
  const trimmed = (text || "").trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
};

const normalizePromptRow = (row: PromptRow, unlocked = false): NormalizedPrompt => {
  const isPremium = row.is_premium !== false;
  const showFull = unlocked || !isPremium;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    featured: row.featured,
    isPremium,
    unlocked: showFull,
    category: row.category?.name ?? "Uncategorized",
    platforms: row.prompt_platforms?.map((pp) => pp.platform.name).filter(Boolean) ?? [],
    packs:
      row.prompt_packs
        ?.map((pp) => pp.pack?.slug)
        .filter((slug): slug is string => Boolean(slug)) ?? [],
    slides: (row.slides ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => {
        const full = s.prompt_text || "";
        const preview = s.prompt_preview || makePreview(full);
        return {
          image: s.image_url,
          beforeImage: s.before_image_url || "",
          preview,
          // Never expose full text for premium looks unless unlocked
          prompt: showFull ? full : "",
        };
      }),
  };
};

export const fetchPacks = async (): Promise<PackRow[]> => {
  const { data, error } = await supabase
    .from("packs")
    .select("id, name, slug, description, cover_image_url, sort_order")
    .order("sort_order", { ascending: true });
  if (error) {
    // Packs table may not exist until migration is applied
    console.warn("fetchPacks:", error.message);
    return [];
  }
  return (data ?? []) as PackRow[];
};

export const fetchPrompts = async (): Promise<FetchPromptsResponse> => {
  // Prefer public-safe columns (no prompt_text). Fall back if migration pending.
  const publicSelect = `
      id, title, slug, featured, is_premium, category_id, created_at, updated_at,
      category:categories(*),
      slides(id, prompt_preview, image_url, before_image_url, sort_order),
      prompt_platforms(platform:platforms(*)),
      prompt_packs(pack:packs(id, name, slug))
    `;

  const legacySelect = `
      *,
      category:categories(*),
      slides(*),
      prompt_platforms(platform:platforms(*))
    `;

  let rows: PromptRow[] = [];
  const primary = await supabase
    .from("prompts")
    .select(publicSelect)
    .order("id", { ascending: true });

  if (primary.error) {
    console.warn("Public prompt select failed, using legacy select:", primary.error.message);
    const legacy = await supabase
      .from("prompts")
      .select(legacySelect)
      .order("id", { ascending: true });
    if (legacy.error) throw new Error(legacy.error.message);
    rows = (legacy.data ?? []) as unknown as PromptRow[];
  } else {
    rows = (primary.data ?? []) as unknown as PromptRow[];
  }

  const prompts: NormalizedPrompt[] = rows.map((row) => normalizePromptRow(row, false));
  const categories = Array.from(new Set(prompts.map((p) => p.category))).filter(Boolean);
  const packs = await fetchPacks();

  return { prompts, categories, packs };
};

export const mergeUnlockedPrompts = (
  publicPrompts: NormalizedPrompt[],
  unlockedItems: Array<{
    id: number;
    slides: Array<{ prompt: string; preview?: string; image?: string; before_image?: string }>;
    packs?: string[];
  }>
): NormalizedPrompt[] => {
  const byId = new Map(unlockedItems.map((item) => [item.id, item]));
  return publicPrompts.map((prompt) => {
    const full = byId.get(prompt.id);
    if (!full) return prompt;
    return {
      ...prompt,
      unlocked: true,
      packs: full.packs?.length ? full.packs : prompt.packs,
      slides: prompt.slides.map((slide, idx) => {
        const fullSlide = full.slides[idx];
        if (!fullSlide) return slide;
        return {
          ...slide,
          prompt: fullSlide.prompt || slide.prompt,
          preview: fullSlide.preview || slide.preview,
          image: fullSlide.image || slide.image,
          beforeImage: fullSlide.before_image || slide.beforeImage,
        };
      }),
    };
  });
};

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

export const uploadImage = async (file: File, path: string) => {
  const { data, error } = await supabase.storage
    .from("prompt-images")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from("prompt-images").getPublicUrl(data.path);
  return publicUrl;
};

export const deleteImage = async (path: string) => {
  const { error } = await supabase.storage.from("prompt-images").remove([path]);
  if (error) throw error;
};

/* ------------------------------------------------------------------ */
/*  Likes & Favorites helpers                                          */
/* ------------------------------------------------------------------ */

export const fetchLikeCounts = async (): Promise<Record<number, number>> => {
  const { data, error } = await supabase
    .from("prompts")
    .select("id, like_count");
  if (error) throw error;
  const map: Record<number, number> = {};
  for (const row of data ?? []) map[row.id] = row.like_count ?? 0;
  return map;
};

export const fetchUserLikes = async (
  userId: string
): Promise<Set<number>> => {
  const { data, error } = await supabase
    .from("likes")
    .select("prompt_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.prompt_id));
};

export const fetchUserFavorites = async (
  userId: string
): Promise<Set<number>> => {
  const { data, error } = await supabase
    .from("favorites")
    .select("prompt_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.prompt_id));
};

export const toggleLike = async (
  userId: string,
  promptId: number,
  isLiked: boolean
) => {
  if (isLiked) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", userId)
      .eq("prompt_id", promptId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("likes")
      .insert({ user_id: userId, prompt_id: promptId });
    if (error) throw error;
  }
};

export const toggleFavorite = async (
  userId: string,
  promptId: number,
  isFavorited: boolean
) => {
  if (isFavorited) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("prompt_id", promptId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: userId, prompt_id: promptId });
    if (error) throw error;
  }
};
