export type VisitLike = {
  smoking: string;
  priceRange: string;
  purpose: string;
  reservation: string;
  paymentMethods: readonly string[];
  partySize: number | null;
};

export type Count = { value: string; count: number };

export type VisitBreakdown = {
  smoking: Count[];
  priceRange: Count[];
  purpose: Count[];
  reservation: Count[];
  paymentMethods: Count[];
  maxPartySize: number | null;
};

function tally(items: Iterable<string>): Count[] {
  const map = new Map<string, number>();
  for (const v of items) {
    if (v === "unknown") continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  // Array.prototype.sort は安定なので、同数は出現順を保つ
  return [...map]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function summarizeVisits(visits: VisitLike[]): VisitBreakdown {
  let maxPartySize: number | null = null;
  for (const v of visits) {
    if (
      v.partySize !== null &&
      (maxPartySize === null || v.partySize > maxPartySize)
    ) {
      maxPartySize = v.partySize;
    }
  }
  return {
    smoking: tally(visits.map((v) => v.smoking)),
    priceRange: tally(visits.map((v) => v.priceRange)),
    purpose: tally(visits.map((v) => v.purpose)),
    reservation: tally(visits.map((v) => v.reservation)),
    paymentMethods: tally(visits.flatMap((v) => v.paymentMethods)),
    maxPartySize,
  };
}
