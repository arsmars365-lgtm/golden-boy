"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getSimilarFoundItems } from "@/lib/item-matching";
import { getStoredItems, type Item } from "@/lib/items";
import { getSupabaseClient } from "@/lib/supabase";
import { useDemoAuth } from "@/lib/use-demo-auth";

export type ItemNotification = {
  id: string;
  lostItemId: string;
  lostTitle: string;
  foundItemId: string;
  foundTitle: string;
  foundPlace: string;
  createdAt: string;
  read: boolean;
};

export type ItemSubscription = {
  itemId: string;
  title: string;
  createdAt: string;
};

const NOTIFICATIONS_EVENT = "foundly-notifications-updated";
const PERMISSION_EVENT = "foundly-notification-permission-changed";
export const OPEN_NOTIFICATIONS_EVENT = "foundly-open-notifications";
const STORAGE_ERROR = "__foundly_notifications_storage_error__";

function storageKey(userId: string) {
  return `foundly-item-notifications-v1:${userId}`;
}

function subscriptionsStorageKey(userId: string) {
  return `foundly-item-subscriptions-v1:${userId}`;
}

function subscribeToNotifications(callback: () => void) {
  window.addEventListener(NOTIFICATIONS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(NOTIFICATIONS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getNotificationSnapshot(userId: string | null) {
  if (!userId) return "[]";
  try {
    return window.localStorage.getItem(storageKey(userId)) ?? "[]";
  } catch {
    return STORAGE_ERROR;
  }
}

function getSubscriptionSnapshot(userId: string | null) {
  if (!userId) return "[]";
  try {
    return window.localStorage.getItem(subscriptionsStorageKey(userId)) ?? "[]";
  } catch {
    return STORAGE_ERROR;
  }
}

function parseNotifications(snapshot: string): { notifications: ItemNotification[]; error: string } {
  if (snapshot === STORAGE_ERROR) {
    return { notifications: [], error: "Браузер не разрешил доступ к уведомлениям." };
  }
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) throw new Error();
    const notifications = parsed.filter((value): value is ItemNotification =>
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      typeof value.id === "string" &&
      "lostItemId" in value &&
      typeof value.lostItemId === "string" &&
      "lostTitle" in value &&
      typeof value.lostTitle === "string" &&
      "foundItemId" in value &&
      typeof value.foundItemId === "string" &&
      "foundTitle" in value &&
      typeof value.foundTitle === "string" &&
      "foundPlace" in value &&
      typeof value.foundPlace === "string" &&
      "createdAt" in value &&
      typeof value.createdAt === "string" &&
      "read" in value &&
      typeof value.read === "boolean",
    );
    if (notifications.length !== parsed.length) throw new Error();
    return { notifications, error: "" };
  } catch {
    return {
      notifications: [],
      error: "Сохранённые уведомления повреждены. Очистите данные сайта и войдите снова.",
    };
  }
}

function writeNotifications(userId: string, notifications: ItemNotification[]) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(notifications));
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
}

function parseSubscriptions(snapshot: string): { subscriptions: ItemSubscription[]; error: string } {
  if (snapshot === STORAGE_ERROR) {
    return { subscriptions: [], error: "Браузер не разрешил доступ к подпискам." };
  }
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) throw new Error();
    const subscriptions = parsed.filter((value): value is ItemSubscription =>
      typeof value === "object" &&
      value !== null &&
      "itemId" in value &&
      typeof value.itemId === "string" &&
      "title" in value &&
      typeof value.title === "string" &&
      "createdAt" in value &&
      typeof value.createdAt === "string",
    );
    if (subscriptions.length !== parsed.length) throw new Error();
    return { subscriptions, error: "" };
  } catch {
    return {
      subscriptions: [],
      error: "Сохранённые подписки повреждены. Очистите данные сайта и войдите снова.",
    };
  }
}

function writeSubscriptions(userId: string, subscriptions: ItemSubscription[]) {
  window.localStorage.setItem(subscriptionsStorageKey(userId), JSON.stringify(subscriptions));
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
}

function subscribeToPermission(callback: () => void) {
  window.addEventListener("focus", callback);
  window.addEventListener(PERMISSION_EVENT, callback);
  return () => {
    window.removeEventListener("focus", callback);
    window.removeEventListener(PERMISSION_EVENT, callback);
  };
}

function getPermissionSnapshot(): NotificationPermission | "unsupported" {
  return "Notification" in window ? window.Notification.permission : "unsupported";
}

type ItemNotificationsState = {
  notifications: ItemNotification[];
  subscriptions: ItemSubscription[];
  unreadCount: number;
  permission: NotificationPermission | "unsupported";
  isConnected: boolean;
  error: string;
  markRead: (notificationId: string) => void;
  markAllRead: () => void;
  isSubscribed: (itemId: string) => boolean;
  subscribeToItem: (item: Pick<Item, "id" | "title">) => boolean;
  unsubscribeFromItem: (itemId: string) => boolean;
  enableBrowserNotifications: () => Promise<void>;
};

const ItemNotificationsContext = createContext<ItemNotificationsState | null>(null);

function useItemNotificationsClient(userId: string | null): ItemNotificationsState {
  const router = useRouter();
  const [syncError, setSyncError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const snapshot = useSyncExternalStore(
    subscribeToNotifications,
    () => getNotificationSnapshot(userId),
    () => "[]",
  );
  const subscriptionsSnapshot = useSyncExternalStore(
    subscribeToNotifications,
    () => getSubscriptionSnapshot(userId),
    () => "[]",
  );
  const permission = useSyncExternalStore<NotificationPermission | "unsupported">(
    subscribeToPermission,
    getPermissionSnapshot,
    () => "default",
  );
  const parsed = useMemo(() => parseNotifications(snapshot), [snapshot]);
  const parsedSubscriptions = useMemo(
    () => parseSubscriptions(subscriptionsSnapshot),
    [subscriptionsSnapshot],
  );

  useEffect(() => {
    if (!userId) return;
    const activeUserId = userId;

    let active = true;
    let connected = false;
    let lostItems: Item[] = [];
    const queuedFoundIds = new Set<string>();

    function addMatches(foundItem: Item, showBrowserNotification: boolean) {
      if (!active || foundItem.type !== "found" || foundItem.status === "returned") return;
      const current = parseNotifications(getNotificationSnapshot(activeUserId));
      const currentSubscriptions = parseSubscriptions(getSubscriptionSnapshot(activeUserId));
      if (current.error) {
        setSyncError(current.error);
        return;
      }
      if (currentSubscriptions.error) {
        setSyncError(currentSubscriptions.error);
        return;
      }

      const additions = lostItems
        .filter((lostItem) =>
          currentSubscriptions.subscriptions.some((subscription) =>
            subscription.itemId === lostItem.id &&
            foundItem.createdAt !== undefined &&
            new Date(foundItem.createdAt).getTime() >= new Date(subscription.createdAt).getTime(),
          ) && lostItem.status !== "returned",
        )
        .filter((lostItem) => getSimilarFoundItems(lostItem, [foundItem]).length > 0)
        .filter((lostItem) => !current.notifications.some(
          (notification) =>
            notification.lostItemId === lostItem.id &&
            notification.foundItemId === foundItem.id,
        ))
        .map((lostItem): ItemNotification => ({
          id: `${lostItem.id}:${foundItem.id}`,
          lostItemId: lostItem.id,
          lostTitle: lostItem.title,
          foundItemId: foundItem.id,
          foundTitle: foundItem.title,
          foundPlace: foundItem.place,
          createdAt: new Date().toISOString(),
          read: false,
        }));

      if (!additions.length) return;
      writeNotifications(
        activeUserId,
        [...additions, ...current.notifications].slice(0, 100),
      );
      setSyncError("");

      if (showBrowserNotification && permission === "granted" && "Notification" in window) {
        for (const notification of additions) {
          const browserNotification = new window.Notification(
            `Похожа находка: ${notification.foundTitle}`,
            {
              body: `Ваша вещь «${notification.lostTitle}» может быть здесь: ${notification.foundPlace}`,
              icon: "/favicon.ico",
              tag: notification.id,
            },
          );
          browserNotification.onclick = () => {
            window.focus();
            router.push(`/item/${encodeURIComponent(notification.foundItemId)}`);
            browserNotification.close();
          };
        }
      }
    }

    function onItemInsert(payload: { new: Record<string, unknown> }) {
      if (payload.new.type !== "found" && payload.new.user_id !== activeUserId) return;
      const id = payload.new.id;
      if (typeof id !== "string") return;
      if (payload.new.type === "found") {
        if (queuedFoundIds.has(id)) return;
        queuedFoundIds.add(id);
      }
      void getStoredItems()
        .then((items) => {
          if (!active) return;
          lostItems = items.filter(
              (item) => item.type === "lost" && item.status !== "returned",
          );
          if (payload.new.type !== "found") {
            for (const foundItem of items.filter(
              (item) => item.type === "found" && item.status !== "returned",
            )) {
              addMatches(foundItem, false);
            }
            return;
          }
          const foundItem = items.find((item) => item.id === id);
          if (foundItem) addMatches(foundItem, true);
        })
        .catch((loadError: unknown) => {
          if (active) {
            if (payload.new.type === "found") queuedFoundIds.delete(id);
            setSyncError(loadError instanceof Error ? loadError.message : "Не удалось проверить новые находки.");
          }
        });
    }

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`foundly-item-notifications-${activeUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items" },
        onItemInsert,
      )
      .subscribe((status, subscriptionError) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          connected = true;
          setIsConnected(true);
          setSyncError("");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          connected = false;
          setIsConnected(false);
          setSyncError(
            subscriptionError?.message ??
              "Не удалось подключить живые уведомления. Проверьте Supabase Realtime.",
          );
        } else if (status === "CLOSED" && connected) {
          connected = false;
          setIsConnected(false);
          setSyncError("Соединение уведомлений с Supabase закрыто.");
        }
      });

    void getStoredItems()
      .then((items) => {
        if (!active) return;
        lostItems = items.filter(
          (item) => item.type === "lost" && item.status !== "returned",
        );
        const foundItems = items.filter(
          (item) => item.type === "found" && item.status !== "returned",
        );
        for (const foundItem of foundItems) addMatches(foundItem, false);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setSyncError(loadError instanceof Error ? loadError.message : "Не удалось загрузить совпадения.");
        }
      });

    return () => {
      active = false;
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [permission, router, userId]);

  const markRead = useCallback((notificationId: string) => {
    if (!userId) return;
    const current = parseNotifications(getNotificationSnapshot(userId));
    if (current.error) {
      setSyncError(current.error);
      return;
    }
    const updated = current.notifications.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    );
    try {
      writeNotifications(userId, updated);
    } catch (writeError) {
      setSyncError(writeError instanceof Error ? writeError.message : "Не удалось обновить уведомление.");
    }
  }, [userId]);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    const current = parseNotifications(getNotificationSnapshot(userId));
    if (current.error) {
      setSyncError(current.error);
      return;
    }
    try {
      writeNotifications(
        userId,
        current.notifications.map((notification) => ({ ...notification, read: true })),
      );
    } catch (writeError) {
      setSyncError(writeError instanceof Error ? writeError.message : "Не удалось обновить уведомления.");
    }
  }, [userId]);

  const enableBrowserNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setSyncError("Этот браузер не поддерживает системные уведомления.");
      return;
    }
    try {
      await window.Notification.requestPermission();
      window.dispatchEvent(new Event(PERMISSION_EVENT));
      setSyncError("");
    } catch (permissionError) {
      setSyncError(
        permissionError instanceof Error
          ? permissionError.message
          : "Не удалось включить системные уведомления.",
      );
    }
  }, []);

  const unreadCount = parsed.notifications.filter((notification) => !notification.read).length;
  const isSubscribed = useCallback(
    (itemId: string) => parsedSubscriptions.subscriptions.some((subscription) => subscription.itemId === itemId),
    [parsedSubscriptions.subscriptions],
  );
  const subscribeToItem = useCallback((item: Pick<Item, "id" | "title">) => {
    if (!userId) return false;
    const current = parseSubscriptions(getSubscriptionSnapshot(userId));
    if (current.error) {
      setSyncError(current.error);
      return false;
    }
    if (current.subscriptions.some((subscription) => subscription.itemId === item.id)) return true;
    try {
      writeSubscriptions(userId, [
        { itemId: item.id, title: item.title, createdAt: new Date().toISOString() },
        ...current.subscriptions,
      ]);
      setSyncError("");
      return true;
    } catch (writeError) {
      setSyncError(writeError instanceof Error ? writeError.message : "Не удалось сохранить подписку.");
      return false;
    }
  }, [userId]);
  const unsubscribeFromItem = useCallback((itemId: string) => {
    if (!userId) return false;
    const current = parseSubscriptions(getSubscriptionSnapshot(userId));
    if (current.error) {
      setSyncError(current.error);
      return false;
    }
    try {
      writeSubscriptions(
        userId,
        current.subscriptions.filter((subscription) => subscription.itemId !== itemId),
      );
      setSyncError("");
      return true;
    } catch (writeError) {
      setSyncError(writeError instanceof Error ? writeError.message : "Не удалось отменить подписку.");
      return false;
    }
  }, [userId]);

  return {
    notifications: parsed.notifications,
    subscriptions: parsedSubscriptions.subscriptions,
    unreadCount,
    permission,
    isConnected,
    error: syncError || parsed.error || parsedSubscriptions.error,
    markRead,
    markAllRead,
    isSubscribed,
    subscribeToItem,
    unsubscribeFromItem,
    enableBrowserNotifications,
  };
}

export function ItemNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useDemoAuth();
  const state = useItemNotificationsClient(user?.id ?? null);
  return createElement(ItemNotificationsContext.Provider, { value: state }, children);
}

export function useItemNotifications() {
  const state = useContext(ItemNotificationsContext);
  if (!state) {
    throw new Error("useItemNotifications must be used within ItemNotificationsProvider.");
  }
  return state;
}
