import { useMemo, useCallback } from 'react';
import { Masonry } from 'masonic';
import PinCard from './PinCard';

/**
 * GalleryGrid — Virtualized masonry layout using Masonic.
 * Only renders items visible in the viewport + a buffer.
 * Can handle 10,000+ items without performance degradation.
 */
export default function GalleryGrid({ filteredPins, savedSet, onOpenLightbox, onToggleSave }) {
  // Masonic render function — receives { data, index, width }
  const renderItem = useCallback(
    ({ data }) => (
      <PinCard
        data={data}
        onOpenLightbox={onOpenLightbox}
        onToggleSave={onToggleSave}
        isSaved={!!savedSet[data._idx]}
      />
    ),
    [savedSet, onOpenLightbox, onToggleSave]
  );

  // Masonic needs a stable items array with id fields
  const items = useMemo(() => {
    return filteredPins.map((pin) => ({
      ...pin,
      id: pin._idx, // Masonic requires an `id` field
    }));
  }, [filteredPins]);

  if (items.length === 0) return null;

  return (
    <div className="masonry-wrapper">
      <Masonry
        items={items}
        render={renderItem}
        columnGutter={14}
        columnWidth={260}
        overscanBy={5}
        role="grid"
      />
    </div>
  );
}
