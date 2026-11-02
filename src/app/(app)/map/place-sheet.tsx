"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createShopAction, type NewShopState } from "@/app/(app)/new/actions";
import type { PickedPlace } from "@/lib/places/use-place-autocomplete";

/**
 * まだ登録されていない Google の店のカード。その場で「気になる」「行った」で登録できる。
 * 地図のアイコンから来たときは placeId しかないので、名前と位置を取ってから出す。
 */
export function PlaceSheet({
  placeId,
  place: given,
  onClose,
}: {
  placeId: string;
  place?: PickedPlace;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<PickedPlace | null>(given ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [state, action, pending] = useActionState<NewShopState, FormData>(createShopAction, {});

  useEffect(() => {
    if (given) return;
    let alive = true;
    fetch(`/api/places/details?${new URLSearchParams({ id: placeId })}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<PickedPlace>;
      })
      .then((d) => alive && setPlace(d))
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
  }, [placeId, given]);

  const ready = !!place && place.name.trim() !== "";

  return (
    <div
      data-testid="place-sheet"
      className="absolute bottom-2.5 left-2.5 right-2.5 z-[4] flex flex-col gap-2.5 rounded-2xl bg-surface p-3.5 shadow-[0_6px_24px_rgba(0,0,0,.2)] motion-safe:animate-[sheet-up_.18s_ease-out]"
    >
      <div className="flex flex-col gap-0.5">
        <div className="font-bold" data-testid="place-name">
          {place?.name || (loadFailed ? "店の情報を取得できませんでした" : "読み込み中…")}
        </div>
        <div className="text-xs text-muted">まだ誰も登録していないお店です</div>
      </div>
      {state.error && (
        <p role="alert" className="m-0 text-[13px] text-shu">
          {state.error}
        </p>
      )}
      <form action={action} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="placeId" value={placeId} />
        <input type="hidden" name="name" value={place?.name ?? ""} />
        <input type="hidden" name="lat" value={place?.lat ?? ""} />
        <input type="hidden" name="lng" value={place?.lng ?? ""} />
        {/* ワンタップ登録の時間帯は既定の「夜」。 */}
        <input type="hidden" name="timeSlots" value="dinner" />
        <button
          type="submit"
          name="mode"
          value="want"
          className="btn btn-primary !py-2 text-[13px]"
          disabled={!ready || pending}
        >
          気になる
        </button>
        <button
          type="submit"
          name="mode"
          value="visit"
          className="btn btn-accent !py-2 text-[13px]"
          disabled={!ready || pending}
        >
          行った（記録する）
        </button>
      </form>
      <div className="flex items-center justify-between">
        <Link href={`/new?placeId=${encodeURIComponent(placeId)}`} className="text-xs text-ai underline">
          ジャンルなども入れて登録
        </Link>
        <button type="button" className="bg-transparent p-0 text-[13px] text-muted" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
