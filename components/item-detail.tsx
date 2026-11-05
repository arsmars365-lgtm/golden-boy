"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { useLanguage } from "@/components/language-provider";
import { categoryTranslationKey, type Language } from "@/lib/messages";
import {
  DEMO_ITEMS,
  ITEM_CATEGORIES,
  deleteStoredItem,
  formatItemDate,
  isStoredItem,
  saveItemReport,
  updateStoredItem,
  type Item,
  type ItemStatus,
} from "@/lib/items";
import { useStoredItems } from "@/lib/use-stored-items";
import { useDemoAuth } from "@/lib/use-demo-auth";
import VerifiedBadge from "@/components/verified-badge";
import { useFavoriteItems } from "@/lib/use-favorite-items";
import { getLostItemProgress, getSimilarFoundItems } from "@/lib/item-matching";
import { useItemNotifications } from "@/lib/use-item-notifications";

function formattedDate(item: Item, language: Language) {
  if (!item.date) {
    if (item.daysAgo === 0) return `${language === "en" ? "Today" : language === "kk" ? "Бүгін" : "Сегодня"}, ${item.time}`;
    if (item.daysAgo === 1) return `${language === "en" ? "Yesterday" : language === "kk" ? "Кеше" : "Вчера"}, ${item.time}`;
    if (language === "en") return `${item.daysAgo} days ago, ${item.time}`;
    if (language === "kk") return `${item.daysAgo} күн бұрын, ${item.time}`;
    return formatItemDate(item.daysAgo, item.time);
  }
  const [year, month, day] = item.date.split("-");
  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale).format(
    new Date(Number(year), Number(month) - 1, Number(day)),
  );
}

export default function ItemDetail({ id }: { id: string }) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const { items: storedItems, error: storageError, isReady } = useStoredItems();
  const { user, isReady: isAuthReady } = useDemoAuth();
  const { favoriteIds, toggleFavorite, error: favoritesError } = useFavoriteItems(user?.id ?? null);
  const {
    isSubscribed,
    subscribeToItem,
    unsubscribeFromItem,
    error: notificationsError,
  } = useItemNotifications();
  const [actionError, setActionError] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState<"lost" | "found">("lost");
  const [editPlace, setEditPlace] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTelegram, setEditTelegram] = useState("");
  const item =
    storedItems.find((storedItem) => storedItem.id === id) ??
    DEMO_ITEMS.find((demoItem) => demoItem.id === id) ??
    null;
  const itemOwnerId = item?.ownerId;
  const isExampleItem = DEMO_ITEMS.some((demoItem) => demoItem.id === id);
  const isOwnItem =
    isReady &&
    isAuthReady &&
    isStoredItem(id, storedItems, user?.id);
  const statusLabels: Record<ItemStatus, string> = {
    searching: t("status.searching"),
    found: t("status.found"),
    returned: t("status.returned"),
  };
  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  const reportReasons = [
    t("detail.reportRule"),
    t("detail.reportSpam"),
    t("detail.reportPrivacy"),
    t("detail.reportOther"),
  ];

  async function handleStatusChange(status: ItemStatus) {
    setActionError("");
    try {
      if (!user) throw new Error("Войди в аккаунт.");
      await updateStoredItem(id, user.id, { status });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : t("detail.error.update"),
      );
    }
  }

  function beginEditing() {
    if (!item) return;
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditType(item.type);
    setEditPlace(item.place);
    setEditDate(item.date ?? "");
    setEditDetails(item.details);
    setEditPrice(item.price == null ? "" : String(item.price));
    setEditTelegram("");
    setActionError("");
    setIsEditing(true);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");

    if (!editTitle.trim() || !editCategory || !editPlace.trim() || !editDate || !editDetails.trim()) {
      setActionError("Заполните все обязательные поля.");
      return;
    }

    const telegramUsername = editTelegram.trim().replace(/^@/, "");
    if (telegramUsername && !/^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)) {
      setActionError(t("form.error.telegram"));
      return;
    }

    setIsSavingEdit(true);
    try {
      if (!user) throw new Error("Войди в аккаунт.");
      await updateStoredItem(id, user.id, {
        title: editTitle,
        category: editCategory,
        type: editType,
        place: editPlace,
        date: editDate,
        details: editDetails,
        price: editPrice.trim() ? Number(editPrice) : null,
      });
      setIsEditing(false);
    } catch (editError) {
      setActionError(editError instanceof Error ? editError.message : "Не удалось изменить объявление.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("detail.deleteConfirm"))) {
      return;
    }

    setActionError("");
    try {
      if (!user) throw new Error("Войди в аккаунт.");
      await deleteStoredItem(id, user.id);
      router.push("/");
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : t("detail.error.delete"),
      );
    }
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportMessage("");
    setActionError("");
    if (!reportReason) {
      setActionError(t("detail.chooseReason"));
      return;
    }

    try {
      await saveItemReport(id, reportReason);
      setReportMessage(
        t("detail.reportSaved"),
      );
      setReportReason("");
    } catch (reportError) {
      setActionError(
        reportError instanceof Error
          ? reportError.message
          : t("detail.error.report"),
      );
    }
  }

  async function handleShare() {
    setActionError("");
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: item?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setReportMessage("Ссылка скопирована.");
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setActionError(
        shareError instanceof Error
          ? shareError.message
          : "Не удалось поделиться ссылкой.",
      );
    }
  }

  if (!isReady || !isAuthReady) {
    return (
      <main className="foundly-shell container-fluid px-0">
        <SiteHeader />
        <div className="detail-loading">{t("detail.loading")}</div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="foundly-shell container-fluid px-0">
        <SiteHeader active="item" />
        <section className="detail-not-found container">
          <span aria-hidden="true">⌕</span>
          <h1>{t("detail.notFound")}</h1>
          <p>
            {t("detail.notFoundDescription")}
          </p>
          {(storageError || actionError) && (
            <Alert severity="error">{storageError || actionError}</Alert>
          )}
          <Button
            className="detail-primary-button"
            href="/"
            variant="contained"
          >
            {t("detail.backToFeed")}
          </Button>
        </section>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader active="item" />

      <section className="detail-page container">
        <div className="form-breadcrumb">
          <Link href="/">Лента</Link>
          <span aria-hidden="true">/</span>
          <span>{item.title}</span>
        </div>

        <div className="detail-layout">
          <div
            className={`detail-art item-art ${item.art}${item.imageDataUrl ? " has-photo" : ""}`}
            style={
              item.imageDataUrl
                ? { backgroundImage: `url("${item.imageDataUrl}")` }
                : undefined
            }
          >
            {!item.imageDataUrl && (
              <>
                <span className="art-shape art-shape-one" />
                <span className="art-shape art-shape-two" />
                <span className="art-symbol">{item.symbol}</span>
              </>
            )}
            <span className={`detail-type-badge ${item.type}`}>
              {item.type === "lost" ? t("detail.lost") : t("detail.found")}
            </span>
          </div>

          <article className="detail-content">
            <div className="detail-topline">
              <span className={`status-label ${item.status}`}>
                <span /> {statusLabels[item.status]}
              </span>
              {isOwnItem && <span className="demo-owner-label">{t("detail.ownItem")}</span>}
            </div>

            <h1>{item.title}</h1>
            {item.ownerUsername && (
              <Link className="detail-author" href={`/u/${encodeURIComponent(item.ownerUsername)}`}>
                {item.ownerFullName || `@${item.ownerUsername}`}
                {item.ownerVerified && <VerifiedBadge />}
              </Link>
            )}
            <span className="category-label detail-category">
              {categoryTranslationKey(item.category)
                ? t(categoryTranslationKey(item.category)!)
                : item.category}
            </span>
            {item.price != null && (
              <p className="detail-price">
                <span>{t("detail.price")}</span>
                <strong>
                  {new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: "KZT",
                    maximumFractionDigits: 2,
                  }).format(item.price)}
                </strong>
              </p>
            )}
            <div className="detail-quick-actions">
              <Button
                aria-pressed={favoriteIds.includes(item.id)}
                className={`favorite-item-button${favoriteIds.includes(item.id) ? " is-favorite" : ""}`}
                onClick={() => {
                  if (!user) {
                    router.push("/login");
                    return;
                  }
                  toggleFavorite(item.id);
                }}
                variant="outlined"
              >
                <span aria-hidden="true">{favoriteIds.includes(item.id) ? "♥" : "♡"}</span>
                {favoriteIds.includes(item.id) ? "В избранном" : "В избранное"}
              </Button>
              {item.type === "lost" && item.status !== "returned" && !isExampleItem && (
                <Button
                  aria-pressed={isSubscribed(item.id)}
                  className={`item-subscription-button${isSubscribed(item.id) ? " is-subscribed" : ""}`}
                  onClick={() => {
                    if (!user) {
                      router.push("/login");
                      return;
                    }
                    if (isSubscribed(item.id)) {
                      unsubscribeFromItem(item.id);
                      return;
                    }
                    if (window.confirm(`Подписаться на новые находки, похожие на «${item.title}»?`)) {
                      subscribeToItem(item);
                    }
                  }}
                  variant="outlined"
                >
                  <span aria-hidden="true">{isSubscribed(item.id) ? "✓" : "♧"}</span>
                  {isSubscribed(item.id) ? "Уведомления включены" : "Следить за находками"}
                </Button>
              )}
              <Button className="share-item-button" onClick={handleShare} variant="outlined">
                Поделиться <span aria-hidden="true">↗</span>
              </Button>
            </div>

            {(storageError || actionError || favoritesError || notificationsError) && (
              <Alert className="detail-alert" severity="error">
                {storageError || actionError || favoritesError || notificationsError}
              </Alert>
            )}
            {reportMessage && (
              <Alert className="detail-alert" severity="success">
                {reportMessage}
              </Alert>
            )}

            <dl className="detail-facts">
              <div>
                <dt>{t("detail.place")}</dt>
                <dd>
                  <span aria-hidden="true">⌖</span> {item.place}
                </dd>
              </div>
              <div>
                <dt>{t("detail.published")}</dt>
                <dd>
                  <span aria-hidden="true">◷</span> {formattedDate(item, language)}
                </dd>
              </div>
            </dl>

            <div className="detail-description">
                <h2>{t("detail.description")}</h2>
                <p>{item.details || t("detail.noDescription")}</p>
            </div>

            {isOwnItem && item.type === "lost" && (() => {
              const matches = getSimilarFoundItems(item, storedItems);
              const currentStep = getLostItemProgress(item, matches.length > 0);
              const steps = ["Объявление опубликовано", "Ищем совпадения", "Есть похожая находка", "Вещь возвращена"];
              return (
                <section className="item-progress-panel" aria-label="Прогресс поиска">
                  <div className="account-section-heading">
                    <div><span className="section-kicker">ПРОГРЕСС ПОИСКА</span><h2>Путь вашей вещи</h2></div>
                    <span className="progress-current-label">{steps[currentStep]}</span>
                  </div>
                  <div className="item-progress-steps">
                    {steps.map((step, index) => (
                      <div className={`item-progress-step${index <= currentStep ? " is-complete" : ""}${index === currentStep ? " is-current" : ""}`} key={step}>
                        <span className="item-progress-dot">{index < currentStep ? "✓" : index + 1}</span>
                        <small>{step}</small>
                      </div>
                    ))}
                  </div>
                  {matches.length > 0 && (
                    <div className="item-match-hint">
                      <span aria-hidden="true">✦</span>
                      <p>Нашли {matches.length === 1 ? "похожее объявление" : "похожие объявления"} в кампусе.</p>
                      <Link href="/profile?tab=notifications">Посмотреть совпадения →</Link>
                    </div>
                  )}
                  {item.status === "returned" && <p className="progress-success-note">Поиск завершён: объявление отмечено как возвращённое.</p>}
                </section>
              );
            })()}

            {itemOwnerId && itemOwnerId !== user?.id && !isOwnItem ? (
              <div className="detail-contact">
                <div>
                  <h2>{t("detail.contact")}</h2>
                  <p>{t("detail.contactHint")}</p>
                </div>
                <Button
                  className="detail-primary-button"
                  onClick={() => {
                    router.push(
                      `/messages?userId=${encodeURIComponent(itemOwnerId)}&itemId=${encodeURIComponent(item.id)}`,
                    );
                  }}
                  variant="contained"
                >
                  {t("detail.openChat")} <span aria-hidden="true">↗</span>
                </Button>
              </div>
            ) : !isOwnItem ? (
              <div className="detail-contact">
                <div>
                  <h2>{t("detail.contact")}</h2>
                  <p>{t("detail.chatUnavailable")}</p>
                </div>
              </div>
            ) : null}

            {isOwnItem && (
              <div className="owner-actions">
                <Button onClick={isEditing ? () => setIsEditing(false) : beginEditing} variant="outlined">
                  {isEditing ? "Отменить редактирование" : "Редактировать объявление"}
                </Button>
                <Dialog
                  fullWidth
                  maxWidth="sm"
                  onClose={() => setIsEditing(false)}
                  open={isEditing}
                >
                  <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <span>Редактировать объявление</span>
                    <IconButton aria-label="Закрыть" onClick={() => setIsEditing(false)} size="small">
                      ×
                    </IconButton>
                  </DialogTitle>
                  <DialogContent>
                    <form className="item-edit-form" id="edit-item-form" onSubmit={handleEditSubmit}>
                      <label className="form-group"><span className="form-label">Название</span><input maxLength={80} onChange={(event) => setEditTitle(event.target.value)} required value={editTitle} /></label>
                      <label className="form-group"><span className="form-label">Тип объявления</span><select onChange={(event) => { if (event.target.value === "lost" || event.target.value === "found") setEditType(event.target.value); }} value={editType}><option value="lost">Потерял</option><option value="found">Нашёл</option></select></label>
                      <label className="form-group"><span className="form-label">Категория</span><select onChange={(event) => setEditCategory(event.target.value)} required value={editCategory}>{ITEM_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                      <label className="form-group"><span className="form-label">Место</span><input maxLength={120} onChange={(event) => setEditPlace(event.target.value)} required value={editPlace} /></label>
                      <label className="form-group"><span className="form-label">Дата</span><input onChange={(event) => setEditDate(event.target.value)} required type="date" value={editDate} /></label>
                      <label className="form-group"><span className="form-label">{t("form.price")}</span><input max={9_999_999_999.99} min={0} onChange={(event) => setEditPrice(event.target.value)} step="0.01" type="number" value={editPrice} /></label>
                      <label className="form-group"><span className="form-label">Описание</span><textarea maxLength={1500} onChange={(event) => setEditDetails(event.target.value)} rows={4} value={editDetails} /></label>
                      <label className="form-group"><span className="form-label">Telegram</span><input maxLength={33} onChange={(event) => setEditTelegram(event.target.value)} required value={editTelegram} /></label>
                    </form>
                  </DialogContent>
                  <DialogActions sx={{ padding: "0 24px 20px" }}>
                    <Button onClick={() => setIsEditing(false)} variant="outlined">Отмена</Button>
                    <Button disabled={isSavingEdit} form="edit-item-form" type="submit" variant="contained">
                      {isSavingEdit ? "Сохраняем…" : "Сохранить изменения"}
                    </Button>
                  </DialogActions>
                </Dialog>
                <label htmlFor="item-status">{t("detail.status")}</label>
                <select
                  id="item-status"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "searching" ||
                      value === "returned"
                    ) {
                      handleStatusChange(value);
                    }
                  }}
                  value={item.status}
                >
                  {Object.entries(statusLabels).filter(([value]) => value !== "found").map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  className="delete-item-button"
                  onClick={handleDelete}
                  variant="outlined"
                >
                  {t("detail.delete")}
                </Button>
              </div>
            )}

            {!isExampleItem && (
              <details className="report-box">
                <summary>{t("detail.report")}</summary>
                <form onSubmit={handleReport}>
                  <label htmlFor="report-reason">{t("detail.reportReason")}</label>
                  <select
                    id="report-reason"
                    onChange={(event) => setReportReason(event.target.value)}
                    required
                    value={reportReason}
                  >
                    <option disabled value="">
                      {t("detail.chooseReason")}
                    </option>
                    {reportReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="report-button"
                    type="submit"
                    variant="outlined"
                  >
                    {t("detail.sendReport")}
                  </Button>
                </form>
                <p>{t("detail.reportDemo")}</p>
              </details>
            )}
          </article>
        </div>

        <div className="detail-back-row">
          <Link href="/">← {t("detail.backAll")}</Link>
          <span>{t("detail.backNote")}</span>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
