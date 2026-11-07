"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import HeaderAccount from "@/components/header-account";
import ThemeToggle from "@/components/theme-toggle";
import { OPEN_NOTIFICATIONS_EVENT } from "@/lib/use-item-notifications";
import type { Language } from "@/lib/messages";

type SiteHeaderProps = {
  active?: "feed" | "add" | "item" | "about" | "favorites" | "messages" | "none";
};

export default function SiteHeader({ active = "none" }: SiteHeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [unreadCounts, setUnreadCounts] = useState({ chat: 0, notifications: 0 });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner container">
        <Link className="brand" href="/" aria-label={t("brand.home")}>
          <span>foundly</span>
        </Link>
        <Link className="header-home-link" href="/">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
          </svg>
          <span>{t("nav.homeScreen")}</span>
        </Link>

        <div className="header-actions">
          <div className="header-language-switch" aria-label={t("language.label")}>
            {([
              ["kk", "Қаз", "Қазақша"],
              ["ru", "Рус", "Русский"],
              ["en", "Eng", "English"],
            ] as const).map(([value, shortLabel, label]) => (
              <button
                aria-label={label}
                aria-pressed={language === value}
                className={language === value ? "active" : ""}
                key={value}
                onClick={() => setLanguage(value satisfies Language)}
                type="button"
              >
                {shortLabel}
              </button>
            ))}
          </div>
          <HeaderAccount
            notificationsOpen={notificationsOpen}
            onNotificationsOpenChange={setNotificationsOpen}
            onUnreadCountsChange={setUnreadCounts}
          />
          <ThemeToggle />
          <Link className="header-publish-link" href="/add">
            <span aria-hidden="true">＋</span>
            {t("nav.publish")}
          </Link>
        </div>
      </div>
      <nav className="mobile-tab-bar" aria-label="Основная навигация">
        <Link href="/" aria-current={active === "feed" ? "page" : undefined} aria-label="Главная"><span aria-hidden="true">⌂</span><small>Главная</small></Link>
        <Link href="/#feed" aria-label="Поиск"><span aria-hidden="true">⌕</span><small>Поиск</small></Link>
        <Link href="/add" aria-current={active === "add" ? "page" : undefined} aria-label="Добавить"><span aria-hidden="true">＋</span><small>Добавить</small></Link>
        <Link href="/about" aria-current={active === "about" ? "page" : undefined} aria-label="О нас"><span aria-hidden="true">ⓘ</span><small>О нас</small></Link>
        <Link
          href="/messages"
          aria-current={active === "messages" ? "page" : undefined}
          aria-label={`${t("nav.messages")}${unreadCounts.chat ? `: ${unreadCounts.chat}` : ""}`}
        >
          <span aria-hidden="true">✉</span>
          <small>{t("nav.messages")}</small>
          {unreadCounts.chat > 0 && (
            <span aria-hidden="true" className="mobile-tab-count-badge">
              {unreadCounts.chat > 99 ? "99+" : unreadCounts.chat}
            </span>
          )}
        </Link>
        <button
          aria-controls="header-notifications-panel"
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          aria-label={`${t("nav.notifications")}${unreadCounts.notifications ? `: ${unreadCounts.notifications}` : ""}`}
          className="mobile-notifications-button"
          onClick={(event) => {
            if (notificationsOpen) {
              setNotificationsOpen(false);
            } else {
              window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT, {
                detail: { trigger: event.currentTarget },
              }));
            }
          }}
          type="button"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
          </svg>
          <small>{t("nav.notificationsShort")}</small>
          {unreadCounts.notifications > 0 && (
            <span aria-hidden="true" className="mobile-tab-count-badge">
              {unreadCounts.notifications > 99 ? "99+" : unreadCounts.notifications}
            </span>
          )}
        </button>
        <Link href="/profile" aria-label="Профиль"><span aria-hidden="true">◉</span><small>Профиль</small></Link>
      </nav>
    </header>
  );
}
