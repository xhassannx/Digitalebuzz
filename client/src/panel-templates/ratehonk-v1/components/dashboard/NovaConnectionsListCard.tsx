import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Link } from "wouter";

export type NovaConnectionIconKind = "image" | "payment" | "whatsapp";

export type NovaConnectionListItem = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: "success" | "muted" | "warning" | "error";
  iconSrc?: string;
  iconAlt?: string;
  iconKind?: NovaConnectionIconKind;
};

type NovaConnectionsListCardProps = {
  title: string;
  items: NovaConnectionListItem[];
  isLoading?: boolean;
  emptyText: string;
  viewAllHref: string;
  viewAllLabel?: string;
  maxItems?: number;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ConnectionRowIcon({ item }: { item: NovaConnectionListItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const kind = item.iconKind ?? (item.iconSrc ? "image" : undefined);

  if (kind === "whatsapp") {
    return (
      <span className="nova-connections-card__icon-shell nova-connections-card__icon-shell--whatsapp">
        <WhatsAppIcon className="h-4 w-4" />
      </span>
    );
  }

  if (kind === "payment") {
    return (
      <span className="nova-connections-card__icon-shell nova-connections-card__icon-shell--payment">
        <CreditCard className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  if (item.iconSrc && !imageFailed) {
    return (
      <img
        src={item.iconSrc}
        alt={item.iconAlt ?? ""}
        className="nova-connections-card__icon"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className="nova-connections-card__icon-fallback" aria-hidden>
      {item.title.charAt(0).toUpperCase()}
    </span>
  );
}

export function NovaConnectionsListCard({
  title,
  items,
  isLoading = false,
  emptyText,
  viewAllHref,
  viewAllLabel = "Manage",
  maxItems = 6,
}: NovaConnectionsListCardProps) {
  const visible = items.slice(0, maxItems);

  return (
    <div className="nova-panel-card nova-connections-card flex h-full min-h-[260px] flex-col p-4 sm:p-5">
      <div className="nova-connections-card__header">
        <h2 className="nova-connections-card__title">{title}</h2>
        <Link href={viewAllHref} className="nova-connections-card__manage">
          {viewAllLabel}
        </Link>
      </div>

      {isLoading ? (
        <div className="nova-connections-card__loading">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--rh-brand)]" />
        </div>
      ) : visible.length === 0 ? (
        <p className="nova-connections-card__empty">{emptyText}</p>
      ) : (
        <ul className="nova-connections-card__list">
          {visible.map((item) => (
            <li key={item.id} className="nova-connections-card__row">
              <ConnectionRowIcon item={item} />
              <div className="nova-connections-card__text">
                <span className="nova-connections-card__name">{item.title}</span>
                {item.subtitle ? (
                  <span className="nova-connections-card__sub">{item.subtitle}</span>
                ) : null}
              </div>
              {item.badge ? (
                <span
                  className={`nova-connections-card__badge nova-connections-card__badge--${item.badgeTone ?? "success"}`}
                >
                  {item.badge}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
