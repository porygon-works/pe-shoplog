import { ReturnLink } from "@/components/return-link";
import { notFound } from "next/navigation";
import { VisitForm } from "@/components/visit-form";
import type { ExistingPhoto } from "@/components/photo-uploader";
import { requireUser } from "@/lib/auth/current-user";
import { isUuid } from "@/lib/ids";
import { createServerClient } from "@/lib/supabase/server";
import type { VisitInput } from "@/lib/validation";

const SIGNED_URL_SECONDS = 3600;

export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createServerClient();
  const { data: visit, error } = await supabase
    .from("visits")
    .select(
      "id, shop_id, user_id, visited_on, rating, party_size, price_range, purpose, reservation, payment_methods, comment, shops(name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!visit || visit.user_id !== user.id) notFound();

  const { data: photoRows, error: photoError } = await supabase
    .from("photos")
    .select("id, kind, storage_path")
    .eq("visit_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (photoError) throw photoError;

  let existing: ExistingPhoto[] = [];
  if (photoRows && photoRows.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("photos")
      .createSignedUrls(
        photoRows.map((p) => p.storage_path),
        SIGNED_URL_SECONDS,
      );
    if (signError) throw signError;
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    existing = photoRows.flatMap((p) => {
      const url = urlByPath.get(p.storage_path);
      return url ? [{ id: p.id, kind: p.kind, url }] : [];
    });
  }

  const shop = visit.shops as unknown as { name: string } | null;

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <ReturnLink href={`/shops/${visit.shop_id}`} className="text-[13px] text-ai no-underline">
          ← 戻る
        </ReturnLink>
        <h1 className="m-0 text-base font-bold">行った記録を編集</h1>
      </header>
      <VisitForm
        shopId={visit.shop_id}
        shopName={shop?.name ?? ""}
        visitId={id}
        existingPhotos={existing}
        initial={{
          visitedOn: visit.visited_on,
          rating: visit.rating,
          priceRange: visit.price_range as VisitInput["priceRange"],
          purpose: visit.purpose as VisitInput["purpose"],
          reservation: visit.reservation as VisitInput["reservation"],
          paymentMethods: (visit.payment_methods ?? []) as VisitInput["paymentMethods"],
          partySize: visit.party_size === null ? "" : String(visit.party_size),
          comment: visit.comment ?? "",
        }}
      />
    </main>
  );
}
