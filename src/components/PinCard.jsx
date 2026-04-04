import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { fmtSize, getExt } from '../utils/helpers';

/**
 * PinCard — Individual gallery item.
 * 
 * Performance fixes for 5000+ files:
 * 1. Cached Dimensions: aspectRatio is saved on the `pin` object. This COMPLETELY prevents
 *    rearranging and jumping when scrolling up, since items instantly remount with the right size.
 * 2. Video Thumbnail Generation: To prevent GPU memory blackouts, videos DO NOT render <video> tags.
 *    Instead, we draw a low-quality frame to offscreen canvas, generate a lightweight JPEG,
 *    and render a standard <img> tag. The <video> element is immediately garbage collected.
 * 3. Hover Playback: True <video> only mounts exactly while hovered. Tries unmuted first.
 */
const PinCard = memo(function PinCard({ data: pin, savedSetRef, onOpenLightboxRef, onToggleSaveRef }) {
  // Initialize from cache if available to prevent layout shift
  const [aspectRatio, setAspectRatio] = useState(pin.aspectRatio || (pin.isOther ? 1 : 4/3));
  const [thumbSrc, setThumbSrc] = useState(pin.thumbSrc || (pin.isVideo ? null : pin.src));
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  
  const videoRef = useRef(null);
  const isSaved = !!(savedSetRef.current[pin._idx]);

  const handleClick = useCallback(() => {
    onOpenLightboxRef.current(pin._idx);
  }, [pin._idx, onOpenLightboxRef]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    onToggleSaveRef.current(pin._idx);
  }, [pin._idx, onToggleSaveRef]);

  // Generate thumbnail for videos on mount to avoid rendering black <video> boxes
  useEffect(() => {
    let isMounted = true;
    let tempVid = null;

    if (pin.isVideo && !pin.thumbSrc) {
      tempVid = document.createElement('video');
      tempVid.src = pin.src;
      tempVid.muted = true;
      tempVid.playsInline = true;
      tempVid.preload = 'metadata';
      tempVid.crossOrigin = 'anonymous';

      tempVid.onloadeddata = () => {
        // Seek to 0.5s to get a frame past black screens
        tempVid.currentTime = Math.min(0.5, tempVid.duration / 2 || 0);
      };

      tempVid.onseeked = () => {
        if (!isMounted) return;
        const ratio = tempVid.videoWidth / tempVid.videoHeight || 4/3;
        
        // Persist ratio immediately to prevent jitter
        pin.aspectRatio = ratio;
        setAspectRatio(ratio);

        try {
          const canvas = document.createElement('canvas');
          // Scale to max 400px for low quality performance 
          canvas.width = Math.min(tempVid.videoWidth, 400);
          canvas.height = canvas.width / ratio;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempVid, 0, 0, canvas.width, canvas.height);
          
          // Generate low quality JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          
          pin.thumbSrc = dataUrl;
          setThumbSrc(dataUrl);
        } catch (err) {
          // Fallback if cross-origin canvas is blocked
          pin.thumbSrc = pin.src;
          setThumbSrc(pin.src);
        }

        // Extremely important: Free up memory
        tempVid.removeAttribute('src');
        tempVid.load();
        tempVid = null;
      };

      tempVid.onerror = () => {
        if (!isMounted) return;
        setImgError(true);
      };
    }

    return () => {
      isMounted = false;
      if (tempVid) {
        tempVid.removeAttribute('src');
        tempVid.load();
      }
    };
  }, [pin]);

  // When standard images load, save their ratio to fix scroll-up jitter
  const handleImgLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      pin.aspectRatio = ratio; // Persist on pin object! No jump on remounts!
      setAspectRatio(ratio);
    }
    setImgLoaded(true);
  }, [pin]);

  const handleImgError = useCallback(() => {
    setImgLoaded(true);
    setImgError(true);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (pin.isVideo) {
      setVideoActive(true);
    }
  }, [pin.isVideo]);

  const handleMouseLeave = useCallback(() => {
    if (pin.isVideo) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setVideoActive(false);
    }
  }, [pin.isVideo]);

  // Handle Playback/Audio unmuting safely 
  useEffect(() => {
    if (videoActive && videoRef.current) {
      videoRef.current.muted = false; // Try unmuted
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Audio blocked by browser -> fallback to muted
          if (err.name === 'NotAllowedError' && videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [videoActive]);

  const sizeText = pin.isUrl ? 'URL' : fmtSize(pin.size);

  return (
    <div
      className="pin"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="pin-media-wrap" style={{ aspectRatio }}>
        {pin.isVideo ? (
          <>
            {videoActive ? (
              <video
                ref={videoRef}
                src={pin.src}
                loop
                playsInline
                preload="auto"
                style={{ objectFit: 'cover', width: '100%', height: '100%', background: '#000', display: 'block' }}
              />
            ) : thumbSrc ? (
              <img
                src={thumbSrc}
                alt={pin.name}
                loading="lazy"
                decoding="async"
                className="pin-img loaded"
                style={{ background: '#000' }}
              />
            ) : (
              <div className="pin-placeholder" />
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
