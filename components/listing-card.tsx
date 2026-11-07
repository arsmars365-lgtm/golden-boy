import Chip from "@mui/material/Chip";
import Link from "next/link";
import type { Item } from "@/lib/items";

type ListingCardLabels = {
  lost: string;
  found: string;
  returned: string;
  foundStatus: string;
  ownerSearch: string;
  more: string;
  addFavorite: string;
  inFavorites: string;
};

type ListingCardProps = {
  item: Item;
  title: string;
  place: string;
  details: string;
  category: string;
  dateLabel: string;
  labels: ListingCardLabels;
  isFavorite: boolean;
  favoritesReady: boolean;
  onToggleFavorite: (itemId: string) => void;
};

export default function ListingCard({
  item,
  title,
  place,
  details,
  category,
  dateLabel,
  labels,
  isFavorite,
  favoritesReady,
  onToggleFavorite,
}: ListingCardProps) {
  return (
    <article className="item-card">
      <Link
        className="item-card-link"
        href={`/item/${encodeURIComponent(item.id)}`}
        aria-label={`${labels.more}: ${title}`}
      >
        <div
          className={`item-art ${item.art}${item.imageDataUrl ? " has-photo" : ""}`}
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
          <Chip
            className={`type-badge ${item.type}`}
            label={item.type === "lost" ? labels.lost : labels.found}
            size="small"
          />
        </div>
        <div className="item-card-content">
          <div className="item-card-title-row">
            <h3>{title}</h3>
            <span className="item-arrow" aria-hidden="true">
              ↗
            </span>
          </div>
          <div className="item-meta">
            <span className="category-label">{category}</span>
            <span className="place-label">
              <Pin /> {place}
            </span>
            <span className="art-date">{dateLabel}</span>
          </div>
          {item.ownerUsername && (
            <span className="item-author">
              @{item.ownerUsername}
              {item.ownerVerified && (
                <span
                  className="item-verified-dot"
                  aria-label="Подтверждённый пользователь"
                >
                  ✓
                </span>
              )}
            </span>
          )}
          <p className="item-description">{details}</p>
          <div className="item-card-footer">
            <span className={`status-label ${item.status}`}>
              <span />
              {item.status === "returned"
                ? labels.returned
                : item.status === "found"
                  ? labels.foundStatus
                  : labels.ownerSearch}
            </span>
            <span className="card-open">{labels.more}</span>
          </div>
        </div>
      </Link>
      <button
        aria-label={isFavorite ? `Убрать из избранного: ${title}` : `Добавить в избранное: ${title}`}
        className={`favorite-toggle ${isFavorite ? "is-favorite" : ""}`}
        type="button"
        aria-pressed={isFavorite}
        disabled={!favoritesReady}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleFavorite(item.id);
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"}>
          <path d="M12 20.7 4.9 13.9a4.7 4.7 0 0 1 6.7-6.6L12 7.6l.4-.3a4.7 4.7 0 1 1 6.7 6.6L12 20.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </article>
  );
}

function Pin() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M19 10.1c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}
