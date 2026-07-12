interface TopBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  todayLabel: string;
  updatedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function TopBar({ query, onQueryChange, todayLabel, updatedAt, refreshing, onRefresh }: TopBarProps) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">
          Project Tracking Dashboard <span className="topbar-title-ar">لوحة متابعة المشاريع</span>
        </div>
        <div className="topbar-subtitle">
          Auto-calculated from source tracking sheet · {todayLabel}
          {updatedAt && (
            <>
              {' · '}
              <span dir="rtl">آخر تحديث {updatedAt}</span>
            </>
          )}
          <button type="button" className="refresh-btn" onClick={onRefresh} disabled={refreshing}>
            <span className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'}>⟳</span>
            <span dir="rtl">{refreshing ? 'يحدّث…' : 'تحديث'}</span>
          </button>
        </div>
      </div>
      <div className="search-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search projects, owners, departments… · ابحث"
          dir="auto"
          className="search-input"
        />
        <span className="search-icon">⌕</span>
      </div>
    </div>
  );
}
