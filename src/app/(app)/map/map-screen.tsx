"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ShopFilterBar } from "@/components/shop-filter-sheet";
import { ShopMap, type LatLng, type MapFocus } from "@/components/shop-map";
import { ShopPills, ShopThumb, shopMeta, type ShopCardData } from "@/components/shop-card";
import { IKEBUKURO_STATION } from "@/lib/default-location";
import type { PickedPlace } from "@/lib/places/use-place-autocomplete";
import { MapPlaceSearch } from "./map-place-search";
import { PlaceSheet } from "./place-sheet";

export type MapScreenShop = ShopCardData & { lat: number; lng: number; placeId: string | null };

type Selection =
  | { type: "shop"; id: string }
  // place は検索から来たときだけ名前と位置がわかっている。地図のアイコンからは placeId だけ。
  | { type: "place"; placeId: string; place?: PickedPlace; fromSearch?: boolean }
  | null;

export function MapScreen({ shops }: { shops: MapScreenShop[] }) {
  const [sel, setSel] = useState<Selection>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const center = useRef<LatLng>(IKEBUKURO_STATION);
  const getCenter = useCallback(() => center.current, []);
  const onCenterChange = useCallback((c: LatLng) => {
    center.current = c;
  }, []);

  const registeredOf = (placeId: string) => shops.find((s) => s.placeId === placeId);

  const selectPlace = (placeId: string) => {
    // 登録済みの店の place_id なら、その店のカードを出す。
    const registered = registeredOf(placeId);
    setSel(registered ? { type: "shop", id: registered.id } : { type: "place", placeId });
  };
  const pickFromSearch = (p: PickedPlace) => {
    const registered = registeredOf(p.placeId);
    setSel(
      registered
        ? { type: "shop", id: registered.id }
        : { type: "place", placeId: p.placeId, place: p, fromSearch: true },
    );
    setFocus((f) => ({ lat: p.lat, lng: p.lng, seq: (f?.seq ?? 0) + 1 }));
  };
  const shop = sel?.type === "shop" ? shops.find((s) => s.id === sel.id) : undefined;
  const close = () => setSel(null);
  const searchPin = sel?.type === "place" && sel.fromSearch && sel.place ? sel.place : null;
  // 絞り込みで選択中の店が一覧から消えたら、選択を外す（凡例を戻す）。
  const gone = sel?.type === "shop" && !shop;
  if (gone) setSel(null);

  return (
    <div className="relative flex-1">
      <div className="absolute inset-0">
        <ShopMap
          shops={shops}
          selectedShopId={shop?.id}
          onSelectShop={(id) => setSel({ type: "shop", id })}
          onSelectPlace={selectPlace}
          onDismiss={close}
          focus={focus}
          searchPin={searchPin}
          onCenterChange={onCenterChange}
        />
      </div>

      <div className="absolute left-2.5 right-2.5 top-2.5 z-[3] flex flex-col gap-2">
        <MapPlaceSearch getBias={getCenter} onPick={pickFromSearch} />
        <ShopFilterBar />
      </div>

      {!sel && (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[2] flex gap-2.5 rounded-[10px] bg-surface px-2.5 py-1.5 text-[11px] text-muted shadow-[0_1px_4px_rgba(0,0,0,.12)]">
          <span>
            <i className="mr-1 inline-block h-[9px] w-[9px] rounded-full bg-shu align-middle" />
            記録あり（数字は件数）
          </span>
          <span>
            <i className="mr-1 inline-block h-[9px] w-[9px] rounded-full bg-ai align-middle" />
            気になる
          </span>
        </div>
      )}

      {shop && (
        <div
          data-testid="shop-sheet"
          className="absolute bottom-2.5 left-2.5 right-2.5 z-[4] flex flex-col gap-2.5 rounded-2xl bg-surface p-3.5 shadow-[0_6px_24px_rgba(0,0,0,.2)] motion-safe:animate-[sheet-up_.18s_ease-out]"
        >
          <div className="flex gap-3">
            <ShopThumb url={shop.thumbUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="font-bold">{shop.name}</div>
              <div className="text-xs text-muted">{shopMeta(shop)}</div>
              <ShopPills shop={shop} />
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/shops/${shop.id}`} className="btn btn-primary flex-1 !py-2 text-[13px]">
              詳しく見る
            </Link>
            <button type="button" className="btn !py-2 text-[13px]" onClick={close}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {sel?.type === "place" && (
        <PlaceSheet key={sel.placeId} placeId={sel.placeId} place={sel.place} onClose={close} />
      )}
    </div>
  );
}
