import { useState, useRef, useEffect } from 'react';

export default function UrlModal({ isOpen, onClose, onLoad, urlStatus }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      setText('');
    }
  };

  const handleLoad = () => {
    if (!text.trim()) return;
    onLoad(text);
    // Don't clear text yet — let user see status
  };

  const handleClose = () => {
    onClose();
    setText('');
  };

  return (
    <div className="modal-overlay open" onClick={handleBackdropClick}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add Media from URL</div>
        <div className="modal-desc">
          Paste image or video URLs below, one per line. Supports Google Drive share links,
          folder links, and direct media URLs.
        </div>
        <textarea
          ref={textareaRef}
          className="modal-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`https://drive.google.com/drive/folders/...\nhttps://drive.google.com/file/d/.../view\nhttps://example.com/photo.jpg`}
        />
        <div className="modal-hint">
          Supports Google Drive folder links, individual file share links, and direct media URLs.
          Drive files must be set to &quot;Anyone with the link can view&quot;.
        </div>
        {urlStatus && (
          <div className={`url-status visible${urlStatus.isError ? ' error' : ''}`}>
            {urlStatus.text}
          </div>
        )}
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={handleClose}>
            Cancel
          </button>
          <button className="modal-btn-load" onClick={handleLoad}>
            Load Media
          </button>
        </div>
      </div>
    </div>
  );
}
