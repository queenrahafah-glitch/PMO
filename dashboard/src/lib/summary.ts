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
  const { costEfficiency, quality, strategic, hospitalDirector } = data;

  // Every "List of … Projects" list counts toward the overall project figures.
  const listProjects = [...costEfficiency, ...quality, ...strategic];
  const totalProjects = listProjects.length + hospitalDirector.length;
  const completedProjects = listProjects.filter((p) => norm(p.status).startsWith('completed')).length;

  // Realized savings stay scoped to Cost Efficiency — savings are a cost measure.
  const savings = totalSavings(costEfficiency);
  const pendingSavings = costEfficiency.filter((p) => p.savings == null).length;

  const depts = [...new Set(listProjects.map((p) => p.dept).filter(Boolean))];

  // Breakdown for the Total Projects subtitle, omitting any list that's empty.
  const breakdown = [
    [costEfficiency.length, 'cost efficiency'] as const,
    [quality.length, 'quality'] as const,
    [strategic.length, 'strategic'] as const,
    [hospitalDirector.length, 'director-led'] as const,
  ]
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(' + ');

  const allTasks = hospitalDirector.flatMap((p) => p.tasks);
  const delayedTasks = allTasks.filter((t) => norm(t.status) === 'delayed').length;
  const notStartedTasks = allTasks.filter((t) => norm(t.status) === 'not yet started').length;

  return [
    {
      labelEn: 'Total Projects',
      labelAr: 'إجمالي المشاريع',
      value: totalProjects,
      sub: breakdown,
      color: 'oklch(48% 0.13 255)',
    },
    {
      labelEn: 'Quality Projects',
      labelAr: 'مشاريع الجودة',
      value: quality.length,
      sub: 'مسؤول: د. بدير',
      color: 'oklch(48% 0.13 310)',
    },
    {
      labelEn: 'Strategic Projects',
      labelAr: 'المشاريع الاستراتيجية',
      value: strategic.length,
      sub: 'مسؤول: أ. ناصر عنكيص',
      color: 'oklch(48% 0.13 200)',
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
      value: completedProjects,
      sub: `of ${listProjects.length} tracked projects`,
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
  // Use the sheet's own "% DONE" for each task when it's filled in; only fall
  // back to estimating progress from the task's status when that cell is blank.
  const sum = project.tasks.reduce((a, t) => a + (t.percentDone ?? taskPct(t.status)), 0);
  return Math.round(sum / project.tasks.length);
}
