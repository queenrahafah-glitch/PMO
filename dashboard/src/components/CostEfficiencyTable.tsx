import type { CSSProperties } from 'react';
import type { CostEfficiencyProject } from '../lib/types';
import { costEffProgressPct, costEffStatusColor, progressBarColor } from '../lib/colors';

interface Props {
  projects: CostEfficiencyProject[];
  count: number;
  savingsLabel: string;
}

export function CostEfficiencyTable({ projects, count, savingsLabel }: Props) {
  return (
    <div className="section">
      <div className="section-header">
        <div>
          <div className="section-title-en">Cost Efficiency Projects</div>
          <div className="section-title-ar" dir="rtl">قائمة مشاريع كفاءة التكلفة · مسؤول: Ms. Rahaf</div>
        </div>
        <div className="section-meta">
          {count} projects · {savingsLabel}
        </div>
      </div>

      <div className="table-card">
        <div className="table-header-row">
          <div>N.</div>
          <div>Project / المشروع</div>
          <div>Owner</div>
          <div>Department</div>
          <div>Status</div>
          <div>Cost Savings (SAR)</div>
        </div>
        {projects.map((p) => {
          const colors = costEffStatusColor(p.status);
          const pct = costEffProgressPct(p.status);
          const savingsLabel = p.savings != null ? `${p.savings.toLocaleString('en-US')} SAR` : p.savingsNote;
          const savingsColor = p.savings != null ? 'oklch(42% 0.14 150)' : 'oklch(55% 0.02 255)';
          return (
            <div className="table-row" key={p.no}>
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
              <div className="savings" style={{ '--savings-color': savingsColor } as CSSProperties} dir="auto">
                {savingsLabel}
              </div>
            </div>
          );
        })}
        {projects.length === 0 && <div className="empty-state">No projects match your search.</div>}
      </div>
    </div>
  );
}
