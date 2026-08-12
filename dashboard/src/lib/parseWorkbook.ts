import * as XLSX from 'xlsx';
import { fetchGoogleSheetRows } from './googleSheets';
import type { CostEfficiencyProject, DashboardData, HospitalProject, HospitalTask, KpiEntry } from './types';

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

// Parse a monetary amount from either a number or a numeric string (gviz may
// return either depending on the column's inferred type). Non-numeric text
// (e.g. a "Pending…" note) returns null.
function parseAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = s(v).replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ---- Project lists (from the "Project Tracking" summary sheet) ----
// The tab now stacks three lists — Cost Efficiency, Improvement (Quality) and
// Strategic — each introduced by a "List of … Projects" banner and repeating the
// same 7 columns (N. | Title | Owner | Department | Status | Cost Savings | Blockers).
export interface ProjectLists {
  costEfficiency: CostEfficiencyProject[];
  quality: CostEfficiencyProject[];
  strategic: CostEfficiencyProject[];
}

type ListKey = keyof ProjectLists;

const BANNER_RE = /list\s+of\s+.*projects/i;

function rowText(row: Row): string {
  return row.map((c) => s(c)).join(' ');
}

// Which list a "List of … Projects" banner introduces. Both the sheet's own
// wording and a renamed heading resolve to the same key, so relabelling the
// section in the sheet never silently breaks the dashboard.
function bannerListKey(text: string): ListKey | null {
  const t = text.toLowerCase();
  if (t.includes('cost efficiency')) return 'costEfficiency';
  if (t.includes('quality') || t.includes('improvement')) return 'quality';
  if (t.includes('strategic')) return 'strategic';
  return null;
}

// Exported for unit testing against both column offsets.
export function parseProjectLists(rows: Row[]): ProjectLists {
  const lists: ProjectLists = { costEfficiency: [], quality: [], strategic: [] };

  let titleCol = -1;
  let ownerCol = -1;
  let deptCol = -1;
  let statusCol = -1;
  let savingsCol = -1;
  let blockersCol = -1;

  // Detect the column map ONCE, from the first row that carries both a
  // "Project Title" and an "Owner" header. All three lists are copies of one
  // layout, so a single map serves them all. These headers live in TEXT columns,
  // which survive gviz's per-column type-casting (unlike "N." and "Cost Savings",
  // whose numeric columns null their header text).
  for (const row of rows) {
    const title = colByLabel(row, (v) => v.includes('project title'));
    const owner = colByLabel(row, (v) => v.includes('owner'));
    if (title < 0 || owner < 0) continue;

    titleCol = title;
    ownerCol = owner;
    deptCol = colByLabel(row, (v) => v.includes('department'));
    statusCol = colByLabel(row, (v) => v.includes('status'));
    savingsCol = colByLabel(row, (v) => v.includes('savings'));
    // "Cost Savings (SAR)" sits in a number column and is nulled by type-casting;
    // it comes right after Status, so fall back to that.
    if (savingsCol < 0 && statusCol >= 0) savingsCol = statusCol + 1;
    blockersCol = colByLabel(row, (v) => v.includes('blocker'));
    // Blockers is currently empty in every row, so gviz nulls its (empty) column
    // header too; it comes right after Cost Savings, so fall back to that.
    if (blockersCol < 0 && savingsCol >= 0) blockersCol = savingsCol + 1;
    break;
  }
  if (titleCol === -1) return lists;

  // The sequence number sits in the column immediately left of the title. Its
  // header text is nulled by type-casting, but the per-row numbers survive.
  const noCol = titleCol - 1;
  const isHeaderRow = (row: Row) => s(cell(row, titleCol)).toLowerCase().includes('project title');

  // Walk top to bottom. Banners switch the active list; header rows are skipped;
  // rows before any banner default to Cost Efficiency (the fallback xlsx has the
  // table but no banner). A real project row is one with both a title and an owner.
  let active: ListKey = 'costEfficiency';
  for (const row of rows) {
    const text = rowText(row);
    if (BANNER_RE.test(text)) {
      const key = bannerListKey(text);
      if (key) active = key;
      continue;
    }
    if (isHeaderRow(row)) continue;

    const title = s(cell(row, titleCol));
    const owner = s(cell(row, ownerCol));
    if (!title || !owner) continue;

    const list = lists[active];
    const no = Number(cell(row, noCol)) || list.length + 1;
    const dept = s(cell(row, deptCol));
    const status = s(cell(row, statusCol));

    // Parse savings as a number even when it arrives as a string. gviz type-casts
    // the whole column, so once enough rows hold text ("Pending…") the numeric
    // amounts come back as strings — reading only `typeof === 'number'` would then
    // zero out the total. A non-numeric cell (a "Pending…" note) stays null.
    const savings = parseAmount(cell(row, savingsCol));
    const savingsNote = savings === null ? (s(cell(row, savingsCol)) || 'Pending') : null;
    const blockers = s(cell(row, blockersCol));

    list.push({ no, title, owner, dept, status, savings, savingsNote, blockers });
  }

  lists.costEfficiency.sort((a, b) => a.no - b.no);
  lists.quality.sort((a, b) => a.no - b.no);
  lists.strategic.sort((a, b) => a.no - b.no);
  return lists;
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
  blockers: number;
  baseline: number;
  target: number;
  actual: number;
}

function locateHospitalColumns(rows: Row[]): HospitalCols | null {
  // Detect the two date columns (START DATE / END DATE) by where actual Date
  // values land, not by their headers — gviz type-casts those columns to date
  // and nulls the header text, so "START DATE"/"END DATE" can't be matched.
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const dateCols: number[] = [];
  for (let c = 0; c < width; c++) {
    if (rows.some((r) => cell(r, c) instanceof Date)) dateCols.push(c);
  }

  // The header row is found via its TEXT columns, which survive type-casting.
  for (const row of rows) {
    const status = colByLabel(row, (v) => v.includes('status'));
    const risk = colByLabel(row, (v) => v.includes('risk'));
    const taskName = colByLabel(row, (v) => v.includes('task name'));
    if (status < 0 || risk < 0 || taskName < 0) continue;

    return {
      status,
      risk,
      taskName,
      start: dateCols[0] ?? -1,
      end: dateCols[1] ?? -1,
      priority: colByLabel(row, (v) => v.includes('priority')),
      assignee: colByLabel(row, (v) => v.includes('assignee')),
      description: colByLabel(row, (v) => v.includes('description')),
      deliverable: colByLabel(row, (v) => v.includes('deliverable')),
      blockers: colByLabel(row, (v) => v.includes('blocker')),
      baseline: colByLabel(row, (v) => v.includes('baseline')),
      target: colByLabel(row, (v) => v.includes('targeted')),
      actual: colByLabel(row, (v) => v.includes('actual')),
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

// The KPI columns form their own mini-table that is NOT aligned row-for-row with
// the tasks: a KPI's name sits on one row (text in Baseline, no Target/Actual)
// and its figures land on the following row. Pair each name row with the next
// values row so every KPI reads as one line — name + baseline → target → actual —
// instead of the name and its results being split across two different tasks.
function extractKpis(blockRows: (Row | undefined)[], cols: HospitalCols): KpiEntry[] {
  const kpis: KpiEntry[] = [];
  let pendingName = '';

  for (const row of blockRows) {
    const baseline = s(cell(row, cols.baseline));
    const target = s(cell(row, cols.target));
    const actual = s(cell(row, cols.actual));
    const hasValues = target !== '' || actual !== '';

    if (hasValues) {
      kpis.push({ name: pendingName, baseline: baseline || '—', target: target || '—', actual: actual || '—' });
      pendingName = '';
    } else if (baseline !== '') {
      // A lone Baseline cell is a KPI label; flush any previous unpaired label.
      if (pendingName) kpis.push({ name: pendingName, baseline: '—', target: '—', actual: '—' });
      pendingName = baseline;
    }
  }
  if (pendingName) kpis.push({ name: pendingName, baseline: '—', target: '—', actual: '—' });
  return kpis;
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
    blockers: s(cell(row, cols.blockers)),
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
      // Pull KPIs from the title row plus the task rows only (never the
      // between-block header rows), so the "KPI As of…"/"Baseline Targeted
      // Actual" label rows don't get mistaken for real KPI entries.
      const kpis = extractKpis([rows[titleRowIdx], ...blockRows], cols);
      const kpiLabel = kpis[0]?.name || '—';

      projects.push({
        title,
        owner,
        kpiLabel,
        kpis,
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

  const lists = parseProjectLists(sheetToRows(wb, 'Project Tracking'));
  const hospitalDirector = parseHospitalDirectorProjects(sheetToRows(wb, 'Hospital Director Projects'));

  return { ...lists, hospitalDirector };
}

export async function loadDashboardDataFromGoogleSheet(sheetId: string): Promise<DashboardData> {
  const [trackingRows, hospitalRows] = await Promise.all([
    fetchGoogleSheetRows(sheetId, 'Project Tracking'),
    fetchGoogleSheetRows(sheetId, 'Hospital Director Projects'),
  ]);

  const lists = parseProjectLists(trackingRows);
  const hospitalDirector = parseHospitalDirectorProjects(hospitalRows);

  return { ...lists, hospitalDirector };
}
