import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { fmtSize, getExt } from '../utils/helpers';
import { globalVideoStore } from '../utils/videoStore';

/**
 * PinCard — Individual gallery item.
 * 
 * Performance fixes for 5000+ files:
 * 1. Cached Dimensions: aspectRatio is saved on the `pin` object. This COMPLETELY prevents
 *    rearranging and jumping when scrolling up, since items instantly remount with the right size.
 * 2. ObjectURL Lifecycle: local file Object URLs are created on mount and revoked on unmount, keeping only ~50 at a time.
 * 3. Video Thumbnail Generation: To prevent GPU memory blackouts, videos generate a lightweight JPEG thumbnail.
 * 4. Hover Playback/Strict Rules: 150ms delay, and ONE active video globally enforced via globalVideoStore.
 */
const PinCard = memo(function PinCard({ data: pin, savedSetRef, onOpenLightboxRef, onToggleSaveRef }) {
  // Ephemeral Object URL for local files (only alive when card is mounted by Masonic)
  const [localUrl, setLocalUrl] = useState(null);

  useEffect(() => {
    if (pin.sourceType === 'local' && pin.file) {
      const url = URL.createObjectURL(pin.file);
      setLocalUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pin.sourceType, pin.file]);

  const activeSrc = pin.sourceType === 'local' ? localUrl : pin.url;

  const [aspectRatio, setAspectRatio] = useState(pin.aspectRatio || (pin.isOther ? 1 : 4/3));
  const [thumbSrc, setThumbSrc] = useState(pin.thumbUrl || (pin.isVideo ? null : activeSrc));
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const videoRef = useRef(null);
  const isSaved = !!(savedSetRef.current[pin._idx]);

  // Update thumbSrc if activeSrc becomes available and no cache exists
  useEffect(() => {
    if (!pin.isVideo && !pin.thumbUrl && activeSrc) {
      setThumbSrc(activeSrc);
    }
  }, [activeSrc, pin.isVideo, pin.thumbUrl]);

  const handleClick = useCallback(() => {
    onOpenLightboxRef.current(pin._idx);
  }, [pin._idx, onOpenLightboxRef]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    onToggleSaveRef.current(pin._idx);
  }, [pin._idx, onToggleSaveRef]);

  const handleCopyName = useCallback((e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pin.name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [pin.name]);

  const handleDownload = useCallback((e) => {
    e.stopPropagation();
    let downloadUrl = activeSrc;
    if (downloadUrl && (downloadUrl.includes('drive.google.com') || downloadUrl.includes('googleusercontent.com'))) {
      const match = downloadUrl.match(/id=([a-zA-Z0-9_-]+)/) || downloadUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', pin.name);
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [activeSrc, pin.name]);

  // Generate thumbnail for videos on mount to avoid rendering black <video> boxes
  useEffect(() => {
    if (!activeSrc) return;
    let isMounted = true;
    let tempVid = null;

    if (pin.isVideo && !pin.thumbUrl) {
      tempVid = document.createElement('video');
      tempVid.src = activeSrc;
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
          
          pin.thumbUrl = dataUrl;
          setThumbSrc(dataUrl);
        } catch (err) {
          // Fallback if cross-origin canvas is blocked
          pin.thumbUrl = activeSrc;
          setThumbSrc(activeSrc);
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
  }, [pin, activeSrc]);

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

  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = useCallback(() => {
    if (pin.isVideo) {
      hoverTimeoutRef.current = setTimeout(() => {
        setVideoActive(true);
      }, 150);
    }
  }, [pin.isVideo]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (pin.isVideo) {
      if (videoRef.current) {
        globalVideoStore.clearActive(videoRef.current);
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // strict reset rule
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setVideoActive(false);
    }
  }, [pin.isVideo]);

  // Handle Playback safely with global enforcement
  useEffect(() => {
    if (videoActive && videoRef.current) {
      globalVideoStore.registerPlaying(videoRef.current);
      videoRef.current.muted = true; // Preview muted
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
           // ignored
        });
      }
    }
  }, [videoActive]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (videoRef.current) {
        globalVideoStore.clearActive(videoRef.current);
      }
    };
  }, []);

  const sizeText = pin.sourceType === 'remote' ? 'URL' : fmtSize(pin.size);

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
            {videoActive && activeSrc ? (
              <video
                ref={videoRef}
                src={activeSrc}
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

            {!imgError && thumbSrc && (
              <img
                src={thumbSrc}
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
        <div className="pin-actions-row" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
           {pin.sourceType === 'local' ? (
             <button className="pin-action-btn" onClick={handleCopyName}>
               {copied ? 'Copied!' : 'Copy Name'}
             </button>
           ) : (
             <button className="pin-action-btn" onClick={handleDownload}>
               Download
             </button>
           )}
        </div>
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
