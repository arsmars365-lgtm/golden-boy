"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import VerifiedBadge from "@/components/verified-badge";
import { getCurrentProfile, isValidUsername, type Profile } from "@/lib/profiles";
import { useDemoAuth } from "@/lib/use-demo-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { useStoredItems } from "@/lib/use-stored-items";
import { deleteStoredItem, getAllItems, updateStoredItem, type Item } from "@/lib/items";
import { getLostItemProgress, getSimilarFoundItems } from "@/lib/item-matching";
import { useFavoriteItems } from "@/lib/use-favorite-items";
import { useItemNotifications } from "@/lib/use-item-notifications";

type ProfileTab = "listings" | "favorites" | "notifications" | "settings";

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: "listings", label: "Мои объявления" },
  { id: "favorites", label: "Избранное" },
  { id: "notifications", label: "Уведомления" },
  { id: "settings", label: "Редактирование" },
];

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isReady } = useDemoAuth();
  const { items: storedItems, error: itemsError, isReady: itemsReady } = useStoredItems();
  const { favoriteIds, toggleFavorite, error: favoritesError } = useFavoriteItems(user?.id ?? null);
  const {
    notifications,
    subscriptions,
    unreadCount,
    permission,
    isConnected: notificationsConnected,
    error: notificationsError,
    markRead,
    markAllRead,
    unsubscribeFromItem,
    enableBrowserNotifications,
  } = useItemNotifications();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [faculty, setFaculty] = useState("");
  const [course, setCourse] = useState("");
  const [avatarSelection, setAvatarSelection] = useState<{ file: File; previewUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingItemForm, setEditingItemForm] = useState({
    title: "",
    category: "",
    type: "lost" as "lost" | "found",
    place: "",
    date: "",
    details: "",
    price: "",
  });
  const [isSavingItemEdit, setIsSavingItemEdit] = useState(false);

  const requestedTab = searchParams.get("tab");
  const activeTab: ProfileTab =
    requestedTab === "favorites" || requestedTab === "notifications" || requestedTab === "settings"
      ? requestedTab
      : "listings";

  function setActiveTab(tab: ProfileTab) {
    router.replace(tab === "listings" ? "/profile" : `/profile?tab=${tab}`, { scroll: false });
  }

  useEffect(() => {
    return () => {
      if (avatarSelection) URL.revokeObjectURL(avatarSelection.previewUrl);
    };
  }, [avatarSelection]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getCurrentProfile(user.id).then((currentProfile) => {
      if (!active || !currentProfile) return;
      setProfile(currentProfile);
      setUsername(currentProfile.username);
      setFullName(currentProfile.full_name);
      setBio(currentProfile.bio);
      setFaculty(currentProfile.faculty);
      setCourse(currentProfile.course?.toString() ?? "");
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить профиль.");
    }).finally(() => {
      if (active) setProfileLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const completedFields = [
    username.trim(),
    fullName.trim(),
    bio.trim(),
    faculty.trim() || course,
    avatarSelection || profile?.avatar_url,
  ].filter(Boolean).length;
  const completion = Math.round((completedFields / 5) * 100);
  const publicProfilePath = isValidUsername(username.trim())
    ? `/u/${encodeURIComponent(username.trim())}`
    : "";

  function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Выберите JPG, PNG или WebP размером не более 5 МБ.");
      event.target.value = "";
      return;
    }
    setError("");
    setAvatarSelection(file ? { file, previewUrl: URL.createObjectURL(file) } : null);
  }

  async function copyProfileLink() {
    if (!publicProfilePath) return;
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicProfilePath}`);
      setMessage("Ссылка на профиль скопирована.");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Не удалось скопировать ссылку.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!user || !profile) return;
    if (!isValidUsername(username)) {
      setError("Никнейм: 3–20 символов, латинские буквы, цифры и _.");
      return;
    }
    setSaving(true);
    const supabase = getSupabaseClient();
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarSelection) {
        const path = `${user.id}/avatar-${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarSelection.file, { upsert: true, contentType: avatarSelection.file.type });
        if (uploadError) throw new Error(`Не удалось загрузить аватар: ${uploadError.message}`);
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          full_name: fullName.trim(),
          bio: bio.trim(),
          faculty: faculty.trim(),
          course: course ? Number(course) : null,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id)
        .select("id,username,full_name,avatar_url,bio,faculty,course,role,is_verified,is_blocked,created_at")
        .single();
      if (updateError) throw new Error(`Не удалось сохранить профиль: ${updateError.message}`);
      setProfile(data as Profile);
      setAvatarSelection(null);
      setMessage("Профиль сохранён.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    if (!user || signingOut) return;
    const confirmed = window.confirm("Вы уверены, что хотите выйти?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    setSigningOut(true);
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) {
        throw new Error(signOutError.message);
      }
      router.push("/");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Не удалось выйти из аккаунта.");
      setSigningOut(false);
    }
  }

  const allItems = useMemo(() => getAllItems(storedItems), [storedItems]);
  const ownItems = useMemo(
    () => storedItems.filter((item) => item.ownerId === user?.id),
    [storedItems, user?.id],
  );
  const favoriteItems = useMemo(
    () => allItems.filter((item) => favoriteIds.includes(item.id)),
    [allItems, favoriteIds],
  );

  function openEditItem(item: Item) {
    setError("");
    setMessage("");
    setEditingItem(item);
    setEditingItemForm({
      title: item.title,
      category: item.category,
      type: item.type,
      place: item.place,
      date: item.date ?? "",
      details: item.details,
      price: item.price == null ? "" : String(item.price),
    });
  }

  async function saveEditedItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !editingItem) return;

    if (!editingItemForm.title.trim() || !editingItemForm.category || !editingItemForm.place.trim() || !editingItemForm.date || !editingItemForm.details.trim()) {
      setError("Заполните все обязательные поля.");
      return;
    }

    setIsSavingItemEdit(true);
    try {
      await updateStoredItem(editingItem.id, user.id, {
        title: editingItemForm.title,
        category: editingItemForm.category,
        type: editingItemForm.type,
        place: editingItemForm.place,
        date: editingItemForm.date,
        details: editingItemForm.details,
        price: editingItemForm.price.trim() ? Number(editingItemForm.price) : null,
      });
      setMessage("Объявление обновлено.");
      setEditingItem(null);
    } catch (itemEditError) {
      setError(itemEditError instanceof Error ? itemEditError.message : "Не удалось обновить объявление.");
    } finally {
      setIsSavingItemEdit(false);
    }
  }

  async function deleteOwnItem(item: Item) {
    if (!user) return;
    const confirmed = window.confirm(`Удалить объявление «${item.title}»? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    try {
      await deleteStoredItem(item.id, user.id);
      setMessage("Объявление удалено.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить объявление.");
    }
  }

  function renderItemRow(item: Item, saved = false, includeActions = false) {
    const matches = item.type === "lost" ? getSimilarFoundItems(item, storedItems) : [];
    const progress = item.type === "lost" ? getLostItemProgress(item, matches.length > 0) : 0;
    return (
      <article className="account-listing" key={`${saved ? "saved-" : ""}${item.id}`}>
        <Link className="account-listing-main" href={`/item/${encodeURIComponent(item.id)}`}>
          <span className={`account-listing-art ${item.art}`} aria-hidden="true">
            {item.imageDataUrl ? <span style={{ backgroundImage: `url("${item.imageDataUrl}")` }} /> : item.symbol}
          </span>
          <span className="account-listing-copy">
            <strong>{item.title}</strong>
            <small>{item.place} · {item.category}</small>
            <span className={`account-status ${item.status}`}>
              {item.status === "returned" ? "Возвращено" : item.type === "found" ? "Найдено" : "Ищем"}
            </span>
            {item.type === "lost" && (
              <span className="mini-progress">
                <span className="mini-progress-track"><span style={{ width: `${((progress + 1) / 4) * 100}%` }} /></span>
                <small>{["Объявление опубликовано", "Ищем совпадения", "Есть похожее объявление", "Вещь возвращена"][progress]}</small>
              </span>
            )}
          </span>
        </Link>
        {includeActions ? (
          <div className="account-listing-actions">
            <button className="account-listing-action account-listing-action-edit" onClick={() => openEditItem(item)} type="button">
              Редактировать
            </button>
            <button className="account-listing-action account-listing-action-delete" onClick={() => void deleteOwnItem(item)} type="button">
              Удалить
            </button>
          </div>
        ) : saved ? (
          <button
            aria-label={`Убрать «${item.title}» из избранного`}
            className="favorite-remove-button"
            onClick={() => toggleFavorite(item.id)}
            type="button"
          >
            ♥
          </button>
        ) : null}
      </article>
    );
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />
      <section className="profile-edit-page container">
        {!isReady ? <p>Проверяем аккаунт…</p> : !user ? (
          <div className="profile-empty"><h1>Войдите в аккаунт</h1><p>Чтобы просматривать и редактировать профиль.</p><Button href="/login" variant="contained">Войти</Button></div>
        ) : (
          <>
            <header className="profile-page-heading"><span className="section-kicker">ВАШ АККАУНТ</span><h1>Профиль</h1></header>
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            {profile?.role === "admin" && <Link className="profile-admin-link" href="/admin">Открыть панель администратора →</Link>}
            {profileLoading ? <p>Загружаем профиль…</p> : profile ? (
              <>
                <section className="account-overview">
                  <div className="account-overview-avatar profile-avatar-preview">
                    {profile.avatar_url ? <span role="img" aria-label="Аватар профиля" style={{ backgroundImage: `url("${profile.avatar_url}")` }} /> : <span>{(profile.full_name || profile.username).slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="account-overview-copy">
                    <span className="profile-username">@{profile.username} {profile.is_verified && <VerifiedBadge />}</span>
                    <h2>{profile.full_name || profile.username}</h2>
                    <p>{profile.bio || "Добавьте пару слов о себе в настройках профиля."}</p>
                  </div>
                  <button className="account-edit-shortcut" onClick={() => setActiveTab("settings")} type="button">Изменить профиль</button>
                </section>
                <div className="account-stat-grid">
                  <article><strong>{ownItems.length}</strong><span>объявлений</span></article>
                  <article><strong>{ownItems.filter((item) => item.status === "returned").length}</strong><span>возвращено</span></article>
                  <article><strong>{favoriteIds.length}</strong><span>в избранном</span></article>
                  <article><strong>{notifications.length}</strong><span>похожих находок</span></article>
                </div>
                <div className="profile-signout-row">
                  <Button
                    className="profile-signout-button"
                    color="error"
                    disabled={signingOut}
                    onClick={handleSignOut}
                    variant="outlined"
                  >
                    {signingOut ? "Выходим…" : "Выйти"}
                  </Button>
                </div>
                <div className="account-tabs" role="tablist" aria-label="Разделы профиля">
                  {profileTabs.map((tab) => (
                    <button
                      aria-selected={activeTab === tab.id}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                      {tab.id === "favorites" && favoriteIds.length > 0 && <span>{favoriteIds.length}</span>}
                      {tab.id === "notifications" && unreadCount > 0 && <span>{unreadCount}</span>}
                    </button>
                  ))}
                </div>
                {itemsError && <Alert severity="error">{itemsError}</Alert>}
                {favoritesError && <Alert severity="error">{favoritesError}</Alert>}
                {!itemsReady ? <p>Загружаем объявления…</p> : (
                  <section className="account-tab-panel" role="tabpanel">
                    {activeTab === "listings" && (
                      <>
                        <div className="account-section-heading"><div><span className="section-kicker">ВАШИ ПУБЛИКАЦИИ</span><h2>Мои объявления</h2></div><Button href="/add" variant="contained">＋ Добавить</Button></div>
                        {ownItems.length ? <div className="account-list">{ownItems.map((item) => renderItemRow(item, false, true))}</div> : <div className="account-empty"><span aria-hidden="true">⌕</span><h3>Объявлений пока нет</h3><p>Опубликуйте потерянную или найденную вещь — здесь появится её статус и прогресс.</p><Button href="/add" variant="contained">Создать объявление</Button></div>}
                      </>
                    )}
                    {activeTab === "favorites" && (
                      <>
                        <div className="account-section-heading"><div><span className="section-kicker">СОХРАНЁННОЕ</span><h2>Избранное</h2></div></div>
                        {favoriteItems.length ? <div className="account-list">{favoriteItems.map((item) => renderItemRow(item, true))}</div> : <div className="account-empty"><span aria-hidden="true">♡</span><h3>Пока ничего не сохранено</h3><p>Нажмите на сердечко в объявлении, чтобы быстро вернуться к нему.</p><Button href="/" variant="outlined">Посмотреть объявления</Button></div>}
                      </>
                    )}
                    {activeTab === "notifications" && (
                      <>
                        <div className="account-section-heading">
                          <div><span className="section-kicker">ПОМОГАЕМ НАЙТИ БЫСТРЕЕ</span><h2>Похожие находки</h2></div>
                          {unreadCount > 0 && <Button onClick={markAllRead} variant="outlined">Прочитать все</Button>}
                        </div>
                        <p className="notification-explainer">Показываем совпадения по категории или словам в названии среди объявлений кампуса. Это подсказки, а не подтверждение, что вещь ваша.</p>
                        <div className="notification-controls">
                          <span className={`notification-connection ${notificationsConnected ? "is-connected" : ""}`}>
                            <span aria-hidden="true" />{notificationsConnected ? "Онлайн-обновления включены" : "Подключаем онлайн-обновления…"}
                          </span>
                          {permission === "default" && (
                            <Button onClick={() => void enableBrowserNotifications()} variant="outlined">Включить уведомления браузера</Button>
                          )}
                          {permission === "granted" && <span className="notification-permission">Системные уведомления включены</span>}
                          {permission === "denied" && <span className="notification-permission">Уведомления заблокированы в настройках браузера</span>}
                          {permission === "unsupported" && <span className="notification-permission">Браузер не поддерживает системные уведомления</span>}
                        </div>
                        {notificationsError && <Alert severity="error">{notificationsError}</Alert>}
                        {subscriptions.length > 0 && (
                          <section className="active-subscriptions">
                            <h3>Отслеживаемые объявления</h3>
                            <div className="match-list">
                              {subscriptions.map((subscription) => (
                                <article className="match-card subscription-card" key={subscription.itemId}>
                                  <span className="match-card-icon" aria-hidden="true">⌕</span>
                                  <div>
                                    <span className="match-label">Подписка включена</span>
                                    <h3>{subscription.title}</h3>
                                    <Link href={`/item/${encodeURIComponent(subscription.itemId)}`}>Открыть объявление →</Link>
                                  </div>
                                  <Button onClick={() => unsubscribeFromItem(subscription.itemId)} variant="outlined">Отписаться</Button>
                                </article>
                              ))}
                            </div>
                          </section>
                        )}
                        {notifications.length ? <div className="match-list">{notifications.map((notification) => (
                          <article className={`match-card ${notification.read ? "" : "is-unread"}`} key={notification.id}>
                            <span className="match-card-icon" aria-hidden="true">✦</span>
                            <div>
                              <span className="match-label">{notification.read ? "Возможное совпадение" : "Новое совпадение"}</span>
                              <h3>Похожая вещь найдена: {notification.foundTitle}</h3>
                              <p>По объявлению «{notification.lostTitle}» · {notification.foundPlace} · {new Date(notification.createdAt).toLocaleDateString("ru-RU")}</p>
                              <Link href={`/item/${encodeURIComponent(notification.foundItemId)}`} onClick={() => markRead(notification.id)}>Проверить находку →</Link>
                            </div>
                          </article>
                        ))}</div> : <div className="account-empty"><span aria-hidden="true">♧</span><h3>Новых совпадений пока нет</h3><p>Когда появится похожее объявление о находке, уведомление сохранится здесь.</p></div>}
                        <p className="notification-footnote">Онлайн-уведомления и системные уведомления браузера работают, пока сайт открыт. Доставка при закрытом браузере потребует отдельной настройки Web Push.</p>
                      </>
                    )}
                    {activeTab === "settings" && (
                      <>
                        <div className="account-section-heading"><div><span className="section-kicker">ЛИЧНАЯ ИНФОРМАЦИЯ</span><h2>Редактирование профиля</h2></div></div>
                        <form className="profile-edit-card" onSubmit={saveProfile}>
                          <div className="profile-avatar-preview">
                            {avatarSelection ? (
                              <span
                                role="img"
                                aria-label="Предварительный просмотр аватара"
                                style={{ backgroundImage: `url("${avatarSelection.previewUrl}")` }}
                              />
                            ) : profile.avatar_url ? (
                              <span
                                role="img"
                                aria-label="Аватар профиля"
                                style={{ backgroundImage: `url("${profile.avatar_url}")` }}
                              />
                            ) : (
                              <span>{(profile.full_name || profile.username).slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <p className="profile-username">
                            @{profile.username} {profile.is_verified && <VerifiedBadge />}
                          </p>
                          <div className="profile-edit-tools">
                            <div className="profile-completion">
                              <div className="profile-completion-label">
                                <span>Заполненность профиля</span>
                                <strong>{completion}%</strong>
                              </div>
                              <progress aria-label="Заполненность профиля" max={100} value={completion} />
                            </div>
                            <div className="profile-public-actions">
                              {publicProfilePath && <Link href={publicProfilePath}>Открыть профиль</Link>}
                              <Button
                                disabled={!publicProfilePath}
                                onClick={copyProfileLink}
                                type="button"
                                variant="outlined"
                              >
                                Скопировать ссылку
                              </Button>
                            </div>
                          </div>
                          <label className="form-group">
                            <span className="form-label">Фото профиля</span>
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              onChange={onAvatarChange}
                              type="file"
                            />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Никнейм <span>*</span></span>
                            <input
                              maxLength={20}
                              minLength={3}
                              onChange={(event) => setUsername(event.target.value)}
                              pattern="[A-Za-z0-9_]{3,20}"
                              required
                              value={username}
                            />
                          </label>
                          <label className="form-group">
                            <span className="form-label">Имя</span>
                            <input
                              maxLength={80}
                              onChange={(event) => setFullName(event.target.value)}
                              value={fullName}
                            />
                          </label>
                          <label className="form-group">
                            <span className="form-label">О себе</span>
                            <textarea
                              maxLength={500}
                              onChange={(event) => setBio(event.target.value)}
                              rows={4}
                              value={bio}
                            />
                          </label>
                          <div className="profile-form-columns">
                            <label className="form-group">
                              <span className="form-label">Факультет</span>
                              <input
                                maxLength={120}
                                onChange={(event) => setFaculty(event.target.value)}
                                value={faculty}
                              />
                            </label>
                            <label className="form-group">
                              <span className="form-label">Курс</span>
                              <input
                                max={8}
                                min={1}
                                onChange={(event) => setCourse(event.target.value)}
                                type="number"
                                value={course}
                              />
                            </label>
                          </div>
                          <Button disabled={saving} type="submit" variant="contained">
                            {saving ? "Сохраняем…" : "Сохранить профиль"}
                          </Button>
                          <p className="profile-edit-note">
                            Роль администратора и подтверждение профиля может менять только администратор.
                          </p>
                        </form>
                      </>
                    )}
                  </section>
                )}
                {editingItem && (
                  <Dialog fullWidth maxWidth="sm" onClose={() => setEditingItem(null)} open={Boolean(editingItem)}>
                    <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <span>Редактировать объявление</span>
                    </DialogTitle>
                    <DialogContent>
                      <form className="item-edit-form" id="profile-edit-item-form" onSubmit={saveEditedItem}>
                        <label className="form-group"><span className="form-label">Название</span><input maxLength={80} onChange={(event) => setEditingItemForm((current) => ({ ...current, title: event.target.value }))} required value={editingItemForm.title} /></label>
                        <label className="form-group"><span className="form-label">Тип объявления</span><select onChange={(event) => setEditingItemForm((current) => ({ ...current, type: event.target.value === "found" ? "found" : "lost" }))} value={editingItemForm.type}><option value="lost">Потерял</option><option value="found">Нашёл</option></select></label>
                        <label className="form-group"><span className="form-label">Категория</span><select onChange={(event) => setEditingItemForm((current) => ({ ...current, category: event.target.value }))} required value={editingItemForm.category}>{["Документы", "Телефон", "Ключи", "Наушники", "Одежда", "Сумки", "Другое", "Электроника", "Книги"].map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                        <label className="form-group"><span className="form-label">Место</span><input maxLength={120} onChange={(event) => setEditingItemForm((current) => ({ ...current, place: event.target.value }))} required value={editingItemForm.place} /></label>
                        <label className="form-group"><span className="form-label">Дата</span><input onChange={(event) => setEditingItemForm((current) => ({ ...current, date: event.target.value }))} required type="date" value={editingItemForm.date} /></label>
                        <label className="form-group"><span className="form-label">Цена, ₸ (необязательно)</span><input max={9_999_999_999.99} min={0} onChange={(event) => setEditingItemForm((current) => ({ ...current, price: event.target.value }))} step="0.01" type="number" value={editingItemForm.price} /></label>
                        <label className="form-group"><span className="form-label">Описание</span><textarea maxLength={1500} onChange={(event) => setEditingItemForm((current) => ({ ...current, details: event.target.value }))} rows={4} value={editingItemForm.details} /></label>
                      </form>
                    </DialogContent>
                    <DialogActions sx={{ padding: "0 24px 20px" }}>
                      <Button onClick={() => setEditingItem(null)} variant="outlined">Отмена</Button>
                      <Button disabled={isSavingItemEdit} form="profile-edit-item-form" type="submit" variant="contained">
                        {isSavingItemEdit ? "Сохраняем…" : "Сохранить изменения"}
                      </Button>
                    </DialogActions>
                  </Dialog>
                )}
              </>
            ) : <Alert severity="error">Профиль не найден. Попробуйте выйти и войти снова.</Alert>}
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
