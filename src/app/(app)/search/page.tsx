import Link from "next/link";
import type { SearchParams } from "nuqs/server";
import { ShopFilterBar } from "@/components/shop-filter-sheet";
import { ShopCard } from "@/components/shop-card";
import { requireUser } from "@/lib/auth/current-user";
import { PublicListCard } from "@/components/list-card";
import { listPublicLists, searchPageCache } from "@/lib/filters/public-list-filters";
import { listShops } from "@/lib/filters/list-shops";
import { createServerClient } from "@/lib/supabase/server";
import { ListSearchInput, ListSortSelect, SearchInput, SortSelect } from "./search-controls";

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const sp = await searchParams;
  const { tab, lq, lsort, ...filters } = searchPageCache.parse(sp);

  const seg = (on: boolean) =>
    `flex-1 rounded-lg py-1.5 text-center text-sm no-underline ${on ? "bg-surface font-bold text-ink shadow-sm" : "text-muted"}`;

  let body: React.ReactNode;
  if (tab === "lists") {
    const lists = await listPublicLists(await createServerClient(), { q: lq, sort: lsort });
    body = (
      <>
        <ListSearchInput />
        <div className="flex items-center justify-between text-[13px] font-bold text-muted">
          <span>共有リスト</span>
          <ListSortSelect />
        </div>
        {lists.length === 0 ? (
          <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">
            条件に合うリストがありません
          </p>
        ) : (
          lists.map((l) => <PublicListCard key={`${l.kind}-${l.id}`} list={l} />)
        )}
      </>
    );
  } else {
    const shops = await listShops(await createServerClient(), filters);
    body = (
      <>
        <SearchInput />
        <ShopFilterBar />
        <div className="flex items-center justify-between text-[13px] font-bold text-muted">
          <span data-testid="result-count">{shops.length}件</span>
          <SortSelect />
        </div>
        {shops.length === 0 ? (
          <p className="m-0 rounded-[10px] bg-surface-2 p-4 text-center text-[13px] text-muted">
            条件に合うお店がありません
          </p>
        ) : (
          shops.map((s) => <ShopCard key={s.id} shop={s} />)
        )}
      </>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-3 bg-bg p-4">
      <h1 className="m-0 text-lg font-bold">さがす</h1>
      <div className="flex gap-1 rounded-[10px] bg-surface-2 p-1" role="tablist">
        <Link href="/search" role="tab" aria-selected={tab === "shops"} className={seg(tab === "shops")}>
          お店
        </Link>
        <Link href="/search?tab=lists" role="tab" aria-selected={tab === "lists"} className={seg(tab === "lists")}>
          リスト
        </Link>
      </div>
      {body}
    </main>
  );
}
