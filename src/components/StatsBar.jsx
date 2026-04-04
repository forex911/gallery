const FILTERS = ['all', 'jpg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'name-asc', label: 'A → Z' },
  { value: 'name-desc', label: 'Z → A' },
  { value: 'random', label: 'Shuffle' },
];

export default function StatsBar({ totalPins, photoCount, videoCount, fileCount, activeFilter, onFilter, activeSort, onSort }) {
  let text = totalPins.toLocaleString() + ' items';
  const parts = [];
  if (photoCount > 0) parts.push(`${photoCount.toLocaleString()} photos`);
  if (videoCount > 0) parts.push(`${videoCount.toLocaleString()} videos`);
  if (fileCount > 0) parts.push(`${fileCount.toLocaleString()} files`);
  if (parts.length > 0) {
    text += `  (${parts.join(', ')})`;
  }

  return (
    <div className="stats-bar">
      <span className="stats-text">{text}</span>

      <div className="stats-divider" />

      {FILTERS.map((f) => (
        <span
          key={f}
          className={`tag-pill${activeFilter === f ? ' active' : ''}`}
          onClick={() => onFilter(f)}
        >
          {f.toUpperCase()}
        </span>
      ))}

      <div className="stats-divider" />

      <div className="sort-group">
        <span className="sort-label">Sort</span>
        {SORT_OPTIONS.map((s) => (
          <span
            key={s.value}
            className={`tag-pill sort-pill${activeSort === s.value ? ' active' : ''}`}
            onClick={() => onSort(s.value)}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
