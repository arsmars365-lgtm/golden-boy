"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useDemoAuth } from "@/lib/use-demo-auth";
import {
  getFavoritesSnapshot,
  mergeGuestFavorites,
  parseFavoritesSnapshot,
  SERVER_FAVORITES_SNAPSHOT,
  setFavorite,
  subscribeToFavorites,
} from "@/lib/favorites";

type FavoritesContextValue = {
  favoriteIds: string[];
  error: string;
  isReady: boolean;
  toggleFavorite: (itemId: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady: authReady } = useDemoAuth();
  const userId = authReady ? user?.id ?? null : null;
  const getSnapshot = useMemo(
    () => () => getFavoritesSnapshot(userId),
    [userId],
  );
  const snapshot = useSyncExternalStore(
    subscribeToFavorites,
    getSnapshot,
    () => SERVER_FAVORITES_SNAPSHOT,
  );
  const { favoriteIds, snapshotError } = useMemo(() => {
    try {
      return { favoriteIds: parseFavoritesSnapshot(snapshot), snapshotError: "" };
    } catch (error) {
      return {
        favoriteIds: [],
        snapshotError:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить избранное.",
      };
    }
  }, [snapshot]);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!authReady || !userId) return;

    try {
      mergeGuestFavorites(userId);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось синхронизировать избранное с аккаунтом.",
      );
    }
  }, [authReady, userId]);

  function toggleFavorite(itemId: string) {
    if (!authReady || snapshot === SERVER_FAVORITES_SNAPSHOT) return;

    setActionError("");
    try {
      setFavorite(itemId, userId, !favoriteIds.includes(itemId));
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Не удалось обновить список избранного.",
      );
    }
  }

  return (
    <FavoritesContext.Provider
      value={{
        favoriteIds,
        error: snapshotError || actionError,
        isReady: authReady && snapshot !== SERVER_FAVORITES_SNAPSHOT,
        toggleFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
}
