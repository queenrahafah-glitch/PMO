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
  return row && col >= 0 ? row[col] : undefined;
}

// Find the first column in a row whose (trimmed, lower-cased) text matches.
// Column layout is discovered from header labels rather than hard-coded indices,
// so parsing stays correct no matter which absolute column each field lands in.
// This matters because the two data sources disagree on column offset: the xlsx
// path keeps an empty leading column A, while Google's gviz feed drops it.
function colByLabel(row: Row, test: (v: string) => boolean): number {
  for (let c = 0; c < row.length; c++) {
    const v = s(cell(row, c)).toLowerCase();
    if (v && test(v)) return c;
  }
  return -1;
}

function sheetToRows(wb: XLSX.WorkBook, sheetName: string): Row[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
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
// Exported for unit testing against both column offsets.
export function parseCostEfficiency(rows: Row[]): CostEfficiencyProject[] {
  let headerIdx = -1;
  let noCol = -1;
  let titleCol = -1;
  let ownerCol = -1;
  let deptCol = -1;
  let statusCol = -1;
  let savingsCol = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const no = colByLabel(row, (v) => v === 'n.');
    const title = colByLabel(row, (v) => v === 'project title');
    if (no < 0 || title < 0) continue;

    headerIdx = r;
    noCol = no;
    titleCol = title;
    ownerCol = colByLabel(row, (v) => v.startsWith('project owner'));
    deptCol = colByLabel(row, (v) => v === 'department');
    statusCol = colByLabel(row, (v) => v === 'status');
    savingsCol = colByLabel(row, (v) => v.startsWith('cost savings'));
    break;
  }
  if (headerIdx === -1) return [];

  const projects: CostEfficiencyProject[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const title = s(cell(row, titleCol));
    if (!title) break; // end of populated list

    const no = Number(cell(row, noCol)) || projects.length + 1;
    const owner = s(cell(row, ownerCol));
    const dept = s(cell(row, deptCol));
    const status = s(cell(row, statusCol));
    const savingsRaw = cell(row, savingsCol);

    const savings = typeof savingsRaw === 'number' ? savingsRaw : null;
    const savingsNote = savings === null ? (s(savingsRaw) || '—') : null;

    projects.push({ no, title, owner, dept, status, savings, savingsNote });
  }
  return projects;
}

// ---- Hospital Director Projects (from the "Hospital Director Projects" sheet) ----
interface HospitalCols {
  status: number;
  risk: number;
  priority: number;
  start: number;
  end: number;
  taskName: number;
  assignee: number;
  description: number;
  deliverable: number;
  baseline: number;
  target: number;
  actual: number;
}

function locateHospitalColumns(rows: Row[]): HospitalCols | null {
  for (const row of rows) {
    const status = colByLabel(row, (v) => v === 'status');
    const risk = colByLabel(row, (v) => v === 'risk');
    const start = colByLabel(row, (v) => v === 'start date');
    if (status < 0 || risk < 0 || start < 0) continue;

    return {
      status,
      risk,
      start,
      priority: colByLabel(row, (v) => v === 'priority'),
      end: colByLabel(row, (v) => v === 'end date'),
      taskName: colByLabel(row, (v) => v === 'task name'),
      assignee: colByLabel(row, (v) => v === 'assignee'),
      description: colByLabel(row, (v) => v === 'description'),
      deliverable: colByLabel(row, (v) => v === 'deliverable'),
      baseline: colByLabel(row, (v) => v === 'baseline'),
      target: colByLabel(row, (v) => v === 'targeted'),
      actual: colByLabel(row, (v) => v === 'actual'),
    };
  }
  return null;
}

// A project title row carries the project name (with "- Project Owner: …") in the
// STATUS column, with the RISK column left blank by the merged header cell.
function isTitleRow(row: Row | undefined, cols: HospitalCols): boolean {
  const title = s(cell(row, cols.status)).toLowerCase();
  return title.includes('owner') && isBlank(cell(row, cols.risk));
}

function kpiTriplet(row: Row, cols: HospitalCols) {
  const baselineRaw = cell(row, cols.baseline);
  const targetRaw = cell(row, cols.target);
  const actualRaw = cell(row, cols.actual);

  // A KPI row only carries real per-task data when Target or Actual is filled in;
  // otherwise the "Baseline" cell is just a stray KPI section label from the sheet's
  // stacked mini-tables, not a value that belongs to this task.
  if (isBlank(targetRaw) && isBlank(actualRaw)) {
    return { kpiBaseline: '—', kpiTarget: '—', kpiActual: '—' };
  }
  const fmt = (v: unknown) => (isBlank(v) ? '—' : s(v));
  return { kpiBaseline: fmt(baselineRaw), kpiTarget: fmt(targetRaw), kpiActual: fmt(actualRaw) };
}

function parseTaskRow(row: Row, cols: HospitalCols): HospitalTask {
  const status = s(cell(row, cols.status));
  const risk = s(cell(row, cols.risk));
  const priority = s(cell(row, cols.priority));
  const start = toDate(cell(row, cols.start));
  const end = toDate(cell(row, cols.end));

  const rawTaskName = s(cell(row, cols.taskName));
  const rawDescription = s(cell(row, cols.description));
  const rawDeliverable = s(cell(row, cols.deliverable));
  const assignee = s(cell(row, cols.assignee));

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
    ...kpiTriplet(row, cols),
  };
}

function isPlaceholderTaskRow(row: Row, cols: HospitalCols): boolean {
  const taskName = s(cell(row, cols.taskName));
  const assignee = s(cell(row, cols.assignee));
  return (!taskName || taskName.toLowerCase() === 'task') && !assignee;
}

// Exported for unit testing against both column offsets.
export function parseHospitalDirectorProjects(rows: Row[]): HospitalProject[] {
  const cols = locateHospitalColumns(rows);
  if (!cols) return [];

  const projects: HospitalProject[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!isTitleRow(rows[i], cols)) {
      i++;
      continue;
    }
    const titleRowIdx = i;
    const titleRaw = s(cell(rows[i], cols.status));
    const [titlePart, ownerPart] = titleRaw.split(/-?\s*Project Owner:?/i);
    const title = s(titlePart);
    const owner = s(ownerPart) || 'Mr. Jahz Almotairy';

    let j = i + 1;
    const blockRows: Row[] = [];
    while (j < rows.length && !isTitleRow(rows[j], cols)) {
      // Real task rows always carry an actual start date; this also weeds out
      // the "PROJECT DETAILS" section label and repeated column-header rows
      // that sit between one project's tasks and the next project's title row.
      if (cell(rows[j], cols.start) instanceof Date) blockRows.push(rows[j]);
      j++;
    }

    const taskRows = blockRows.filter((r) => !isPlaceholderTaskRow(r, cols));
    const isTemplate = taskRows.length === 0 || title.toLowerCase() === 'project name';

    if (!isTemplate) {
      const kpiLabelRow = [rows[titleRowIdx], ...blockRows].find((r) => !isBlank(cell(r, cols.baseline)));
      const kpiLabel = kpiLabelRow ? s(cell(kpiLabelRow, cols.baseline)) : '—';

      projects.push({
        title,
        owner,
        kpiLabel,
        tasks: taskRows.map((r) => parseTaskRow(r, cols)),
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
