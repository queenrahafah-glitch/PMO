import { useEffect, useState } from 'react';
import { fetchGoogleSheetRows } from '../lib/googleSheets';

// Temporary diagnostic surface (opened with ?debug=1). It runs the exact same
// fetch the dashboard uses and dumps the first rows so we can see precisely what
// Google's gviz feed returns for this workbook.
export function DebugView({ sheetId }: { sheetId: string }) {
  const [out, setOut] = useState('Loading…');

  useEffect(() => {
    (async () => {
      const report: string[] = [];
      for (const sheet of ['Project Tracking', 'Hospital Director Projects']) {
        try {
          const rows = await fetchGoogleSheetRows(sheetId, sheet);
          report.push(`### ${sheet} — ${rows.length} rows`);
          rows.slice(0, 6).forEach((r, i) => {
            const cells = r.map((c) => (c == null ? '·' : String(c).replace(/\s+/g, ' ').slice(0, 40)));
            report.push(`[${i}] ${JSON.stringify(cells)}`);
          });
        } catch (e) {
          report.push(`### ${sheet} — ERROR: ${(e as Error).message}`);
        }
        report.push('');
      }
      setOut(report.join('\n'));
    })();
  }, [sheetId]);

  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        background: '#0b1f33',
        color: '#d6e6ff',
        minHeight: '100vh',
      }}
    >
      {out}
    </pre>
  );
}
