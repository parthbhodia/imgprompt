import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Sparkles, Palette, Users, ArrowRight, Check,
} from "lucide-react";
import { toast } from "sonner";
import { getFrameworkPresets, buildPromptFromFramework, type PromptFramework } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PresetCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  presets: string[];
  useCases: string[];
  color: string;
}

interface PresetTagsProps {
  onPresetSelected?: (prompt: string) => void;
}

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: "portrait",
    name: "Portraits",
    icon: <Camera className="w-4 h-4" />,
    description: "Professional headshots, editorial, candid moments",
    presets: ["cinematic_portrait"],
    useCases: [
      "LinkedIn profiles",
      "Professional portfolios",
      "Editorial shoots",
      "Character designs",
    ],
    color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  },
  {
    id: "fantasy",
    name: "Fantasy & Worlds",
    icon: <Sparkles className="w-4 h-4" />,
    description: "Concept art, world-building, fantasy scenarios",
    presets: ["fantasy_landscape"],
    useCases: [
      "Game concept art",
      "Novel illustrations",
      "DnD campaigns",
      "Worldbuilding",
    ],
    color: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
  },
  {
    id: "product",
    name: "Products",
    icon: <Palette className="w-4 h-4" />,
    description: "Commercial photography, product showcases",
    presets: ["product_showcase"],
    useCases: [
      "E-commerce listings",
      "Marketing materials",
      "Brand shots",
      "Luxury items",
    ],
    color: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  {
    id: "mood",
    name: "Mood & Cinema",
    icon: <Users className="w-4 h-4" />,
    description: "Atmospheric, cinematic, moody scenes",
    presets: ["moody_atmosphere"],
    useCases: [
      "Film stills",
      "Mood boards",
      "Dark academia",
      "Cinematic scenes",
    ],
    color: "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400",
  },
];

export function PresetTags({ onPresetSelected }: PresetTagsProps) {
  const { session } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | null>(null);
  const [categoryPresets, setCategoryPresets] = useState<Record<string, PromptFramework>>({});
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);

  const handleCategoryClick = async (category: PresetCategory) => {
    if (!session) {
      toast.error("Please sign in first");
      return;
    }

    setSelectedCategory(category);

    // Load presets if not already loaded
    if (Object.keys(categoryPresets).length === 0) {
      try {
        setLoading(true);
        const data = await getFrameworkPresets(session.access_token);
        setCategoryPresets(data.presets);
      } catch (e) {
        toast.error("Failed to load presets");
        setSelectedCategory(null);
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePresetClick = async (presetName: string) => {
    if (!session) return;

    try {
      setBuilding(true);
      const preset = categoryPresets[presetName];
      if (!preset) {
        toast.error("Preset not found");
        return;
      }

      const result = await buildPromptFromFramework(session.access_token, preset, "compact");
      toast.success("Preset loaded! Ready to generate.");
      
      if (onPresetSelected) {
        onPresetSelected(result.compact_prompt);
      }
      setSelectedCategory(null);
    } catch (e) {
      toast.error("Failed to build prompt from preset");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      {/* Preset Tags Row */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-muted-foreground">Explore presets:</span>
        {PRESET_CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105",
              category.color,
              "border cursor-pointer"
            )}
          >
            {category.icon}
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Modal for Category Details */}
      {selectedCategory && (
        <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedCategory.icon}
                {selectedCategory.name}
              </DialogTitle>
              <DialogDescription>{selectedCategory.description}</DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-center space-y-2">
                  <Sparkles className="w-6 h-6 animate-spin mx-auto opacity-50" />
                  <p className="text-sm text-muted-foreground">Loading presets...</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 p-4">
                  {/* Use Cases */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">Perfect for:</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCategory.useCases.map(useCase => (
                        <Badge key={useCase} variant="secondary">
                          {useCase}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">Available Templates:</h3>
                    <div className="space-y-2">
                      {selectedCategory.presets.map(presetName => {
                        const preset = categoryPresets[presetName];
                        if (!preset) return null;

                        return (
                          <div
                            key={presetName}
                            className="p-3 border rounded-lg hover:bg-muted/50 transition-colors space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm capitalize">
                                  {presetName.replace(/_/g, " ")}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {preset.subject_definition}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handlePresetClick(presetName)}
                                disabled={building}
                                className="shrink-0 gap-1"
                              >
                                {building ? (
                                  <>
                                    <Sparkles className="w-3 h-3 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Use
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Framework Preview */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-muted/30 p-2 rounded">
                                <p className="font-medium text-muted-foreground">Style</p>
                                <p className="text-foreground truncate">{preset.visual_style}</p>
                              </div>
                              <div className="bg-muted/30 p-2 rounded">
                                <p className="font-medium text-muted-foreground">Lighting</p>
                                <p className="text-foreground truncate">{preset.lighting_color}</p>
                              </div>
                              <div className="bg-muted/30 p-2 rounded col-span-2">
                                <p className="font-medium text-muted-foreground">Camera</p>
                                <p className="text-foreground truncate">{preset.camera_composition}</p>
                              </div>
                            </div>

                            {/* Action */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Click Use to load this framework</span>
                              <ArrowRight className="w-3 h-3" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      💡 Pro Tip
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Load a preset, review the framework, customize any section, and click "Build Prompt" to generate your image!
                    </p>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
