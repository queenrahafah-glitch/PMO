# Project Tracking Dashboard

A React + Vite implementation of the "Project Tracking Dashboard" design (originally prototyped in Claude Design as `project/Project Tracking Dashboard.dc.html`).

Unlike the original prototype — which had the project/task data hard-coded — this version parses the source workbook (`public/data/project-tracking.xlsx`, a copy of `project/uploads/Project tracking.xlsx`) directly in the browser at load time, so the dashboard always reflects whatever is in that file.

## Running it

```bash
npm install
npm run dev      # dev server with HMR
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

## How the data pipeline works

- `src/lib/parseWorkbook.ts` reads two sheets from the workbook:
  - **"Project Tracking"** → the *Cost Efficiency Projects* list (rows below the `N. | Project Title | ... | Cost Savings (SAR)` header).
  - **"Hospital Director Projects"** → each project is a block starting at a row whose title cell contains "Project Owner"; the block's task rows are every subsequent row with a real date in the START DATE column (this reliably skips the sheet's "PROJECT DETAILS" section labels and repeated column-header rows). A block is skipped as an unfilled template if none of its task rows have a real task name/assignee — this is what excludes the ~21 blank per-project templates in that sheet, and the other four fully-templated hidden sheets (Cost Efficiency Projects, Strategic, Improvement, Innovation) aren't read at all.
  - Per-task KPI (baseline → target → actual) only pulls from the sheet's Baseline/Targeted/Actual mini-columns when Targeted or Actual is actually filled in — otherwise a row's "Baseline" cell is just a stray KPI section label from the sheet's stacked mini-tables, not a value belonging to that task.
- `src/lib/summary.ts` computes everything the top summary cards and status-mix bar show (totals, realized savings, delayed/not-started counts, departments engaged) live from the parsed rows — nothing is a maintained/manual total.
- `src/lib/colors.ts` holds the status/risk/priority color tokens, ported from the original design.

## Known gap vs. the original prototype

The source spreadsheet has a few cells where a human would need real judgment calls to interpret correctly (e.g. one KPI cell for the "إحسان للتنويم" project reads as a target value in the original hand-tuned prototype, but structurally looks identical to two other cells that are section labels, not values, elsewhere in the same sheet). The parser here uses one consistent, documented rule rather than special-casing individual cells, so it may occasionally differ from the original prototype's exact text in a handful of ambiguous KPI cells. Everything else — all 9 real projects, all 15 real tasks, savings figures, and status/date/search behavior — matches.
