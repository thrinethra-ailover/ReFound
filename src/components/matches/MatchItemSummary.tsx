import { Badge } from '../ui/Badge';
import { getItemImageUrl } from '../../lib/itemService';
import { formatRelativeDate } from '../../utils/date';
import type { ItemWithImages } from '../../types/database';

export function MatchItemSummary({ item, role }: { item: ItemWithImages; role: 'LOST' | 'FOUND' }) {
  const primaryImage = item.item_images?.find((img) => img.is_primary) ?? item.item_images?.[0];

  return (
    <div className="flex gap-3">
      <div className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-paper">
        {primaryImage ? (
          <img src={getItemImageUrl(primaryImage.storage_path)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-light">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Badge tone={role === 'LOST' ? 'signal' : 'beacon'}>{role}</Badge>
        <p className="mt-1 truncate font-display text-sm font-semibold text-ink">{item.title}</p>
        <p className="truncate text-xs text-slate">{item.category}</p>
        <p className="truncate text-xs text-slate-light">{formatRelativeDate(item.item_datetime)}</p>
      </div>
    </div>
  );
}
