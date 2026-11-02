import { z } from "zod";
import type { Option } from "@/lib/options";

/** 区分（ジャンル・形態）。`value` は不変の ID、`label` は管理画面から変えられる。 */
export type Category = { value: string; label: string; hidden: boolean; sortOrder: number };
export type Categories = { genres: Category[]; styles: Category[] };
export type CategoryKind = "genre" | "style";

/** DB の shop_categories.value の形。URL クエリや入力の形式チェックにも使う。 */
export const CATEGORY_VALUE_RE = /^[a-z0-9_]{1,40}$/;

export const categoryLabelSchema = z.string().trim().min(1).max(20);

/** 管理画面で追加する区分の value。`c_` + ランダム 8 桁の 16 進。 */
export function generateCategoryValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `c_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 新規に選ばせる選択肢。非表示は除くが、`keep`（今の値）に含まれるものは残す。
 * `excludeUnknown` は「不明」では絞り込めない絞り込みシート用。
 */
export function selectableOptions(
  list: readonly Category[],
  keep: readonly string[] = [],
  excludeUnknown = false,
): Option<string>[] {
  return list
    .filter((c) => (!c.hidden || keep.includes(c.value)) && !(excludeUnknown && c.value === "unknown"))
    .map((c) => ({ value: c.value, label: c.label }));
}

/** 店の登録・編集で選ぶジャンルの選択肢。「不明」は何も選ばないことで表すので出さない。 */
export function genreOptions(list: readonly Category[], keep: readonly string[] = []): Option<string>[] {
  return selectableOptions(list, keep, true);
}

/** ジャンルの表示名を「・」でつなぐ（未設定なら空文字）。 */
export function genresText(list: readonly Category[], genres: readonly string[]): string {
  return genres
    .map((g) => list.find((c) => c.value === g)?.label ?? g)
    .join("・");
}

/**
 * 店のジャンル・形態が区分に存在するか確認する。新規に選ぶ値は非表示不可。
 * `current`（編集前の値）と同じ値なら非表示でも可。問題があれば true。
 */
export function hasInvalidCategory(
  categories: Categories,
  input: { genres: readonly string[]; styles: readonly string[] },
  current?: { genres: readonly string[]; styles: readonly string[] },
): boolean {
  const badGenre = input.genres.some((v) => {
    const c = categories.genres.find((x) => x.value === v);
    return !c || v === "unknown" || (c.hidden && !current?.genres.includes(v));
  });
  if (badGenre) return true;
  return input.styles.some((s) => {
    const c = categories.styles.find((x) => x.value === s);
    return !c || (c.hidden && !current?.styles.includes(s));
  });
}

/** 同じ kind に同じ表示名（非表示含む）があるか。`exceptValue` は改名時の自分自身。 */
export function hasDuplicateLabel(list: readonly Category[], label: string, exceptValue?: string): boolean {
  return list.some((c) => c.value !== exceptValue && c.label === label);
}

export const INVALID_CATEGORY_MESSAGE = "選べない区分が含まれています。画面を開き直してもう一度お試しください";
/** shops のトリガー（0007）が区分の不一致で投げる SQLSTATE（check_violation）。 */
export const CHECK_VIOLATION = "23514";
