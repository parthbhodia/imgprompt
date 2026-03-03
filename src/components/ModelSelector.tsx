import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getModels, type ModelInfo } from "@/lib/api";
import { Cpu, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  token: string | null;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ token, selectedModel, onSelectModel, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    getModels(token)
      .then((data) => {
        setModels(data.models.filter((m) => m.available));
        setLoading(false);
      })
      .catch(() => {
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

  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  // Don't show if only one model available
  if (models.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
        <Cpu className="w-3 h-3" />
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
            selectedModel === "imagen-3" && "text-blue-600 hover:text-blue-700"
          )}
        >
          {selectedModel === "imagen-3" ? (
            <Zap className="w-3.5 h-3.5" />
          ) : (
            <Cpu className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{selectedModelInfo?.name || "Model"}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            className={cn(
              "flex items-start gap-2 py-2",
              selectedModel === model.id && "bg-accent"
            )}
          >
            <div className="mt-0.5">
              {model.id === "imagen-3" ? (
                <Zap className="w-4 h-4 text-blue-500" />
              ) : (
                <Cpu className="w-4 h-4 text-purple-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{model.name}</span>
                {selectedModel === model.id && (
                  <span className="text-xs text-muted-foreground">Active</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {model.description}
              </p>
              <span className="text-[10px] text-muted-foreground/60 mt-1">
                via {model.provider}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
