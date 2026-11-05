"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import VerifiedBadge from "@/components/verified-badge";
import { useLanguage } from "@/components/language-provider";
import { getProfileByUsername, getProfileItems, isValidUsername, type Profile } from "@/lib/profiles";
import type { Item } from "@/lib/items";
import { useDemoAuth } from "@/lib/use-demo-auth";

type ProfileItem = Item & { status: "searching" | "found" | "returned" };

export default function PublicProfilePage({ username }: { username: string }) {
  const { t } = useLanguage();
  const { user } = useDemoAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [tab, setTab] = useState<"mine" | "found" | "returned">("mine");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isValidUsername(decodeURIComponent(username))) {
      const task = window.setTimeout(() => setReady(true), 0);
      return () => {
        active = false;
        window.clearTimeout(task);
      };
    }
    void getProfileByUsername(decodeURIComponent(username))
      .then(async (result) => {
        if (!active) return;
        if (!result) {
          setReady(true);
          return;
        }
        setProfile(result);
        const profileItems = await getProfileItems(result.id);
        if (active) setItems(profileItems as unknown as ProfileItem[]);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить профиль.");
      })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [username]);

  const visibleItems = items.filter((item) =>
    tab === "found" ? item.type === "found" : tab === "returned" ? item.status === "returned" : true,
  );

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />
      <section className="public-profile-page container">
        {!ready ? <div className="detail-loading">Загружаем профиль…</div> : !profile ? (
          <div className="profile-empty"><h1>Профиль не найден</h1><Link href="/">Вернуться в ленту</Link></div>
        ) : (
          <>
            <header className="public-profile-header">
              <div className="profile-avatar-preview">
                {profile.avatar_url ? <span role="img" aria-label="Аватар профиля" style={{ backgroundImage: `url("${profile.avatar_url}")` }} /> : <span>{(profile.full_name || profile.username).slice(0, 1).toUpperCase()}</span>}
              </div>
              <div>
                <span className="profile-username">@{profile.username} {profile.is_verified && <VerifiedBadge />}</span>
                <h1>{profile.full_name || profile.username}</h1>
                {profile.role === "admin" && <span className="admin-badge">Admin</span>}
                {profile.bio && <p>{profile.bio}</p>}
                {(profile.faculty || profile.course) && <p>{[profile.faculty, profile.course ? `${profile.course} курс` : ""].filter(Boolean).join(" · ")}</p>}
                {user?.id !== profile.id && (
                  <Link
                    className="profile-message-link"
                    href={`/messages?userId=${encodeURIComponent(profile.id)}`}
                  >
                    {t("chat.writeMessage")} ↗
                  </Link>
                )}
              </div>
            </header>
            <div className="profile-tabs" role="tablist" aria-label="Объявления пользователя">
              <button aria-selected={tab === "mine"} onClick={() => setTab("mine")} role="tab">Мои объявления</button>
              <button aria-selected={tab === "found"} onClick={() => setTab("found")} role="tab">Найдено мной</button>
              <button aria-selected={tab === "returned"} onClick={() => setTab("returned")} role="tab">Возвращено</button>
            </div>
            {error && <Alert severity="error">{error}</Alert>}
            {visibleItems.length ? <div className="profile-listings">{visibleItems.map((item) => (
              <Link className="profile-listing" href={`/item/${encodeURIComponent(item.id)}`} key={item.id}>
                <strong>{item.title}</strong><span>{item.place}</span><small>{item.status === "returned" ? "Возвращено" : item.type === "found" ? "Найдено" : "Ищется"}</small>
              </Link>
            ))}</div> : <p className="profile-empty-copy">В этой вкладке пока нет объявлений.</p>}
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
