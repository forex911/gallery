import { useMemo, useCallback, useState, useEffect } from 'react';
import { Masonry } from 'masonic';
import PinCard from './PinCard';

/**
 * GalleryGrid — Virtualized masonry layout using Masonic.
 * Only renders items visible in the viewport + a buffer.
 * Can handle 10,000+ items without performance degradation.
 */
export default function GalleryGrid({ filteredPins, savedSet, onOpenLightbox, onToggleSave }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    let frameId;
    const handleResize = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setWindowWidth(window.innerWidth);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  const gridConfig = useMemo(() => {
    if (windowWidth < 600) {
      // Mobile Phones: Force 2 symmetrical columns (account for 12px lateral masonry padding)
      return { columnWidth: Math.max(120, (windowWidth - 24 - 10) / 2), columnGutter: 10 };
    } else if (windowWidth < 900) {
      // Tablets
      return { columnWidth: 200, columnGutter: 14 };
    } else if (windowWidth >= 1600) {
      // Ultra-wide 4k Displays
      return { columnWidth: 320, columnGutter: 24 };
    }
    // Standard Desktops & Laptops
    return { columnWidth: 260, columnGutter: 16 };
  }, [windowWidth]);

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
        columnGutter={gridConfig.columnGutter}
        columnWidth={gridConfig.columnWidth}
        overscanBy={5}
        role="grid"
      />
    </div>
  );
}
