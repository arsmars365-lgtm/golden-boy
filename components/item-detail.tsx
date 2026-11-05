"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import { useStoredItems, useTodayDate } from "@/lib/use-stored-items";
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
  const today = useTodayDate();
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
  const [editTelegram, setEditTelegram] = useState("");
  const item =
    storedItems.find((storedItem) => storedItem.id === id) ??
    DEMO_ITEMS.find((demoItem) => demoItem.id === id) ??
    null;
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
    setEditTelegram(item.telegram ?? "");
    setActionError("");
    setIsEditing(true);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    const telegramUsername = editTelegram.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)) {
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
        telegram: telegramUsername,
      });
      setIsEditing(false);
      setActionError("");
    } catch (editError) {
      setActionError(editError instanceof Error ? editError.message : "Не удалось изменить объявление.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function closeEditDialog() {
    if (isSavingEdit) return;
    setIsEditing(false);
    setActionError("");
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

  const telegramUsername = item.telegram?.trim().replace(/^@/, "");
  const validTelegramUsername =
    telegramUsername && /^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)
      ? telegramUsername
      : null;

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

            {(storageError || (!isEditing && actionError) || favoritesError || notificationsError) && (
              <Alert className="detail-alert" severity="error">
                {storageError || (!isEditing && actionError) || favoritesError || notificationsError}
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

            {validTelegramUsername ? (
              <div className="detail-contact">
                <div>
                  <h2>{t("detail.contact")}</h2>
                  <p>{t("detail.contactHint")}</p>
                </div>
                <Button
                  className="detail-primary-button"
                  component="a"
                  href={`https://t.me/${validTelegramUsername}`}
                  rel="noreferrer"
                  target="_blank"
                  variant="contained"
                >
                  {t("detail.messageTelegram")} <span aria-hidden="true">↗</span>
                </Button>
              </div>
            ) : (
              <div className="detail-contact">
                <div>
                  <h2>Связаться с автором</h2>
                  <p>
                    {item.telegram
                      ? "Telegram-ник указан в неверном формате."
                      : "Автор не указал Telegram для связи."}
                  </p>
                </div>
              </div>
            )}

            {isOwnItem && (
              <div className="owner-actions">
                <Button onClick={beginEditing} variant="outlined">
                  Редактировать объявление
                </Button>
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

            <Dialog
              aria-labelledby="item-edit-title"
              className="item-edit-dialog"
              fullWidth
              maxWidth="sm"
              onClose={closeEditDialog}
              open={isEditing}
            >
              <DialogTitle className="item-edit-dialog-title" id="item-edit-title">
                <span>Редактировать объявление</span>
                <button
                  aria-label="Закрыть окно"
                  className="item-edit-close"
                  disabled={isSavingEdit}
                  onClick={closeEditDialog}
                  type="button"
                >
                  ×
                </button>
              </DialogTitle>
              <DialogContent className="item-edit-dialog-content" dividers>
                <p className="item-edit-intro">
                  Обновите информацию — изменения сразу появятся в публикации.
                </p>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <form className="item-edit-form" id="item-edit-form" onSubmit={handleEditSubmit}>
                  <label className="form-group">
                    <span className="form-label">Название <span>*</span></span>
                    <input
                      autoFocus
                      maxLength={80}
                      onChange={(event) => setEditTitle(event.target.value)}
                      required
                      value={editTitle}
                    />
                  </label>
                  <div className="item-edit-fields-row">
                    <label className="form-group">
                      <span className="form-label">Тип объявления <span>*</span></span>
                      <select
                        onChange={(event) => {
                          if (event.target.value === "lost" || event.target.value === "found") {
                            setEditType(event.target.value);
                          }
                        }}
                        value={editType}
                      >
                        <option value="lost">Потерял(а)</option>
                        <option value="found">Нашёл(ла)</option>
                      </select>
                    </label>
                    <label className="form-group">
                      <span className="form-label">Категория <span>*</span></span>
                      <select
                        onChange={(event) => setEditCategory(event.target.value)}
                        required
                        value={editCategory}
                      >
                        {ITEM_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="item-edit-fields-row">
                    <label className="form-group">
                      <span className="form-label">Место <span>*</span></span>
                      <input
                        maxLength={120}
                        onChange={(event) => setEditPlace(event.target.value)}
                        required
                        value={editPlace}
                      />
                    </label>
                    <label className="form-group">
                      <span className="form-label">Дата <span>*</span></span>
                      <input
                        max={today}
                        onChange={(event) => setEditDate(event.target.value)}
                        required
                        type="date"
                        value={editDate}
                      />
                    </label>
                  </div>
                  <label className="form-group">
                    <span className="form-label">Описание</span>
                    <textarea
                      maxLength={1500}
                      onChange={(event) => setEditDetails(event.target.value)}
                      rows={4}
                      value={editDetails}
                    />
                    <span className="item-edit-character-count">{editDetails.length}/1500</span>
                  </label>
                  <label className="form-group">
                    <span className="form-label">Telegram <span>*</span></span>
                    <div className="telegram-input">
                      <span aria-hidden="true">@</span>
                      <input
                        autoComplete="username"
                        maxLength={33}
                        onChange={(event) => setEditTelegram(event.target.value)}
                        placeholder="username"
                        required
                        value={editTelegram}
                      />
                    </div>
                    <span className="item-edit-hint">Укажите имя пользователя без ссылки, например @student.</span>
                  </label>
                </form>
              </DialogContent>
              <DialogActions className="item-edit-dialog-actions">
                <Button disabled={isSavingEdit} onClick={closeEditDialog} variant="outlined">
                  Отмена
                </Button>
                <Button disabled={isSavingEdit} form="item-edit-form" type="submit" variant="contained">
                  {isSavingEdit ? "Сохраняем…" : "Сохранить изменения"}
                </Button>
              </DialogActions>
            </Dialog>

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
