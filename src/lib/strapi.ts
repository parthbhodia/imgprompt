type StrapiEntity<T> = {
  id: number;
  attributes: T;
};

type StrapiMedia = {
  url: string;
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
  prompt: string;
  order?: number | null;
  image?: {
    data: StrapiEntity<StrapiMedia> | null;
  };
};

type StrapiPrompt = {
  title: string;
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

const buildImageUrl = (media?: StrapiEntity<StrapiMedia> | null) => {
  if (!media?.attributes?.url) return "";
  const url = media.attributes.url;
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
    const attrs = item.attributes || {};
    const slides = attrs.slides?.data || [];
    const platforms = attrs.platforms?.data || [];
    const categoryName = attrs.category?.data?.attributes?.name?.trim() || "Uncategorized";
    const slug = attrs.slug?.trim() || slugify(attrs.title);

    return {
      id: item.id,
      title: attrs.title,
      slug: slug || `prompt-${item.id}`,
      category: categoryName || "Uncategorized",
      platforms: platforms.map((p) => p.attributes?.name).filter(Boolean) as string[],
      slides: slides
        .map((slide) => {
          const slideAttrs = slide.attributes || {};
          return {
            image: buildImageUrl(slideAttrs.image?.data) || "",
            prompt: slideAttrs.prompt || "",
            order: slideAttrs.order ?? 0,
          };
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
