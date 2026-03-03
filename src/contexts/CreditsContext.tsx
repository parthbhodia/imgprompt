import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus, syncCreditsFromStripe, type SubscriptionStatus } from '@/lib/api';
import { toast } from 'sonner';

interface CreditsContextType {
  credits: number;
  plan: string | null;
  status: string | null;
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
  const [loading, setLoading] = useState<boolean>(true);

  const token = session?.access_token ?? null;

  // Refresh credits from the server
  const refreshCredits = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const subscriptionStatus = await getSubscriptionStatus(token);
      setCredits(subscriptionStatus.credits);
      setPlan(subscriptionStatus.plan);
      setStatus(subscriptionStatus.status);
    } catch (error) {
      console.error('Failed to refresh credits:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync credits from Stripe (more aggressive update)
  const syncCredits = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const result = await syncCreditsFromStripe(token);
      setCredits(result.credits);
      setPlan(result.plan);
      setStatus('active');
      toast.success(`Credits synced! You now have ${result.credits} credits.`, {
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to sync credits:', error);
      toast.error('Could not sync credits. Please try again.');
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
