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

export type PromptRow = {
  id: number;
  title: string;
  slug: string;
  featured: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  category: { id: number; name: string; slug: string } | null;
  slides: {
    id: number;
    prompt_text: string;
    image_url: string;
    sort_order: number;
  }[];
  prompt_platforms: {
    platform: { id: number; name: string; url: string | null };
  }[];
};

export type NormalizedPrompt = {
  id: number;
  title: string;
  slug: string;
  category: string;
  platforms: string[];
  slides: { image: string; prompt: string }[];
  featured?: boolean;
};

export type FetchPromptsResponse = {
  prompts: NormalizedPrompt[];
  categories: string[];
};

export const fetchPrompts = async (): Promise<FetchPromptsResponse> => {
  const { data, error } = await supabase
    .from("prompts")
    .select(
      `
      *,
      category:categories(*),
      slides(*),
      prompt_platforms(platform:platforms(*))
    `
    )
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PromptRow[];

  const prompts: NormalizedPrompt[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    featured: row.featured,
    category: row.category?.name ?? "Uncategorized",
    platforms: row.prompt_platforms?.map((pp) => pp.platform.name).filter(Boolean) ?? [],
    slides: (row.slides ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ image: s.image_url, prompt: s.prompt_text })),
  }));

  const categories = Array.from(new Set(prompts.map((p) => p.category))).filter(Boolean);

  return { prompts, categories };
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
