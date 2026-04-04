import { useState, useCallback, useRef } from 'react';
import { useGallery } from './hooks/useGallery';
import TopBar from './components/TopBar';
import StatsBar from './components/StatsBar';
import DropZone from './components/DropZone';
import GalleryGrid from './components/GalleryGrid';
import Lightbox from './components/Lightbox';
import UrlModal from './components/UrlModal';
import './App.css';

export default function App() {
  const {
    state,
    stats,
    pinsLength,
    filteredPins,
    handleFiles,
    loadFromUrls,
    setFilter,
    setSearch,
    setSort,
    toggleSave,
    clearUrlStatus,
  } = useGallery();

  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const searchTimerRef = useRef(null);

  const hasPins = pinsLength > 0;

  // Debounced search — fires setSearch after 200ms idle
  const handleSearch = useCallback(
    (value) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        setSearch(value);
      }, 200);
    },
    [setSearch]
  );

  // Lightbox handlers
  const openLightbox = useCallback(
    (idx) => {
      const pos = filteredPins.findIndex((p) => p._idx === idx);
      setLightboxIndex(pos >= 0 ? pos : 0);
    },
    [filteredPins]
  );

  const closeLightbox = useCallback(() => {
    setLightboxIndex(-1);
  }, []);

  const navigateLightbox = useCallback(
    (dir) => {
      setLightboxIndex((prev) => {
        const len = filteredPins.length;
        if (len <= 1) return prev;
        return (prev + dir + len) % len;
      });
    },
    [filteredPins.length]
  );

  // URL modal
  const handleUrlLoad = useCallback(
    (text) => {
      loadFromUrls(text);
    },
    [loadFromUrls]
  );

  const handleUrlModalClose = useCallback(() => {
    setUrlModalOpen(false);
    clearUrlStatus();
  }, [clearUrlStatus]);

  return (
    <div id="app">
      <TopBar
        onSearch={handleSearch}
        onUpload={handleFiles}
        onUrlClick={() => setUrlModalOpen(true)}
        progress={state.progress}
      />

      {hasPins && (
        <StatsBar
          totalPins={stats.total}
          photoCount={stats.photoCount}
          videoCount={stats.videoCount}
          fileCount={stats.fileCount}
          activeFilter={state.filter}
          onFilter={setFilter}
          activeSort={state.sort}
          onSort={setSort}
        />
      )}

      {!hasPins && (
        <DropZone
          onUpload={handleFiles}
          onUrlClick={() => setUrlModalOpen(true)}
        />
      )}

      {hasPins && (
        <>
          <GalleryGrid
            key={`${state.filter}-${state.sort}-${state.search}`}
            filteredPins={filteredPins}
            savedSet={state.savedSet}
            onOpenLightbox={openLightbox}
            onToggleSave={toggleSave}
          />
          {filteredPins.length === 0 && (
            <div className="empty-filter">No items match your search.</div>
          )}
        </>
      )}

      {lightboxIndex >= 0 && (
        <Lightbox
          pins={filteredPins}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}

      <UrlModal
        isOpen={urlModalOpen}
        onClose={handleUrlModalClose}
        onLoad={handleUrlLoad}
        urlStatus={state.urlStatus}
      />
    </div>
  );
}
