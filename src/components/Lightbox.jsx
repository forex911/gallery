import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtSize } from '../utils/helpers';

/**
 * Lightbox — Fullscreen media viewer with keyboard navigation.
 * Now supports zoom logic (scroll, drag, double-click) and memory-efficient local file loading.
 */
export default function Lightbox({ pins, currentIndex, onClose, onNavigate }) {
  const wrapRef = useRef(null);
  
  const [activeSrc, setActiveSrc] = useState(null);
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  const isDraggingList = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });

  const pin = pins[currentIndex];

  useEffect(() => {
    if (!pin) return;
    if (pin.sourceType === 'local' && pin.file) {
      const url = URL.createObjectURL(pin.file);
      setActiveSrc(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setActiveSrc(pin.url);
    }
  }, [pin]);

  // Keyboard navigation and zoom reset
  useEffect(() => {
    setZoom({ scale: 1, x: 0, y: 0 });
    
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate(-1);
      else if (e.key === 'ArrowRight') onNavigate(1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, onClose, onNavigate]);

  // Support wheel zoom via native event to allow preventDefault
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (pin && (pin.isVideo || pin.isOther)) return;
      e.preventDefault();
      
      setZoom(prev => {
        let newScale = prev.scale - e.deltaY * 0.005;
        newScale = Math.max(1, Math.min(newScale, 5));
        
        if (newScale === 1) return { scale: 1, x: 0, y: 0 };
        return { ...prev, scale: newScale };
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [pin]);

  if (!pin) return null;
  const total = pins.length;
  const displayIdx = currentIndex + 1;

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setZoom(prev => {
      if (prev.scale > 1) return { scale: 1, x: 0, y: 0 };
      return { scale: 2.5, x: 0, y: 0 };
    });
  }, []);

  const handlePointerDown = (e) => {
    if (zoom.scale <= 1) return;
    isDraggingList.current = true;
    startDragPos.current = { x: e.clientX - zoom.x, y: e.clientY - zoom.y };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingList.current || zoom.scale <= 1) return;
    setZoom(prev => ({
      ...prev,
      x: e.clientX - startDragPos.current.x,
      y: e.clientY - startDragPos.current.y
    }));
  };

  const handlePointerUp = () => {
    isDraggingList.current = false;
  };

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleCopyName = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pin.name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = (e) => {
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
  };

  const meta = pin.sourceType === 'remote' ? 'URL source' : `${fmtSize(pin.size)}  ·  ${pin.type}`;

  return createPortal(
    <div 
      className="lightbox open" 
      onClick={handleBackdropClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
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
             activeSrc && (
               activeSrc.includes('drive.google.com') ? (
                 <iframe
                   key={activeSrc}
                   src={activeSrc.replace('export=view', 'preview')}
                   allow="autoplay"
                   allowFullScreen
                   style={{ width: '88vw', height: '80vh', border: 'none', background: '#000', borderRadius: '8px' }}
                 />
               ) : (
                 <video
                   key={activeSrc}
                   src={activeSrc}
                   controls
                   autoPlay
                   style={{ maxWidth: '88vw', maxHeight: '80vh' }}
                 />
               )
             )
          ) : pin.isOther ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>📄</div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{pin.name}</h2>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Cannot preview this file type in the browser.</p>
            </div>
          ) : (
             activeSrc && (
              <img
                key={activeSrc}
                src={activeSrc}
                alt={pin.name}
                onDoubleClick={handleDoubleClick}
                onPointerDown={handlePointerDown}
                style={{
                  transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                  cursor: zoom.scale > 1 ? 'grab' : 'zoom-in',
                  transition: isDraggingList.current ? 'none' : 'transform 0.2s ease-out'
                }}
                title="Double-click or scroll to zoom, drag to pan"
              />
            )
          )}
        </div>
        <div className="lb-footer">
          <div>
            <div className="lb-name">{pin.name}</div>
            <div className="lb-meta">{meta}</div>
          </div>
          <div className="lb-footer-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="lb-counter">
              {displayIdx.toLocaleString()} / {total.toLocaleString()}
            </span>
            
            {/* Context Actions */}
            {pin.sourceType === 'local' ? (
              <button className="lb-nav action-btn" onClick={handleCopyName}>
                {copied ? 'Copied!' : 'Copy Name'}
              </button>
            ) : (
              <button className="lb-nav action-btn" onClick={handleDownload}>
                Download
              </button>
            )}

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
