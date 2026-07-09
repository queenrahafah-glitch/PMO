import type { CSSProperties } from 'react';
import type { StatusMixSegment } from '../lib/summary';

export function StatusMixBar({ segments }: { segments: StatusMixSegment[] }) {
  return (
    <div className="section section--status">
      <div className="status-card">
        <div className="status-header">
          <div className="status-title">
            All Projects — Status Mix <span className="status-title-ar" dir="rtl">· توزيع الحالات</span>
          </div>
        </div>
        <div className="status-bar">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="status-bar-seg"
              style={{ '--seg-color': seg.color, width: `${seg.pct}%` } as CSSProperties}
              title={seg.label}
            />
          ))}
        </div>
        <div className="status-legend">
          {segments.map((seg) => (
            <div key={seg.label} className="status-legend-item">
              <span className="status-legend-dot" style={{ '--seg-color': seg.color } as CSSProperties} />
              {seg.label} ({seg.count})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
