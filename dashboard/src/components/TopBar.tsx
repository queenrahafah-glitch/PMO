interface TopBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  todayLabel: string;
}

export function TopBar({ query, onQueryChange, todayLabel }: TopBarProps) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">
          Project Tracking Dashboard <span className="topbar-title-ar">لوحة متابعة المشاريع</span>
        </div>
        <div className="topbar-subtitle">Auto-calculated from source tracking sheet · {todayLabel}</div>
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
