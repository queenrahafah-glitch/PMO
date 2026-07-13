import type { CSSProperties } from 'react';
import type { HospitalProject } from '../lib/types';
import { priorityColor, riskColor, taskProgressPct, taskStatusColor } from '../lib/colors';
import { formatDate } from '../lib/parseWorkbook';
import { projectAvgPct } from '../lib/summary';

interface Props {
  projects: HospitalProject[];
  count: number;
  taskCount: number;
  openIds: Record<number, boolean>;
  onToggle: (index: number) => void;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function ringColors(pct: number): { bg: string; color: string } {
  if (pct >= 66) return { bg: 'oklch(92% 0.06 150)', color: 'oklch(42% 0.14 150)' };
  if (pct >= 33) return { bg: 'oklch(93% 0.05 255)', color: 'oklch(45% 0.14 255)' };
  return { bg: 'oklch(93% 0.008 255)', color: 'oklch(48% 0.02 255)' };
}

export function HospitalDirectorAccordion({ projects, count, taskCount, openIds, onToggle }: Props) {
  return (
    <div className="section section--hospital">
      <div className="section-header">
        <div>
          <div className="section-title-en">Hospital Director Projects</div>
          <div className="section-title-ar" dir="rtl">مشاريع مدير المستشفى · Owner: Mr. Jahz Almotairy</div>
        </div>
        <div className="section-meta">
          {count} projects · {taskCount} tasks tracked
        </div>
      </div>

      <div className="projects-list">
        {projects.map((proj, i) => {
          const isOpen = !!openIds[i];
          const avgPct = projectAvgPct(taskProgressPct, proj);
          const ring = ringColors(avgPct);
          const delayedCount = proj.tasks.filter((t) => norm(t.status) === 'delayed' || norm(t.risk) === 'critical').length;
          const highPriorityCount = proj.tasks.filter((t) => norm(t.priority) === 'high').length;

          return (
            <div className="project-card" key={proj.title}>
              <button type="button" className="project-summary-row" onClick={() => onToggle(i)}>
                <div className="pct-ring" style={{ '--ring-bg': ring.bg, '--ring-color': ring.color } as CSSProperties}>
                  {avgPct}%
                </div>
                <div className="project-info">
                  <div className="project-title" dir="auto">{proj.title}</div>
                  <div className="project-sub">
                    {proj.owner} · {proj.tasks.length} tasks · KPI: <span dir="auto">{proj.kpiLabel}</span>
                  </div>
                </div>
                <div className="chips">
                  {delayedCount > 0 && (
                    <span className="chip" style={{ '--badge-bg': 'oklch(92% 0.07 25)', '--badge-color': 'oklch(48% 0.16 25)' } as CSSProperties}>
                      {delayedCount} at risk
                    </span>
                  )}
                  {highPriorityCount > 0 && (
                    <span className="chip" style={{ '--badge-bg': 'oklch(93% 0.06 80)', '--badge-color': 'oklch(48% 0.13 80)' } as CSSProperties}>
                      {highPriorityCount} high priority
                    </span>
                  )}
                </div>
                <div className="chevron" style={{ '--chevron-rotate': isOpen ? 'rotate(180deg)' : 'rotate(0deg)' } as CSSProperties}>
                  ⌄
                </div>
              </button>

              {isOpen && (
                <div className="task-table-wrap">
                  <div className="task-table-header">
                    <div>Status</div>
                    <div>Risk</div>
                    <div>Priority</div>
                    <div>Task</div>
                    <div>Assignee</div>
                    <div>Description</div>
                    <div>Blockers · المعوقات</div>
                    <div>KPI (Baseline → Target → Actual)</div>
                  </div>
                  {proj.tasks.map((t, ti) => {
                    const sc = taskStatusColor(t.status);
                    const rc = riskColor(t.risk);
                    const pc = priorityColor(t.priority);
                    return (
                      <div className="task-row" key={ti}>
                        <div>
                          <span className="badge badge--sm" style={{ '--badge-bg': sc.bg, '--badge-color': sc.color } as CSSProperties}>
                            {t.status}
                          </span>
                        </div>
                        <div>
                          <span className="badge badge--sm" style={{ '--badge-bg': rc.bg, '--badge-color': rc.color } as CSSProperties}>
                            {t.risk}
                          </span>
                        </div>
                        <div>
                          <span className="badge badge--sm" style={{ '--badge-bg': pc.bg, '--badge-color': pc.color } as CSSProperties}>
                            {t.priority}
                          </span>
                        </div>
                        <div className="task-name" dir="auto">{t.taskName}</div>
                        <div className="task-assignee" dir="auto">{t.assignee}</div>
                        <div>
                          <div className="task-desc" dir="auto">{t.description}</div>
                          <div className="task-daterange">{formatDate(t.start)} → {formatDate(t.end)}</div>
                        </div>
                        <div className="task-blockers" dir="auto">{t.blockers || '—'}</div>
                        <div className="task-kpi" dir="auto">
                          {t.kpiBaseline} → {t.kpiTarget} → {t.kpiActual}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {projects.length === 0 && <div className="empty-state empty-state--card">No projects match your search.</div>}
      </div>
    </div>
  );
}
