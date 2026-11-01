"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMap,
  type MapCameraChangedEvent,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { IKEBUKURO_STATION } from "@/lib/default-location";

export const MAP_ERROR_MESSAGE = "地図を読み込めませんでした";

export type MapShop = {
  id: string;
  lat: number;
  lng: number;
  visitCount: number;
};
export type LatLng = { lat: number; lng: number };
/** 地図を動かす先。同じ場所へもう一度動かせるよう、呼ぶたびに seq を変える。 */
export type MapFocus = LatLng & { seq: number };

// 飲食店のアイコンが十分に出る縮尺。15 だと Google が目立つ店しか出さない。
const DEFAULT_ZOOM = 17;
const FOCUS_ZOOM = 18;

function Pin({
  visitCount,
  selected,
}: {
  visitCount: number;
  selected: boolean;
}) {
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

/** 検索で選んだ、まだ登録されていない店の目印。 */
function SearchPin() {
  return (
    <span
      aria-hidden="true"
      className="block h-[22px] w-[22px] rounded-full border-[4px] border-shu bg-surface shadow-[0_2px_6px_rgba(0,0,0,.3)]"
    />
  );
}

/** 現在地の目印（青い点）。 */
function MyLocationDot() {
  return (
    <span
      aria-hidden="true"
      className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-[#1a73e8] shadow-[0_0_0_4px_rgba(26,115,232,.25)]"
    />
  );
}

function LocateButton({
  onLocate,
  locating,
}: {
  onLocate: () => void;
  locating: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="現在地"
      disabled={locating}
      onClick={onLocate}
      className="absolute bottom-2.5 right-2.5 z-[2] grid h-11 w-11 place-items-center rounded-full bg-surface text-ai shadow-[0_1px_4px_rgba(0,0,0,.2)] disabled:opacity-60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-6 w-6 ${locating ? "animate-pulse" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
      </svg>
    </button>
  );
}

function FocusController({ focus }: { focus?: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !focus) return;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    if ((map.getZoom() ?? 0) < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM);
  }, [map, focus]);
  return null;
}

/**
 * 絞り込み後の全店をピンで出す。ピンのタップは onSelectShop、Google の店舗アイコンのタップは
 * onSelectPlace（placeId）、地図の何もない所のタップは onDismiss で親に知らせる。
 * focus が変わるとそこへ地図を動かし、searchPin があればその位置に目印を出す。
 */
export function ShopMap({
  shops,
  selectedShopId,
  onSelectShop,
  onSelectPlace,
  onDismiss,
  focus,
  searchPin,
  onCenterChange,
  myLocation,
  onLocate,
  locating = false,
}: {
  shops: MapShop[];
  selectedShopId?: string | null;
  onSelectShop: (id: string) => void;
  onSelectPlace: (placeId: string) => void;
  onDismiss?: () => void;
  focus?: MapFocus | null;
  searchPin?: LatLng | null;
  onCenterChange?: (center: LatLng) => void;
  /** 取得済みの現在地。あれば青い点を出す。 */
  myLocation?: LatLng | null;
  /** 渡したときだけ「現在地」ボタンを出す（地図が読み込めないときは出さない）。 */
  onLocate?: () => void;
  locating?: boolean;
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
    <>
      <APIProvider apiKey={apiKey} language="ja" region="JP" onError={onError}>
        <Map
          mapId={mapId}
          defaultCenter={IKEBUKURO_STATION}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons
          onClick={click}
          onCameraChanged={(e: MapCameraChangedEvent) =>
            onCenterChange?.(e.detail.center)
          }
        >
          <FocusController focus={focus} />
          {myLocation && (
            <AdvancedMarker position={myLocation} zIndex={0}>
              <MyLocationDot />
            </AdvancedMarker>
          )}
          {searchPin && (
            <AdvancedMarker position={searchPin} zIndex={3}>
              <SearchPin />
            </AdvancedMarker>
          )}
          {shops.map((s) => (
            <AdvancedMarker
              key={s.id}
              position={{ lat: s.lat, lng: s.lng }}
              onClick={() => onSelectShop(s.id)}
              zIndex={s.id === selectedShopId ? 2 : 1}
            >
              <Pin
                visitCount={s.visitCount}
                selected={s.id === selectedShopId}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
      {onLocate && <LocateButton onLocate={onLocate} locating={locating} />}
    </>
  );
}
