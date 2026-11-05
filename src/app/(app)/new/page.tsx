import { requireUser } from "@/lib/auth/current-user";
import { getPlaceBasics, isValidPlaceId } from "@/lib/places/google";
import { consumePlacesQuota } from "@/lib/places/quota";
import { NewShopFlow } from "./new-shop-flow";
import type { PickedPlace } from "./place-search";

export default async function NewShopPage({
  searchParams,
}: {
  searchParams: Promise<{ placeId?: string | string[]; name?: string; lat?: string; lng?: string; mode?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const id = typeof sp.placeId === "string" ? sp.placeId.trim() : "";
  // 地図の「行った」から来たときは、行った記録を付ける前提の登録画面にする。
  const intent = sp.mode === "visit" ? "visit" : "any";
  // 地図で取得済みの名前と位置があれば、それを使って Google を呼ばない（登録時にサーバーで形式を確認する）。
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const given =
    id && isValidPlaceId(id) && typeof sp.name === "string" && sp.name.trim() && Number.isFinite(lat) && Number.isFinite(lng)
      ? { placeId: id, name: sp.name.trim().slice(0, 100), lat, lng }
      : null;

  // マップのアイコンから来た場合は、店を選んだ状態から始める。
  let initialPlace: PickedPlace | null = null;
  let initialError = false;
  if (given) {
    initialPlace = given;
  } else if (id) {
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
      <h1 className="m-0 border-b border-line px-4 py-3 text-base font-bold">
        {intent === "visit" ? "行ったお店を登録" : "お店を登録"}
      </h1>
      <NewShopFlow initialPlace={initialPlace} initialError={initialError} intent={intent} />
    </main>
  );
}
