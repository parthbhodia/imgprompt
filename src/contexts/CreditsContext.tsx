import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus, syncCreditsFromStripe, type SubscriptionStatus } from '@/lib/api';
import { toast } from 'sonner';

interface CreditsContextType {
  credits: number;
  plan: string | null;
  status: string | null;
  libraryUnlocked: boolean;
  loading: boolean;
  syncCredits: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
};

interface CreditsProviderProps {
  children: ReactNode;
}

export const CreditsProvider = ({ children }: CreditsProviderProps) => {
  const { session } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [plan, setPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [libraryUnlocked, setLibraryUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const token = session?.access_token ?? null;

  // Refresh credits from the server
  const refreshCredits = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const data = await getSubscriptionStatus(token);
      setCredits(data.credits);
      setPlan(data.plan);
      setStatus(data.status);
      setLibraryUnlocked(Boolean(data.library_unlocked));
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Failed to refresh credits:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Sync credits from Stripe (more aggressive update with retries)
  const syncCredits = async (): Promise<void> => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      // Try multiple times with delays to handle webhook delays
      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Credit sync attempt ${attempt}...`);
          const result = await syncCreditsFromStripe(token);
          
          // Validate the result
          if (result.credits >= 0 && result.plan) {
            setCredits(result.credits);
            setPlan(result.plan);
            setStatus(result.status);
            // Re-check entitlement after Stripe sync
            const sub = await getSubscriptionStatus(token);
            setLibraryUnlocked(Boolean(sub.library_unlocked));
            setLastUpdated(Date.now());
            console.log(`✅ Sync successful: ${result.credits} credits for ${result.plan} plan`);
            return; // Return void instead of the result
          }
        } catch (error) {
          lastError = error;
          console.warn(`Sync attempt ${attempt} failed:`, error);
          
          // Wait before retry (with exponential backoff)
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      // If all attempts failed, throw the last error
      throw lastError;
    } catch (error) {
      console.error('Failed to sync credits after 3 attempts:', error);
      toast.error('Could not sync credits. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Initial load and periodic refresh
  useEffect(() => {
    if (!token) {
      setCredits(0);
      setPlan(null);
      setStatus(null);
      setLibraryUnlocked(false);
      setLoading(false);
      return;
    }

    // Initial load
    refreshCredits();

    // Set up periodic refresh every 5 minutes
    const interval = setInterval(() => {
      refreshCredits();
    }, 5 * 60 * 1000); // 5 minutes

    // Set up visibility change listener to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshCredits();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  // Listen for custom credit update events
  useEffect(() => {
    const handleCreditUpdate = (event: CustomEvent) => {
      const { credits: newCredits, plan: newPlan, status: newStatus } = event.detail;
      setCredits(newCredits);
      setPlan(newPlan);
      setStatus(newStatus);
    };

    window.addEventListener('creditUpdate', handleCreditUpdate as EventListener);
    
    return () => {
      window.removeEventListener('creditUpdate', handleCreditUpdate as EventListener);
    };
  }, []);

  const value: CreditsContextType = {
    credits,
    plan,
    status,
    libraryUnlocked,
    loading,
    syncCredits,
    refreshCredits,
  };

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
};
