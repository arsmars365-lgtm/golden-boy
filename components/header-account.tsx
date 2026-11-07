"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import { useLanguage } from "@/components/language-provider";
import { useDemoAuth } from "@/lib/use-demo-auth";
import { OPEN_NOTIFICATIONS_EVENT, useItemNotifications } from "@/lib/use-item-notifications";
import { getUnreadChatCount, subscribeToConversations } from "@/lib/chat";

type HeaderAccountProps = {
  onUnreadCountsChange: (counts: { chat: number; notifications: number }) => void;
  notificationsOpen: boolean;
  onNotificationsOpenChange: (open: boolean) => void;
};

export default function HeaderAccount({
  onUnreadCountsChange,
  notificationsOpen,
  onNotificationsOpenChange,
}: HeaderAccountProps) {
  const { language, t } = useLanguage();
  const { user, isReady, error: sessionError } = useDemoAuth();
  const {
    notifications,
    subscriptions,
    unreadCount,
    permission,
    isConnected,
    error: notificationsError,
    markRead,
    markAllRead,
    unsubscribeFromItem,
    enableBrowserNotifications,
  } = useItemNotifications();
  const [chatStatus, setChatStatus] = useState<{
    userId: string;
    count: number;
    error: string;
  } | null>(null);
  const notificationPanel = useRef<HTMLElement>(null);
  const notificationCloseButton = useRef<HTMLButtonElement>(null);
  const notificationTrigger = useRef<HTMLElement | null>(null);
  const [notificationPosition, setNotificationPosition] = useState<CSSProperties>();

  const positionNotificationPanel = useCallback((trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const isMobile = window.innerWidth <= 767.98;
    const panelWidth = isMobile ? window.innerWidth - 20 : Math.min(430, window.innerWidth - 30);
    const panelHeight = isMobile
      ? Math.min(window.innerHeight * 0.72, 640)
      : Math.min(window.innerHeight - 72, 700);
    const left = isMobile
      ? 10
      : Math.max(
        10,
        Math.min(
          rect.left + rect.width / 2 - panelWidth / 2,
          window.innerWidth - panelWidth - 10,
        ),
      );
    const preferredTop = isMobile
      ? rect.top - panelHeight - 8
        : rect.top > panelHeight + 20
          ? rect.top - panelHeight - 8
          : rect.bottom + 12;
      const bottomMargin = isMobile ? 10 : 16;
      const top = Math.max(
        10,
        Math.min(preferredTop, window.innerHeight - panelHeight - bottomMargin),
      );

    setNotificationPosition({ left, top });
  }, []);

  const openNotifications = useCallback((trigger: HTMLElement) => {
    notificationTrigger.current = trigger;
    positionNotificationPanel(trigger);
    onNotificationsOpenChange(true);
  }, [onNotificationsOpenChange, positionNotificationPanel]);

  useEffect(() => {
    if (!isReady || !user) return;

    let active = true;
    const refreshUnreadCount = async () => {
      try {
        const count = await getUnreadChatCount();
        if (active) {
          setChatStatus({ userId: user.id, count, error: "" });
        }
      } catch (loadError) {
        if (active) {
          setChatStatus({
            userId: user.id,
            count: 0,
            error: loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить непрочитанные сообщения.",
          });
        }
      }
    };

    void refreshUnreadCount();
    const unsubscribe = subscribeToConversations(
      user.id,
      () => void refreshUnreadCount(),
      (error) => {
        if (active) setChatStatus({ userId: user.id, count: 0, error });
      },
      () => void refreshUnreadCount(),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isReady, user]);

  const unreadChatCount =
    chatStatus && chatStatus.userId === user?.id ? chatStatus.count : 0;
  const chatError =
    chatStatus && chatStatus.userId === user?.id ? chatStatus.error : "";

  useEffect(() => {
    onUnreadCountsChange({ chat: unreadChatCount, notifications: unreadCount });
  }, [onUnreadCountsChange, unreadChatCount, unreadCount]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    notificationCloseButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onNotificationsOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = notificationPanel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [notificationsOpen, onNotificationsOpenChange]);

  useEffect(() => {
    const handleOpenNotifications = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: HTMLElement }>).detail?.trigger
        ?? Array.from(document.querySelectorAll<HTMLElement>(
          ".header-notifications-link, .mobile-notifications-button",
        )).find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      if (trigger) openNotifications(trigger);
      else openNotifications(document.body);
    };
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, handleOpenNotifications);
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, handleOpenNotifications);
  }, [openNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const reposition = () => {
      if (notificationTrigger.current) positionNotificationPanel(notificationTrigger.current);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [notificationsOpen, positionNotificationPanel]);

  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  return (
    <>
      <div className="header-account">
        {!isReady ? (
          <Link className="header-profile-link" href="/login">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="7.5" r="3.5" />
              <path d="M4.5 21c.4-4.1 3.4-6.5 7.5-6.5s7.1 2.4 7.5 6.5" />
            </svg>
            <span>{t("nav.login")}</span>
          </Link>
        ) : user ? (
          <>
          <Link
            aria-label={`${t("nav.chat")}${unreadChatCount ? `: ${unreadChatCount}` : ""}`}
            className="header-messages-link"
            href="/messages"
            title={t("nav.messages")}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.1A7.5 7.5 0 1 1 20 11.5Z" />
              <path d="M8.5 11.5h7M8.5 14.5h4" />
            </svg>
            <span>{t("nav.chat")}</span>
            {unreadChatCount > 0 && (
              <span aria-hidden="true" className="notification-count-badge">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
          </Link>
          <Link
            aria-label={t("nav.favorites")}
            className="header-favorites-link"
            href="/favorites"
            title={t("nav.favorites")}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M20.8 8.7c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z" />
            </svg>
          </Link>
          <button
            aria-controls="header-notifications-panel"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            aria-label={`${t("nav.notifications")}${unreadCount ? `: ${unreadCount}` : ""}`}
            className="header-notifications-link"
            onClick={(event) => {
              if (notificationsOpen) {
                onNotificationsOpenChange(false);
              } else {
                openNotifications(event.currentTarget);
              }
            }}
            title={t("nav.notifications")}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
            {unreadCount > 0 && (
              <span aria-hidden="true" className="notification-count-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <Link
            aria-label={t("nav.profile")}
            className="header-profile-link"
            href="/profile"
            title={t("nav.profile")}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="7.5" r="3.5" />
              <path d="M4.5 21c.4-4.1 3.4-6.5 7.5-6.5s7.1 2.4 7.5 6.5" />
            </svg>
            <span>{t("nav.profile")}</span>
          </Link>
          </>
        ) : (
          <>
          <button
            aria-controls="header-notifications-panel"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            aria-label={`${t("nav.notifications")}${unreadCount ? `: ${unreadCount}` : ""}`}
            className="header-notifications-link"
            onClick={(event) => {
              if (notificationsOpen) {
                onNotificationsOpenChange(false);
              } else {
                openNotifications(event.currentTarget);
              }
            }}
            title={t("nav.notifications")}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
            {unreadCount > 0 && (
              <span aria-hidden="true" className="notification-count-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <Link
            aria-label={t("nav.favorites")}
            className="header-favorites-link"
            href="/favorites"
            title={t("nav.favorites")}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M20.8 8.7c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z" />
            </svg>
          </Link>
          <Link className="header-profile-link" href="/login">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="7.5" r="3.5" />
              <path d="M4.5 21c.4-4.1 3.4-6.5 7.5-6.5s7.1 2.4 7.5 6.5" />
            </svg>
            <span>{t("nav.login")}</span>
          </Link>
          </>
        )}
        {(sessionError || chatError) && (
          <span className="header-auth-error" role="status">
            {sessionError || chatError}
          </span>
        )}
      </div>
      {notificationsOpen && (
        <>
          <button
            aria-label={t("notifications.close")}
            className="notification-popover-backdrop"
            onClick={() => onNotificationsOpenChange(false)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-labelledby="header-notifications-title"
            aria-modal="true"
            className="notification-popover"
            id="header-notifications-panel"
            ref={notificationPanel}
            role="dialog"
            style={notificationPosition}
          >
            <header className="notification-popover-header">
              <h2 id="header-notifications-title">{t("nav.notifications")}</h2>
              <div>
                {unreadCount > 0 && (
                  <button className="notification-mark-all" onClick={markAllRead} type="button">
                    {t("notifications.markAllRead")}
                  </button>
                )}
                <button
                  aria-label={t("notifications.close")}
                  className="notification-close"
                  onClick={() => onNotificationsOpenChange(false)}
                  ref={notificationCloseButton}
                  type="button"
                >
                  ×
                </button>
              </div>
            </header>
            {!isReady ? (
              <div className="notification-popover-empty">
                <p>{t("chat.searching")}</p>
              </div>
            ) : !user ? (
              <div className="notification-popover-empty">
                <p>{t("notifications.loginPrompt")}</p>
                <Link href="/login" onClick={() => onNotificationsOpenChange(false)}>
                  {t("nav.login")}
                </Link>
              </div>
            ) : (
              <>
                {notificationsError && <Alert severity="error">{notificationsError}</Alert>}
                <div className="notification-popover-body">
                  {notifications.length ? (
                    <div className="notification-popover-list">
                      {notifications.map((notification) => (
                        <article
                          className={`notification-popover-item${notification.read ? "" : " is-unread"}`}
                          key={notification.id}
                        >
                          <span aria-hidden="true" className="notification-popover-item-icon">✦</span>
                          <div>
                            <span className="match-label">
                              {notification.read
                                ? t("notifications.match")
                                : t("notifications.newMatch")}
                            </span>
                            <h3>{t("notifications.foundPrefix")} {notification.foundTitle}</h3>
                            <p>{notification.lostTitle} · {notification.foundPlace}</p>
                            <time dateTime={notification.createdAt}>
                              {new Intl.DateTimeFormat(locale, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }).format(new Date(notification.createdAt))}
                            </time>
                            <Link
                              href={`/item/${encodeURIComponent(notification.foundItemId)}`}
                              onClick={() => {
                                markRead(notification.id);
                                onNotificationsOpenChange(false);
                              }}
                            >
                              {t("notifications.openFound")}
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-popover-empty">
                      <svg aria-hidden="true" className="notification-empty-art" fill="none" viewBox="0 0 220 190">
                        <path d="M42 135h136v27H42z" fill="#F9DC38" />
                        <path d="M42 135h34v27H42z" fill="#C9C56D" />
                        <path d="M42 135l18-18h100l18 18H42Z" fill="#00383B" />
                        <path d="M42 117a68 68 0 0 1 136 0H42Z" fill="#F9DC38" />
                        <path d="M42 117a68 68 0 0 1 34-58v58H42Z" fill="#C9C56D" />
                        <path d="m75 22 17-4 3 6-14 3 7 34-8 2-5-41Z" fill="#00383B" />
                        <circle cx="86" cy="58" r="10" fill="#00383B" />
                        <path d="m146 19 29 7-9 37-8-2 7-30-13-3-5 24-8-2 7-31Z" fill="#00383B" />
                        <circle cx="160" cy="63" r="9" fill="#00383B" />
                        <circle cx="111" cy="26" r="10" fill="#F9DC38" />
                      </svg>
                      <h3>{t("notifications.emptyTitle")}</h3>
                      <p>{t("notifications.emptyDescription")}</p>
                    </div>
                  )}
                  {subscriptions.length > 0 && (
                    <details className="notification-subscriptions">
                      <summary>{t("notifications.subscriptions")} ({subscriptions.length})</summary>
                      <div>
                        {subscriptions.map((subscription) => (
                          <article key={subscription.itemId}>
                            <Link
                              href={`/item/${encodeURIComponent(subscription.itemId)}`}
                              onClick={() => onNotificationsOpenChange(false)}
                            >
                              {subscription.title}
                            </Link>
                            <button onClick={() => unsubscribeFromItem(subscription.itemId)} type="button">
                              {t("notifications.unsubscribe")}
                            </button>
                          </article>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <footer className="notification-popover-footer">
                  <span className={`notification-connection ${isConnected ? "is-connected" : ""}`}>
                    <span aria-hidden="true" />
                    {isConnected ? t("notifications.online") : t("notifications.connecting")}
                  </span>
                  {permission === "default" && (
                    <button onClick={() => void enableBrowserNotifications()} type="button">
                      {t("notifications.enableBrowser")}
                    </button>
                  )}
                  {permission === "granted" && <span>{t("notifications.browserEnabled")}</span>}
                  {permission === "denied" && <span>{t("notifications.browserDenied")}</span>}
                  {permission === "unsupported" && <span>{t("notifications.browserUnsupported")}</span>}
                </footer>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
