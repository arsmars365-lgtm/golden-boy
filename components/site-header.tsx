"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { useFavorites } from "@/components/favorites-provider";
import HeaderAccount from "@/components/header-account";
import ThemeToggle from "@/components/theme-toggle";

type SiteHeaderProps = {
  active?: "feed" | "add" | "item" | "about" | "favorites" | "none";
};

export default function SiteHeader({ active = "none" }: SiteHeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { favoriteIds } = useFavorites();

  return (
    <header className="site-header">
      <div className="header-inner container">
        <Link className="brand" href="/" aria-label={t("brand.home")}>
          <span className="brand-mark">f</span>
          <span>foundly</span>
        </Link>

        <nav className="main-nav" aria-label={t("nav.feed")}>
          <Link
            aria-current={active === "feed" ? "page" : undefined}
            className={`nav-link ${active === "feed" ? "active" : ""}`}
            href="/"
          >
            {t("nav.feed")}
          </Link>
          <Link
            aria-current={active === "favorites" ? "page" : undefined}
            className={`nav-link ${active === "favorites" ? "active" : ""}`}
            href="/favorites"
          >
            {t("nav.favorites")} <span className="favorites-count">({favoriteIds.length})</span>
          </Link>
          <Link
            aria-current={active === "about" ? "page" : undefined}
            className={`nav-link ${active === "about" ? "active" : ""}`}
            href="/about"
          >
            {t("nav.about")}
          </Link>
          <Link
            aria-current={active === "add" ? "page" : undefined}
            className={`nav-link ${active === "add" ? "active" : ""}`}
            href="/add"
          >
            Добавить
          </Link>
        </nav>

        <div className="header-actions">
          <label className="language-select-wrap">
            <span>{t("language.label")}:</span>
            <select
              aria-label={t("language.label")}
              value={language}
              onChange={(event) => setLanguage(event.target.value as "kk" | "ru" | "en")}
            >
              <option value="kk">Қазақша</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <ThemeToggle />
          <HeaderAccount />
        </div>
      </div>
      <nav className="mobile-tab-bar" aria-label="Основная навигация">
        <Link href="/" aria-current={active === "feed" ? "page" : undefined} aria-label="Главная"><span aria-hidden="true">⌂</span><small>Главная</small></Link>
        <Link href="/#feed" aria-label="Поиск"><span aria-hidden="true">⌕</span><small>Поиск</small></Link>
        <Link href="/add" aria-current={active === "add" ? "page" : undefined} aria-label="Добавить"><span aria-hidden="true">＋</span><small>Добавить</small></Link>
        <Link href="/about" aria-current={active === "about" ? "page" : undefined} aria-label="О проекте"><span aria-hidden="true">ⓘ</span><small>О проекте</small></Link>
        <Link href="/profile" aria-label="Профиль"><span aria-hidden="true">◉</span><small>Профиль</small></Link>
      </nav>
    </header>
  );
}
