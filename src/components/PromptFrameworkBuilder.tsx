import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Wand2, Copy, Lightbulb, Sparkles, Zap, AlertCircle, Check, Loader2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildPromptFromFramework,
  createFrameworkFromDescription,
  getFrameworkPresets,
  getQuickFixes,
  buildNegativeConstraints,
  type PromptFramework,
  type PresetsResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface PromptFrameworkBuilderProps {
  onPromptGenerated?: (prompt: string) => void;
}

const FRAMEWORK_SECTIONS = [
  {
    key: "subject_definition",
    label: "Subject Definition",
    description: "What the image is primarily about. The anchor.",
    placeholder: "e.g., A person with distinctive features, confident expression",
    tips: ["Include 2-4 defining traits", "Be specific about the main subject", "This is your foundation"],
  },
  {
    key: "action_context",
    label: "Action and Context",
    description: "What the subject is doing, and why it matters.",
    placeholder: "e.g., Looking directly at camera, candid moment",
    tips: ["Show movement or interaction", "Include purpose or narrative", "Make it dynamic"],
  },
  {
    key: "environment_setting",
    label: "Environment and Setting",
    description: "Where the scene takes place. Ground it.",
    placeholder: "e.g., Studio with controlled lighting, minimal background",
    tips: ["Specify location and time", "Include key surroundings", "Set the atmosphere"],
  },
  {
    key: "mood_story",
    label: "Mood and Story",
    description: "The emotional tone and implied narrative.",
    placeholder: "e.g., Professional yet approachable, confident presence",
    tips: ["Define emotional tone", "Hint at narrative", "Create feeling"],
  },
  {
    key: "visual_style",
    label: "Visual Style and References",
    description: "The aesthetic direction: genre, era, medium, inspirations.",
    placeholder: "e.g., Contemporary portrait photography, editorial magazine style",
    tips: ["Name specific styles", "Reference photographers/artists", "Be era-specific"],
  },
  {
    key: "lighting_color",
    label: "Lighting and Color",
    description: "The lighting setup and the color grading.",
    placeholder: "e.g., Three-point lighting with warm key light, rim light, cool fill",
    tips: ["Specify lighting type", "Define color palette", "This makes cinematic look"],
  },
  {
    key: "camera_composition",
    label: "Camera and Composition",
    description: "Lens choice, angle, framing, depth of field, motion.",
    placeholder: "e.g., 85mm lens, shallow depth of field f/1.8, centered framing",
    tips: ["Name lens millimeters", "Specify shot type", "Define framing"],
  },
  {
    key: "detail_texture",
    label: "Detail and Texture Control",
    description: "Materials, micro details, wear, surface realism.",
    placeholder: "e.g., Detailed skin texture, sharp eyes with catchlight, fine hair detail",
    tips: ["Include material specifics", "Add micro details", "Control realism"],
  },
  {
    key: "quality_realism",
    label: "Quality and Realism Control",
    description: "Sharpness, fidelity, realism level, rendering quality.",
    placeholder: "e.g., Photorealistic, high fidelity, cinematic grade, professional polish",
    tips: ["Define realism level", "Specify finish quality", "Control sharpness"],
  },
  {
    key: "negative_constraints",
    label: "Negative Constraints",
    description: "What to prevent: common failures, artifacts, unwanted elements.",
    placeholder: "e.g., no makeup, no filters, no soft focus, no beauty mode",
    tips: ["Be explicit about what NOT to do", "Include common failure modes", "Prevents artifacts"],
  },
];

export function PromptFrameworkBuilder({ onPromptGenerated }: PromptFrameworkBuilderProps) {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "ai" | "templates">("builder");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  const [framework, setFramework] = useState<PromptFramework>({
    subject_definition: "",
    action_context: "",
    environment_setting: "",
    mood_story: "",
    visual_style: "",
    lighting_color: "",
    camera_composition: "",
    detail_texture: "",
    quality_realism: "",
    negative_constraints: "",
  });

  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [presets, setPresets] = useState<PresetsResponse["presets"] | null>(null);
  const [building, setBuilding] = useState(false);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!user || !session) return;
    
    const loadPresets = async () => {
      try {
        const data = await getFrameworkPresets(session.access_token);
        setPresets(data.presets);
      } catch (e) {
        console.error("Failed to load presets", e);
      }
    };

    if (open) loadPresets();
  }, [open, user, session]);

  const handleFrameworkChange = (key: keyof PromptFramework, value: string) => {
    setFramework(prev => ({ ...prev, [key]: value }));
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBuildPrompt = async () => {
    if (!session) return;
    
    try {
      setBuilding(true);
      const result = await buildPromptFromFramework(session.access_token, framework, "compact");
      setPrompt(result.compact_prompt);
      toast.success("Prompt built successfully!");
      
      if (onPromptGenerated) {
        onPromptGenerated(result.compact_prompt);
        setOpen(false);
      }
    } catch (e) {
      toast.error("Failed to build prompt");
    } finally {
      setBuilding(false);
    }
  };

  const handleAIEnhance = async () => {
    if (!session || !naturalLanguageInput.trim()) {
      toast.error("Please describe what you want to create");
      return;
    }

    try {
      setAiLoading(true);
      const result = await createFrameworkFromDescription(session.access_token, naturalLanguageInput);
      setFramework(result.framework as PromptFramework);
      setActiveTab("builder");
      toast.success("Framework created from your description!");
    } catch (e) {
      toast.error("Failed to create framework from description");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLoadPreset = (presetName: string) => {
    if (!presets || !presets[presetName]) return;
    setFramework(presets[presetName]);
    setActiveTab("builder");
    toast.success(`Loaded preset: ${presetName}`);
  };

  if (!user || !session) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Open AI prompt framework builder"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Framework</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>AI Image Prompt Framework</DialogTitle>
          <DialogDescription>
            Build cinematic prompts using the 10-part framework for consistent results
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("builder")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "builder"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Builder
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "ai"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            AI Helper
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "templates"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Presets
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Builder Tab */}
          {activeTab === "builder" && (
            <div className="space-y-3 p-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Pro Tip
                </p>
                <p className="text-xs text-muted-foreground">
                  Lock the story first (sections 1-4), then lock the shot (sections 5-7), add details, then guardrails.
                  Change one section at a time for best results.
                </p>
              </div>

              <div className="space-y-2">
                {FRAMEWORK_SECTIONS.map((section, idx) => (
                  <div
                    key={section.key}
                    className="border rounded-lg overflow-hidden bg-card"
                  >
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary bg-primary/10 rounded px-2 py-1">
                            {idx + 1}
                          </span>
                          <h3 className="font-medium text-sm">{section.label}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                      </div>
                      {expandedSections.has(section.key) ? (
                        <ChevronUp className="w-4 h-4 shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0 ml-2" />
                      )}
                    </button>

                    {expandedSections.has(section.key) && (
                      <div className="border-t p-3 bg-muted/30 space-y-2">
                        <Textarea
                          placeholder={section.placeholder}
                          value={framework[section.key as keyof PromptFramework]}
                          onChange={(e) => handleFrameworkChange(section.key as keyof PromptFramework, e.target.value)}
                          className="min-h-20"
                        />
                        <div className="flex flex-wrap gap-1">
                          {section.tips.map((tip, i) => (
                            <span key={i} className="text-xs bg-background/50 text-muted-foreground px-2 py-1 rounded">
                              • {tip}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Helper Tab */}
          {activeTab === "ai" && (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Describe your image in natural language</label>
                <Textarea
                  placeholder="E.g., A professional portrait of a woman in a modern office, confident and approachable, shot with warm studio lighting and a clean background..."
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  className="min-h-32"
                />
                <p className="text-xs text-muted-foreground">
                  Be as detailed as you want. AI will break it down into the 10 framework sections.
                </p>
              </div>

              <Button
                onClick={handleAIEnhance}
                disabled={aiLoading || !naturalLanguageInput.trim()}
                className="w-full gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Create Framework with AI
                  </>
                )}
              </Button>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  How it works
                </p>
                <p className="text-xs text-muted-foreground">
                  Describe your image naturally. The AI breaks it down into the 10 framework sections,
                  then you can refine each part and build the final prompt.
                </p>
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === "templates" && (
            <div className="p-4 space-y-3">
              {presets ? (
                Object.entries(presets).map(([name, preset]) => (
                  <button
                    key={name}
                    onClick={() => handleLoadPreset(name)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors space-y-1"
                  >
                    <h3 className="font-medium text-sm capitalize">
                      {name.replace(/_/g, " ")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {preset.subject_definition}
                    </p>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading presets...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex gap-2">
          {prompt && (
            <div className="flex-1 bg-muted/50 p-2 rounded text-xs text-muted-foreground overflow-hidden max-h-16 line-clamp-3">
              {prompt}
            </div>
          )}
          <Button
            onClick={() => {
              navigator.clipboard.writeText(prompt);
              toast.success("Prompt copied!");
            }}
            variant="outline"
            size="sm"
            disabled={!prompt}
            className="shrink-0"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleBuildPrompt}
            disabled={building || Object.values(framework).some(v => !v.trim())}
            className="shrink-0 gap-2"
          >
            {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Build Prompt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
