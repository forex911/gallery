import { useRef } from 'react';

export default function TopBar({ search, onSearch, onUpload, onUrlClick, progress }) {
  const fileRef = useRef(null);

  return (
    <div className="topbar">
      <div className="logo">F9-Gallery</div>

      <div className="search-wrap">
        <span className="search-icon">S</span>
        <input
          type="text"
          id="searchInput"
          placeholder="Search photos and videos..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="topbar-actions">
        {progress && (
          <>
            <div className="progress-bar-wrap">
              <div
                className="progress-bar"
                style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }}
              />
            </div>
            <span className="loading-label">
              {progress.loaded.toLocaleString()} / {progress.total.toLocaleString()}
            </span>
          </>
        )}
        <button className="btn-url" onClick={onUrlClick}>
          From URL
        </button>
        <button className="btn-upload" onClick={() => fileRef.current?.click()}>
          Add Media
        </button>
        <input
          ref={fileRef}
          type="file"
          id="fileInput"
          multiple
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            onUpload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
