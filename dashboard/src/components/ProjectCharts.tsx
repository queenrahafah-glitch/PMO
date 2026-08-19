import type { CSSProperties } from 'react';
import type { CostEfficiencyProject } from '../lib/types';
import { costEffStatusColor } from '../lib/colors';

interface Props {
  costEfficiency: CostEfficiencyProject[];
  quality: CostEfficiencyProject[];
  strategic: CostEfficiencyProject[];
}

// Group the many raw status spellings into the handful the dashboard colours.
function statusGroup(status: string): string {
  const s = status.trim().toLowerCase();
  if (s.startsWith('completed')) return 'Completed';
  if (s === 'on going' || s === 'ongoing') return 'On Going';
  if (s === 'extended') return 'Extended';
  if (s === 'delayed') return 'Delayed';
  if (s === 'proposal') return 'Proposal';
  if (s === '' || s === 'pending') return 'Pending';
  return status.trim();
}

const R = 52;
const STROKE = 22;
const C = 2 * Math.PI * R;

export function ProjectCharts({ costEfficiency, quality, strategic }: Props) {
  const all = [...costEfficiency, ...quality, ...strategic];

  // ---- Donut: projects by status ----
  const byStatus = new Map<string, number>();
  for (const p of all) {
    const g = statusGroup(p.status);
    byStatus.set(g, (byStatus.get(g) ?? 0) + 1);
  }
  const segments = [...byStatus.entries()]
    .map(([label, count]) => ({ label, count, color: costEffStatusColor(label).color }))
    .sort((a, b) => b.count - a.count);
  const total = all.length || 1;

  // Build the arc for each segment, leaving a small gap between them so adjacent
  // colours never touch (secondary encoding for the status palette).
  const GAP = total > 1 ? 3 : 0;
  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = seg.count / total;
    const len = Math.max(frac * C - GAP, 0);
    const arc = { ...seg, len, offset, pct: Math.round(frac * 100) };
    offset += frac * C;
    return arc;
  });

  // ---- Bars: realized savings by project ----
  const savingsRows = all
    .filter((p) => p.savings != null)
    .sort((a, b) => (b.savings ?? 0) - (a.savings ?? 0));
  const maxSaving = Math.max(1, ...savingsRows.map((p) => p.savings ?? 0));

  return (
    <div className="charts-grid">
      <div className="chart-card">
        <div className="chart-title">
          Projects by Status <span dir="rtl">· المشاريع حسب الحالة</span>
        </div>
        {all.length === 0 ? (
          <div className="empty-state">No projects yet.</div>
        ) : (
          <div className="donut-wrap">
            <svg className="donut" viewBox="0 0 140 140" role="img" aria-label="Projects by status">
              <circle cx="70" cy="70" r={R} fill="none" stroke="oklch(93% 0.006 255)" strokeWidth={STROKE} />
              {arcs.map((a) => (
                <circle
                  key={a.label}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${a.len} ${C - a.len}`}
                  strokeDashoffset={-a.offset}
                  transform="rotate(-90 70 70)"
                />
              ))}
              <text x="70" y="66" textAnchor="middle" className="donut-total">{all.length}</text>
              <text x="70" y="84" textAnchor="middle" className="donut-total-label">projects</text>
            </svg>
            <div className="donut-legend">
              {arcs.map((a) => (
                <div className="legend-row" key={a.label}>
                  <span className="legend-dot" style={{ background: a.color } as CSSProperties} />
                  <span className="legend-label" dir="auto">{a.label}</span>
                  <span className="legend-count">{a.count} · {a.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chart-card">
        <div className="chart-title">
          Realized Savings by Project <span dir="rtl">· الوفورات حسب المشروع</span>
        </div>
        {savingsRows.length === 0 ? (
          <div className="empty-state">No calculated savings yet.</div>
        ) : (
          <div className="bars">
            {savingsRows.map((p) => (
              <div className="bar-row" key={`${p.no}-${p.title}`}>
                <div className="bar-label" dir="auto" title={p.title}>{p.title}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${((p.savings ?? 0) / maxSaving) * 100}%` } as CSSProperties} />
                </div>
                <div className="bar-value">{(p.savings ?? 0).toLocaleString('en-US')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
