import { BackButton } from "@/components/back-link";
import { requireAdmin } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";
import { createServerClient } from "@/lib/supabase/server";
import { CategorySection, type CategoryItem } from "./category-section";

export const metadata = { title: "ジャンル・形態・用途の編集" };

const PAGE = 1000;

/** 区分ごとに、その値を使っている店（削除済みを除く）の数を数える。 */
async function usageCounts() {
  const supabase = await createServerClient();
  const genre = new Map<string, number>();
  const style = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("shops")
      .select("genres, styles")
      .is("deleted_at", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const s of data ?? []) {
      // ジャンル未設定の店は「不明」として数える。
      const gs: string[] = s.genres?.length ? s.genres : ["unknown"];
      for (const v of new Set<string>(gs)) genre.set(v, (genre.get(v) ?? 0) + 1);
      for (const v of new Set<string>(s.styles ?? [])) style.set(v, (style.get(v) ?? 0) + 1);
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  // 用途は記録（削除済みを除く）ごとに数える。
  const purpose = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("visits")
      .select("purpose")
      .is("deleted_at", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const v of data ?? []) purpose.set(v.purpose, (purpose.get(v.purpose) ?? 0) + 1);
    if ((data?.length ?? 0) < PAGE) break;
  }
  return { genre, style, purpose };
}

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const [categories, counts] = await Promise.all([getCategories(), usageCounts()]);
  const items = (list: typeof categories.genres, used: Map<string, number>): CategoryItem[] =>
    list.map((c) => ({ ...c, count: used.get(c.value) ?? 0 }));

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 pb-24">
      <BackButton />
      <h1 className="m-0 text-lg font-bold">ジャンル・形態・用途の編集</h1>
      <p className="m-0 text-xs text-muted">
        削除はできません。使わない区分は「非表示」にすると、新しく選べなくなります（すでにその区分の店はそのまま表示されます）。
      </p>
      <CategorySection kind="genre" title="ジャンル" items={items(categories.genres, counts.genre)} />
      <CategorySection kind="style" title="形態" items={items(categories.styles, counts.style)} />
      <CategorySection kind="purpose" title="用途" items={items(categories.purposes, counts.purpose)} />
    </main>
  );
}
