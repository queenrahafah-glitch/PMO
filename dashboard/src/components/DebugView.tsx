import { useEffect, useState } from 'react';

// Temporary diagnostic (?debug=1): dumps the raw gviz cells (both typed value v
// and formatted value f) for the KPI/Blockers columns so we can see exactly how
// Google represents those values.
export function DebugView({ sheetId }: { sheetId: string }) {
  const [out, setOut] = useState('Loading…');

  useEffect(() => {
    (async () => {
      const lines: string[] = [];
      for (const sheet of ['Project Tracking', 'Hospital Director Projects']) {
        try {
          const url =
            `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
            `?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
          const text = await (await fetch(url, { cache: 'no-store' })).text();
          const json = JSON.parse(/setResponse\(([\s\S]*?)\);?\s*$/.exec(text)![1]);
          const rows = json.table.rows as { c: ({ v: unknown; f?: string } | null)[] }[];
          lines.push(`### ${sheet} — ${rows.length} rows`);
          rows.slice(0, 22).forEach((r, i) => {
            const cells = r.c.map((c) => {
              if (!c) return '·';
              const v = c.v == null ? '∅' : String(c.v).replace(/\s+/g, ' ').slice(0, 16);
              const f = c.f == null ? '' : `/f=${String(c.f).replace(/\s+/g, ' ').slice(0, 16)}`;
              return v + f;
            });
            lines.push(`[${i}] ${cells.join(' | ')}`);
          });
        } catch (e) {
          lines.push(`### ${sheet} — ERROR: ${(e as Error).message}`);
        }
        lines.push('');
      }
      setOut(lines.join('\n'));
    })();
  }, [sheetId]);

  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        fontSize: 10,
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
