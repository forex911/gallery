import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Masonry } from 'masonic';
import PinCard from './PinCard';

/**
 * GalleryGrid — Virtualized masonry layout using Masonic.
 * 
 * Performance fixes for 5000+ items:
 * - NO .map() spread on items — pins already have `id` from creation
 * - savedSet/callbacks via refs — stable renderItem, never invalidated
 * - Masonic handles all virtualization (no content-visibility conflict)
 */
export default function GalleryGrid({ filteredPins, savedSet, onOpenLightbox, onToggleSave }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  const savedSetRef = useRef(savedSet);
  savedSetRef.current = savedSet;

  const onOpenLightboxRef = useRef(onOpenLightbox);
  onOpenLightboxRef.current = onOpenLightbox;
  const onToggleSaveRef = useRef(onToggleSave);
  onToggleSaveRef.current = onToggleSave;

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
      return { columnWidth: Math.max(120, (windowWidth - 24 - 10) / 2), columnGutter: 10 };
    } else if (windowWidth < 900) {
      return { columnWidth: 200, columnGutter: 14 };
    } else if (windowWidth >= 1600) {
      return { columnWidth: 320, columnGutter: 24 };
    }
    return { columnWidth: 260, columnGutter: 16 };
  }, [windowWidth]);

  // Stable render function — empty deps = never re-created
  const renderItem = useCallback(
    ({ data }) => (
      <PinCard
        data={data}
        savedSetRef={savedSetRef}
        onOpenLightboxRef={onOpenLightboxRef}
        onToggleSaveRef={onToggleSaveRef}
      />
    ),
    []
  );

  if (filteredPins.length === 0) return null;

  return (
    <div className="masonry-wrapper">
      <Masonry
        items={filteredPins}
        render={renderItem}
        columnGutter={gridConfig.columnGutter}
        columnWidth={gridConfig.columnWidth}
        overscanBy={3}
        role="grid"
        tabIndex={0}
      />
    </div>
  );
}
