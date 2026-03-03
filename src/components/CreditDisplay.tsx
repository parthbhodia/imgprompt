import { useCredits } from "@/contexts/CreditsContext";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Settings, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatCreditAmount, getCreditStatusMessage, getCreditsColorClass, handleCreditSyncError } from "@/utils/creditUtils";

interface CreditDisplayProps {
  showSyncButton?: boolean;
  compact?: boolean;
  className?: string;
}

export const CreditDisplay = ({ 
  showSyncButton = false, 
  compact = false, 
  className = "" 
}: CreditDisplayProps) => {
  const { credits, plan, status, loading, syncCredits } = useCredits();
  const [syncLoading, setSyncLoading] = useState(false);

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      await syncCredits();
      toast.success(`Credits synced! You now have ${formatCreditAmount(credits)}.`, {
        duration: 3000,
      });
    } catch (error) {
      handleCreditSyncError(error, 'manual credit sync');
    } finally {
      setSyncLoading(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Zap className={`w-4 h-4 ${getCreditsColorClass(credits)}`} />
            <span className={`font-medium ${getCreditsColorClass(credits)}`}>
              {credits}
            </span>
            {credits < 5 && (
              <AlertTriangle className="w-3 h-3 text-orange-500" />
            )}
            {showSyncButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncLoading}
                className="h-6 w-6 p-0"
              >
                {syncLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Settings className="w-3 h-3" />
                )}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading credits...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${getCreditsColorClass(credits)}`} />
            <div>
              <p className={`text-sm font-medium ${getCreditsColorClass(credits)}`}>
                {formatCreditAmount(credits)}
              </p>
              <p className="text-xs text-muted-foreground">
                {getCreditStatusMessage(credits, plan || undefined)}
              </p>
              {plan && status === "active" && (
                <p className="text-xs text-primary capitalize">{plan} plan</p>
              )}
            </div>
            {credits < 5 && (
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            )}
          </div>
          {showSyncButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncLoading}
              className="gap-1"
            >
              {syncLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Settings className="w-3 h-3" />
              )}
              Sync
            </Button>
          )}
        </>
      )}
    </div>
  );
};

import { useState } from "react";
