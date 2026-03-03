import { useEffect, useRef } from 'react';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';

export const useRealTimeCredits = () => {
  const { refreshCredits } = useCredits();
  const { session } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!session) {
      // Clear interval when user logs out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set up polling for credit updates
    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Poll every 30 seconds for credit updates
      intervalRef.current = setInterval(async () => {
        try {
          await refreshCredits();
          lastUpdateRef.current = Date.now();
        } catch (error) {
          console.error('Failed to refresh credits in real-time:', error);
        }
      }, 30000); // 30 seconds
    };

    // Start polling immediately
    startPolling();

    // Set up visibility change listener to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Refresh credits when user returns to the tab
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
        if (timeSinceLastUpdate > 10000) { // If more than 10 seconds since last update
          refreshCredits().catch(console.error);
          lastUpdateRef.current = Date.now();
        }
      }
    };

    // Set up focus listener for window
    const handleFocus = () => {
      refreshCredits().catch(console.error);
      lastUpdateRef.current = Date.now();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, refreshCredits]);

  // Manual refresh function
  const forceRefresh = async () => {
    try {
      await refreshCredits();
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error('Failed to force refresh credits:', error);
      throw error;
    }
  };

  return {
    forceRefresh,
    isPolling: !!intervalRef.current,
    lastUpdate: lastUpdateRef.current,
  };
};
