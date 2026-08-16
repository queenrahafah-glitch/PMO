import { useState, type CSSProperties } from 'react';
import type { CostEfficiencyProject } from '../lib/types';
import { costEffProgressPct, costEffStatusColor, progressBarColor } from '../lib/colors';

interface Props {
  projects: CostEfficiencyProject[];
  titleEn: string;
  titleAr: string;
  meta: string;
  // Shown when the list has no rows at all (vs. an active search filter). Lets an
  // empty Quality/Strategic section read as "not filled in yet" rather than
  // "no search results".
  emptyLabel?: string;
  // Cost Savings is a cost-efficiency measure, so the Quality/Strategic lists hide
  // that column entirely (header and cells) rather than showing an empty field.
  showSavings?: boolean;
}

// One table renders all three project lists (Cost Efficiency, Quality, Strategic),
// which share a layout. The column grid is set inline on both the header and the
// data rows so the shared .table-header-row / .table-row rules stay untouched — a
// narrower grid is used when the Cost Savings column is dropped.
const GRID_WITH_SAVINGS = '40px 2.2fr 1fr 0.9fr 0.9fr 1fr 1.2fr';
const GRID_NO_SAVINGS = '40px 2.2fr 1fr 0.9fr 0.9fr 1.2fr';

export function CostEfficiencyTable({ projects, titleEn, titleAr, meta, emptyLabel, showSavings = true }: Props) {
  const GRID = showSavings ? GRID_WITH_SAVINGS : GRID_NO_SAVINGS;
  const [open, setOpen] = useState(true);
  return (
    <div className="section">
      <button type="button" className="section-header section-header--toggle" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="section-title-en">{titleEn}</div>
          <div className="section-title-ar" dir="rtl">{titleAr}</div>
        </div>
        <div className="section-header-right">
          <div className="section-meta">{meta}</div>
          <div className="chevron" style={{ '--chevron-rotate': open ? 'rotate(180deg)' : 'rotate(0deg)' } as CSSProperties}>
            ⌄
          </div>
        </div>
      </button>

      {open && (
      <div className="table-card">
        <div className="table-header-row" style={{ gridTemplateColumns: GRID }}>
          <div>N.</div>
          <div>Project / المشروع</div>
          <div>Owner</div>
          <div>Department</div>
          <div>Status</div>
          {showSavings && <div>Cost Savings (SAR)</div>}
          <div>Blockers / المعوقات</div>
        </div>
        {projects.map((p) => {
          const colors = costEffStatusColor(p.status);
          const pct = costEffProgressPct(p.status);
          const savingsLabel = p.savings != null ? `${p.savings.toLocaleString('en-US')} SAR` : p.savingsNote;
          const savingsColor = p.savings != null ? 'oklch(42% 0.14 150)' : 'oklch(55% 0.02 255)';
          return (
            <div className="table-row" style={{ gridTemplateColumns: GRID }} key={`${p.no}-${p.title}`}>
              <div className="table-no">{p.no}</div>
              <div>
                <div className="project-title" dir="auto">{p.title}</div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ '--fill-pct': `${pct}%`, '--fill-color': progressBarColor(pct) } as CSSProperties}
                  />
                </div>
              </div>
              <div className="table-owner" dir="auto">{p.owner}</div>
              <div className="table-dept" dir="auto">{p.dept}</div>
              <div>
                <span className="badge" style={{ '--badge-bg': colors.bg, '--badge-color': colors.color } as CSSProperties}>
                  {p.status}
                </span>
              </div>
              {showSavings && (
                <div className="savings" style={{ '--savings-color': savingsColor } as CSSProperties} dir="auto">
                  {savingsLabel}
                </div>
              )}
              <div className="table-blockers" dir="auto">{p.blockers || '—'}</div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div className="empty-state">{emptyLabel ?? 'No projects match your search.'}</div>
        )}
      </div>
      )}
    </div>
  );
}
