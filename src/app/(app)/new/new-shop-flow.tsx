"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useCategories } from "@/components/categories-provider";
import { ChipGroup } from "@/components/chip-group";
import { useToast } from "@/components/toast";
import { selectableOptions } from "@/lib/category-utils";
import type { ShopInput } from "@/lib/validation";
import { createShopAction, type NewShopState } from "./actions";
import { LocationPicker, type LatLng } from "./location-picker";
import { PlaceSearch, SEARCH_ERROR, type PickedPlace } from "./place-search";

type Picked = { placeId: string | null; name: string; location: LatLng | null; manual: boolean };

export function NewShopFlow({
  initialPlace,
  initialError,
}: {
  initialPlace: PickedPlace | null;
  initialError: boolean;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<Picked | null>(
    initialPlace
      ? {
          placeId: initialPlace.placeId,
          name: initialPlace.name,
          location: { lat: initialPlace.lat, lng: initialPlace.lng },
          manual: false,
        }
      : null,
  );

  const notified = useRef(false);
  useEffect(() => {
    if (!initialError || notified.current) return;
    notified.current = true;
    toast.show(SEARCH_ERROR, "error");
  }, [initialError, toast]);

  if (!picked) {
    return (
      <PlaceSearch
        onPick={(p) =>
          setPicked({ placeId: p.placeId, name: p.name, location: { lat: p.lat, lng: p.lng }, manual: false })
        }
        onManual={() => setPicked({ placeId: null, name: "", location: null, manual: true })}
      />
    );
  }
  return <ShopForm picked={picked} onBack={() => setPicked(null)} />;
}

function ShopForm({ picked, onBack }: { picked: Picked; onBack: () => void }) {
  const [state, action, pending] = useActionState<NewShopState, FormData>(createShopAction, {});
  const categories = useCategories();
  const [name, setName] = useState(picked.name);
  const [genre, setGenre] = useState<ShopInput["genre"]>("unknown");
  const [styles, setStyles] = useState<ShopInput["styles"]>([]);
  const [location, setLocation] = useState<LatLng | null>(picked.location);
  const [mapFailed, setMapFailed] = useState(false);
  const onMapError = useCallback(() => setMapFailed(true), []);

  const blocked = pending || name.trim() === "" || (picked.manual && (mapFailed || !location));

  return (
    <form action={action} className="flex flex-col gap-4 p-4">
      <button type="button" onClick={onBack} className="self-start bg-transparent p-0 text-[13px] text-ai">
        ← 戻る
      </button>
      {state.error && (
        <p role="alert" className="m-0 rounded-[10px] bg-surface-2 p-3 text-[13px] text-shu">
          {state.error}
        </p>
      )}
      <input type="hidden" name="placeId" value={picked.placeId ?? ""} />
      <input type="hidden" name="lat" value={location?.lat ?? ""} />
      <input type="hidden" name="lng" value={location?.lng ?? ""} />

      {picked.manual ? (
        <LocationPicker value={location} onChange={setLocation} failed={mapFailed} onError={onMapError} />
      ) : (
        <p className="m-0 rounded-[10px] bg-surface-2 p-3 text-[13px] text-muted">Googleマップの店舗から選択済みです</p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="nm" className="text-[13px] font-bold text-muted">
          店名（必須）
        </label>
        <input
          id="nm"
          name="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">ジャンル</span>
        <ChipGroup name="genre" options={selectableOptions(categories.genres)} value={genre} onChange={setGenre} aria-label="ジャンル" />
        <span className="text-xs text-muted">選ばなければ「不明」になります。</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">店の形態（複数可）</span>
        <ChipGroup name="styles" multiple options={selectableOptions(categories.styles)} value={styles} onChange={setStyles} aria-label="店の形態" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="submit" name="mode" value="want" className="btn btn-primary" disabled={blocked}>
          気になるで登録
        </button>
        <button type="submit" name="mode" value="visit" className="btn btn-accent" disabled={blocked}>
          行った記録を付ける
        </button>
      </div>
      <p className="m-0 text-xs text-muted">「気になるで登録」は、自分の「気になる」リストにも追加します。</p>
    </form>
  );
}
