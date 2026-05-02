import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getModels, type ModelInfo } from "@/lib/api";
import { Cpu, Zap, Sparkles, Crown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  token: string | null;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
}

const modelIcons: Record<string, React.ReactNode> = {
  "gpt-image-2": <Sparkles className="w-4 h-4 text-emerald-500" />,
  "replicate-flux": <Cpu className="w-4 h-4 text-purple-500" />,
  "imagen-3.0-fast-generate-001": <Zap className="w-4 h-4 text-green-500" />,
  "imagen-3.0-generate-001": <Sparkles className="w-4 h-4 text-blue-500" />,
  "imagen-3.0-ultra-generate-001": <Crown className="w-4 h-4 text-amber-500" />,
  "gemini-2.5-flash-image": <Zap className="w-4 h-4 text-yellow-500" />,
  "gemini-3.1-flash-image-preview": <Sparkles className="w-4 h-4 text-blue-500" />,
  "gemini-3-pro-image-preview": <Crown className="w-4 h-4 text-amber-500" />,
};

const modelBadges: Record<string, string> = {
  "gpt-image-2": "Best for Edits",
  "imagen-3.0-fast-generate-001": "Fastest",
  "imagen-3.0-generate-001": "Balanced",
  "imagen-3.0-ultra-generate-001": "Ultra Quality",
  "gemini-2.5-flash-image": "Flash",
};

export function ModelSelector({ token, selectedModel, onSelectModel, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Models endpoint is public - fetch even without token
    getModels(token)  // token can be null
      .then((data) => {
        console.log("Models API response:", data);
        // Handle both: array directly OR {models: [...]} wrapper
        const modelsArray = Array.isArray(data) ? data : data.models;
        if (modelsArray && modelsArray.length > 0) {
          setModels(modelsArray);
        } else {
          console.warn("No models returned from API, using fallback");
          // Use fallback if no models
          setModels([
            {
              id: "replicate-flux",
              name: "Flux 1.1 Ultra",
              provider: "replicate",
              description: "Best quality, supports img2img",
              available: true,
            },
          ]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch models:", err);
        // Fallback to default if API fails
        setModels([
          {
            id: "replicate-flux",
            name: "Flux 1.1 Ultra",
            provider: "replicate",
            description: "Best quality, supports img2img",
            available: true,
          },
        ]);
        setLoading(false);
      });
  }, [token]);

  const selectedModelInfo = models?.find((m) => m.id === selectedModel);
  const selectedIcon = modelIcons[selectedModel] || <Cpu className="w-4 h-4" />;
  const selectedBadge = modelBadges[selectedModel];

  // Don't show if no models available (loading or error)
  if (!models || models.length === 0 || loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
        {selectedIcon}
        <span>{selectedModelInfo?.name || "Flux"}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || loading}
          className={cn(
            "h-7 gap-1.5 px-2 text-xs",
            selectedModel.startsWith("gemini-") && "text-blue-600 hover:text-blue-700"
          )}
        >
          {selectedIcon}
          <span className="hidden sm:inline">{selectedModelInfo?.name || "Model"}</span>
          {selectedBadge && (
            <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {selectedBadge}
            </span>
          )}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {models.map((model, index) => {
          const icon = modelIcons[model.id] || <Cpu className="w-4 h-4" />;
          const badge = modelBadges[model.id];
          const isSelected = selectedModel === model.id;
          const isAvailable = model.available;
          
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => isAvailable && onSelectModel(model.id)}
              disabled={!isAvailable}
              className={cn(
                "flex items-start gap-3 py-2.5",
                isSelected && "bg-accent",
                !isAvailable && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn("mt-0.5 shrink-0", !isAvailable && "opacity-50")}>{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("font-medium text-sm", !isAvailable && "text-muted-foreground")}>
                    {model.name}
                  </span>
                  {!isAvailable ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                      Will be live soon
                    </span>
                  ) : badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                      {badge}
                    </span>
                  )}
                </div>
                <p className={cn("text-xs mt-0.5 line-clamp-2", !isAvailable ? "text-muted-foreground/50" : "text-muted-foreground")}>
                  {model.description}
                </p>
                <span className={cn("text-[10px] mt-1", !isAvailable ? "text-muted-foreground/40" : "text-muted-foreground/60")}>
                  via {model.provider}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
