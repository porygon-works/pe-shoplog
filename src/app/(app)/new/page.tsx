import { requireUser } from "@/lib/auth/current-user";
import { getPlaceBasics, isValidPlaceId } from "@/lib/places/google";
import { NewShopFlow } from "./new-shop-flow";
import type { PickedPlace } from "./place-search";

export default async function NewShopPage({
  searchParams,
}: {
  searchParams: Promise<{ placeId?: string | string[] }>;
}) {
  await requireUser();
  const { placeId } = await searchParams;
  const id = typeof placeId === "string" ? placeId.trim() : "";

  // マップのアイコンから来た場合は、店を選んだ状態から始める。
  let initialPlace: PickedPlace | null = null;
  let initialError = false;
  if (id) {
    if (isValidPlaceId(id)) {
      try {
        initialPlace = await getPlaceBasics(id);
      } catch (e) {
        console.error("place details failed", e);
        initialError = true;
      }
    } else {
      initialError = true;
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <h1 className="m-0 border-b border-line px-4 py-3 text-base font-bold">お店を登録</h1>
      <NewShopFlow initialPlace={initialPlace} initialError={initialError} />
    </main>
  );
}
