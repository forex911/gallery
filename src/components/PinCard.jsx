import { memo, useRef, useState, useCallback } from 'react';
import { fmtSize, getExt } from '../utils/helpers';

/**
 * PinCard — Individual gallery item.
 * 
 * Critical performance fixes:
 * - Videos are LAZY: no src until hover. Shows poster/thumbnail only.
 *   This prevents 100s of video elements from downloading simultaneously.
 * - React.memo prevents re-renders from parent updates
 * - Reads savedSet/callbacks from refs (avoids prop-change re-renders)
 * - decoding="async" for non-blocking image decode
 */
const PinCard = memo(function PinCard({ data: pin, savedSetRef, onOpenLightboxRef, onToggleSaveRef }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(pin.isOther ? 1 : 4/3);
  const [videoActive, setVideoActive] = useState(false); // Only load video src on hover
  const videoRef = useRef(null);

  const isSaved = !!(savedSetRef.current[pin._idx]);

  const handleClick = useCallback(() => {
    onOpenLightboxRef.current(pin._idx);
  }, [pin._idx, onOpenLightboxRef]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    onToggleSaveRef.current(pin._idx);
  }, [pin._idx, onToggleSaveRef]);

  // Video: set src and play ONLY on hover
  const handleMouseEnter = useCallback(() => {
    if (pin.isVideo) {
      setVideoActive(true);
      // Need a small delay for the src to be set before playing
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      });
    }
  }, [pin.isVideo]);

  const handleMouseLeave = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load(); // Release the media resource
    }
    setVideoActive(false);
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
            {/* Show thumbnail image by default; only mount video element on hover */}
            {!videoActive ? (
              <img
                src={pin.thumbSrc || pin.src}
                alt={pin.name}
                loading="lazy"
                decoding="async"
                className="pin-img loaded"
                style={{ background: '#000' }}
              />
            ) : (
              <video
                ref={videoRef}
                src={pin.src}
                muted
                loop
                playsInline
                preload="auto"
                onLoadedMetadata={handleVideoLoad}
                style={{ background: '#000' }}
              />
            )}
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
