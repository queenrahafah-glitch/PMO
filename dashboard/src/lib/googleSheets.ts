const DATE_LITERAL = /^Date\((\d+),(\d+),(\d+)/;

interface GvizCell {
  v: unknown;
  f?: string;
}

interface GvizResponse {
  table: {
    cols: { id: string; label?: string }[];
    rows: { c: (GvizCell | null)[] }[];
  };
}

function parseGvizValue(v: unknown): unknown {
  if (typeof v !== 'string') return v ?? null;
  // gviz encodes dates as e.g. "Date(2026,6,8)" with a 0-based month, which
  // lines up with Date.UTC's 0-based month argument.
  const m = DATE_LITERAL.exec(v);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]), Number(m[3])));
  return v;
}

// Google's gviz endpoint wraps its JSON in a JS function call rather than
// returning it directly, so the body must be unwrapped before parsing.
function unwrapGvizResponse(text: string): GvizResponse {
  const match = /google\.visualization\.Query\.setResponse\(([\s\S]*?)\);?\s*$/.exec(text);
  if (!match) throw new Error('Unexpected response shape from Google Sheets');
  return JSON.parse(match[1]);
}

export async function fetchGoogleSheetRows(sheetId: string, sheetName: string): Promise<unknown[][]> {
  // headers=0 tells gviz to treat every row as data — otherwise it silently
  // consumes the first row(s) as column headers, dropping real content. The
  // downstream parser discovers column positions from label text itself, so
  // the exact column offset gviz returns does not matter.
  // The timestamp param + no-store defeat browser/CDN caching so edits made in
  // the sheet show up on the next page load instead of a stale cached response.
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(
      `Could not load sheet "${sheetName}" (${res.status}). Make sure the sheet's sharing is set to "Anyone with the link – Viewer".`,
    );
  }
  const data = unwrapGvizResponse(await res.text());
  const width = data.table.cols.length;

  const dataRows = data.table.rows.map((row) => {
    const cells: unknown[] = new Array(width).fill(null);
    for (let i = 0; i < width; i++) {
      const c = row.c[i];
      if (c) cells[i] = parseGvizValue(c.v);
    }
    return cells;
  });

  // gviz auto-detects one header row and lifts it into cols[].label, dropping
  // it from the data rows — and it type-casts each column, so header text
  // sitting in a date/number column comes back as null in the remaining rows.
  // The net effect is that the sheet's real header row ("N. | Project Title …",
  // "STATUS | RISK | START DATE …") vanishes from the data entirely. The
  // downstream parser locates fields by that header text, so re-materialize the
  // detected header as a leading row from the column labels.
  const labelRow: unknown[] = data.table.cols.map((c) => (c.label && c.label.trim() ? c.label : null));
  if (labelRow.some((v) => v != null)) return [labelRow, ...dataRows];
  return dataRows;
}
