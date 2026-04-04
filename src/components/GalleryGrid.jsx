import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Masonry } from 'masonic';
import PinCard from './PinCard';

/**
 * GalleryGrid — Virtualized masonry layout using Masonic.
 * 
 * Performance optimizations for 5000+ items:
 * - savedSet accessed via ref to avoid re-creating renderItem on every save toggle
 * - Stable renderItem reference prevents Masonic from re-rendering all visible cells
 * - overscanBy=3 reduces offscreen rendering overhead
 */
export default function GalleryGrid({ filteredPins, savedSet, onOpenLightbox, onToggleSave }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Store savedSet in a ref so renderItem doesn't depend on it
  const savedSetRef = useRef(savedSet);
  savedSetRef.current = savedSet;

  // Store callbacks in refs for stable renderItem
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

  // Stable render function — NO dependency on savedSet, onOpenLightbox, onToggleSave
  // Uses refs internally so Masonic never invalidates the render function
  const renderItem = useCallback(
    ({ data }) => (
      <PinCard
        data={data}
        savedSetRef={savedSetRef}
        onOpenLightboxRef={onOpenLightboxRef}
        onToggleSaveRef={onToggleSaveRef}
      />
    ),
    [] // Empty deps = stable reference forever
  );

  // Masonic needs a stable items array with id fields
  const items = useMemo(() => {
    return filteredPins.map((pin) => ({
      ...pin,
      id: pin._idx,
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
        overscanBy={3}
        role="grid"
      />
    </div>
  );
}
