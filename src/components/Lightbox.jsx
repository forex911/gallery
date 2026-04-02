import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fmtSize } from '../utils/helpers';

/**
 * Lightbox — Fullscreen media viewer with keyboard navigation.
 * Rendered as a portal to avoid z-index issues.
 */
export default function Lightbox({ pins, currentIndex, onClose, onNavigate }) {
  const wrapRef = useRef(null);

  const pin = pins[currentIndex];
  if (!pin) return null;

  const total = pins.length;
  const displayIdx = currentIndex + 1;

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate(-1);
      else if (e.key === 'ArrowRight') onNavigate(1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onNavigate]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const meta = pin.isUrl ? 'URL source' : `${fmtSize(pin.size)}  ·  ${pin.type}`;

  return createPortal(
    <div className="lightbox open" onClick={handleBackdropClick}>
      <button
        className="lb-side-nav prev"
        onClick={(e) => { e.stopPropagation(); onNavigate(-1); }}
        title="Previous"
      >
        &#8592;
      </button>
      <button
        className="lb-side-nav next"
        onClick={(e) => { e.stopPropagation(); onNavigate(1); }}
        title="Next"
      >
        &#8594;
      </button>

      <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
        <div className="lb-media-wrap" ref={wrapRef}>
          {pin.isVideo ? (
            <video
              key={pin.src}
              src={pin.src}
              controls
              autoPlay
              style={{ maxWidth: '88vw', maxHeight: '80vh' }}
            />
          ) : (
            <img
              key={pin.src}
              src={pin.src}
              alt={pin.name}
            />
          )}
        </div>
        <div className="lb-footer">
          <div>
            <div className="lb-name">{pin.name}</div>
            <div className="lb-meta">{meta}</div>
          </div>
          <div className="lb-footer-right">
            <span className="lb-counter">
              {displayIdx.toLocaleString()} / {total.toLocaleString()}
            </span>
            <button className="lb-nav" onClick={() => onNavigate(-1)}>Prev</button>
            <button className="lb-nav" onClick={() => onNavigate(1)}>Next</button>
            <button className="lb-close" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
