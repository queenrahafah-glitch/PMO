export interface CostEfficiencyProject {
  no: number;
  title: string;
  owner: string;
  dept: string;
  status: string;
  savings: number | null;
  savingsNote: string | null;
  blockers: string;
}

export interface HospitalTask {
  status: string;
  risk: string;
  priority: string;
  start: Date | null;
  end: Date | null;
  taskName: string;
  assignee: string;
  description: string;
  blockers: string;
  // The sheet's own "% DONE" value (0–100), or null when the cell is blank.
  percentDone: number | null;
}

export interface KpiEntry {
  name: string;
  baseline: string;
  target: string;
  actual: string;
}

export interface HospitalProject {
  title: string;
  owner: string;
  kpiLabel: string;
  kpis: KpiEntry[];
  tasks: HospitalTask[];
}

export interface DashboardData {
  costEfficiency: CostEfficiencyProject[];
  quality: CostEfficiencyProject[];
  strategic: CostEfficiencyProject[];
  hospitalDirector: HospitalProject[];
}
