import { memo, useRef, useState, useCallback } from 'react';
import { fmtSize, getExt } from '../utils/helpers';

/**
 * PinCard — Individual gallery item.
 * 
 * Video strategy:
 * - Always render <video preload="metadata"> — only downloads first frame + dimensions
 * - Masonic virtualizes so only ~20-30 videos are mounted at any time (safe)
 * - On hover: play with audio (fallback to muted if browser blocks)
 * - On leave: pause + reset
 */
const PinCard = memo(function PinCard({ data: pin, savedSetRef, onOpenLightboxRef, onToggleSaveRef }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(pin.isOther ? 1 : 4/3);
  const videoRef = useRef(null);

  const isSaved = !!(savedSetRef.current[pin._idx]);

  const handleClick = useCallback(() => {
    onOpenLightboxRef.current(pin._idx);
  }, [pin._idx, onOpenLightboxRef]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    onToggleSaveRef.current(pin._idx);
  }, [pin._idx, onToggleSaveRef]);

  // Play with audio on hover — fallback to muted if browser blocks
  const handleMouseEnter = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === 'NotAllowedError' && videoRef.current) {
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
      videoRef.current.muted = true;
    }
  }, []);

  const handleImgLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setAspectRatio(naturalWidth / naturalHeight);
    }
    setImgLoaded(true);
  }, []);

  const handleVideoLoad = useCallback((e) => {
    const { videoWidth, videoHeight } = e.target;
    if (videoWidth && videoHeight) {
      setAspectRatio(videoWidth / videoHeight);
    }
  }, []);

  const handleImgError = useCallback(() => {
    setImgLoaded(true);
    setImgError(true);
  }, []);

  const sizeText = pin.isUrl ? 'URL' : fmtSize(pin.size);

  return (
    <div
      className="pin"
      onClick={handleClick}
      onMouseEnter={pin.isVideo ? handleMouseEnter : undefined}
      onMouseLeave={pin.isVideo ? handleMouseLeave : undefined}
    >
      <div className="pin-media-wrap" style={{ aspectRatio }}>
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
            <div className={`pin-placeholder${imgLoaded ? ' hide' : ''}`} />

            {imgError && (
              <div className="pin-error">
                <div className="pin-error-icon">×</div>
                <div className="pin-error-text">Could not load</div>
              </div>
            )}

            {!imgError && (
              <img
                src={pin.thumbSrc || pin.src}
                alt={pin.name}
                loading="lazy"
                decoding="async"
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

      <button className="pin-save" onClick={handleSave}>
        {isSaved ? 'Saved' : 'Save'}
      </button>

      {/* Mobile Info Block */}
      <div className="pin-info">
        <div className="pin-info-title">{pin.name}</div>
        <button 
          className="pin-info-more"
          onClick={handleSave}
          title={isSaved ? "Saved" : "Save"}
        >
          {isSaved ? '★' : '···'}
        </button>
      </div>
    </div>
  );
});

export default PinCard;
