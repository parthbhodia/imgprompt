import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PromptCard } from "@/components/PromptCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Zap, Copy, Search, Lightbulb, Star, Palette, MessageCircle, Share2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fetchPrompts, type NormalizedPrompt } from "@/lib/supabase";

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

const Index = () => {
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
  const [activeCategory, setActiveCategory] = useState(defaultCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const adsenseScriptRef = useRef<HTMLScriptElement | null>(null);
  const hasInitializedRoute = useRef(false);
  const selectedPrompt = selectedPromptId ? mergedPrompts.find((prompt) => prompt.id === selectedPromptId) ?? null : null;
  const selectedSlide = selectedPrompt ? selectedPrompt.slides[currentSlideIndex] : null;

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] ?? "All");
    }
  }, [categories, activeCategory]);

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
    setSearchQuery("");
    setActiveCategory(promptCategory);
    setTimeout(() => scrollToPromptCard(promptId), 200);
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
            <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
              {featuredPrompts.map((prompt) => {
                const firstSlide = prompt.slides[0];
                return (
                  <article
                    key={prompt.id}
                    className="min-w-[260px] max-w-[260px] rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-4 shrink-0"
                    onClick={() => handleFeaturedPromptClick(prompt.id, prompt.category)}
                  >
                    <div className="aspect-[4/5] overflow-hidden rounded-2xl mb-3">
                      <img
                        src={firstSlide.image}
                        alt={prompt.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                      {prompt.category}
                    </p>
                    <h3 className="text-lg font-semibold mb-2">{prompt.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{firstSlide.prompt}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Search Bar */}
        <section className="container mx-auto px-4 py-4">
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search prompts by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 glass text-base"
            />
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
            {filteredPrompts.map((prompt, index) => (
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
                />
              </div>
            ))}
          </div>

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
                <div className="flex flex-wrap gap-2">
                  {selectedPrompt.platforms.map((platform) => (
                    <Button
                      key={platform}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs uppercase tracking-wide"
                      onClick={() => handlePlatformLaunch(platform)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {platform}
                    </Button>
                  ))}
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4 overflow-y-auto max-h-[320px]">
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{selectedSlide.prompt}</p>
                </div>
                <Button onClick={copySelectedPrompt} className="w-full">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Prompt
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
};

export default Index;
