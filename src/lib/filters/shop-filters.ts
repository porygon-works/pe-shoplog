import {
  createParser,
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsStringLiteral,
} from "nuqs/server";

import { CATEGORY_VALUE_RE } from "@/lib/category-utils";
import { PRICE_RANGES, PURPOSES, SMOKING, type Option } from "@/lib/options";

/** 絞り込みの選択肢。「不明」では絞り込めないので外す。URL の値の検証にもこれを使う。 */
const known = <O extends readonly Option<string>[]>(o: O) => o.filter((x) => x.value !== "unknown");
export const SMOKING_FILTER_OPTIONS = known(SMOKING);
export const PRICE_FILTER_OPTIONS = known(PRICE_RANGES);
export const PURPOSE_FILTER_OPTIONS = known(PURPOSES);

export const MAX_Q_LENGTH = 100;

/** 許可した値だけを残す配列パーサー。URL 由来の不正な値は捨てる（PostgREST の 400 を防ぐ）。 */
function allowedArray(options: readonly Option<string>[]) {
  const allowed = new Set(options.map((o) => o.value));
  return arrayOf((v) => allowed.has(v));
}

function arrayOf(isValid: (v: string) => boolean) {
  const item = createParser<string>({
    parse: (v) => (isValid(v) ? v : null),
    serialize: (v) => v,
  });
  return parseAsArrayOf(item).withDefault([]);
}

/**
 * ジャンル・形態は DB で増減するので、固定の許可リストではなく形だけ検査する。
 * 存在しない値は結果 0 件になるだけで害はない。「不明」では絞り込めないので外す。
 */
const categoryArray = () => arrayOf((v) => CATEGORY_VALUE_RE.test(v) && v !== "unknown");

const qParser = createParser<string>({
  parse: (v) => v.slice(0, MAX_Q_LENGTH),
  serialize: (v) => v,
}).withDefault("");

export const SORTS = ["new", "visits"] as const;
export type ShopSort = (typeof SORTS)[number];

/** URL クエリで持つ絞り込み条件。マップとさがすで共通。 */
export const shopFilterParsers = {
  q: qParser,
  genre: categoryArray(),
  styles: categoryArray(),
  smoking: allowedArray(SMOKING_FILTER_OPTIONS),
  price: allowedArray(PRICE_FILTER_OPTIONS),
  purpose: allowedArray(PURPOSE_FILTER_OPTIONS),
  want: parseAsBoolean.withDefault(false),
  sort: parseAsStringLiteral(SORTS).withDefault("new"),
};

export const shopFilterCache = createSearchParamsCache(shopFilterParsers);

export type ShopFilters = {
  q: string;
  genre: string[];
  styles: string[];
  smoking: string[];
  price: string[];
  purpose: string[];
  want: boolean;
  sort: ShopSort;
};

/** クイックチップ「吸える」が表す喫煙の値。 */
export const SMOKABLE = ["smoking_ok", "separated", "heated_only"] as const;
/** クイックチップ「打ち上げ実績」が表す用途の値。 */
export const CELEBRATION = ["celebration"] as const;

export function hasAll(current: readonly string[], values: readonly string[]): boolean {
  return values.every((v) => current.includes(v));
}

/** values が全部入っていれば外し、そうでなければ足す。 */
export function toggleValues(current: readonly string[], values: readonly string[]): string[] {
  if (hasAll(current, values)) return current.filter((c) => !values.includes(c));
  return [...current, ...values.filter((v) => !current.includes(v))];
}

/** LIKE のワイルドカードと、エスケープ文字そのものを無効化する。 */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// PostgREST のビルダー型は入れ子が深く、ジェネリクスで受けると型推論が破綻するため、
// 使うメソッドだけの構造型にキャストして条件を足す。
interface Chain {
  ilike(column: string, pattern: string): Chain;
  in(column: string, values: string[]): Chain;
  overlaps(column: string, values: string[]): Chain;
  eq(column: string, value: number): Chain;
  order(column: string, options: { ascending: boolean }): Chain;
}

/** `shop_index` に対するクエリへ絞り込みと並び順を加える。 */
export function applyShopFilters<Q>(query: Q, f: ShopFilters): Q {
  let r = query as unknown as Chain;
  const q = f.q.trim();
  if (q) r = r.ilike("name", `%${escapeLike(q)}%`);
  if (f.genre.length) r = r.in("genre", f.genre);
  if (f.styles.length) r = r.overlaps("styles", f.styles);
  if (f.smoking.length) r = r.in("smoking", f.smoking);
  if (f.price.length) r = r.in("price_range", f.price);
  if (f.purpose.length) r = r.overlaps("purposes", f.purpose);
  if (f.want) r = r.eq("visit_count", 0);
  if (f.sort === "visits") {
    r = r.order("visit_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    r = r.order("created_at", { ascending: false });
  }
  return r as unknown as Q;
}
