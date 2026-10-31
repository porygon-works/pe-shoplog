"use client";

import { useEffect } from "react";
import { AdvancedMarker, APIProvider, Map, type MapMouseEvent } from "@vis.gl/react-google-maps";

export type LatLng = { lat: number; lng: number };

const TOKYO: LatLng = { lat: 35.681236, lng: 139.767125 };
export const MAP_ERROR_MESSAGE = "地図を読み込めませんでした";

/** 手入力の店の位置を、地図をタップして決める。読み込めなければ onError で親に知らせる。 */
export function LocationPicker({
  value,
  onChange,
  failed,
  onError,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  failed: boolean;
  onError: () => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

  useEffect(() => {
    if (!apiKey) onError();
  }, [apiKey, onError]);

  // 認証エラーなどで Google 側が読み込みを拒否した場合に呼ばれる。
  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => onError();
    return () => {
      w.gm_authFailure = prev;
    };
  }, [onError]);

  if (!apiKey || failed) {
    return (
      <p role="alert" className="notice m-0 rounded-[10px] bg-surface-2 p-3 text-[13px] text-shu">
        {MAP_ERROR_MESSAGE}
      </p>
    );
  }

  const tap = (e: MapMouseEvent) => {
    const ll = e.detail.latLng;
    if (ll) onChange({ lat: ll.lat, lng: ll.lng });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="h-64 overflow-hidden rounded-[10px] border border-line" data-testid="location-picker">
        <APIProvider apiKey={apiKey} language="ja" region="JP" onError={onError}>
          <Map
            mapId={mapId}
            defaultCenter={value ?? TOKYO}
            defaultZoom={15}
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
            onClick={tap}
          >
            {value && <AdvancedMarker position={value} />}
          </Map>
        </APIProvider>
      </div>
      <span className="text-xs text-muted">
        {value ? "ピンの位置で登録します。タップで動かせます。" : "地図をタップして、お店の場所を指定してください。"}
      </span>
    </div>
  );
}
