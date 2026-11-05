"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { useDemoAuth } from "@/lib/use-demo-auth";
import { useItemNotifications } from "@/lib/use-item-notifications";
import { getUnreadChatCount, subscribeToConversations } from "@/lib/chat";

export default function HeaderAccount() {
  const { t } = useLanguage();
  const { user, isReady, error: sessionError } = useDemoAuth();
  const { unreadCount } = useItemNotifications();
  const [chatStatus, setChatStatus] = useState<{
    userId: string;
    count: number;
    error: string;
  } | null>(null);

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

  if (!isReady) {
    return (
      <div className="header-actions">
        <Link className="login-button" href="/login">
          Войти
        </Link>
        <Button className="publish-button" variant="contained" href="/add">
          <span aria-hidden="true">＋</span> Разместить объявление
        </Button>
      </div>
    );
  }

  return (
    <div className="header-account">
      {user ? (
        <>
          <Link
            aria-label={t("nav.messages")}
            className="header-messages-link"
            href="/messages"
            title={t("nav.messages")}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.1A7.5 7.5 0 1 1 20 11.5Z" />
              <path d="M8.5 11.5h7M8.5 14.5h4" />
            </svg>
            {unreadChatCount > 0 && (
              <span className="notification-count-badge">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
          </Link>
          <Link
            aria-label={`Уведомления о похожих находках${unreadCount ? `, непрочитанных: ${unreadCount}` : ""}`}
            className="header-notifications-link"
            href="/profile?tab=notifications"
            title="Уведомления"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
            {unreadCount > 0 && <span className="notification-count-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </Link>
          <Link
            aria-label="Перейти в профиль"
            className="header-user-avatar"
            href="/profile"
            title="Профиль"
          >
            {(user.name || "U").slice(0, 1).toLocaleUpperCase("en-US")}
          </Link>
        </>
      ) : (
        <>
          <Link className="login-button" href="/login">
            Войти
          </Link>
          <Link className="register-header-link" href="/register">
            Регистрация
          </Link>
        </>
      )}
      <Button className="publish-button" variant="contained" href="/add">
        <span aria-hidden="true">＋</span> Разместить объявление
      </Button>
      {(sessionError || chatError) && (
        <span className="header-auth-error" role="status">
          {sessionError || chatError}
        </span>
      )}
    </div>
  );
}
