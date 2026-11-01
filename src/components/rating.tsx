/** 平均★の表示用（例: ★4.3（3件））。評価がなければ null。 */
export function ratingText(avg: number | string | null, count: number): string | null {
  if (avg === null || count === 0) return null;
  return `★${Number(avg).toFixed(1)}（${count}件）`;
}

/** 1 件の記録の★（例: ★★★☆☆）。 */
export function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`評価 ★${rating}`} className="text-warn">
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
