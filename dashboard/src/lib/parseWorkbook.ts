import * as XLSX from 'xlsx';
import { fetchGoogleSheetRows } from './googleSheets';
import type { CostEfficiencyProject, DashboardData, HospitalProject, HospitalTask } from './types';

type Row = unknown[];

function s(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function isBlank(v: unknown): boolean {
  return v == null || String(v).trim() === '';
}

function cell(row: Row | undefined, col: number): unknown {
  return row ? row[col] : undefined;
}

// Column indices (0-based) shared by the "Hospital Director Projects" sheet layout.
const COL = {
  TITLE_OR_STATUS: 1, // B
  RISK: 2, // C
  PRIORITY: 3, // D
  START: 4, // E
  END: 5, // F
  TASK_NAME: 7, // H
  ASSIGNEE: 8, // I
  DESCRIPTION: 9, // J
  DELIVERABLE: 10, // K
  KPI_BASELINE: 13, // N
  KPI_TARGET: 14, // O
  KPI_ACTUAL: 15, // P
} as const;

function sheetToRows(wb: XLSX.WorkBook, sheetName: string): Row[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  // Force the range to start at column A: sheets where column A is entirely
  // empty report a !ref starting at B, which would otherwise shift every
  // column index left by one.
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null, range: 'A1:W1200' });
}

export function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!n) return null;
  const utcDays = Math.floor(n - 25569);
  return new Date(utcDays * 86400 * 1000);
}

// ---- Cost Efficiency Projects (from the "Project Tracking" summary sheet) ----
function parseCostEfficiency(rows: Row[]): CostEfficiencyProject[] {
  const headerIdx = rows.findIndex((r) => s(cell(r, 1)) === 'N.' && s(cell(r, 2)) === 'Project Title');
  if (headerIdx === -1) return [];

  const projects: CostEfficiencyProject[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const title = s(cell(row, 2));
    if (!title) break; // end of populated list

    const no = Number(cell(row, 1)) || projects.length + 1;
    const owner = s(cell(row, 5));
    const dept = s(cell(row, 6));
    const status = s(cell(row, 7));
    const savingsRaw = cell(row, 8);

    const savings = typeof savingsRaw === 'number' ? savingsRaw : null;
    const savingsNote = savings === null ? (s(savingsRaw) || '—') : null;

    projects.push({ no, title, owner, dept, status, savings, savingsNote });
  }
  return projects;
}

// ---- Hospital Director Projects (from the "Hospital Director Projects" sheet) ----
function isTitleRow(row: Row | undefined): boolean {
  const b = cell(row, COL.TITLE_OR_STATUS);
  const c = cell(row, COL.RISK);
  return typeof b === 'string' && b.toLowerCase().includes('owner') && isBlank(c);
}

function kpiTriplet(row: Row) {
  const baselineRaw = cell(row, COL.KPI_BASELINE);
  const targetRaw = cell(row, COL.KPI_TARGET);
  const actualRaw = cell(row, COL.KPI_ACTUAL);

  // A KPI row only carries real per-task data when Target or Actual is filled in;
  // otherwise the "Baseline" cell is just a stray KPI section label from the sheet's
  // stacked mini-tables, not a value that belongs to this task.
  if (isBlank(targetRaw) && isBlank(actualRaw)) {
    return { kpiBaseline: '—', kpiTarget: '—', kpiActual: '—' };
  }
  const fmt = (v: unknown) => (isBlank(v) ? '—' : s(v));
  return { kpiBaseline: fmt(baselineRaw), kpiTarget: fmt(targetRaw), kpiActual: fmt(actualRaw) };
}

function parseTaskRow(row: Row): HospitalTask {
  const status = s(cell(row, COL.TITLE_OR_STATUS));
  const risk = s(cell(row, COL.RISK));
  const priority = s(cell(row, COL.PRIORITY));
  const start = toDate(cell(row, COL.START));
  const end = toDate(cell(row, COL.END));

  const rawTaskName = s(cell(row, COL.TASK_NAME));
  const rawDescription = s(cell(row, COL.DESCRIPTION));
  const rawDeliverable = s(cell(row, COL.DELIVERABLE));
  const assignee = s(cell(row, COL.ASSIGNEE));

  // When the sheet's own TASK NAME cell was never filled in (left as the "Task"
  // placeholder), fall back to the description column for the name instead —
  // and shift the deliverable column into the description slot so nothing repeats.
  const nameIsPlaceholder = !rawTaskName || rawTaskName.toLowerCase() === 'task';
  const taskName = nameIsPlaceholder ? (rawDescription || '—') : rawTaskName;

  // Independently, when the DESCRIPTION cell itself was left as its own
  // placeholder ("Details of task here"), fall back to the deliverable column.
  const descSource = nameIsPlaceholder ? rawDeliverable : rawDescription;
  const description = descSource.toLowerCase() === 'details of task here' ? rawDeliverable : descSource;

  return {
    status,
    risk,
    priority,
    start,
    end,
    taskName,
    assignee,
    description,
    ...kpiTriplet(row),
  };
}

function isPlaceholderTaskRow(row: Row): boolean {
  const taskName = s(cell(row, COL.TASK_NAME));
  const assignee = s(cell(row, COL.ASSIGNEE));
  return (!taskName || taskName.toLowerCase() === 'task') && !assignee;
}

function parseHospitalDirectorProjects(rows: Row[]): HospitalProject[] {
  const projects: HospitalProject[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!isTitleRow(rows[i])) {
      i++;
      continue;
    }
    const titleRowIdx = i;
    const titleRaw = s(cell(rows[i], COL.TITLE_OR_STATUS));
    const [titlePart, ownerPart] = titleRaw.split(/-?\s*Project Owner:?/i);
    const title = s(titlePart);
    const owner = s(ownerPart) || 'Mr. Jahz Almotairy';

    let j = i + 1;
    const blockRows: Row[] = [];
    while (j < rows.length && !isTitleRow(rows[j])) {
      // Real task rows always carry an actual start date; this also weeds out
      // the "PROJECT DETAILS" section label and repeated column-header rows
      // that sit between one project's tasks and the next project's title row.
      if (cell(rows[j], COL.START) instanceof Date) blockRows.push(rows[j]);
      j++;
    }

    const taskRows = blockRows.filter((r) => !isPlaceholderTaskRow(r));
    const isTemplate = taskRows.length === 0 || title.toLowerCase() === 'project name';

    if (!isTemplate) {
      const kpiLabelRow = [rows[titleRowIdx], ...blockRows].find((r) => !isBlank(cell(r, COL.KPI_BASELINE)));
      const kpiLabel = kpiLabelRow ? s(cell(kpiLabelRow, COL.KPI_BASELINE)) : '—';

      projects.push({
        title,
        owner,
        kpiLabel,
        tasks: taskRows.map(parseTaskRow),
      });
    }

    i = j;
  }
  return projects;
}

export async function loadDashboardDataFromXlsx(url: string): Promise<DashboardData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load source workbook (${res.status})`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  const costEfficiency = parseCostEfficiency(sheetToRows(wb, 'Project Tracking'));
  const hospitalDirector = parseHospitalDirectorProjects(sheetToRows(wb, 'Hospital Director Projects'));

  return { costEfficiency, hospitalDirector };
}

export async function loadDashboardDataFromGoogleSheet(sheetId: string): Promise<DashboardData> {
  const [trackingRows, hospitalRows] = await Promise.all([
    fetchGoogleSheetRows(sheetId, 'Project Tracking'),
    fetchGoogleSheetRows(sheetId, 'Hospital Director Projects'),
  ]);

  const costEfficiency = parseCostEfficiency(trackingRows);
  const hospitalDirector = parseHospitalDirectorProjects(hospitalRows);

  return { costEfficiency, hospitalDirector };
}
