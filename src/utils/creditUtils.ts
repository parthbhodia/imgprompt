import { toast } from 'sonner';

export interface CreditValidationResult {
  isValid: boolean;
  error?: string;
  credits?: number;
}

export const validateCreditUpdate = (newCredits: number, oldCredits: number): CreditValidationResult => {
  // Check if credits is a valid number
  if (typeof newCredits !== 'number' || isNaN(newCredits)) {
    return {
      isValid: false,
      error: 'Invalid credit amount received',
    };
  }

  // Check if credits are negative
  if (newCredits < 0) {
    return {
      isValid: false,
      error: 'Credits cannot be negative',
    };
  }

  // Check for suspicious credit jumps (more than 1000 credits at once)
  if (Math.abs(newCredits - oldCredits) > 1000) {
    console.warn(`Suspicious credit jump detected: ${oldCredits} -> ${newCredits}`);
  }

  return {
    isValid: true,
    credits: newCredits,
  };
};

export const handleCreditSyncError = (error: unknown, context: string = 'credit sync'): void => {
  console.error(`Error in ${context}:`, error);
  
  let errorMessage = 'An error occurred while updating credits.';
  
  if (error instanceof Error) {
    if (error.message.includes('503') || error.message.includes('service unavailable')) {
      errorMessage = 'Credit service is temporarily unavailable. Please try again in a moment.';
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      errorMessage = 'Authentication error. Please sign in again.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else {
      errorMessage = error.message;
    }
  }
  
  toast.error(errorMessage, {
    duration: 5000,
    action: {
      label: 'Retry',
      onClick: () => {
        // Dispatch custom event for retry
        window.dispatchEvent(new CustomEvent('retryCreditSync'));
      },
    },
  });
};

export const formatCreditAmount = (credits: number): string => {
  if (credits === 1) return '1 credit';
  return `${credits.toLocaleString()} credits`;
};

export const getCreditStatusMessage = (credits: number, plan?: string): string => {
  if (credits === 0) {
    return plan ? `Your ${plan} plan credits have been used up` : 'No credits remaining';
  } else if (credits < 5) {
    return `Only ${formatCreditAmount(credits)} remaining`;
  } else if (credits < 20) {
    return `${formatCreditAmount(credits)} available`;
  } else {
    return `${formatCreditAmount(credits)} available`;
  }
};

export const shouldShowUpgradePrompt = (credits: number, hasActivePlan: boolean): boolean => {
  return !hasActivePlan && credits < 5;
};

export const getCreditsRemainingPercentage = (credits: number, maxCredits: number): number => {
  if (maxCredits <= 0) return 0;
  return Math.min(100, Math.max(0, (credits / maxCredits) * 100));
};

export const getCreditsColorClass = (credits: number): string => {
  if (credits === 0) return 'text-red-500';
  if (credits < 5) return 'text-orange-500';
  if (credits < 20) return 'text-yellow-500';
  return 'text-green-500';
};
