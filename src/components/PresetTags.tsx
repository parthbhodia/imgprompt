import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, Sparkles, Palette, CloudSun, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { getSuggestions } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PresetTagsProps {
  onPresetSelected?: (prompt: string) => void;
}

interface PromptItem {
  title: string;
  prompt_text: string;
  category: string;
}

interface PresetCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  apiCategory: string;
  color: string;
  image: string;
}

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: "portrait",
    name: "Portraits",
    icon: <Camera className="w-4 h-4" />,
    description: "Portrait edits, cinematic headshots & face transformations",
    apiCategory: "portrait",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    image: "/portrait-headshot-blonde.jpg",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    icon: <Sparkles className="w-4 h-4" />,
    description: "Concept art, world-building & fantasy scenarios",
    apiCategory: "fantasy",
    color: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
    image: "/landscape-mountains.jpg",
  },
  {
    id: "product",
    name: "Products",
    icon: <Palette className="w-4 h-4" />,
    description: "Commercial photography & product showcases",
    apiCategory: "product",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    image: "/product-headphones.jpg",
  },
  {
    id: "mood",
    name: "Cinematic",
    icon: <CloudSun className="w-4 h-4" />,
    description: "Atmospheric, cinematic & moody scenes",
    apiCategory: "cinematic",
    color: "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400",
    image: "/portrait-smoke.jpg",
  },
];

export function PresetTags({ onPresetSelected }: PresetTagsProps) {
  const { session } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCategoryClick = async (category: PresetCategory) => {
    setSelectedCategory(category);
    setPrompts([]);
    setLoading(true);
    try {
      const token = session?.access_token ?? null;
      // First try with category filter
      let res = await getSuggestions(token, { limit: 50, category: category.apiCategory });
      // If nothing found, fall back to showing all prompts
      if (res.suggestions.length === 0) {
        res = await getSuggestions(token, { limit: 30 });
      }
      setPrompts(res.suggestions);
    } catch {
      toast.error("Could not load prompts");
    } finally {
      setLoading(false);
    }
  };

  const handleUsePrompt = (promptText: string) => {
    onPresetSelected?.(promptText);
    setSelectedCategory(null);
    toast.success("Prompt loaded! Hit send to generate.");
  };

  return (
    <>
      {/* Tag row */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Explore presets:</span>
        {PRESET_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            className={cn(
              "flex items-center gap-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 border cursor-pointer overflow-hidden",
              "p-1 sm:px-2 sm:py-1",
              category.color
            )}
            title={category.name}
          >
            <img
              src={category.image}
              alt={category.name}
              className="w-5 h-5 rounded-full object-cover hidden sm:block"
            />
            {category.icon}
            <span className="hidden sm:inline pr-1">{category.name}</span>
          </button>
        ))}
      </div>

      {/* Prompts Modal */}
      {selectedCategory && (
        <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={selectedCategory.image}
                  alt={selectedCategory.name}
                  className="w-12 h-12 rounded-lg object-cover border"
                />
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedCategory.icon}
                    {selectedCategory.name} Prompts
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">{selectedCategory.description}</p>
                </div>
              </div>
            </DialogHeader>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Sparkles className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading prompts…</span>
              </div>
            ) : prompts.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No prompts found for this category yet.
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-2">
                <div className="space-y-2 p-1">
                  {prompts.map((p, idx) => (
                    <div
                      key={idx}
                      className="group flex items-start justify-between gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {p.prompt_text}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5 h-8 px-3 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
                        onClick={() => handleUsePrompt(p.prompt_text)}
                      >
                        <Wand2 className="w-3 h-3" />
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
