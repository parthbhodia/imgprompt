import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronLeft, ChevronRight, ThumbsUp, Heart, Wand2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SlideContent {
  image: string;
  prompt: string;
}

interface PromptCardProps {
  slides: SlideContent[];
  category: string;
  title: string;
  platforms: string[];
  onOpen: () => void;
  onGenerateWithAI?: (prompt: string, imageUrl: string) => void;
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
  onOpen,
  onGenerateWithAI,
  likeCount = 0,
  isLiked = false,
  isFavorited = false,
  onLike,
  onFavorite,
}: PromptCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % slides.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const safeIndex = Math.min(currentImageIndex, slides.length - 1);
    const slide = slides[safeIndex];
    if (!slide) return;
    const text = slide.prompt;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
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

  // Ensure currentImageIndex is within bounds
  const safeIndex = Math.min(currentImageIndex, slides.length - 1);
  const currentSlide = slides[safeIndex];
  if (!currentSlide) {
    return null;
  }

  return (
    <Card
      className="group relative overflow-hidden glass hover:scale-105 transition-all duration-300 cursor-pointer animate-scale-in border-border/50 flex flex-col"
      onClick={onOpen}
    >
      {/* Image area */}
      <div className="aspect-square overflow-hidden relative">
        <img
          src={currentSlide.image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-110 group-hover:transition-transform group-hover:duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Category badge – top left */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold glass backdrop-blur-md">
            {category}
          </span>
        </div>

        {/* Copy icon – top right */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy prompt"
          className="absolute top-3 right-3 w-8 h-8 rounded-full glass backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-primary/20"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-400" />
            : <Copy className="w-3.5 h-3.5 text-foreground" />}
        </button>

        {/* Slide navigation */}
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

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {currentSlide.prompt}
        </p>

        {/* Like / Favorite row */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onLike?.(e); }}
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
            onClick={(e) => { e.stopPropagation(); onFavorite?.(e); }}
            className={cn(
              "flex items-center gap-1 text-sm transition-colors",
              isFavorited ? "text-rose-500 font-semibold" : "text-muted-foreground hover:text-rose-500"
            )}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-4 h-4", isFavorited && "fill-rose-500")} />
          </button>
        </div>

        {/* Generate with AI – always at the bottom */}
        <Button
          size="sm"
          className="mt-auto w-full gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onGenerateWithAI?.(currentSlide.prompt, currentSlide.image);
          }}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Generate with AI
        </Button>
      </div>
    </Card>
  );
};
