"use client";

import { useCallback, useEffect, useState } from "react";
import { AdvancedMarker, APIProvider, Map, type MapMouseEvent } from "@vis.gl/react-google-maps";
import { IKEBUKURO_STATION } from "@/lib/default-location";

export const MAP_ERROR_MESSAGE = "地図を読み込めませんでした";

export type MapShop = { id: string; lat: number; lng: number; visitCount: number };

function Pin({ visitCount, selected }: { visitCount: number; selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[30px] w-[30px] -rotate-45 rounded-[50%_50%_50%_0] border-[3px] border-surface shadow-[0_2px_6px_rgba(0,0,0,.25)] ${
        visitCount > 0 ? "bg-shu" : "bg-ai"
      } ${selected ? "scale-125" : ""}`}
    >
      <i className="block rotate-45 text-center text-xs font-bold not-italic leading-6 text-white">
        {visitCount > 0 ? visitCount : "?"}
      </i>
    </span>
  );
}

/**
 * 絞り込み後の全店をピンで出す。ピンのタップは onSelectShop、Google の店舗アイコンのタップは
 * onSelectPlace（placeId）、地図の何もない所のタップは onDismiss で親に知らせる。
 */
export function ShopMap({
  shops,
  selectedShopId,
  onSelectShop,
  onSelectPlace,
  onDismiss,
}: {
  shops: MapShop[];
  selectedShopId?: string | null;
  onSelectShop: (id: string) => void;
  onSelectPlace: (placeId: string) => void;
  onDismiss?: () => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = onError;
    return () => {
      w.gm_authFailure = prev;
    };
  }, [onError]);

  if (!apiKey || failed) {
    return (
      <div className="grid h-full place-items-center bg-surface-2 p-6">
        <p role="alert" className="m-0 text-[13px] text-shu">
          {MAP_ERROR_MESSAGE}
        </p>
      </div>
    );
  }

  const click = (e: MapMouseEvent) => {
    const placeId = e.detail.placeId;
    if (placeId) {
      // Google 標準の情報ウィンドウは出さず、自前のカードを出す。
      e.stop();
      onSelectPlace(placeId);
    } else {
      onDismiss?.();
    }
  };

  return (
    <APIProvider apiKey={apiKey} language="ja" region="JP" onError={onError}>
      <Map
        mapId={mapId}
        defaultCenter={IKEBUKURO_STATION}
        defaultZoom={15}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons
        onClick={click}
      >
        {shops.map((s) => (
          <AdvancedMarker
            key={s.id}
            position={{ lat: s.lat, lng: s.lng }}
            onClick={() => onSelectShop(s.id)}
            zIndex={s.id === selectedShopId ? 2 : 1}
          >
            <Pin visitCount={s.visitCount} selected={s.id === selectedShopId} />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
