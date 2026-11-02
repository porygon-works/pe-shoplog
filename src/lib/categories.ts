import "server-only";

import { cache } from "react";
import type { Categories, Category } from "@/lib/category-utils";
import { createServerClient } from "@/lib/supabase/server";

/** 区分（ジャンル・形態）を 1 リクエストにつき 1 回だけ取得する。sort_order → label 順。 */
export const getCategories = cache(async (): Promise<Categories> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("shop_categories")
    .select("kind, value, label, hidden, sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw error;

  const genres: Category[] = [];
  const styles: Category[] = [];
  const purposes: Category[] = [];
  for (const r of data ?? []) {
    const c: Category = { value: r.value, label: r.label, hidden: r.hidden, sortOrder: r.sort_order };
    // 知らない種類は無視する（DB に新しい種類を先に足しても、ほかの区分に混ざらないように）。
    if (r.kind === "genre") genres.push(c);
    else if (r.kind === "style") styles.push(c);
    else if (r.kind === "purpose") purposes.push(c);
  }
  return { genres, styles, purposes };
});
