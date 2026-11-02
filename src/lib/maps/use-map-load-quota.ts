"use client";

import { useEffect, useState } from "react";

export type MapLoadQuota = "checking" | "ok" | "limit" | "error";
export const MAP_LIMIT_MESSAGE = "今月の地図の表示回数の上限に達しました";

/**
 * 地図を表示する前に、表示回数を 1 回分数えてもらう（料金が発生しないよう上限で止めるため）。
 * enabled が false のとき（地図キーがないなど）は数えない。数えられなかったときも地図は出さない。
 */
export function useMapLoadQuota(enabled: boolean): MapLoadQuota {
  const [state, setState] = useState<MapLoadQuota>("checking");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch("/api/maps/load", { method: "POST" })
      .then((r) => alive && setState(r.ok ? "ok" : r.status === 429 ? "limit" : "error"))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return state;
}
