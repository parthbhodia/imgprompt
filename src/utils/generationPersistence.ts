const GENERATION_STATE_KEY = 'vibeimg_generation_state';

interface GenerationState {
  isGenerating: boolean;
  prompt: string;
  sessionId: string | null;
  startTime: number | null;
  estimatedDuration: number;
}

export const persistGenerationState = (state: GenerationState): void => {
  try {
    localStorage.setItem(GENERATION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist generation state:', error);
  }
};

export const getGenerationState = (): GenerationState | null => {
  try {
    const stored = localStorage.getItem(GENERATION_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Failed to get generation state:', error);
    return null;
  }
};

export const clearGenerationState = (): void => {
  try {
    localStorage.removeItem(GENERATION_STATE_KEY);
  } catch (error) {
    console.error('Failed to clear generation state:', error);
  }
};
