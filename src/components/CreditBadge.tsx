import { useState } from "react";
import { Coins, TrendingUp, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CreditBadgeProps {
  balance: number | null;
  onEarnClick?: () => void;
  isLow?: boolean;
}

export function CreditBadge({ balance, onEarnClick, isLow = false }: CreditBadgeProps) {
  const [open, setOpen] = useState(false);

  if (balance === null) return null;

  const displayBalance = balance.toFixed(1);
  const isVeryLow = balance < 1;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all",
            isVeryLow
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
              : isLow
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          <Coins className="h-4 w-4" />
          <span>{displayBalance}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        {/* Header */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Credits</h3>
            <div
              className={cn(
                "text-2xl font-bold",
                isVeryLow
                  ? "text-destructive"
                  : isLow
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-primary"
              )}
            >
              {displayBalance}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isVeryLow
              ? "You're running low on credits"
              : isLow
              ? "Consider earning more credits"
              : "You have enough credits"}
          </p>
        </div>

        <DropdownMenuSeparator />

        {/* Breakdown */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">How to earn:</p>
          
          <div className="space-y-2">
            {/* Daily Login */}
            <button
              onClick={() => {
                onEarnClick?.();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
            >
              <div className="flex items-start gap-2">
                <Gift className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs">Daily Login</p>
                  <p className="text-[10px] text-muted-foreground">+1 credit per day</p>
                </div>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex-shrink-0">
                  +1
                </span>
              </div>
            </button>

            {/* Share Creation */}
            <div className="px-3 py-2 rounded-lg bg-muted/30 text-sm">
              <div className="flex items-start gap-2">
                <Share2 className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs">Share Creation</p>
                  <p className="text-[10px] text-muted-foreground">+1 credit per share</p>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                  +1
                </span>
              </div>
            </div>

            {/* Community Engagement */}
            <div className="px-3 py-2 rounded-lg bg-muted/30 text-sm">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs">Community Engagement</p>
                  <p className="text-[10px] text-muted-foreground">+0.5 credit per action</p>
                </div>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex-shrink-0">
                  +0.5
                </span>
              </div>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Generation Costs */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Generation costs:</p>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="px-2 py-1.5 rounded-lg bg-muted/50 text-center">
              <p className="font-medium">Standard</p>
              <p className="text-muted-foreground">-1</p>
            </div>
            <div className="px-2 py-1.5 rounded-lg bg-muted/50 text-center">
              <p className="font-medium">HD</p>
              <p className="text-muted-foreground">-2</p>
            </div>
            <div className="px-2 py-1.5 rounded-lg bg-muted/50 text-center">
              <p className="font-medium">Batch</p>
              <p className="text-muted-foreground">-3</p>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
