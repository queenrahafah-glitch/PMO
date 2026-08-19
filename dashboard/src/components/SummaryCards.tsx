import { useState, type CSSProperties } from 'react';
import type { SummaryCard } from '../lib/summary';

function Card({ card }: { card: SummaryCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ '--card-color': card.color } as CSSProperties}>
      <div className="card-label-en">{card.labelEn}</div>
      <div className="card-label-ar" dir="auto">{card.labelAr}</div>
      <div className="card-value">{card.value}</div>
      {card.items ? (
        <>
          <button type="button" className="card-sub card-sub--toggle" onClick={() => setOpen((o) => !o)}>
            {open ? 'إخفاء الأقسام ▲' : 'اضغط لعرض الأقسام ▾'}
          </button>
          {open && (
            <div className="card-chips">
              {card.items.map((it) => (
                <span className="card-chip" dir="auto" key={it}>{it}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card-sub">{card.sub}</div>
      )}
    </div>
  );
}

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="cards-grid">
      {cards.map((card) => (
        <Card key={card.labelEn} card={card} />
      ))}
    </div>
  );
}
