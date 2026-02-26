import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PromptCard } from "@/components/PromptCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { ImageChat } from "@/components/ImageChat";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Zap, Copy, Search, Lightbulb, Star, Palette, MessageCircle, Share2, ChevronLeft, ChevronRight, ExternalLink, ThumbsUp, Heart, TrendingUp, LogIn, LogOut, User, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { fetchPrompts, type NormalizedPrompt } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLikes } from "@/hooks/use-likes";
import { cn } from "@/lib/utils";

type PromptWithAssets = {
  id: number;
  title: string;
  category: string;
  platforms: string[];
  slug: string;
  slides: {
    image: string;
    prompt: string;
  }[];
  featured?: boolean;
};

const normalizeStrapiPrompts = (data?: NormalizedPrompt[]): PromptWithAssets[] => {
  if (!data) return [];
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category || "Uncategorized",
    platforms: item.platforms?.length ? item.platforms : ["Custom"],
    slug: item.slug || `prompt-${item.id}`,
    slides: item.slides?.map((slide) => ({
      image: slide.image || "",
      prompt: slide.prompt,
    })) ?? [],
    featured: item.featured,
  }));
};

const buildCategories = (promptList: PromptWithAssets[]) => {
  const unique = new Set<string>(promptList.map((p) => p.category));
  const fromPrompts = Array.from(unique).filter(Boolean);
  const list = ["All", ...fromPrompts];
  if (list.length === 1) return ["All"];
  return list;
};

const ADSENSE_CLIENT = "ca-pub-1175059421524576";
const platformUrls: Record<string, string> = {
  "Midjourney": "https://www.midjourney.com/",
  "DALL-E 3": "https://chatgpt.com/",
  "Stable Diffusion": "https://stablediffusionweb.com/",
  "Leonardo AI": "https://leonardo.ai/",
  "Adobe Firefly": "https://firefly.adobe.com/",
  "Niji Journey": "https://niji.journey.com/",
  "Google Gemini": "https://gemini.google.com/app",
  "Createimg.com": "https://createimg.com/",
};

const faqItems = [
  {
    question: "What makes VibeIMG different from other AI prompt libraries?",
    answer: "VibeIMG pairs every prompt with finished visuals, detailed guidance, and platform tags so you know exactly how to recreate the look across Midjourney, DALL·E 3, Stable Diffusion, and more.",
  },
  {
    question: "Can I use these prompts for commercial projects?",
    answer: "Yes—each prompt is written to be production-ready. We recommend customizing names, colors, and brand cues before publishing to ensure unique final images.",
  },
  {
    question: "How often is the VibeIMG library updated?",
    answer: "We add fresh prompt packs weekly, focusing on trending aesthetics like cyberpunk portraits, anime splash art, luxury products, and cinematic landscapes.",
  },
  {
    question: "Do I need advanced AI knowledge to start?",
    answer: "Not at all. Each prompt includes plain-language steps that cover composition, lighting, camera choices, and color grading so beginners can follow along confidently.",
  },
];

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "VibeIMG",
  url: "https://vibeimg.xyz",
  description: "VibeIMG is a curated AI prompt library that showcases premium Midjourney, DALL·E, and Stable Diffusion prompts with visuals and creator tips.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://vibeimg.xyz/?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const DEFAULT_DOCUMENT_TITLE = "ImgPrompt — Curated AI Prompt Library & Inspiration";
const DEFAULT_META_DESCRIPTION =
  "ImgPrompt is a curated library of high-performing AI prompts with visuals, tips, and platform guidance so you can create stunning images faster.";

const getInitialRouteState = (promptList: PromptWithAssets[]) => {
  if (typeof window === "undefined") {
    return { promptId: null as number | null, slideIndex: 0 };
  }
  const params = new URLSearchParams(window.location.search);
  const promptSlug = params.get("prompt");
  const slideParam = params.get("slide");
  let promptId: number | null = null;
  let promptRecord: PromptWithAssets | undefined;
  if (promptSlug) {
    promptRecord = promptList.find((prompt) => prompt.slug === promptSlug);
    if (promptRecord) {
      promptId = promptRecord.id;
    } else {
      const fallbackId = Number(promptSlug);
      if (Number.isFinite(fallbackId)) {
        promptRecord = promptList.find((prompt) => prompt.id === fallbackId);
        if (promptRecord) {
          promptId = promptRecord.id;
        }
      }
    }
  }
  let slideIndex = 0;
  if (promptRecord && slideParam) {
    const parsedSlide = Number(slideParam);
    if (
      Number.isFinite(parsedSlide) &&
      parsedSlide >= 0 &&
      parsedSlide < promptRecord.slides.length
    ) {
      slideIndex = parsedSlide;
    }
  }
  return { promptId, slideIndex };
};

const slugifyCategory = (category: string) => {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const findCategoryFromSlug = (slug: string, categories: string[]) => {
  return categories.find(cat => slugifyCategory(cat) === slug) || "All";
};

const Index = () => {
  const [searchParams] = useSearchParams();
  
  const {
    data: supabaseData,
    isLoading: isDataLoading,
    isError: isDataError,
  } = useQuery({
    queryKey: ["prompts"],
    queryFn: fetchPrompts,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const remotePrompts = normalizeStrapiPrompts(supabaseData?.prompts);
  const mergedPrompts = remotePrompts;
  const categories = buildCategories(mergedPrompts);
  const defaultCategory = categories[0] ?? "All";
  
  // Initialize category from URL parameter
  const categoryFromUrl = searchParams.get('category');
  const initialCategory = categoryFromUrl ? findCategoryFromSlug(categoryFromUrl, categories) : defaultCategory;
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  const likedScrollRef = useRef<HTMLDivElement>(null);
  const adsenseScriptRef = useRef<HTMLScriptElement | null>(null);
  const hasInitializedRoute = useRef(false);

  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  const { likeCounts, userLikes, userFavorites, toggleLike, toggleFavorite } = useLikes();
  const selectedPrompt = selectedPromptId ? mergedPrompts.find((prompt) => prompt.id === selectedPromptId) ?? null : null;
  const selectedSlide = selectedPrompt ? selectedPrompt.slides[currentSlideIndex] : null;

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] ?? "All");
    }
  }, [categories, activeCategory]);

  // Update active category when URL parameter changes
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    const urlCategory = categoryFromUrl ? findCategoryFromSlug(categoryFromUrl, categories) : defaultCategory;
    if (urlCategory !== activeCategory && categories.length > 0) {
      setActiveCategory(urlCategory);
    }
  }, [searchParams, categories, defaultCategory]);

  useEffect(() => {
    if (hasInitializedRoute.current) return;
    const initialState = getInitialRouteState(mergedPrompts);
    setSelectedPromptId(initialState.promptId);
    setCurrentSlideIndex(initialState.slideIndex ?? 0);
    setIsPromptDialogOpen(Boolean(initialState.promptId));
    hasInitializedRoute.current = true;
  }, [mergedPrompts]);

  const getPromptSlugById = (promptId: number) => {
    const prompt = mergedPrompts.find((item) => item.id === promptId);
    return prompt?.slug ?? null;
  };

  const getPromptShareUrl = (promptId: number, slideIndex = 0) => {
    if (typeof window === "undefined") {
      return "";
    }
    const url = new URL(window.location.href);
    const promptSlug = getPromptSlugById(promptId);
    url.searchParams.set("prompt", promptSlug ?? String(promptId));
    url.searchParams.set("slide", String(slideIndex));
    return url.toString();
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (selectedPrompt && selectedPromptId) {
      const promptIdentifier = `Prompt ${selectedPromptId}`;
      document.title = `${promptIdentifier} · ${selectedPrompt.title} | ImgPrompt`;
      const dynamicDescription = `${promptIdentifier} from our ${selectedPrompt.category} collection. Optimized for ${selectedPrompt.platforms.join(
        ", "
      )} with visuals that show exactly what you'll create.`;
      metaDescription?.setAttribute("content", dynamicDescription);
      return;
    }
    document.title = DEFAULT_DOCUMENT_TITLE;
    metaDescription?.setAttribute("content", DEFAULT_META_DESCRIPTION);
  }, [selectedPrompt, selectedPromptId]);

  useEffect(() => {
    updatePromptParam(selectedPromptId, currentSlideIndex);
  }, [selectedPromptId, currentSlideIndex]);

  const updatePromptParam = (promptId?: number | null, slideIndex = 0) => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (promptId) {
      const promptSlug = getPromptSlugById(promptId);
      url.searchParams.set("prompt", promptSlug ?? String(promptId));
      url.searchParams.set("slide", String(slideIndex));
    } else {
      url.searchParams.delete("prompt");
      url.searchParams.delete("slide");
    }
    window.history.replaceState({}, "", url);
  };

  const openPromptModal = (promptId: number, slideIndex = 0) => {
    setSelectedPromptId(promptId);
    setCurrentSlideIndex(slideIndex);
    setIsPromptDialogOpen(true);
  };

  const closePromptModal = () => {
    setIsPromptDialogOpen(false);
    setSelectedPromptId(null);
    setCurrentSlideIndex(0);
  };

  const copyTextToClipboard = async (text: string, successMessage = "Copied to clipboard!") => {
    let fallbackTextarea: HTMLTextAreaElement | null = null;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackTextarea = document.createElement("textarea");
        fallbackTextarea.value = text;
        fallbackTextarea.style.position = "fixed";
        fallbackTextarea.style.left = "-9999px";
        document.body.appendChild(fallbackTextarea);
        fallbackTextarea.focus();
        fallbackTextarea.select();
        document.execCommand("copy");
      }
      toast.success(successMessage);
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast.error("Couldn't copy. Please try manually.");
    } finally {
      if (fallbackTextarea && fallbackTextarea.parentNode) {
        fallbackTextarea.parentNode.removeChild(fallbackTextarea);
      }
    }
  };

  const handleSharePrompt = async () => {
    if (!selectedPromptId) {
      return;
    }
    const shareUrl = getPromptShareUrl(selectedPromptId, currentSlideIndex);
    if (!shareUrl) {
      return;
    }
    const shareTitle = selectedPrompt ? `Prompt ${selectedPrompt.id}` : "AI Prompt";
    const shareText = selectedPrompt
      ? `${selectedPrompt.title} • ${selectedPrompt.category} prompt`
      : "Check out this AI prompt!";
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch (error) {
      console.warn("Native share interrupted, falling back to clipboard", error);
    }
    await copyTextToClipboard(
      shareUrl,
      selectedPromptId ? `Prompt #${selectedPromptId} link copied!` : "Prompt link copied!"
    );
  };

  const copyPromptShareUrl = async () => {
    if (!selectedPromptId) {
      return;
    }
    const shareUrl = getPromptShareUrl(selectedPromptId, currentSlideIndex);
    if (!shareUrl) {
      return;
    }
    await copyTextToClipboard(
      shareUrl,
      selectedPrompt ? `${selectedPrompt.title} link copied!` : "Prompt link copied!"
    );
  };

  const handlePlatformLaunch = async (platform: string) => {
    if (!selectedSlide) {
      return;
    }
    const copyPromise = copyTextToClipboard(
      selectedSlide.prompt,
      `Prompt ready for ${platform}. Paste it in your ${platform} workspace!`,
    );
    const url = platformUrls[platform] || "#";
    if (url !== "#") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    await copyPromise;
  };

  const copySelectedPrompt = async () => {
    if (!selectedSlide) {
      return;
    }
    await copyTextToClipboard(selectedSlide.prompt, "Prompt copied!");
  };

  const goToSlide = (direction: "prev" | "next") => {
    if (!selectedPrompt) return;
    setCurrentSlideIndex((prev) => {
      if (direction === "prev") {
        return (prev - 1 + selectedPrompt.slides.length) % selectedPrompt.slides.length;
      }
      return (prev + 1) % selectedPrompt.slides.length;
    });
  };

  const handleLike = async (promptId: number) => {
    if (!user) {
      setIsSignInDialogOpen(true);
      return;
    }
    const ok = await toggleLike(promptId);
    if (ok) {
      const wasLiked = userLikes.has(promptId);
      toast.success(wasLiked ? "Like removed" : "Prompt liked!");
    }
  };

  const handleFavorite = async (promptId: number) => {
    if (!user) {
      setIsSignInDialogOpen(true);
      return;
    }
    const ok = await toggleFavorite(promptId);
    if (ok) {
      const wasFav = userFavorites.has(promptId);
      toast.success(wasFav ? "Removed from favorites" : "Added to favorites!");
    }
  };

  const mostLikedPrompts = [...mergedPrompts]
    .filter((p) => (likeCounts[p.id] ?? 0) > 0)
    .sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0))
    .slice(0, 6);

  const featuredPrompts =
    mergedPrompts.filter((prompt) => prompt.featured).length > 0
      ? mergedPrompts.filter((prompt) => prompt.featured)
      : mergedPrompts.slice(0, 3);

  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToPromptCard = (promptId: number) => {
    const element = document.getElementById(`prompt-${promptId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleFeaturedPromptClick = (promptId: number, promptCategory: string) => {
    // Open the modal directly — scrolling to gallery card is unreliable when visibleCount limits rendering
    openPromptModal(promptId);
    // Also filter to the right category so it's visible if user closes the modal
    setSearchQuery("");
    setActiveCategory(promptCategory);
  };

  const filteredPrompts = mergedPrompts.filter((prompt) => {
    const matchesCategory = activeCategory === "All" || prompt.category === activeCategory;
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      prompt.title.toLowerCase().includes(lowerQuery) ||
      prompt.slides.some((slide) => slide.prompt.toLowerCase().includes(lowerQuery));
    return matchesCategory && matchesSearch;
  });
  const hasPromptContent = filteredPrompts.length > 0;
  const visiblePrompts = filteredPrompts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPrompts.length;

  useEffect(() => {
    setVisibleCount(6);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (hasPromptContent) {
      if (adsenseScriptRef.current) {
        return;
      }
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      script.crossOrigin = "anonymous";
      script.dataset.adsense = "true";
      document.head.appendChild(script);
      adsenseScriptRef.current = script;

      return () => {
        script.remove();
        adsenseScriptRef.current = null;
      };
    }
    if (adsenseScriptRef.current) {
      adsenseScriptRef.current.remove();
      adsenseScriptRef.current = null;
    }
  }, [hasPromptContent]);

  const resetFilters = () => {
    setSearchQuery("");
    setActiveCategory(defaultCategory);
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const feedbackFormUrl =
    import.meta.env.VITE_FEEDBACK_FORM_URL ||
    "https://docs.google.com/forms/d/e/1FAIpQLSc2Y-or9K-I6X-PFAHV-iLN2evZL_KqOAQzMd2FUJqwcQVgzQ/viewform?embedded=true";

  return (
    <>
    <main
      className="min-h-screen bg-background relative overflow-x-hidden"
      role="main"
      aria-label="AI prompt inspiration library"
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 animate-gradient" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-glow-pulse delay-1000" />

      <div className="relative z-10">
        {/* Top navigation */}
        <nav className="sticky top-0 z-50 backdrop-blur-lg bg-background/70 border-b border-border/40">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <Sparkles className="w-5 h-5 text-primary" />
              VibeIMG
            </Link>

            <div className="flex items-center gap-2">
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate("/favorites")}
                >
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span className="hidden sm:inline">My Favorites</span>
                </Button>
              )}

              <Link to="/pricing">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="hidden xs:inline">Pricing</span>
                </Button>
              </Link>

              {user ? (
                <div className="flex items-center gap-1">
                  <Link to="/profile">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline truncate max-w-[120px]">
                        {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
                      </span>
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 px-2">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => signInWithGoogle(window.location.href)}
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI Prompt Library</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Discover Amazing
              <span className="text-gradient block mt-2">AI Prompts</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See exactly how stunning AI images were created. Click any card to reveal the magic prompt behind it. Copy, learn, and create your own masterpieces!
            </p>

            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button onClick={scrollToGallery} className="gradient-primary neon-glow font-semibold px-8">
                <Zap className="w-5 h-5 mr-2" />
                Explore Prompts
              </Button>
              <Button onClick={() => setIsHelpDialogOpen(true)} variant="outline" className="glass font-semibold px-8">
                <Copy className="w-5 h-5 mr-2" />
                Learn More
              </Button>
            </div>
          </div>
        </header>

        {/* AI Image Chat – visible on first visit */}
        <ImageChat
          inline
          initialPrompt={aiPrompt}
          onPromptConsumed={() => setAiPrompt("")}
        />

        {featuredPrompts.length > 0 && (
          <section className="container mx-auto px-4 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-primary font-semibold">Social media drops</p>
                <h2 className="text-2xl font-bold">Trending prompt highlights</h2>
              </div>
              <Button
                variant="outline"
                className="hidden md:flex"
                onClick={() => {
                  const firstFeatured = featuredPrompts[0];
                  if (firstFeatured) {
                    handleFeaturedPromptClick(firstFeatured.id, firstFeatured.category);
                  } else {
                    scrollToGallery();
                  }
                }}
              >
                View all
              </Button>
            </div>
            {/* Scroll container with side arrow overlays */}
            <div className="relative group/scroll">
              <button
                aria-label="Scroll left"
                onClick={() => trendingScrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-2 w-10 h-10 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-accent"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div ref={trendingScrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 scroll-smooth">
                {featuredPrompts.map((prompt) => {
                  const firstSlide = prompt.slides[0];
                  return (
                    <article
                      key={prompt.id}
                      className="min-w-[260px] max-w-[260px] rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-4 shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform hover:border-primary/40 hover:shadow-lg group/card flex flex-col"
                      onClick={() => handleFeaturedPromptClick(prompt.id, prompt.category)}
                    >
                      {/* Image with hover overlay */}
                      <div className="aspect-[4/5] overflow-hidden rounded-2xl mb-3 relative">
                        <img
                          src={firstSlide.image}
                          alt={prompt.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                        />
                        {/* Hover overlay CTA */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAiPrompt(firstSlide.prompt); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur border border-white/40 text-white text-sm font-semibold hover:bg-white/30 transition-colors"
                          >
                            <Wand2 className="w-4 h-4" />
                            Generate with AI
                          </button>
                        </div>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                        {prompt.category}
                      </p>
                      <h3 className="text-lg font-semibold mb-2">{prompt.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{firstSlide.prompt}</p>
                      {/* Bottom always-visible CTA */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAiPrompt(firstSlide.prompt); }}
                        className="mt-auto w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Generate with AI
                      </button>
                    </article>
                  );
                })}
              </div>
              <button
                aria-label="Scroll right"
                onClick={() => trendingScrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-2 w-10 h-10 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-accent"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* Portrait Models Showcase */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              {/* Left Column - Text Content */}
              <div className="lg:col-span-1 space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-primary font-semibold mb-2">Portrait Editing</p>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                    Portrait Edits & Styles
                  </h2>
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Transform your portraits with our curated collection of portrait editing LoRA models and custom styles. Each model is carefully selected to help you enhance, stylize, and transform your portrait images with artistic flair.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Simply select a portrait editing style, add it to your prompt, and let the AI enhance your images with professional-quality transformations. Mix and match styles to create unique artistic variations.
                </p>
                <div className="pt-4">
                  <Button size="lg" className="gap-2">
                    <Palette className="w-4 h-4" />
                    Explore All Styles
                  </Button>
                </div>
              </div>

              {/* Right Column - Portrait Cards Grid */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                {[
                  {
                    id: "princess-jasmine",
                    name: "Princess Jasmine",
                    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=350&h=450&fit=crop",
                    artist: "Nostradabra",
                    trigger: "princess jasmine",
                  },
                  {
                    id: "pixel-core",
                    name: "PIXEL CORE - ILL",
                    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=350&h=450&fit=crop",
                    artist: "Visionary_Studio",
                    trigger: "pixel core",
                    recommended: true,
                  },
                  {
                    id: "incase-style",
                    name: "Incase Style",
                    image: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=350&h=450&fit=crop",
                    artist: "Digital_pastel",
                    trigger: "incase style",
                  },
                  {
                    id: "anime-portrait",
                    name: "Anime Portrait",
                    image: "https://images.unsplash.com/photo-1535016120754-18c5d804d309?w=350&h=450&fit=crop",
                    artist: "AnimeArtist",
                    trigger: "anime portrait",
                  },
                ].map((portrait) => (
                  <div
                    key={portrait.id}
                    className="group relative overflow-hidden rounded-2xl border border-border/40 hover:border-primary/60 transition-all hover:shadow-xl bg-card cursor-pointer"
                  >
                    {/* Recommended Badge */}
                    {portrait.recommended && (
                      <div className="absolute top-3 right-3 z-20">
                        <Badge className="bg-gradient-to-r from-amber-500 to-red-500 gap-1">
                          <Zap className="w-3 h-3" />
                          Recommended
                        </Badge>
                      </div>
                    )}

                    {/* Image */}
                    <div className="relative overflow-hidden h-64 sm:h-80">
                      <img
                        src={portrait.image}
                        alt={portrait.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </div>

                    {/* Content Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white space-y-2">
                      <div>
                        <p className="text-xs text-white/70">{portrait.artist}</p>
                        <h3 className="font-bold text-sm line-clamp-1">{portrait.name}</h3>
                      </div>
                      <div className="bg-white/20 backdrop-blur border border-white/30 rounded px-2 py-1">
                        <p className="text-xs text-white/70">Trigger:</p>
                        <code className="text-xs font-mono text-white truncate block">
                          {portrait.trigger}
                        </code>
                      </div>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Button
                        size="sm"
                        className="gap-2 rounded-full"
                        onClick={() => setAiPrompt(portrait.trigger)}
                      >
                        <Sparkles className="w-4 h-4" />
                        Use Style
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Most Liked Prompts */}
        {mostLikedPrompts.length > 0 && (
          <section className="container mx-auto px-4 pb-6">
            <div className="flex items-center mb-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-primary font-semibold">Community picks</p>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Most Liked Prompts
                </h2>
              </div>
            </div>
            {/* Scroll container with side arrow overlays */}
            <div className="relative group/scroll2">
              <button
                aria-label="Scroll left"
                onClick={() => likedScrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-2 w-10 h-10 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center opacity-0 group-hover/scroll2:opacity-100 transition-opacity hover:bg-accent"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            <div 
              ref={likedScrollRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 scroll-smooth"
            >
              {mostLikedPrompts.map((prompt) => {
                const firstSlide = prompt.slides[0];
                return (
                  <article
                    key={prompt.id}
                    className="min-w-[260px] max-w-[260px] rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-4 shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform hover:border-primary/40 hover:shadow-lg group/card flex flex-col"
                    onClick={() => {
                      openPromptModal(prompt.id);
                      setSearchQuery("");
                      setActiveCategory(prompt.category);
                    }}
                  >
                    {/* Image with like badge + hover overlay */}
                    <div className="aspect-[4/5] overflow-hidden rounded-2xl mb-3 relative">
                      <img
                        src={firstSlide.image}
                        alt={prompt.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs font-semibold">
                        <ThumbsUp className="w-3 h-3 fill-white" />
                        {likeCounts[prompt.id] ?? 0}
                      </div>
                      {/* Hover overlay CTA */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAiPrompt(firstSlide.prompt); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur border border-white/40 text-white text-sm font-semibold hover:bg-white/30 transition-colors"
                        >
                          <Wand2 className="w-4 h-4" />
                          Generate with AI
                        </button>
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                      {prompt.category}
                    </p>
                    <h3 className="text-lg font-semibold mb-2">{prompt.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{firstSlide.prompt}</p>
                    {/* Bottom always-visible CTA */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAiPrompt(firstSlide.prompt); }}
                      className="mt-auto w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Generate with AI
                    </button>
                  </article>
                );
              })}
            </div>
              <button
                aria-label="Scroll right"
                onClick={() => likedScrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-2 w-10 h-10 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center opacity-0 group-hover/scroll2:opacity-100 transition-opacity hover:bg-accent"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* Search Bar */}
        <section className="container mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            {/* Glow wrapper */}
            <div className="relative group">
              {/* Ambient glow layer — sits behind the input */}
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-primary/60 via-accent/50 to-primary/60 opacity-0 group-focus-within:opacity-100 blur-md transition-all duration-500 pointer-events-none" />
              {/* Subtle always-on glow ring */}
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-60 blur-sm transition-all duration-500 pointer-events-none" />
              {/* Input row */}
              <div className="relative flex items-center rounded-xl border border-primary/20 bg-background/80 backdrop-blur-md shadow-lg overflow-hidden focus-within:border-primary/60 transition-all duration-300">
                <div className="pl-4 pr-2 shrink-0">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <Input
                  type="text"
                  placeholder="Search prompts by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="pr-4 text-muted-foreground hover:text-foreground transition-colors text-xs shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="container mx-auto px-4 py-8">
          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </section>

        {/* Prompt Gallery */}
        <section ref={galleryRef} className="container mx-auto px-4 pb-20">
          {isDataLoading && (
            <p className="text-sm text-muted-foreground mb-4">Loading prompts…</p>
          )}
          {isDataError && (
            <p className="text-sm text-amber-600 mb-4">Could not load prompts. Please try again later.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visiblePrompts.map((prompt, index) => (
              <div
                key={prompt.id}
                id={`prompt-${prompt.id}`}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <PromptCard
                  slides={prompt.slides}
                  category={prompt.category}
                  title={prompt.title}
                  platforms={prompt.platforms}
                  onOpen={() => openPromptModal(prompt.id)}
                  onGenerateWithAI={(promptText) => setAiPrompt(promptText)}
                  likeCount={likeCounts[prompt.id] ?? 0}
                  isLiked={userLikes.has(prompt.id)}
                  isFavorited={userFavorites.has(prompt.id)}
                  onLike={() => handleLike(prompt.id)}
                  onFavorite={() => handleFavorite(prompt.id)}
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-10">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 px-8"
                onClick={() => setVisibleCount((prev) => prev + 6)}
              >
                <Sparkles className="w-4 h-4" />
                Load more prompts ({filteredPrompts.length - visibleCount} remaining)
              </Button>
            </div>
          )}

          {filteredPrompts.length === 0 && (
            <div className="text-center py-20 max-w-2xl mx-auto space-y-6 glass rounded-3xl p-10">
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold">No prompts match your filters yet</h3>
                <p className="text-muted-foreground text-base">
                  ImgPrompt always keeps at least one hero section live, but ads stay paused until real prompt cards are visible. Clear your filters or explore a different category to load fresh inspiration.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={resetFilters} className="flex-1 min-w-[180px]">
                  Reset filters
                </Button>
                <Button variant="outline" onClick={() => setIsHelpDialogOpen(true)} className="flex-1 min-w-[180px]">
                  Learn how ImgPrompt works
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <p className="text-sm uppercase tracking-widest text-primary font-semibold">FAQ</p>
              <h2 className="text-3xl font-bold">Answers to popular VibeIMG questions</h2>
              <p className="text-muted-foreground max-w-3xl mx-auto">
                These search-optimized answers help new creators—and search engines—understand how to get the most out of the vibeimg.xyz prompt library.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {faqItems.map((item) => (
                <article key={item.question} className="rounded-2xl border border-border/60 p-6 bg-background/80 backdrop-blur">
                  <h3 className="text-xl font-semibold mb-2">{item.question}</h3>
                  <p className="text-muted-foreground text-sm">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="container mx-auto px-4 py-16 text-center">
          <div className="glass rounded-3xl p-12 space-y-6">
            <h2 className="text-3xl font-bold">
              Ready to Create Something <span className="text-gradient">Amazing?</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Use these prompts as inspiration for your next AI art project. Mix, match, and make them your own!
            </p>
          </div>
        </footer>
      </div>
      </main>

      {/* Help Dialog */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Lightbulb className="w-6 h-6 text-primary" />
              How to Use AI Prompts
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Master the art of creating stunning AI images with these tips
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Copy className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Copy & Customize</h4>
                  <p className="text-sm text-muted-foreground">
                    Click any prompt card to reveal and copy the full prompt. Modify details like colors, style, or subject to make it unique.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Be Specific</h4>
                  <p className="text-sm text-muted-foreground">
                    The more details you provide (lighting, mood, style, colors), the better your results. Don't be afraid to be descriptive!
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Try Different Platforms</h4>
                  <p className="text-sm text-muted-foreground">
                    Each prompt shows compatible AI platforms. Experiment across Midjourney, DALL-E, Stable Diffusion, and others for varied results.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Iterate & Experiment</h4>
                  <p className="text-sm text-muted-foreground">
                    Your first generation might not be perfect. Try variations, adjust parameters, and refine your prompt until you get the results you want.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <button
        type="button"
        onClick={() => document.getElementById("ai-chat")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-xl bg-gradient-to-r from-primary to-accent hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        aria-label="Scroll to AI Image Chat"
      >
        <Sparkles className="w-5 h-5" />
        <span className="hidden sm:inline">AI Image</span>
      </button>
      <button
        onClick={() => setIsFeedbackDialogOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl bg-gradient-to-r from-primary to-accent hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        aria-label="Send feedback about ImgPrompt"
      >
        <MessageCircle className="w-4 h-4" />
        Feedback
      </button>
      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[720px] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Share Feedback</DialogTitle>
            <DialogDescription>
              Tell us how we can improve ImgPrompt. Your thoughts go straight to our inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1">
            <iframe
              src={feedbackFormUrl}
              title="ImgPrompt feedback form"
              className="w-full h-full rounded-2xl border border-border"
              loading="lazy"
            />
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Trouble with the form?{" "}
              <a
                href={feedbackFormUrl.replace("?embedded=true", "")}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                Open it in a new tab
              </a>
              .
            </p>
    </div>
        </DialogContent>
      </Dialog>
      {selectedPrompt && selectedSlide && (
        <Dialog
          open={isPromptDialogOpen}
          onOpenChange={(open) => (open ? openPromptModal(selectedPrompt.id, currentSlideIndex) : closePromptModal())}
        >
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center justify-between gap-4 text-2xl">
                <span>{selectedPrompt.title}</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={copyPromptShareUrl}
                  >
                    <Copy className="w-4 h-4" />
                    Copy link
                  </Button>
                  <button
                    type="button"
                    onClick={handleSharePrompt}
                    className="rounded-full p-2 hover:bg-muted transition-colors"
                    aria-label="Share prompt link"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </DialogTitle>
              <DialogDescription className="text-sm">
                {selectedPrompt.category} prompt • Platforms: {selectedPrompt.platforms.join(", ")}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="relative rounded-2xl overflow-hidden border border-border/60 max-h-[360px] md:max-h-full">
                <img
                  src={selectedSlide.image}
                  alt={selectedPrompt.title}
                  className="w-full h-full object-cover"
                />

                {selectedPrompt.slides.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass flex items-center justify-center"
                      onClick={() => goToSlide("prev")}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass flex items-center justify-center"
                      onClick={() => goToSlide("next")}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {selectedPrompt.slides.map((_, idx) => (
                        <span
                          key={idx}
                          className={`w-2 h-2 rounded-full ${idx === currentSlideIndex ? "bg-primary" : "bg-white/50"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {/* Prompt text */}
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4 overflow-y-auto max-h-[320px] relative group/prompt">
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pr-8">{selectedSlide.prompt}</p>
                  {/* Small copy icon top-right of prompt box */}
                  <button
                    type="button"
                    onClick={copySelectedPrompt}
                    aria-label="Copy prompt"
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-muted/60 hover:bg-primary/20 transition-colors opacity-0 group-hover/prompt:opacity-100"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                  </button>
                </div>

                {/* Generate with AI – primary CTA */}
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 transition-opacity text-base py-5"
                  onClick={() => {
                    setAiPrompt(selectedSlide.prompt);
                    closePromptModal();
                  }}
                >
                  <Wand2 className="w-4 h-4" />
                  Generate with AI
                </Button>

                {/* Like / Favorite row */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleLike(selectedPrompt.id)}
                    className={cn(userLikes.has(selectedPrompt.id) && "border-primary text-primary")}
                    aria-label="Like"
                  >
                    <ThumbsUp className={cn("w-4 h-4", userLikes.has(selectedPrompt.id) && "fill-primary")} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleFavorite(selectedPrompt.id)}
                    className={cn(userFavorites.has(selectedPrompt.id) && "border-rose-500 text-rose-500")}
                    aria-label="Favorite"
                  >
                    <Heart className={cn("w-4 h-4", userFavorites.has(selectedPrompt.id) && "fill-rose-500")} />
                  </Button>
                  {(likeCounts[selectedPrompt.id] ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground ml-1">
                      {likeCounts[selectedPrompt.id]} {likeCounts[selectedPrompt.id] === 1 ? "person likes" : "people like"} this
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Sign-in dialog for likes/favorites */}
      <Dialog open={isSignInDialogOpen} onOpenChange={setIsSignInDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">Sign in to continue</DialogTitle>
            <DialogDescription className="text-center">
              Sign in with Google to like prompts and save your favorites.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Button
              onClick={() => {
                signInWithGoogle(window.location.href);
                setIsSignInDialogOpen(false);
              }}
              size="lg"
              className="w-full gap-3 h-12 text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Footer />
    </>
  );
};

export default Index;
