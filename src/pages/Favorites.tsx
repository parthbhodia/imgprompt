import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLikes } from "@/contexts/LikesContext";
import { fetchPrompts, type NormalizedPrompt } from "@/lib/supabase";
import { PromptCard } from "@/components/PromptCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Heart,
  ChevronLeft,
  Copy,
  ChevronRight,
  ExternalLink,
  Share2,
  ThumbsUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PromptWithAssets = {
  id: number;
  title: string;
  category: string;
  platforms: string[];
  slug: string;
  slides: { image: string; prompt: string }[];
  featured?: boolean;
};

const normalizePrompts = (data?: NormalizedPrompt[]): PromptWithAssets[] => {
  if (!data) return [];
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category || "Uncategorized",
    platforms: item.platforms?.length ? item.platforms : ["Custom"],
    slug: item.slug || `prompt-${item.id}`,
    slides:
      item.slides?.map((slide) => ({
        image: slide.image || "",
        prompt: slide.prompt,
      })) ?? [],
    featured: item.featured,
  }));
};

const platformUrls: Record<string, string> = {
  Midjourney: "https://www.midjourney.com/",
  "DALL-E 3": "https://chatgpt.com/",
  "Stable Diffusion": "https://stablediffusionweb.com/",
  "Leonardo AI": "https://leonardo.ai/",
  "Adobe Firefly": "https://firefly.adobe.com/",
  "Niji Journey": "https://niji.journey.com/",
  "Google Gemini": "https://gemini.google.com/app",
  "Createimg.com": "https://createimg.com/",
};

const Favorites = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { likeCounts, userLikes, userFavorites, loaded: likesLoaded, toggleLike, toggleFavorite } = useLikes();

  const { data: promptsData, isLoading: promptsLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: fetchPrompts,
    staleTime: 5 * 60 * 1000,
  });

  const allPrompts = normalizePrompts(promptsData?.prompts);
  const favoritePrompts = allPrompts.filter((p) => userFavorites.has(p.id));

  // Prompt dialog state
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedPrompt = selectedPromptId
    ? favoritePrompts?.find((p) => p.id === selectedPromptId) ??
      allPrompts?.find((p) => p.id === selectedPromptId) ??
      null
    : null;
  const selectedSlide = selectedPrompt
    ? selectedPrompt.slides[currentSlideIndex]
    : null;

  const openPrompt = (id: number) => {
    setSelectedPromptId(id);
    setCurrentSlideIndex(0);
    setIsDialogOpen(true);
  };

  const closePrompt = () => {
    setIsDialogOpen(false);
    setSelectedPromptId(null);
    setCurrentSlideIndex(0);
  };

  const goToSlide = (dir: "prev" | "next") => {
    if (!selectedPrompt) return;
    setCurrentSlideIndex((prev) =>
      dir === "prev"
        ? (prev - 1 + selectedPrompt.slides.length) % selectedPrompt.slides.length
        : (prev + 1) % selectedPrompt.slides.length
    );
  };

  const copyText = async (text: string, msg = "Copied!") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleLike = async (promptId: number) => {
    if (!user) return;
    const ok = await toggleLike(promptId);
    if (ok) toast.success(userLikes.has(promptId) ? "Like removed" : "Prompt liked!");
  };

  const handleFavorite = async (promptId: number) => {
    if (!user) return;
    const ok = await toggleFavorite(promptId);
    if (ok) toast.success(userFavorites.has(promptId) ? "Removed from favorites" : "Added to favorites!");
  };

  const isLoading = authLoading || promptsLoading || !likesLoaded;

  // Redirect to sign-in if not authenticated (after loading completes)
  useEffect(() => {
    if (!authLoading && !user) {
      // Don't redirect, just show sign-in prompt on the page
    }
  }, [authLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
          <Heart className="w-16 h-16 text-rose-500" />
          <h1 className="text-3xl font-bold">Sign in to see your favorites</h1>
          <p className="text-muted-foreground max-w-md">
            Sign in with Google to save prompts and access them anytime.
          </p>
          <Button
            onClick={() => signInWithGoogle(window.location.href)}
            size="lg"
            className="gap-3 h-12 text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back to prompts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-10">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 mb-6">
            <ChevronLeft className="w-4 h-4" />
            Back to prompts
          </Button>
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
            <div>
              <h1 className="text-3xl font-bold">My Favorites</h1>
              <p className="text-muted-foreground">
                {favoritePrompts.length} saved prompt{favoritePrompts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </header>

        {/* Gallery */}
        <section className="container mx-auto px-4 pb-20">
          {favoritePrompts.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto space-y-6 glass rounded-3xl p-10">
              <Sparkles className="w-12 h-12 text-primary mx-auto" />
              <h3 className="text-2xl font-semibold">No favorites yet</h3>
              <p className="text-muted-foreground">
                Browse prompts and tap the heart icon to save your favorites here.
              </p>
              <Button onClick={() => navigate("/")}>Explore Prompts</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoritePrompts.map((prompt) => (
                <div key={prompt.id}>
                  <PromptCard
                    slides={prompt.slides}
                    category={prompt.category}
                    title={prompt.title}
                    platforms={prompt.platforms}
                    onOpen={() => openPrompt(prompt.id)}
                    likeCount={likeCounts[prompt.id] ?? 0}
                    isLiked={userLikes.has(prompt.id)}
                    isFavorited={userFavorites.has(prompt.id)}
                    onLike={() => handleLike(prompt.id)}
                    onFavorite={() => handleFavorite(prompt.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Prompt detail dialog */}
      {selectedPrompt && selectedSlide && (
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => (open ? undefined : closePrompt())}
        >
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center justify-between gap-4 text-2xl">
                <span>{selectedPrompt.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/?prompt=${selectedPrompt.slug}`;
                    copyText(url, "Link copied!");
                  }}
                  className="rounded-full p-2 hover:bg-muted transition-colors"
                  aria-label="Share"
                >
                  <Share2 className="w-5 h-5" />
                </button>
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
                      onClick={() => {
                        copyText(selectedSlide.prompt, `Prompt copied for ${platform}!`);
                        const url = platformUrls[platform];
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {platform}
                    </Button>
                  ))}
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4 overflow-y-auto max-h-[320px]">
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {selectedSlide.prompt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => copyText(selectedSlide.prompt, "Prompt copied!")}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Prompt
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleLike(selectedPrompt.id)}
                    className={cn(userLikes.has(selectedPrompt.id) && "border-primary text-primary")}
                  >
                    <ThumbsUp className={cn("w-4 h-4", userLikes.has(selectedPrompt.id) && "fill-primary")} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleFavorite(selectedPrompt.id)}
                    className={cn(userFavorites.has(selectedPrompt.id) && "border-rose-500 text-rose-500")}
                  >
                    <Heart className={cn("w-4 h-4", userFavorites.has(selectedPrompt.id) && "fill-rose-500")} />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Favorites;
