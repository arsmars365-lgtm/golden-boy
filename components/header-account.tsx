"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Link from "next/link";
import { logoutDemoUser } from "@/lib/demo-auth";
import { useDemoAuth } from "@/lib/use-demo-auth";
import { useItemNotifications } from "@/lib/use-item-notifications";

export default function HeaderAccount() {
  const { user, isReady, error: sessionError } = useDemoAuth();
  const { unreadCount } = useItemNotifications();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLogoutError("");
    try {
      await logoutDemoUser();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Не удалось выйти из аккаунта.",
      );
    }
  }

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
          <Link className="header-user-name" href="/profile">{user.name}</Link>
          <Button className="logout-button" onClick={handleLogout}>
            Выйти
          </Button>
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
      {(sessionError || logoutError) && (
        <span className="header-auth-error" role="status">
          {sessionError || logoutError}
        </span>
      )}
    </div>
  );
}
