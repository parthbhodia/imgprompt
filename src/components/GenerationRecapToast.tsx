import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GenerationRecapToastProps {
  isVisible: boolean;
  creditsCost: number;
  creditsRemaining: number;
  generationType: "standard" | "hd" | "batch";
  onClose: () => void;
  onEarnClick?: () => void;
}

const typeLabels = {
  standard: "Standard Generation",
  hd: "HD Generation",
  batch: "Batch Generation",
};

export function GenerationRecapToast({
  isVisible,
  creditsCost,
  creditsRemaining,
  generationType,
  onClose,
  onEarnClick,
}: GenerationRecapToastProps) {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  const isLow = creditsRemaining < 2;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div
            className={cn(
              "rounded-lg border backdrop-blur-md shadow-lg p-4 space-y-3",
              isLow
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-green-500/10 border-green-500/30"
            )}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex-shrink-0",
                  isLow
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
                )}
              >
                {isLow ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">
                  {isLow ? "Low on Credits" : "Generation Successful!"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {typeLabels[generationType]}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-background/50">
                <span className="text-muted-foreground">Credits Used:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{creditsCost}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-background/50">
                <span className="text-muted-foreground">Remaining:</span>
                <span
                  className={cn(
                    "font-semibold",
                    isLow
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"
                  )}
                >
                  {creditsRemaining.toFixed(1)}
                </span>
              </div>
            </div>

            {/* CTA */}
            {isLow && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-8 text-xs"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onEarnClick?.();
                    onClose();
                  }}
                  className="flex-1 h-8 text-xs gap-1.5"
                >
                  <Coins className="h-3 w-3" />
                  Earn Credits
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
