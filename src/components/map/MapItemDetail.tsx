import { Badge } from '../ui/Badge';
import { getItemImageUrl } from '../../lib/itemService';
import { formatRelativeDate } from '../../utils/date';
import type { ItemWithImages } from '../../types/database';
import { Button } from '../ui/Button';

interface MapItemDetailProps {
  item: ItemWithImages | null;
  onClose: () => void;
  onFlag?: () => void;
  canFlag?: boolean;
}

/**
 * Shows only public-safe fields — the same subset already visible on item
 * cards elsewhere in the app. Hidden verification attributes are never
 * fetched for map data in the first place, so there is nothing here that
 * could leak them.
 */
export function MapItemDetail({ item, onClose, onFlag, canFlag = false }: MapItemDetailProps) {
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-white/60 p-6 text-center">
        <p className="text-sm text-slate">Select a marker to see a summary of that report.</p>
      </div>
    );
  }

  const primaryImage = item.item_images?.find((img) => img.is_primary) ?? item.item_images?.[0];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <Badge tone={item.report_type === 'LOST' ? 'signal' : 'beacon'}>{item.report_type}</Badge>
        <button onClick={onClose} className="text-slate-light hover:text-ink" aria-label="Close detail">
          &times;
        </button>
      </div>

      {primaryImage && (
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-paper">
          <img src={getItemImageUrl(primaryImage.storage_path)} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div>
        <p className="font-display text-base font-semibold text-ink">{item.title}</p>
        <p className="text-xs font-mono uppercase tracking-wide text-slate">{item.category}</p>
      </div>

      {item.description && <p className="text-sm text-slate">{item.description}</p>}

      <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-slate">
        {item.location_name && <span>Near {item.location_name}</span>}
        <span>{formatRelativeDate(item.item_datetime)}</span>
      </div>

      <p className="text-[11px] text-slate-light">
        Marker position is approximate. Owner details are never shown here.
      </p>
      {canFlag && onFlag && <Button size="sm" variant="ghost" onClick={onFlag}>Report this listing</Button>}
    </div>
  );
}
