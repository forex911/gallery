import { useRef, useCallback } from 'react';

export default function DropZone({ onUpload, onUrlClick }) {
  const dzRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    dzRef.current.style.outline = '2px dashed var(--accent)';
  }, []);

  const handleDragLeave = useCallback(() => {
    dzRef.current.style.outline = '';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dzRef.current.style.outline = '';
    if (e.dataTransfer.files.length) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  return (
    <div
      ref={dzRef}
      className="drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="drop-icon">MEDIA</div>
      <div className="drop-title">Your Media Gallery</div>
      <div className="drop-sub">
        Upload photos and videos from your device or paste URLs from Google Drive and other
        sources. Supports JPG, PNG, GIF, WebP, MP4, WebM, MOV and more.
      </div>
      <div className="drop-actions">
        <button className="btn-primary" onClick={() => document.getElementById('fileInput')?.click()}>
          Choose Files
        </button>
        <button className="btn-secondary" onClick={onUrlClick}>
          Add from URL
        </button>
      </div>
      <p className="drop-note">All local files stay on your device — nothing is uploaded to any server</p>
    </div>
  );
}
