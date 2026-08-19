import { useEffect, useState } from 'react';
import { fetchGoogleSheetRows } from '../lib/googleSheets';
import { parseProjectLists } from '../lib/parseWorkbook';

// Temporary diagnostic (?debug=1): shows how the live "Project Tracking" feed is
// split into the three lists, plus the raw rows, so we can see why newly added
// Quality/Strategic rows do or don't show up.
export function DebugView({ sheetId }: { sheetId: string }) {
  const [out, setOut] = useState('Loading…');

  useEffect(() => {
    (async () => {
      const lines: string[] = [];
      try {
        const rows = await fetchGoogleSheetRows(sheetId, 'Project Tracking');
        const lists = parseProjectLists(rows);
        lines.push(`PARSED → costEfficiency:${lists.costEfficiency.length}  quality:${lists.quality.length}  strategic:${lists.strategic.length}`);
        lines.push('');
        (['costEfficiency', 'quality', 'strategic'] as const).forEach((k) => {
          lines.push(`== ${k} ==`);
          lists[k].forEach((p) => lines.push(`   #${p.no} "${p.title}" | owner="${p.owner}" | ${p.dept} | ${p.status}`));
          if (lists[k].length === 0) lines.push('   (none)');
        });
        lines.push('');
        lines.push(`RAW ROWS — ${rows.length}`);
        rows.forEach((r, i) => {
          const cells = r.map((c) => (c == null ? '·' : String(c).replace(/\s+/g, ' ').slice(0, 20)));
          lines.push(`[${i}] ${cells.join(' | ')}`);
        });
      } catch (e) {
        lines.push(`ERROR: ${(e as Error).message}`);
      }
      setOut(lines.join('\n'));
    })();
  }, [sheetId]);

  return (
    <pre style={{ margin: 0, padding: 12, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0b1f33', color: '#d6e6ff', minHeight: '100vh' }}>
      {out}
    </pre>
  );
}
