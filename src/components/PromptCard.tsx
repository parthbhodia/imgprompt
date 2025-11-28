import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface PromptCardProps {
  images: string[];
  prompt: string;
  category: string;
  title: string;
  platforms: string[];
}

export const PromptCard = ({ images, prompt, category, title, platforms }: PromptCardProps) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const platformUrls: Record<string, string> = {
    "Midjourney": "https://www.midjourney.com/",
    "DALL-E 3": "https://chatgpt.com/",
    "Stable Diffusion": "https://stablediffusionweb.com/",
    "Leonardo AI": "https://leonardo.ai/",
    "Adobe Firefly": "https://firefly.adobe.com/",
    "Niji Journey": "https://niji.journey.com/",
  };

  const handlePlatformClick = (e: React.MouseEvent, platform: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt);
    const url = platformUrls[platform] || "#";
    if (url !== "#") {
      window.open(url, "_blank");
      toast.success(`Prompt copied! Opening ${platform}...`);
    }
  };

  return (
    <Card
      className="group relative overflow-hidden glass hover:scale-105 transition-all duration-300 cursor-pointer animate-scale-in border-border/50"
      onClick={() => setShowPrompt(!showPrompt)}
    >
      <div className="aspect-square overflow-hidden relative">
        <img
          src={images[currentImageIndex]}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold glass backdrop-blur-md">
            {category}
          </span>
        </div>

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Sparkles className="w-5 h-5 text-primary-glow" />
        </div>

        {/* Image Navigation */}
        {images.length > 1 && (
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
              {images.map((_, idx) => (
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

      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{title}</h3>
        
        {/* Platform Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {platforms.map((platform) => (
            <Badge 
              key={platform} 
              variant="secondary" 
              className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={(e) => handlePlatformClick(e, platform)}
            >
              {platform}
            </Badge>
          ))}
        </div>
        
        {showPrompt ? (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {prompt}
            </p>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              variant="secondary"
              size="sm"
              className="w-full gradient-secondary"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Prompt
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Click to reveal prompt ✨
          </p>
        )}
      </div>
    </Card>
  );
};
