import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, TrendingDown, TrendingUp, Gift, Share2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "spend_standard" | "spend_hd" | "spend_batch" | "earn_daily_login" | "earn_share" | "earn_community" | "purchase" | "bonus";
  amount: number;
  balance_after: number;
  created_at: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  spend_standard: {
    label: "Standard Generation",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-red-600 dark:text-red-400",
  },
  spend_hd: {
    label: "HD Generation",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-red-600 dark:text-red-400",
  },
  spend_batch: {
    label: "Batch Generation",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-red-600 dark:text-red-400",
  },
  earn_daily_login: {
    label: "Daily Login Bonus",
    icon: <Gift className="h-3.5 w-3.5" />,
    color: "text-green-600 dark:text-green-400",
  },
  earn_share: {
    label: "Share Creation",
    icon: <Share2 className="h-3.5 w-3.5" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  earn_community: {
    label: "Community Engagement",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    color: "text-purple-600 dark:text-purple-400",
  },
  purchase: {
    label: "Credit Purchase",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    color: "text-green-600 dark:text-green-400",
  },
  bonus: {
    label: "Bonus Credits",
    icon: <Gift className="h-3.5 w-3.5" />,
    color: "text-green-600 dark:text-green-400",
  },
};

export function TransactionHistory({ transactions, isLoading = false }: TransactionHistoryProps) {
  const [sortedTransactions, setSortedTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // Sort by date descending (newest first)
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setSortedTransactions(sorted);
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sortedTransactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground">No transactions yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 pr-4">
        {sortedTransactions.map((transaction) => {
          const config = typeConfig[transaction.type];
          const isSpend = transaction.amount < 0;
          const displayAmount = Math.abs(transaction.amount);

          return (
            <div
              key={transaction.id}
              className="px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className={cn("mt-0.5 flex-shrink-0", config.color)}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[11px]">{config.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(transaction.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      "font-semibold text-[11px]",
                      isSpend
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    )}
                  >
                    {isSpend ? "-" : "+"}
                    {displayAmount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Balance: {transaction.balance_after.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
