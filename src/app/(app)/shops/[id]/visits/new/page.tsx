import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { isUuid } from "@/lib/ids";
import { createServerClient } from "@/lib/supabase/server";
import { VisitForm } from "@/components/visit-form";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!shop) notFound();

  // 日本時間の今日
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Link href={`/shops/${id}`} className="text-[13px] text-ai no-underline">
          ← 戻る
        </Link>
        <h1 className="m-0 text-base font-bold">行った記録</h1>
      </header>
      <VisitForm
        shopId={id}
        shopName={shop.name}
        initial={{
          visitedOn: today,
          rating: null,
          smoking: "unknown",
          priceRange: "unknown",
          purpose: "unknown",
          reservation: "unknown",
          paymentMethods: [],
          partySize: "",
          comment: "",
        }}
      />
    </main>
  );
}
