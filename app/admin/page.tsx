"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import type { Profile } from "@/lib/profiles";
import { getSupabaseClient } from "@/lib/supabase";
import { useDemoAuth } from "@/lib/use-demo-auth";

type AdminItem = {
  id: string;
  title: string;
  type: "lost" | "found";
  status: "active" | "returned" | "hidden";
  created_at: string;
  profiles: { username: string } | null;
};

type AdminReport = {
  id: string;
  item_id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  items: { title: string } | null;
};

export default function AdminPage() {
  const { user, isReady } = useDemoAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [metrics, setMetrics] = useState({ users: 0, items: 0, reports: 0, returned: 0 });
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError("");
    const supabase = getSupabaseClient();
    try {
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio,faculty,course,contact_telegram,role,is_verified,is_blocked,created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      setProfile(currentProfile as Profile | null);
      if (currentProfile?.role !== "admin") {
        setLoading(false);
        return;
      }

      const [usersResult, itemsResult, reportsResult, usersCount, itemsCount, reportsCount, returnedCount] = await Promise.all([
        supabase.from("profiles").select("id,username,full_name,avatar_url,bio,faculty,course,contact_telegram,role,is_verified,is_blocked,created_at").order("created_at", { ascending: false }),
        supabase.from("items").select("id,title,type,status,created_at,profiles!items_user_profile_fkey(username)").order("created_at", { ascending: false }).limit(100),
        supabase.from("reports").select("id,item_id,reason,status,created_at,items(title)").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("items").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }),
        supabase.from("items").select("id", { count: "exact", head: true }).eq("status", "returned"),
      ]);
      if (usersResult.error) throw new Error(usersResult.error.message);
      if (itemsResult.error) throw new Error(itemsResult.error.message);
      if (reportsResult.error) throw new Error(reportsResult.error.message);
      if (usersCount.error) throw new Error(usersCount.error.message);
      if (itemsCount.error) throw new Error(itemsCount.error.message);
      if (reportsCount.error) throw new Error(reportsCount.error.message);
      if (returnedCount.error) throw new Error(returnedCount.error.message);
      setUsers(usersResult.data as unknown as Profile[]);
      setItems(itemsResult.data as unknown as AdminItem[]);
      setReports(reportsResult.data as unknown as AdminReport[]);
      setMetrics({
        users: usersCount.count ?? 0,
        items: itemsCount.count ?? 0,
        reports: reportsCount.count ?? 0,
        returned: returnedCount.count ?? 0,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить панель.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const task = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(task);
  }, [loadData]);
  useEffect(() => {
    const task = window.setTimeout(() => setToday(new Date().toISOString().slice(0, 10)), 0);
    return () => window.clearTimeout(task);
  }, []);

  const filteredUsers = useMemo(
    () => users.filter((entry) =>
      `${entry.username} ${entry.full_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ),
    [search, users],
  );
  const dailyItems = useMemo(() => {
    if (!today) return [];
    const todayTimestamp = Date.parse(`${today}T12:00:00Z`);
    return Array.from({ length: 7 }, (_, index) => {
      const key = new Date(todayTimestamp - (6 - index) * 86_400_000).toISOString().slice(0, 10);
      return { key, count: items.filter((item) => item.created_at.slice(0, 10) === key).length };
    });
  }, [items, today]);
  const maxDaily = Math.max(1, ...dailyItems.map((day) => day.count));
  const runAdminAction = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    setError("");
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Не удалось выполнить действие.");
    }
  };
  const supabase = getSupabaseClient();

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />
      <section className="admin-page container">
        {!isReady || loading ? <p>Загружаем панель…</p> : !user ? (
          <div className="profile-empty"><h1>Войдите в аккаунт</h1><Button href="/login" variant="contained">Войти</Button></div>
        ) : profile?.role !== "admin" ? (
          <div className="profile-empty"><h1>Нет доступа</h1><p>Панель доступна только администраторам.</p><Link href="/">Вернуться на главную</Link></div>
        ) : (
          <>
            <header className="admin-heading"><div><span className="section-kicker">УПРАВЛЕНИЕ СООБЩЕСТВОМ</span><h1>Панель администратора</h1></div><span className="admin-badge">Admin</span></header>
            {error && <Alert severity="error">{error}</Alert>}
            <div className="admin-stats">
              <article><span>Пользователи</span><strong>{metrics.users}</strong></article>
              <article><span>Объявления</span><strong>{metrics.items}</strong></article>
              <article><span>Жалобы</span><strong>{metrics.reports}</strong></article>
              <article><span>Возвращено</span><strong>{metrics.returned}</strong></article>
            </div>
            <section className="admin-panel">
              <h2>Публикации за 7 дней</h2>
              <div className="admin-chart" aria-label="График публикаций по дням">
                {dailyItems.map((day) => <div key={day.key}><span>{day.count}</span><i style={{ height: `${Math.max(4, day.count / maxDaily * 100)}%` }} /><small>{new Date(`${day.key}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</small></div>)}
              </div>
            </section>
            <section className="admin-panel">
              <div className="admin-section-heading"><h2>Пользователи</h2><input aria-label="Поиск пользователей" onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по имени или нику" value={search} /></div>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Профиль</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>
                {filteredUsers.map((entry) => <tr key={entry.id}><td><Link href={`/u/${encodeURIComponent(entry.username)}`}>@{entry.username}</Link><small>{entry.full_name}</small></td><td>{entry.role}</td><td>{entry.is_blocked ? "Заблокирован" : "Активен"}{entry.is_verified && " · Подтверждён"}</td><td className="admin-actions">
                  <Button size="small" onClick={() => void runAdminAction(() => supabase.from("profiles").update({ is_verified: !entry.is_verified }).eq("id", entry.id))}>{entry.is_verified ? "Снять галочку" : "Подтвердить"}</Button>
                  <Button size="small" onClick={() => void runAdminAction(() => supabase.from("profiles").update({ is_blocked: !entry.is_blocked }).eq("id", entry.id))}>{entry.is_blocked ? "Разблокировать" : "Блокировать"}</Button>
                  <Button size="small" onClick={() => void runAdminAction(() => supabase.from("profiles").update({ role: entry.role === "admin" ? "user" : "admin" }).eq("id", entry.id))}>{entry.role === "admin" ? "Снять Admin" : "Назначить Admin"}</Button>
                </td></tr>)}
              </tbody></table></div>
            </section>
            <section className="admin-panel">
              <h2>Объявления</h2>
              <div className="admin-list">{items.map((item) => <article key={item.id}><div><Link href={`/item/${item.id}`}>{item.title}</Link><small>@{item.profiles?.username ?? "—"} · {item.type} · {item.status}</small></div>
                <Button size="small" onClick={() => void runAdminAction(() => supabase.from("items").update({ status: item.status === "hidden" ? "active" : "hidden" }).eq("id", item.id))}>{item.status === "hidden" ? "Показать" : "Скрыть"}</Button>
                <Button color="error" size="small" onClick={() => { if (window.confirm("Удалить объявление без возможности восстановления?")) void runAdminAction(() => supabase.from("items").delete().eq("id", item.id)); }}>Удалить</Button>
              </article>)}</div>
            </section>
            <section className="admin-panel">
              <h2>Жалобы</h2>
              {reports.length ? <div className="admin-list">{reports.map((report) => <article key={report.id}><div><strong>{report.items?.title ?? "Объявление удалено"}</strong><small>{report.reason} · {report.status}</small></div><Button size="small" onClick={() => void runAdminAction(() => supabase.from("reports").update({ status: report.status === "open" ? "reviewed" : "open" }).eq("id", report.id))}>{report.status === "open" ? "Отметить проверенной" : "Вернуть в работу"}</Button><Button color="error" size="small" onClick={() => void runAdminAction(() => supabase.from("reports").delete().eq("id", report.id))}>Удалить</Button></article>)}</div> : <p>Новых жалоб нет.</p>}
            </section>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
