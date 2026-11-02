"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { MapScreen, type MapScreenShop } from "./map-screen";

/**
 * 地図画面を、一度開いたら閉じずに（ほかの画面では隠して）持ち続ける。
 * Google の地図は作るたびに 1 回の「地図の読み込み」として数えられ料金の対象になるので、
 * 画面を行き来するたびに作り直さない。位置・拡大率・開いている店のカードもそのまま残る。
 * 地図ページ（/map）は店の一覧を渡すだけで、表示はアプリ全体のレイアウトに置いたこの部品が行う。
 */
type HostState = { shops: MapScreenShop[] | null; active: boolean };
const Ctx = createContext<((s: Partial<HostState>) => void) | null>(null);
const StateCtx = createContext<HostState>({ shops: null, active: false });

export function MapHostProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HostState>({ shops: null, active: false });
  const update = useCallback((s: Partial<HostState>) => setState((prev) => ({ ...prev, ...s })), []);
  return (
    <Ctx.Provider value={update}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </Ctx.Provider>
  );
}

/** 地図ページが表示されている間、店の一覧を渡して地図を見せる。 */
export function MapScreenBridge({ shops }: { shops: MapScreenShop[] }) {
  const set = useContext(Ctx);
  useLayoutEffect(() => {
    set?.({ shops, active: true });
  }, [set, shops]);
  useLayoutEffect(() => () => set?.({ active: false }), [set]);
  return null;
}

/** レイアウトに置く地図の本体。まだ一度も地図ページを開いていなければ何も作らない。 */
export function MapHost() {
  const { shops, active } = useContext(StateCtx);
  if (!shops) return null;
  return (
    <div data-testid="map-host" hidden={!active} className={active ? "relative flex flex-1 flex-col" : undefined}>
      <MapScreen shops={shops} />
    </div>
  );
}
