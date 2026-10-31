import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { NoticeToast } from "./notice-toast";

// 仮の詳細ページ。Task 9 で本実装に置き換える。
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { notice } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: shop } = await supabase.from("shops").select("name").eq("id", id).maybeSingle();
  if (!shop) notFound();

  return (
    <main className="flex flex-col gap-4 bg-surface p-4">
      <NoticeToast notice={notice} />
      <h1 className="text-lg font-bold" data-testid="shop-name">
        {shop.name}
      </h1>
    </main>
  );
}
