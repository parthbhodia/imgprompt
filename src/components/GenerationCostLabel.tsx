import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface GenerationCostLabelProps {
  cost: number;
  userBalance: number | null;
  disabled?: boolean;
  className?: string;
}

export function GenerationCostLabel({
  cost,
  userBalance,
  disabled = false,
  className,
}: GenerationCostLabelProps) {
  const hasEnoughCredits = userBalance !== null && userBalance >= cost;
  const isInsufficient = userBalance !== null && userBalance < cost;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
        disabled || isInsufficient
          ? "bg-destructive/20 text-destructive"
          : "bg-primary/10 text-primary",
        className
      )}
    >
      <Coins className="h-3 w-3" />
      <span>{cost}</span>
      {isInsufficient && <span className="text-[10px]">insufficient</span>}
    </div>
  );
}
