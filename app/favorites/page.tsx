"use client";

import Link from "next/link";
import { useMemo } from "react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import ListingCard from "@/components/listing-card";
import { useFavorites } from "@/components/favorites-provider";
import { useLanguage } from "@/components/language-provider";
import { formatItemDate, getAllItems } from "@/lib/items";
import { useStoredItems } from "@/lib/use-stored-items";

export default function FavoritesPage() {
  const { language, t } = useLanguage();
  const { favoriteIds, error, isReady, toggleFavorite } = useFavorites();
  const {
    items: storedItems,
    error: storageError,
    isReady: itemsReady,
  } = useStoredItems();
  const items = useMemo(() => getAllItems(storedItems), [storedItems]);
  const favorites = useMemo(
    () => items.filter((item) => favoriteIds.includes(item.id)),
    [favoriteIds, items],
  );

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader active="favorites" />
      <section className="feed-section container favorites-page">
        <div className="feed-heading favorites-heading">
          <div>
            <span className="section-kicker">{t("favorites.kicker")}</span>
            <h1>
              {t("favorites.title")} <span>({favorites.length})</span>
            </h1>
          </div>
        </div>

        {(error || storageError) && (
          <div className="storage-message" role="alert">
            {error || storageError}
          </div>
        )}

        {!isReady || !itemsReady ? (
          <p className="favorites-loading" role="status">
            {t("favorites.loading")}
          </p>
        ) : favorites.length === 0 ? (
          <div className="favorites-empty">
            <p>{t("favorites.empty")}</p>
            <Link className="favorites-back-button" href="/">
              {t("favorites.backToFeed")}
            </Link>
          </div>
        ) : (
          <div className="row g-4 item-grid">
            {favorites.map((item) => (
              <div className="col-12 col-sm-6 col-lg-4" key={item.id}>
                <ListingCard
                  item={item}
                  title={item.title}
                  place={item.place}
                  details={item.details}
                  category={item.category}
                  dateLabel={formatItemDate(item.daysAgo, item.time, language)}
                  labels={{
                    lost: t("detail.lost"),
                    found: t("detail.found"),
                    returned: t("status.returned"),
                    foundStatus: t("status.found"),
                    ownerSearch: t("status.searching"),
                    more: t("feed.more"),
                    addFavorite: t("favorites.add"),
                    inFavorites: t("favorites.inFavorites"),
                  }}
                  isFavorite
                  favoritesReady={isReady}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
