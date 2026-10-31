import type { SupabaseClient } from "@supabase/supabase-js";
import { createParser, createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

import { escapeLike, MAX_Q_LENGTH, shopFilterParsers } from "./shop-filters";

export const SEARCH_TABS = ["shops", "lists"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const LIST_SORTS = ["updated", "count"] as const;
export type PublicListSort = (typeof LIST_SORTS)[number];

/** さがす画面の「リスト」タブが URL で持つ条件。不明な値は捨てて既定値に戻す。 */
export const publicListParsers = {
  tab: parseAsStringLiteral(SEARCH_TABS).withDefault("shops"),
  lq: createParser<string>({
    parse: (v) => v.slice(0, MAX_Q_LENGTH),
    serialize: (v) => v,
  }).withDefault(""),
  lsort: parseAsStringLiteral(LIST_SORTS).withDefault("updated"),
};

/** さがす画面全体（お店タブ + リストタブ）のサーバー側キャッシュ。 */
export const searchPageCache = createSearchParamsCache({ ...shopFilterParsers, ...publicListParsers });

export const PUBLIC_LIST_LIMIT = 100;

export type PublicListRow = {
  kind: "personal" | "shared";
  id: string;
  name: string;
  list_kind: "want" | "favorite" | null;
  owner_id: string;
  owner_nickname: string;
  shop_count: number;
  updated_at: string;
};

/** `public_lists` ビューを名前で絞り込み、並べ替えて最大 100 件返す。 */
export async function listPublicLists(
  supabase: SupabaseClient,
  f: { q: string; sort: PublicListSort },
): Promise<PublicListRow[]> {
  let query = supabase
    .from("public_lists")
    .select("kind, id, name, list_kind, owner_id, owner_nickname, shop_count, updated_at");
  const q = f.q.trim();
  if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
  if (f.sort === "count") query = query.order("shop_count", { ascending: false });
  query = query.order("updated_at", { ascending: false }).limit(PUBLIC_LIST_LIMIT);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PublicListRow[];
}
