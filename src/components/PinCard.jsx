import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { fmtSize, getExt } from '../utils/helpers';

/**
 * PinCard — Individual gallery item.
 * Wrapped in React.memo to prevent re-renders when parent list updates.
 * Uses IntersectionObserver for lazy loading + smooth fade-in.
 */
const PinCard = memo(function PinCard({ data: pin, onOpenLightbox, onToggleSave, isSaved }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(pin.aspectRatio || (pin.isOther ? 1 : 4/3));
  const cardRef = useRef(null);
  const videoRef = useRef(null);

  // We rely entirely on <img loading="lazy"> to natively handle decoding. 
  // Native virtualization from masonic handles mounting optimally.


  const handleMouseEnter = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false; // Attempt to play with audio
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // If playback with audio is blocked by the browser, fallback to muted
          if (err.name === 'NotAllowedError') {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true; // reset
    }
  }, []);

  const handleImgLoad = useCallback((e) => {
    const ratio = e.target.naturalWidth / e.target.naturalHeight;
    pin.aspectRatio = ratio;
    setAspectRatio(ratio);
    setImgLoaded(true);
  }, [pin]);

  const handleVideoLoad = useCallback((e) => {
    const ratio = e.target.videoWidth / e.target.videoHeight;
    pin.aspectRatio = ratio;
    setAspectRatio(ratio);
  }, [pin]);

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
      <div className="pin-media-wrap" style={{ aspectRatio: aspectRatio }}>
        {pin.isVideo ? (
          <>
            <video
              ref={videoRef}
              src={pin.src}
              poster={pin.thumbSrc && pin.thumbSrc !== pin.src ? pin.thumbSrc : undefined}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={handleVideoLoad}
            />
            <div className="pin-badge">Video</div>
          </>
        ) : pin.isOther ? (
          <div className="pin-other-file">
            <div className="file-icon">📄</div>
            <div className="file-ext">{getExt(pin.name).toUpperCase() || 'FILE'}</div>
          </div>
        ) : (
          <>
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
            {!imgError && (
              <img
                src={pin.thumbSrc || pin.src}
                alt={pin.name}
                loading="lazy"
                className={`pin-img${imgLoaded ? ' loaded' : ''}`}
                onLoad={handleImgLoad}
                onError={handleImgError}
              />
            )}
          </>
        )}
      </div>

      {/* Desktop Overlay */}
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

      {/* Mobile Info Block (Pinterest Style) */}
      <div className="pin-info">
        <div className="pin-info-title">{pin.name}</div>
        <button 
          className="pin-info-more"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(pin._idx);
          }}
          title={isSaved ? "Saved" : "Save"}
        >
          {isSaved ? '★' : '···'}
        </button>
      </div>
    </div>
  );
});

export default PinCard;
