import { Badge } from '../ui/Badge';
import { formatRelativeDate } from '../../utils/date';
import { getItemImageUrl } from '../../lib/itemService';
import type { ItemWithImages } from '../../types/database';

interface ItemCardProps {
  item: ItemWithImages;
  actions?: React.ReactNode;
}

const STATUS_TONE = {
  ACTIVE: 'signal',
  RESOLVED: 'beacon',
  CANCELLED: 'slate',
} as const;

export function ItemCard({ item, actions }: ItemCardProps) {
  const primaryImage = item.item_images?.find((img) => img.is_primary) ?? item.item_images?.[0];

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <div className="relative aspect-[4/3] w-full bg-paper">
        {primaryImage ? (
          <img
            src={getItemImageUrl(primaryImage.storage_path)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-light">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 16l-5.5-5-4 4-2-2L3 18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge tone={item.report_type === 'LOST' ? 'signal' : 'beacon'}>{item.report_type}</Badge>
        </div>
        <div className="absolute right-2 top-2">
          <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-ink leading-tight">{item.title}</h3>
        </div>
        <p className="text-xs font-mono uppercase tracking-wide text-slate">{item.category}</p>
        {item.description && (
          <p className="line-clamp-2 text-sm text-slate">{item.description}</p>
        )}
        <div className="mt-auto flex flex-col gap-1 pt-2 text-xs text-slate">
          {item.location_name && (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M12 21c3.5-4 6-7.4 6-10.4A6 6 0 0 0 6 10.6C6 13.6 8.5 17 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
              {item.location_name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9.5h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {formatRelativeDate(item.item_datetime)}
          </span>
        </div>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  );
}
