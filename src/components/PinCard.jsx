import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { fmtSize } from '../utils/helpers';

/**
 * PinCard — Individual gallery item.
 * Wrapped in React.memo to prevent re-renders when parent list updates.
 * Uses IntersectionObserver for lazy loading + smooth fade-in.
 */
const PinCard = memo(function PinCard({ data: pin, onOpenLightbox, onToggleSave, isSaved }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef(null);
  const videoRef = useRef(null);

  // Lazy load: only load image src when card scrolls near viewport
  useEffect(() => {
    if (pin.isVideo) {
      setInView(true);
      return;
    }

    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pin.isVideo]);

  const handleMouseEnter = useCallback(() => {
    if (videoRef.current) videoRef.current.play().catch(() => {});
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  const handleImgError = useCallback(() => {
    setImgLoaded(true);
    setImgError(true);
  }, []);

  const sizeText = pin.isUrl ? 'URL' : fmtSize(pin.size);

  return (
    <div
      ref={cardRef}
      className="pin"
      onClick={() => onOpenLightbox(pin._idx)}
      onMouseEnter={pin.isVideo ? handleMouseEnter : undefined}
      onMouseLeave={pin.isVideo ? handleMouseLeave : undefined}
    >
      {pin.isVideo ? (
        <>
          <video
            ref={videoRef}
            src={pin.src}
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div className="pin-badge">Video</div>
        </>
      ) : (
        <div className="pin-media-wrap">
          {/* Shimmer placeholder — fades out after image loads */}
          <div className={`pin-placeholder${imgLoaded ? ' hide' : ''}`} />

          {/* Error state */}
          {imgError && (
            <div className="pin-error">
              <div className="pin-error-icon">×</div>
              <div className="pin-error-text">Could not load</div>
            </div>
          )}

          {/* Image — fades + scales in smoothly */}
          {inView && !imgError && (
            <img
              src={pin.src}
              alt={pin.name}
              loading="lazy"
              className={`pin-img${imgLoaded ? ' loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={handleImgError}
            />
          )}
        </div>
      )}

      <div className="pin-overlay">
        <div className="pin-name">{pin.name}</div>
        <div className="pin-size">{sizeText}</div>
      </div>

      <button
        className="pin-save"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave(pin._idx);
        }}
      >
        {isSaved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
});

export default PinCard;
