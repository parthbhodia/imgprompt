import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ThumbsUp, Heart, Wand2, Copy, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface SlideContent {
  image: string;
  beforeImage?: string;
  prompt: string;
  preview?: string;
}

interface PromptCardProps {
  slides: SlideContent[];
  category: string;
  title: string;
  platforms: string[];
  unlocked?: boolean;
  onOpen: () => void;
  onGenerateWithAI?: (prompt: string, imageUrl: string, slideIndex: number) => void;
  likeCount?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
  onLike?: (e: React.MouseEvent) => void;
  onFavorite?: (e: React.MouseEvent) => void;
}

export const PromptCard = ({
  slides,
  category,
  title,
  platforms,
  unlocked = false,
  onOpen,
  onGenerateWithAI,
  likeCount = 0,
  isLiked = false,
  isFavorited = false,
  onLike,
  onFavorite,
}: PromptCardProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showBefore, setShowBefore] = useState(false);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % slides.length);
    setShowBefore(false);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setShowBefore(false);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!unlocked) {
      toast.message("Unlock ImgPrompt to copy the full transform prompt");
      navigate("/pricing");
      return;
    }
    const safeIndex = Math.min(currentImageIndex, slides.length - 1);
    const slide = slides[safeIndex];
    if (!slide?.prompt) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(slide.prompt);
      } else {
        const ta = document.createElement("textarea");
        ta.value = slide.prompt;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      toast.success("Prompt copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy prompt.");
    }
  };

  if (!slides || slides.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentImageIndex, slides.length - 1);
  const currentSlide = slides[safeIndex];
  if (!currentSlide) {
    return null;
  }

  const hasBefore = Boolean(currentSlide.beforeImage);
  const displayImage =
    showBefore && hasBefore ? currentSlide.beforeImage! : currentSlide.image;
  const teaser = currentSlide.preview || currentSlide.prompt || "Upload your photo → get this look";

  return (
    <Card
      className="group relative overflow-hidden glass hover:scale-105 transition-all duration-300 cursor-pointer animate-scale-in border-border/50 flex flex-col"
      onClick={onOpen}
    >
      <div className="aspect-square overflow-hidden relative">
        <img
          src={displayImage}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-110 group-hover:transition-transform group-hover:duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
          <span className="px-3 py-1 rounded-full text-xs font-semibold glass backdrop-blur-md">
            {category}
          </span>
          {!unlocked && (
            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-background/80 backdrop-blur-md flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Premium
            </span>
          )}
        </div>

        {hasBefore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBefore((v) => !v);
            }}
            className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold glass backdrop-blur-md"
          >
            {showBefore ? "After" : "Before"}
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          aria-label={unlocked ? "Copy prompt" : "Unlock to copy"}
          className="absolute top-3 right-3 w-8 h-8 rounded-full glass backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-primary/20"
        >
          {!unlocked ? (
            <Lock className="w-3.5 h-3.5 text-foreground" />
          ) : copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-foreground" />
          )}
        </button>

        {slides.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {slides.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentImageIndex ? "bg-primary w-4" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{teaser}</p>

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {platforms.slice(0, 3).map((platform) => (
              <span
                key={platform}
                className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground"
              >
                {platform}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike?.(e);
            }}
            className={cn(
              "flex items-center gap-1.5 text-sm transition-colors",
              isLiked ? "text-primary font-semibold" : "text-muted-foreground hover:text-primary"
            )}
            aria-label={isLiked ? "Unlike prompt" : "Like prompt"}
          >
            <ThumbsUp className={cn("w-4 h-4", isLiked && "fill-primary")} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite?.(e);
            }}
            className={cn(
              "flex items-center gap-1 text-sm transition-colors",
              isFavorited ? "text-rose-500 font-semibold" : "text-muted-foreground hover:text-rose-500"
            )}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-4 h-4", isFavorited && "fill-rose-500")} />
          </button>
        </div>

        <Button
          size="sm"
          className="mt-auto w-full gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onGenerateWithAI?.(currentSlide.prompt, currentSlide.image, safeIndex);
          }}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Try on my photo
        </Button>
      </div>
    </Card>
  );
};
