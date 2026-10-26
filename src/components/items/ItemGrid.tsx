import type { ReactNode } from 'react';
import { ItemCard } from './ItemCard';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import type { ItemWithImages } from '../../types/database';

interface ItemGridProps {
  items: ItemWithImages[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  renderActions?: (item: ItemWithImages) => ReactNode;
}

export function ItemGrid({
  items,
  loading,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderActions,
}: ItemGridProps) {
  if (loading) {
    return <Spinner label="Loading items…" />;
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} actions={renderActions?.(item)} />
      ))}
    </div>
  );
}
