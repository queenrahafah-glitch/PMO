import type { CSSProperties } from 'react';
import type { SummaryCard } from '../lib/summary';

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="cards-grid">
      {cards.map((card) => (
        <div key={card.labelEn} className="card" style={{ '--card-color': card.color } as CSSProperties}>
          <div className="card-label-en">{card.labelEn}</div>
          <div className="card-label-ar" dir="auto">{card.labelAr}</div>
          <div className="card-value">{card.value}</div>
          <div className="card-sub">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
