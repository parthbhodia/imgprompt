type StrapiEntity<T> = {
  id: number;
  attributes?: T;
} & Partial<T>;

type StrapiMedia = {
  url?: string;
  alternativeText?: string | null;
};

type StrapiCategory = {
  name: string;
  slug?: string;
};

type StrapiPlatform = {
  name: string;
  url?: string;
};

type StrapiSlide = {
  prompt?: string;
  order?: number | null;
  image?:
    | {
        data?: StrapiEntity<StrapiMedia> | null;
      }
    | StrapiMedia
    | null;
};

type StrapiPrompt = {
  title?: string;
  slug?: string | null;
  featured?: boolean;
  category?: { data: StrapiEntity<StrapiCategory> | null };
  platforms?: { data: StrapiEntity<StrapiPlatform>[] };
  slides?: { data: StrapiEntity<StrapiSlide>[] };
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

export type StrapiPromptResponse = {
  prompts: NormalizedPrompt[];
  categories: string[];
};

const STRAPI_URL = (import.meta.env.VITE_STRAPI_URL as string | undefined)?.replace(/\/$/, "") || "";
const STRAPI_TOKEN = import.meta.env.VITE_STRAPI_TOKEN as string | undefined;

const extractMediaUrl = (
  media?: StrapiEntity<StrapiMedia> | StrapiMedia | { data?: StrapiEntity<StrapiMedia> | StrapiMedia | null } | null
) => {
  if (!media) return "";
  // v4 shape: { data: { attributes: { url } } }
  const url =
    (media as any)?.attributes?.url ||
    (media as any)?.url ||
    (media as any)?.data?.attributes?.url ||
    (media as any)?.data?.url;
  if (url.startsWith("http")) return url;
  if (!STRAPI_URL) return "";
  return `${STRAPI_URL}${url}`;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const fetchPromptsFromStrapi = async (): Promise<StrapiPromptResponse> => {
  if (!STRAPI_URL) {
    throw new Error("STRAPI_URL is not configured");
  }

  const query = new URLSearchParams();
  query.set("populate[category]", "true");
  query.set("populate[platforms]", "true");
  query.set("populate[slides][populate]", "image");
  query.set("sort[0]", "id:asc");

  const res = await fetch(`${STRAPI_URL}/api/prompts?${query.toString()}`, {
    headers: STRAPI_TOKEN
      ? {
          Authorization: `Bearer ${STRAPI_TOKEN}`,
        }
      : undefined,
  });

  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.statusText}`);
  }

  const payload = await res.json();
  const items: StrapiEntity<StrapiPrompt>[] = payload?.data || [];

  const prompts: NormalizedPrompt[] = items.map((item) => {
    // Support Strapi v4 (attributes) and v5 (flat fields).
    const attrs: StrapiPrompt = (item.attributes || item) as StrapiPrompt;

    const rawSlides = (attrs.slides as any)?.data || attrs.slides || [];
    const rawPlatforms = (attrs.platforms as any)?.data || attrs.platforms || [];

    const categorySource =
      (attrs.category as any)?.data?.attributes ||
      (attrs.category as any)?.data ||
      (attrs.category as any) ||
      null;
    const categoryName = categorySource?.name?.trim() || "Uncategorized";

    const slug = attrs.slug?.trim() || slugify(attrs.title || "");

    return {
      id: item.id,
      title: attrs.title || `Prompt ${item.id}`,
      slug: slug || `prompt-${item.id}`,
      category: categoryName || "Uncategorized",
      platforms: rawPlatforms
        .map((p: any) => (p?.attributes ? p.attributes.name : p?.name))
        .filter(Boolean) as string[],
      slides: rawSlides
        .map((slide: any) => {
          const slideAttrs: StrapiSlide = (slide?.attributes || slide || {}) as StrapiSlide;
          return {
            image: extractMediaUrl(slideAttrs.image),
            prompt: slideAttrs.prompt || "",
            order: slideAttrs.order ?? 0,
          };
        })
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ image, prompt }) => ({ image, prompt })),
      featured: attrs.featured,
    };
  });

  const categories = Array.from(new Set(prompts.map((p) => p.category))).filter(Boolean);

  return {
    prompts,
    categories,
  };
};
