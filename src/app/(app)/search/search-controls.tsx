"use client";

import { debounce, useQueryState } from "nuqs";
import { publicListParsers } from "@/lib/filters/public-list-filters";
import { shopFilterParsers } from "@/lib/filters/shop-filters";

export function SearchInput() {
  const [q, setQ] = useQueryState("q", {
    ...shopFilterParsers.q,
    shallow: false,
    limitUrlUpdates: debounce(300),
  });
  return (
    <input
      type="search"
      className="input"
      placeholder="店名でさがす"
      aria-label="店名でさがす"
      value={q}
      onChange={(e) => void setQ(e.target.value || null)}
    />
  );
}

export function SortSelect() {
  const [sort, setSort] = useQueryState("sort", { ...shopFilterParsers.sort, shallow: false });
  return (
    <select
      aria-label="並び順"
      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink"
      value={sort}
      onChange={(e) => void setSort(e.target.value === "visits" ? "visits" : null)}
    >
      <option value="new">新着順</option>
      <option value="visits">記録の多い順</option>
    </select>
  );
}

export function ListSearchInput() {
  const [lq, setLq] = useQueryState("lq", {
    ...publicListParsers.lq,
    shallow: false,
    limitUrlUpdates: debounce(300),
  });
  return (
    <input
      type="search"
      className="input"
      placeholder="リスト名でさがす"
      aria-label="リスト名でさがす"
      value={lq}
      onChange={(e) => void setLq(e.target.value || null)}
    />
  );
}

export function ListSortSelect() {
  const [lsort, setLsort] = useQueryState("lsort", { ...publicListParsers.lsort, shallow: false });
  return (
    <select
      aria-label="並び順"
      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink"
      value={lsort}
      onChange={(e) => void setLsort(e.target.value === "count" ? "count" : null)}
    >
      <option value="updated">更新順</option>
      <option value="count">店の多い順</option>
    </select>
  );
}
