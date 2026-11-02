import { requireUser } from "@/lib/auth/current-user";
import { getPlaceBasics, isValidPlaceId } from "@/lib/places/google";
import { consumePlacesQuota } from "@/lib/places/quota";
import { NewShopFlow } from "./new-shop-flow";
import type { PickedPlace } from "./place-search";

export default async function NewShopPage({
  searchParams,
}: {
  searchParams: Promise<{ placeId?: string | string[] }>;
}) {
  const user = await requireUser();
  const { placeId } = await searchParams;
  const id = typeof placeId === "string" ? placeId.trim() : "";

  // マップのアイコンから来た場合は、店を選んだ状態から始める。
  let initialPlace: PickedPlace | null = null;
  let initialError = false;
  if (id) {
    if (isValidPlaceId(id)) {
      try {
        // 使用回数の上限に達していたら Google を呼ばず、検索失敗として知らせる。
        if (!(await consumePlacesQuota("details", user.id))) throw new Error("places quota reached");
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
