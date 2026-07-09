import type { CostEfficiencyProject, DashboardData, HospitalProject } from './types';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export interface SummaryCard {
  labelEn: string;
  labelAr: string;
  value: string | number;
  sub: string;
  color: string;
}

export interface StatusMixSegment {
  label: string;
  count: number;
  color: string;
  pct: number;
}

export function costEffSearchText(p: CostEfficiencyProject): string {
  return norm(`${p.title} ${p.owner} ${p.dept} ${p.status}`);
}

export function hospitalSearchText(p: HospitalProject): string {
  const taskText = p.tasks.map((t) => `${t.taskName} ${t.assignee} ${t.description} ${t.status} ${t.priority}`).join(' ');
  return norm(`${p.title} ${p.owner} ${p.kpiLabel} ${taskText}`);
}

export function filterByQuery<T>(items: T[], query: string, searchText: (item: T) => string): T[] {
  const q = norm(query);
  if (!q) return items;
  return items.filter((item) => searchText(item).includes(q));
}

export function totalSavings(costEfficiency: CostEfficiencyProject[]): number {
  return costEfficiency.reduce((a, p) => a + (p.savings ?? 0), 0);
}

export function buildSummaryCards(data: DashboardData): SummaryCard[] {
  const { costEfficiency, hospitalDirector } = data;
  const totalProjects = costEfficiency.length + hospitalDirector.length;
  const completedCostEff = costEfficiency.filter((p) => norm(p.status).startsWith('completed')).length;
  const savings = totalSavings(costEfficiency);
  const pendingSavings = costEfficiency.filter((p) => p.savings == null).length;
  const depts = [...new Set(costEfficiency.map((p) => p.dept))];

  const allTasks = hospitalDirector.flatMap((p) => p.tasks);
  const delayedTasks = allTasks.filter((t) => norm(t.status) === 'delayed').length;
  const notStartedTasks = allTasks.filter((t) => norm(t.status) === 'not yet started').length;

  return [
    {
      labelEn: 'Total Projects',
      labelAr: 'إجمالي المشاريع',
      value: totalProjects,
      sub: `${costEfficiency.length} cost efficiency + ${hospitalDirector.length} director-led`,
      color: 'oklch(48% 0.13 255)',
    },
    {
      labelEn: 'Realized Savings',
      labelAr: 'الوفورات المحققة',
      value: `${(savings / 1e6).toFixed(1)}M SAR`,
      sub: `${pendingSavings} project(s) pending calculation`,
      color: 'oklch(48% 0.13 150)',
    },
    {
      labelEn: 'Completed',
      labelAr: 'مكتملة',
      value: completedCostEff,
      sub: `of ${costEfficiency.length} cost efficiency projects`,
      color: 'oklch(48% 0.13 150)',
    },
    {
      labelEn: 'Tasks Delayed',
      labelAr: 'مهام متأخرة',
      value: delayedTasks,
      sub: `out of ${allTasks.length} tracked tasks`,
      color: 'oklch(50% 0.15 25)',
    },
    {
      labelEn: 'Not Yet Started',
      labelAr: 'لم تبدأ',
      value: notStartedTasks,
      sub: 'director-led project tasks',
      color: 'oklch(50% 0.02 255)',
    },
    {
      labelEn: 'Departments Engaged',
      labelAr: 'الأقسام المشاركة',
      value: depts.length,
      sub: depts.join(' · '),
      color: 'oklch(48% 0.13 255)',
    },
  ];
}

export function buildStatusMix(hospitalDirector: HospitalProject[]): StatusMixSegment[] {
  const allTasks = hospitalDirector.flatMap((p) => p.tasks);
  const raw = [
    { label: 'Complete', count: allTasks.filter((t) => norm(t.status) === 'complete').length, color: 'oklch(58% 0.14 150)' },
    { label: 'In Progress', count: allTasks.filter((t) => norm(t.status) === 'in progress').length, color: 'oklch(55% 0.14 255)' },
    { label: 'Not Yet Started', count: allTasks.filter((t) => norm(t.status) === 'not yet started').length, color: 'oklch(80% 0.008 255)' },
    { label: 'Delayed', count: allTasks.filter((t) => norm(t.status) === 'delayed').length, color: 'oklch(58% 0.16 25)' },
  ];
  const total = raw.reduce((a, s) => a + s.count, 0) || 1;
  return raw.map((s) => ({ ...s, pct: (s.count / total) * 100 }));
}

export function projectAvgPct(taskPct: (status: string) => number, project: HospitalProject): number {
  if (project.tasks.length === 0) return 0;
  return Math.round(project.tasks.reduce((a, t) => a + taskPct(t.status), 0) / project.tasks.length);
}
