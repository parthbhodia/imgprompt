import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { persistGenerationState, getGenerationState, clearGenerationState } from '@/utils/generationPersistence';

interface GenerationState {
  isGenerating: boolean;
  prompt: string;
  sessionId: string | null;
  startTime: number | null;
  estimatedDuration: number; // in seconds
}

interface GenerationContextType {
  generationState: GenerationState;
  startGeneration: (prompt: string, sessionId: string) => void;
  stopGeneration: () => void;
  clearGeneration: () => void;
  getElapsedTime: () => number;
  getRemainingTime: () => number;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const useGeneration = () => {
  const context = useContext(GenerationContext);
  if (context === undefined) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
};

interface GenerationProviderProps {
  children: ReactNode;
}

export const GenerationProvider = ({ children }: GenerationProviderProps) => {
  const [generationState, setGenerationState] = useState<GenerationState>({
    isGenerating: false,
    prompt: '',
    sessionId: null,
    startTime: null,
    estimatedDuration: 30, // Default 30 seconds
  });

  // Load persisted state on mount
  useEffect(() => {
    const persistedState = getGenerationState();
    if (persistedState && persistedState.isGenerating) {
      // Check if generation is stale (more than 5 minutes)
      const elapsed = Date.now() - persistedState.startTime;
      if (elapsed > 5 * 60 * 1000) {
        clearGenerationState();
        setGenerationState({
          isGenerating: false,
          prompt: '',
          sessionId: null,
          startTime: null,
          estimatedDuration: 30,
        });
      } else {
        setGenerationState(persistedState);
      }
    }
  }, []);

  // Persist state changes
  useEffect(() => {
    if (generationState.isGenerating) {
      persistGenerationState(generationState);
    } else {
      clearGenerationState();
    }
  }, [generationState]);

  const startGeneration = (prompt: string, sessionId: string) => {
    const newState: GenerationState = {
      isGenerating: true,
      prompt,
      sessionId,
      startTime: Date.now(),
      estimatedDuration: 30,
    };
    setGenerationState(newState);
  };

  const stopGeneration = () => {
    setGenerationState(prev => ({
      ...prev,
      isGenerating: false,
    }));
  };

  const clearGeneration = () => {
    setGenerationState({
      isGenerating: false,
      prompt: '',
      sessionId: null,
      startTime: null,
      estimatedDuration: 30,
    });
  };

  const getElapsedTime = () => {
    if (!generationState.startTime) return 0;
    return Math.floor((Date.now() - generationState.startTime) / 1000);
  };

  const getRemainingTime = () => {
    const elapsed = getElapsedTime();
    return Math.max(0, generationState.estimatedDuration - elapsed);
  };

  const value: GenerationContextType = {
    generationState,
    startGeneration,
    stopGeneration,
    clearGeneration,
    getElapsedTime,
    getRemainingTime,
  };

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
};
