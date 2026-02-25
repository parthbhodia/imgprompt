import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Lightbulb, BookOpen, Zap, AlertCircle, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getQuickFixes, type QuickFixResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

const QUICK_ISSUES = [
  { key: "flat_image", label: "Image looks flat", icon: "📸" },
  { key: "anatomy_weird", label: "Anatomy is weird", icon: "🧬" },
  { key: "too_generic", label: "Too generic", icon: "🎨" },
  { key: "style_drift", label: "Style keeps shifting", icon: "🎭" },
  { key: "background_mess", label: "Background is cluttered", icon: "🖼️" },
];

export function PromptGuidePanel() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [quickFixes, setQuickFixes] = useState<QuickFixResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectIssue = async (issueKey: string) => {
    if (!session) return;
    setSelectedIssue(issueKey);

    try {
      setLoading(true);
      const result = await getQuickFixes(session.access_token, issueKey);
      setQuickFixes(result);
    } catch (e) {
      toast.error("Failed to load quick fixes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Open prompt framework guide"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Guide</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[500px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Prompt Framework Guide</SheetTitle>
          <SheetDescription>
            Master the 10-part framework for cinematic results
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4">
            {/* Quick Access */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Quick Fixes
              </h3>
              <p className="text-xs text-muted-foreground">
                Having issues? Find solutions for common problems:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ISSUES.map(issue => (
                  <button
                    key={issue.key}
                    onClick={() => handleSelectIssue(issue.key)}
                    className={cn(
                      "p-2 rounded-lg border text-left text-xs font-medium transition-colors",
                      selectedIssue === issue.key
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted/40 border-border hover:bg-muted/60"
                    )}
                  >
                    <span className="text-lg">{issue.icon}</span>
                    <span className="block mt-1">{issue.label}</span>
                  </button>
                ))}
              </div>

              {quickFixes && selectedIssue && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    Solutions for: {quickFixes.issue}
                  </h4>
                  <ul className="space-y-2">
                    {quickFixes.fixes.map((fix, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">→</span>
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Framework Overview */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                10-Part Framework
              </h3>
              <div className="space-y-2">
                {[
                  { num: 1, name: "Subject Definition", desc: "What the image is about" },
                  { num: 2, name: "Action & Context", desc: "What the subject is doing" },
                  { num: 3, name: "Environment", desc: "Where the scene takes place" },
                  { num: 4, name: "Mood & Story", desc: "Emotional tone & narrative" },
                  { num: 5, name: "Visual Style", desc: "Aesthetic direction & references" },
                  { num: 6, name: "Lighting & Color", desc: "Lighting setup & grading" },
                  { num: 7, name: "Camera & Composition", desc: "Lens, angle, framing" },
                  { num: 8, name: "Detail & Texture", desc: "Materials & micro details" },
                  { num: 9, name: "Quality & Realism", desc: "Sharpness & fidelity" },
                  { num: 10, name: "Negative Constraints", desc: "What to prevent" },
                ].map(section => (
                  <div key={section.num} className="flex gap-3 p-2 rounded-lg bg-muted/30">
                    <span className="text-xs font-bold bg-primary/20 text-primary rounded px-2 py-1 h-fit">
                      {section.num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{section.name}</p>
                      <p className="text-xs text-muted-foreground">{section.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tips */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Pro Tips</h3>
              <div className="space-y-2">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Lock and Iterate</p>
                  <p className="text-xs text-muted-foreground">
                    Fix one section at a time. If the face is wrong, don't change the environment—fix the face first.
                  </p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Start with the Story</p>
                  <p className="text-xs text-muted-foreground">
                    Lock sections 1-4 (subject, action, environment, mood) before touching other parts.
                  </p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Add the Shot</p>
                  <p className="text-xs text-muted-foreground">
                    Cinematic results start with lighting + camera composition + negative constraints.
                  </p>
                </div>
              </div>
            </div>

            {/* Common Negatives */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Common Negative Constraints</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground mb-1">Text & Artifacts:</p>
                  <p className="text-xs">no text, no watermark, no logo, no signature, no frame, no UI elements</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Anatomy:</p>
                  <p className="text-xs">no extra limbs, no extra fingers, no fused hands, no distorted anatomy</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Quality:</p>
                  <p className="text-xs">no blurry face, no low resolution, no compression artifacts, no pixelation</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Geometry:</p>
                  <p className="text-xs">no warped geometry, no unnatural reflections, no melted objects</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
