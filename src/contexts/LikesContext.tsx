import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLikeCounts,
  fetchUserLikes,
  fetchUserFavorites,
  toggleLike as apiToggleLike,
  toggleFavorite as apiToggleFavorite,
} from "@/lib/supabase";

interface LikesContextValue {
  /** Global like counts keyed by prompt id. */
  likeCounts: Record<number, number>;
  /** Set of prompt ids the current user has liked. */
  userLikes: Set<number>;
  /** Set of prompt ids the current user has favorited. */
  userFavorites: Set<number>;
  /** Whether initial data has loaded. */
  loaded: boolean;
  /** Toggle like for a prompt. Returns true on success. */
  toggleLike: (promptId: number) => Promise<boolean>;
  /** Toggle favorite for a prompt. Returns true on success. */
  toggleFavorite: (promptId: number) => Promise<boolean>;
}

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

/**
 * Hook to access the shared likes/favorites state.
 * Can be used in any component wrapped by <LikesProvider>.
 */
export const useLikes = () => {
  const ctx = useContext(LikesContext);
  if (!ctx)
    throw new Error("useLikes must be used inside <LikesProvider>");
  return ctx;
};

export const LikesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [userLikes, setUserLikes] = useState<Set<number>>(new Set());
  const [userFavorites, setUserFavorites] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load global like counts (always, even for anonymous visitors)
  useEffect(() => {
    fetchLikeCounts()
      .then(setLikeCounts)
      .catch(() => {});
  }, []);

  // Load user-specific likes and favorites when signed in
  useEffect(() => {
    if (!user) {
      setUserLikes(new Set());
      setUserFavorites(new Set());
      setLoaded(true);
      return;
    }
    Promise.all([fetchUserLikes(user.id), fetchUserFavorites(user.id)])
      .then(([likes, favs]) => {
        setUserLikes(likes);
        setUserFavorites(favs);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user]);

  const toggleLike = useCallback(
    async (promptId: number) => {
      if (!user) return false;
      const isLiked = userLikes.has(promptId);
      setUserLikes((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(promptId);
        else next.add(promptId);
        return next;
      });
      setLikeCounts((prev) => ({
        ...prev,
        [promptId]: (prev[promptId] ?? 0) + (isLiked ? -1 : 1),
      }));
      try {
        await apiToggleLike(user.id, promptId, isLiked);
        return true;
      } catch {
        setUserLikes((prev) => {
          const next = new Set(prev);
          if (isLiked) next.add(promptId);
          else next.delete(promptId);
          return next;
        });
        setLikeCounts((prev) => ({
          ...prev,
          [promptId]: (prev[promptId] ?? 0) + (isLiked ? 1 : -1),
        }));
        return false;
      }
    },
    [user, userLikes]
  );

  const toggleFavorite = useCallback(
    async (promptId: number) => {
      if (!user) return false;
      const isFav = userFavorites.has(promptId);
      setUserFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(promptId);
        else next.add(promptId);
        return next;
      });
      try {
        await apiToggleFavorite(user.id, promptId, isFav);
        return true;
      } catch {
        setUserFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(promptId);
          else next.delete(promptId);
          return next;
        });
        return false;
      }
    },
    [user, userFavorites]
  );

  return (
    <LikesContext.Provider
      value={{
        likeCounts,
        userLikes,
        userFavorites,
        loaded,
        toggleLike,
        toggleFavorite,
      }}
    >
      {children}
    </LikesContext.Provider>
  );
};
