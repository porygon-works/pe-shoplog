import { isUuid } from "@/lib/ids";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";
import type { ShopInput } from "@/lib/validation";
import { EditShopForm } from "./edit-form";

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  const { data: shop, error } = await supabase
    .from("shops")
    .select("name, genres, styles, smoking, time_slots, reference_url")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!shop) notFound();

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <h1 className="m-0 border-b border-line px-4 py-3 text-base font-bold">店情報を編集</h1>
      <EditShopForm
        shopId={id}
        initial={{
          name: shop.name,
          genres: (shop.genres ?? []) as ShopInput["genres"],
          styles: (shop.styles ?? []) as ShopInput["styles"],
          smoking: shop.smoking as ShopInput["smoking"],
          timeSlots: (shop.time_slots ?? ["dinner"]) as ShopInput["timeSlots"],
          referenceUrl: shop.reference_url ?? "",
        }}
      />
    </main>
  );
}
