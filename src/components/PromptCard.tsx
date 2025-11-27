import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PromptCardProps {
  image: string;
  prompt: string;
  category: string;
  title: string;
}

export const PromptCard = ({ image, prompt, category, title }: PromptCardProps) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      className="group relative overflow-hidden glass hover:scale-105 transition-all duration-300 cursor-pointer animate-scale-in border-border/50"
      onClick={() => setShowPrompt(!showPrompt)}
    >
      <div className="aspect-square overflow-hidden relative">
        <img
          src={image}
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
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{title}</h3>
        
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
