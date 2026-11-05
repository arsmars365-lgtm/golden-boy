export const SERVER_FAVORITES_SNAPSHOT = "\u0000server-favorites";

const GUEST_FAVORITES_KEY = "foundly-favorites-v1:guest";
const USER_FAVORITES_PREFIX = "foundly-favorites-v1:";
const FAVORITES_EVENT = "foundly-favorites-updated";
const STORAGE_ERROR_PREFIX = "\u0000favorites-storage-error:";

function getStorageKey(userId: string | null): string {
  return userId
    ? `${USER_FAVORITES_PREFIX}${userId}`
    : GUEST_FAVORITES_KEY;
}

function readFavoriteIds(key: string): string[] {
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error("Список избранного повреждён.");
  }

  if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) {
    throw new Error("Не удалось прочитать список избранного.");
  }

  return [...new Set(value)];
}

function notifyFavoritesChanged() {
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

export function getFavoritesSnapshot(userId: string | null): string {
  try {
    return window.localStorage.getItem(getStorageKey(userId)) ?? "[]";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Хранилище браузера недоступно.";
    return `${STORAGE_ERROR_PREFIX}${message}`;
  }
}

export function parseFavoritesSnapshot(snapshot: string): string[] {
  if (snapshot.startsWith(STORAGE_ERROR_PREFIX)) {
    throw new Error(snapshot.slice(STORAGE_ERROR_PREFIX.length));
  }
  if (snapshot === SERVER_FAVORITES_SNAPSHOT) return [];

  let value: unknown;
  try {
    value = JSON.parse(snapshot);
  } catch {
    throw new Error("Список избранного повреждён.");
  }

  if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) {
    throw new Error("Не удалось прочитать список избранного.");
  }

  return [...new Set(value)];
}

export function subscribeToFavorites(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(FAVORITES_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(FAVORITES_EVENT, callback);
  };
}

export function setFavorite(
  itemId: string,
  userId: string | null,
  isFavorite: boolean,
): void {
  const storageKey = getStorageKey(userId);
  const favoriteIds = readFavoriteIds(storageKey);
  const nextIds = isFavorite
    ? [...new Set([...favoriteIds, itemId])]
    : favoriteIds.filter((id) => id !== itemId);

  if (nextIds.length === favoriteIds.length) return;

  window.localStorage.setItem(storageKey, JSON.stringify(nextIds));
  notifyFavoritesChanged();
}

export function mergeGuestFavorites(userId: string): void {
  const guestIds = readFavoriteIds(GUEST_FAVORITES_KEY);
  if (guestIds.length === 0) return;

  const userKey = getStorageKey(userId);
  const userIds = readFavoriteIds(userKey);
  window.localStorage.setItem(
    userKey,
    JSON.stringify([...new Set([...userIds, ...guestIds])]),
  );
  window.localStorage.removeItem(GUEST_FAVORITES_KEY);
  notifyFavoritesChanged();
}