import { useEffect, useState } from 'react';
import { fetchGoogleSheetRows } from '../lib/googleSheets';

// Temporary diagnostic (?debug=1): dumps the rows the dashboard actually receives
// for the "Project Tracking" sheet so we can see what changed after new projects
// were added.
export function DebugView({ sheetId }: { sheetId: string }) {
  const [out, setOut] = useState('Loading…');

  useEffect(() => {
    (async () => {
      const lines: string[] = [];
      try {
        const rows = await fetchGoogleSheetRows(sheetId, 'Project Tracking');
        lines.push(`Project Tracking — ${rows.length} rows`);
        rows.forEach((r, i) => {
          const cells = r.map((c) => (c == null ? '·' : String(c).replace(/\s+/g, ' ').slice(0, 22)));
          lines.push(`[${i}] ${cells.join(' | ')}`);
        });
      } catch (e) {
        lines.push(`ERROR: ${(e as Error).message}`);
      }
      setOut(lines.join('\n'));
    })();
  }, [sheetId]);

  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
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
