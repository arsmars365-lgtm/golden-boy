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
          <span className="art-date">{dateLabel}</span>
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
        className="favorite-toggle"
        type="button"
        aria-pressed={isFavorite}
        disabled={!favoritesReady}
        onClick={() => onToggleFavorite(item.id)}
      >
        {isFavorite ? labels.inFavorites : labels.addFavorite}
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
