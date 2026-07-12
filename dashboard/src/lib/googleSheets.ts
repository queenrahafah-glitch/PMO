const DATE_LITERAL = /^Date\((\d+),(\d+),(\d+)/;

interface GvizCell {
  v: unknown;
  f?: string;
}

interface GvizResponse {
  table: {
    cols: { id: string }[];
    rows: { c: (GvizCell | null)[] }[];
  };
}

function parseGvizValue(v: unknown): unknown {
  if (typeof v !== 'string') return v ?? null;
  const m = DATE_LITERAL.exec(v);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]), Number(m[3])));
  return v;
}

// Google's cols[].id is the real spreadsheet column letter (e.g. "B", "C"...),
// not a 0-based array position. When a sheet's column A is entirely empty,
// gviz omits it and cols[0].id is "B" — so column letters must be decoded
// into absolute indices rather than trusting array position, otherwise every
// downstream fixed column index (COL.RISK, COL.START, etc.) reads one or more
// columns too far right.
function columnLetterToIndex(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Google's gviz endpoint wraps its JSON in a JS function call rather than
// returning it directly, so the body must be unwrapped before parsing.
function unwrapGvizResponse(text: string): GvizResponse {
  const match = /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/.exec(text);
  if (!match) throw new Error('Unexpected response shape from Google Sheets');
  return JSON.parse(match[1]);
}

export async function fetchGoogleSheetRows(sheetId: string, sheetName: string): Promise<unknown[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Could not load sheet "${sheetName}" (${res.status}). Make sure the sheet's sharing is set to "Anyone with the link – Viewer".`,
    );
  }
  const data = unwrapGvizResponse(await res.text());
  const colIndices = data.table.cols.map((c) => columnLetterToIndex(c.id));
  const width = Math.max(23, ...colIndices.map((i) => i + 1));
  return data.table.rows.map((row) => {
    const cells: unknown[] = new Array(width).fill(null);
    colIndices.forEach((absIndex, i) => {
      const cell = row.c[i];
      if (cell) cells[absIndex] = parseGvizValue(cell.v);
    });
    return cells;
  });
}
