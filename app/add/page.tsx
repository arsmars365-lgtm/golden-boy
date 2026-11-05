"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useState,
} from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { useLanguage } from "@/components/language-provider";
import {
  getDaysAgo,
  getItemArt,
  ITEM_CATEGORIES,
  saveItem,
  type ItemType,
} from "@/lib/items";
import { categoryTranslationKey } from "@/lib/messages";
import { useTodayDate } from "@/lib/use-stored-items";
import { useDemoAuth } from "@/lib/use-demo-auth";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 3;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Не удалось прочитать изображение."));
        return;
      }
      const image = new Image();
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Не удалось сжать фотографию."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("Не удалось обработать фотографию."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(file);
  });
}

export default function AddItemPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const today = useTodayDate();
  const { user, isReady: isAuthReady, error: authError } = useDemoAuth();
  const [type, setType] = useState<ItemType>("lost");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [telegram, setTelegram] = useState("");
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setImageError("");
    if (!files.length) return;
    if (files.length > MAX_IMAGES) {
      setImageError(`Можно добавить не более ${MAX_IMAGES} фотографий.`);
      event.target.value = "";
      return;
    }

    const invalidType = files.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type));
    if (invalidType) {
      setImageDataUrls([]);
      setImageNames([]);
      setImageError(t("form.error.imageType"));
      event.target.value = "";
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_IMAGE_SIZE);
    if (oversizedFile) {
      setImageDataUrls([]);
      setImageNames([]);
      setImageError(t("form.error.imageSize"));
      event.target.value = "";
      return;
    }

    try {
      setImageDataUrls(await Promise.all(files.map(readImage)));
      setImageNames(files.map((file) => file.name));
    } catch (imageReadError) {
      setImageDataUrls([]);
      setImageNames([]);
      setImageError(
        imageReadError instanceof Error
          ? imageReadError.message
          : t("form.error.uploadImage"),
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!user) {
      setError("Войди или зарегистрируйся, чтобы опубликовать объявление.");
      return;
    }
    const selectedDate = date || today;

    const normalizedTelegram = telegram.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{5,32}$/.test(normalizedTelegram)) {
      setError(t("form.error.telegram"));
      return;
    }

    if (!selectedDate) {
      setError(t("form.error.date"));
      return;
    }

    setIsSaving(true);
    const { art, symbol } = getItemArt(category);
    const now = new Date();
    const itemId = crypto.randomUUID();

    try {
      await saveItem({
        id: itemId,
        title: title.trim(),
        category,
        type,
        place: place.trim(),
        date: selectedDate,
        daysAgo: getDaysAgo(selectedDate),
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        status: "searching",
        art,
        symbol,
        details: details.trim(),
        telegram: normalizedTelegram,
        ownerId: user.id,
        ...(imageDataUrls.length ? { imageDataUrls } : {}),
      });
      router.push(`/item/${itemId}`);
    } catch (saveError) {
      setIsSaving(false);
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("form.error.save"),
      );
    }
  }

  if (!isAuthReady) {
    return (
      <main className="foundly-shell container-fluid px-0">
        <SiteHeader active="add" />
        <section className="auth-required-state container">
          <p>Проверяем аккаунт...</p>
        </section>
        <SiteFooter />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="foundly-shell container-fluid px-0">
        <SiteHeader active="add" />
        <section className="auth-required-state container">
          <span className="section-kicker">ПУБЛИКАЦИЯ ОБЪЯВЛЕНИЯ</span>
          <h1>Сначала войди в аккаунт</h1>
          <p>
            Демо-аккаунт нужен, чтобы сохранить объявление за его автором и
            управлять его статусом.
          </p>
          {authError && <Alert severity="error">{authError}</Alert>}
          <div className="auth-required-actions">
            <Button
              className="detail-primary-button"
              href="/login"
              variant="contained"
            >
              Войти
            </Button>
            <Button className="auth-secondary-button" href="/register">
              Создать аккаунт
            </Button>
          </div>
        </section>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader active="add" />

      <section className="form-page">
        <div className="container form-page-container">
          <div className="form-breadcrumb">
            <Link href="/">{t("form.breadcrumbFeed")}</Link>
            <span aria-hidden="true">/</span>
            <span>{t("form.breadcrumbNew")}</span>
          </div>

          <div className="form-heading">
            <span className="section-kicker">{t("form.kicker")}</span>
              <h1>{t("form.title")}</h1>
              <p>{t("form.subtitle")}</p>
          </div>

          <form className="item-form" onSubmit={handleSubmit}>
            {error && (
              <Alert className="form-error" severity="error">
                {error}
              </Alert>
            )}

            <fieldset className="form-group">
              <legend>
                {t("form.whatHappened")} <span>*</span>
              </legend>
              <div className="kind-options">
                <button
                  aria-pressed={type === "lost"}
                  className={`kind-option ${type === "lost" ? "selected" : ""}`}
                  onClick={() => setType("lost")}
                  type="button"
                >
                  <span className="kind-icon lost-kind" aria-hidden="true">
                    ↗
                  </span>
                  <span>
                    <strong>{t("form.lostByMe")}</strong>
                    <small>{t("form.findMyItem")}</small>
                  </span>
                </button>
                <button
                  aria-pressed={type === "found"}
                  className={`kind-option ${type === "found" ? "selected" : ""}`}
                  onClick={() => setType("found")}
                  type="button"
                >
                  <span className="kind-icon found-kind" aria-hidden="true">
                    ✳
                  </span>
                  <span>
                    <strong>{t("form.foundByMe")}</strong>
                    <small>{t("form.findOwner")}</small>
                  </span>
                </button>
              </div>
            </fieldset>

            <div className="form-two-columns">
              <label className="form-group">
                <span className="form-label">
                  {t("form.itemName")} <span>*</span>
                </span>
                <input
                  autoComplete="off"
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("form.namePlaceholder")}
                  required
                  value={title}
                />
              </label>

              <label className="form-group">
                <span className="form-label">
                  {t("form.category")} <span>*</span>
                </span>
                <select
                  onChange={(event) => setCategory(event.target.value)}
                  required
                  value={category}
                >
                  <option disabled value="">
                    {t("form.chooseCategory")}
                  </option>
                  {ITEM_CATEGORIES.map((itemCategory) => (
                    <option key={itemCategory} value={itemCategory}>
                      {categoryTranslationKey(itemCategory)
                        ? t(categoryTranslationKey(itemCategory)!)
                        : itemCategory}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-group">
                <span className="form-label">{t("form.description")}</span>
              <textarea
                maxLength={1000}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
                rows={4}
                value={details}
              />
              <span className="field-hint">
                {t("form.privacyHint")}
              </span>
            </label>

            <div className="form-two-columns">
              <label className="form-group">
                <span className="form-label">
                  {t("form.location")} <span>*</span>
                </span>
                <input
                  maxLength={120}
                  onChange={(event) => setPlace(event.target.value)}
                  placeholder={t("form.locationPlaceholder")}
                  required
                  value={place}
                />
              </label>

              <label className="form-group">
                <span className="form-label">
                  {t("form.date")} <span>*</span>
                </span>
                <input
                  max={today}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  type="date"
                  value={date || today}
                />
              </label>
            </div>

            <div className="form-group">
              <span className="form-label">{t("form.photo")}</span>
              <label className="upload-area">
                <input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  multiple
                  type="file"
                />
                {imageDataUrls.length ? (
                  <span
                    className="upload-preview"
                    style={{ backgroundImage: `url("${imageDataUrls[0]}")` }}
                    role="img"
                    aria-label={`${t("form.photo")}: ${imageNames.join(", ")}`}
                  />
                ) : (
                  <span className="upload-icon" aria-hidden="true">
                    ↑
                  </span>
                )}
                <span className="upload-copy">
                  <strong>{imageNames.join(", ") || t("form.addPhoto")}</strong>
                  <small>JPG, PNG или WebP · до 5 МБ каждое · максимум 3 фото</small>
                </span>
                <span className="upload-browse">{t("form.chooseFile")}</span>
              </label>
              {imageError && (
                <span className="field-error" role="alert">
                  {imageError}
                </span>
              )}
            </div>

            <div className="form-divider" />

            <label className="form-group">
              <span className="form-label">
                {t("form.telegram")} <span>*</span>
              </span>
              <div className="telegram-input">
                <span aria-hidden="true">@</span>
                <input
                  autoComplete="off"
                  maxLength={33}
                  onChange={(event) => setTelegram(event.target.value)}
                  pattern="@?[A-Za-z0-9_]{5,32}"
                  placeholder="username"
                  required
                  value={telegram}
                />
              </div>
              <span className="field-hint">
                {t("form.telegramHint")}
              </span>
            </label>

            <div className="form-submit-row">
              <Link className="cancel-link" href="/">
                {t("form.cancel")}
              </Link>
              <Button
                className="form-submit-button"
                disabled={isSaving}
                type="submit"
                variant="contained"
              >
                {isSaving ? t("form.saving") : t("form.submit")}
                <span aria-hidden="true">→</span>
              </Button>
            </div>
          </form>

          <p className="form-privacy-note">
            {t("form.privacyNote")}
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
